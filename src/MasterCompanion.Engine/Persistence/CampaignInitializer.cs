using MasterCompanion.Contracts;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Engine.Persistence;

public static class CampaignInitializer
{
    public static async Task ApplyAsync(AppDbContext db, IEnumerable<ICampaignModule> modules,
        CancellationToken cancellationToken = default)
    {
        var registeredModules = modules.ToList();
        var existing = await db.Campaigns.SingleOrDefaultAsync(cancellationToken);
        if (existing is not null)
        {
            // One-time upgrade from the initial flat navigation. Never replace user documents.
            if (!await db.Folders.AnyAsync(x => x.CampaignId == existing.Id, cancellationToken))
            {
                var existingModule = registeredModules.Single(x => x.Manifest.Id == existing.ModuleId);
                var folders = await existingModule.LoadFoldersAsync(cancellationToken);
                var seeds = await existingModule.LoadMaterialsAsync(cancellationToken);
                ValidateFolders(folders, seeds);
                db.Folders.AddRange(folders.Select(folder => CreateFolder(existing.Id, folder)));
                var existingMaterials = await db.Materials.Where(x => x.CampaignId == existing.Id).ToListAsync(cancellationToken);
                var folderIds = seeds.ToDictionary(x => x.Id, x => x.FolderId);
                foreach (var material in existingMaterials)
                    if (folderIds.TryGetValue(material.Id, out var folderId)) material.FolderId = folderId;
                await db.SaveChangesAsync(cancellationToken);
            }
            return;
        }
        var module = registeredModules.Single();
        if (module.Manifest.ContentSchemaVersion != 1)
            throw new NotSupportedException("The module material schema version is not supported.");

        var campaign = new Campaign
        {
            Id = Guid.NewGuid(), Title = module.Manifest.Name,
            ModuleId = module.Manifest.Id, ModuleVersion = module.Manifest.Version
        };
        var materials = await module.LoadMaterialsAsync(cancellationToken);
        var seedFolders = await module.LoadFoldersAsync(cancellationToken);
        ValidateFolders(seedFolders, materials);
        if (!materials.Any(item => item.Id == module.Manifest.StartMaterialId))
            throw new InvalidOperationException("The module start material does not exist.");
        var maps = await module.LoadMapsAsync(cancellationToken);
        db.Campaigns.Add(campaign);
        db.Folders.AddRange(seedFolders.Select(folder => CreateFolder(campaign.Id, folder)));
        db.Materials.AddRange(materials.Select(item => new Material
        {
            Id = item.Id, CampaignId = campaign.Id, Title = item.Title, Group = item.Group,
            DocumentJson = item.Document.GetRawText(), SortOrder = item.SortOrder, FolderId = item.FolderId
        }));
        db.Maps.AddRange(maps.Select(item => new CampaignMap
        {
            Id = item.Id, CampaignId = campaign.Id, DefinitionJson = item.Definition.GetRawText()
        }));
        await db.SaveChangesAsync(cancellationToken);
    }

    private static CampaignFolder CreateFolder(Guid campaignId, SeedFolder folder) => new()
    {
        Id = folder.Id, CampaignId = campaignId, Title = folder.Title,
        ParentId = folder.ParentId, SortOrder = folder.SortOrder
    };

    private static void ValidateFolders(IReadOnlyList<SeedFolder> folders, IReadOnlyList<SeedMaterial> materials)
    {
        var byId = folders.ToDictionary(x => x.Id);
        foreach (var folder in folders)
        {
            var visited = new HashSet<string> { folder.Id };
            var parentId = folder.ParentId;
            while (parentId is not null)
            {
                if (!visited.Add(parentId) || !byId.TryGetValue(parentId, out var parent))
                    throw new InvalidOperationException("The module folder hierarchy contains a cycle or a missing parent.");
                parentId = parent.ParentId;
            }
        }
        if (materials.Any(x => x.FolderId is not null && !byId.ContainsKey(x.FolderId)))
            throw new InvalidOperationException("A module material references a folder that does not exist.");
    }
}
