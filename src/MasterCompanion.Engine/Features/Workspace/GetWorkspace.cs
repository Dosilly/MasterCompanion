using MasterCompanion.Engine.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using MasterCompanion.Contracts;
using System.Data;
using MasterCompanion.Engine.Features.Folders;

namespace MasterCompanion.Engine.Features.Workspace;

public static class GetWorkspace
{
    public static void Map(IEndpointRouteBuilder endpoints) =>
        endpoints.MapGet("/api/workspace", async (AppDbContext db, IEnumerable<ICampaignModule> modules,
            CancellationToken token) =>
        {
            // Folder metadata and its revision must describe the same committed snapshot.
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, token);
            var campaign = await db.Campaigns.AsNoTracking().SingleAsync(token);
            var maps = await db.Maps.AsNoTracking().Where(x => x.CampaignId == campaign.Id)
                .Select(x => x.DefinitionJson).ToListAsync(token);
            var folders = await db.Folders.AsNoTracking().Where(x => x.CampaignId == campaign.Id).ToListAsync(token);
            return Results.Ok(new
            {
                campaignId = campaign.Id,
                title = campaign.Title,
                moduleId = campaign.ModuleId,
                moduleVersion = campaign.ModuleVersion,
                foldersRevision = campaign.FoldersRevision,
                startMaterialId = modules.Single(x => x.Manifest.Id == campaign.ModuleId).Manifest.StartMaterialId,
                maps = maps.Select(x => JsonSerializer.Deserialize<JsonElement>(x)),
                folders = FolderSnapshot.From(campaign.FoldersRevision, folders, []).Folders,
                materials = await db.Materials.AsNoTracking().OrderBy(x => x.SortOrder).ThenBy(x => x.Id)
                    .Where(x => x.CampaignId == campaign.Id)
                    .Select(x => new { x.Id, x.Title, x.Group, x.FolderId }).ToListAsync(token)
            });
        });
}
