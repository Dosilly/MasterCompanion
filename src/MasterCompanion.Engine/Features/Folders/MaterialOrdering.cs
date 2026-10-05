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
        var siblings = materials.Where(item => item.FolderId == material.FolderId && item.Id != material.Id)
            .OrderBy(item => item.SortOrder).ThenBy(item => item.Id, StringComparer.Ordinal).ToList();
        var position = operation.BeforeId is null ? siblings.Count : siblings.FindIndex(item => item.Id == operation.BeforeId);
        if (position < 0 || operation.BeforeId == material.Id)
        {
            return "material_order_target_invalid";
        }
        siblings.Insert(position, material);
        for (var index = 0; index < siblings.Count; index++)
        {
            siblings[index].SortOrder = index;
        }
        return null;
    }
}
