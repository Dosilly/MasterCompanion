using MasterCompanion.Engine.Persistence;

namespace MasterCompanion.Engine.Features.Folders;

internal static class MaterialOrdering
{
    internal static string? Apply(IReadOnlyList<Material> materials, ReorderMaterialOperation operation)
    {
        var material = materials.SingleOrDefault(item => item.Id == operation.MaterialId);
        if (material is null)
        {
            return "material_not_found";
        }
        if (material.FolderId != operation.FolderId)
        {
            return "material_folder_conflict";
        }
        return Place(materials, material, operation.FolderId, operation.BeforeId);
    }

    internal static string? Place(IReadOnlyList<Material> materials, Material material, string? folderId, string? beforeId)
    {
        var siblings = materials.Where(item => item.FolderId == folderId && item.Id != material.Id)
            .OrderBy(item => item.SortOrder).ThenBy(item => item.Id, StringComparer.Ordinal).ToList();
        var position = beforeId is null ? siblings.Count : siblings.FindIndex(item => item.Id == beforeId);
        if (position < 0 || beforeId == material.Id)
        {
            return "material_order_target_invalid";
        }
        if (material.FolderId != folderId)
        {
            var previousSiblings = materials.Where(item => item.FolderId == material.FolderId && item.Id != material.Id)
                .OrderBy(item => item.SortOrder).ThenBy(item => item.Id, StringComparer.Ordinal).ToList();
            for (var index = 0; index < previousSiblings.Count; index++)
            {
                previousSiblings[index].SortOrder = index;
            }
        }
        material.FolderId = folderId;
        siblings.Insert(position, material);
        for (var index = 0; index < siblings.Count; index++)
        {
            siblings[index].SortOrder = index;
        }
        return null;
    }
}
