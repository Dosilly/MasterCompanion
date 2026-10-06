using MasterCompanion.Engine.Persistence;

namespace MasterCompanion.Engine.Features.Folders;

internal static class MaterialMoving
{
    internal static string? Apply(IReadOnlyList<Material> materials, IReadOnlyList<CampaignFolder> folders,
        MoveMaterialOperation operation)
    {
        var material = materials.SingleOrDefault(item => item.Id == operation.MaterialId);
        if (material is null)
        {
            return "material_not_found";
        }
        if (operation.FolderId is not null && !folders.Any(item => item.Id == operation.FolderId))
        {
            return "folder_target_not_found";
        }
        return MaterialOrdering.Place(materials, material, operation.FolderId, operation.BeforeId);
    }
}
