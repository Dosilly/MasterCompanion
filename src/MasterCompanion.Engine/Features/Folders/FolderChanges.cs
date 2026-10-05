using MasterCompanion.Engine.Persistence;

namespace MasterCompanion.Engine.Features.Folders;

internal static class FolderChanges
{
    internal static string? Apply(IReadOnlyList<CampaignFolder> folders, FolderOperation operation)
    {
        var folderId = operation switch
        {
            RenameFolderOperation renamed => renamed.FolderId,
            MoveFolderOperation moved => moved.FolderId,
            _ => throw new InvalidOperationException("The folder operation kind is unsupported.")
        };
        var folder = folders.SingleOrDefault(item => item.Id == folderId);
        if (folder is null)
        {
            return "folder_not_found";
        }
        if (operation is RenameFolderOperation rename)
        {
            folder.Title = rename.Title.Trim();
            return null;
        }
        if (operation is not MoveFolderOperation move)
        {
            throw new InvalidOperationException("The folder operation kind is unsupported.");
        }

        var byId = folders.ToDictionary(item => item.Id, StringComparer.Ordinal);
        if (move.ParentId is not null && !byId.ContainsKey(move.ParentId))
        {
            return "folder_parent_not_found";
        }
        var visited = new HashSet<string>(StringComparer.Ordinal) { folder.Id };
        var ancestorId = move.ParentId;
        while (ancestorId is not null)
        {
            if (!visited.Add(ancestorId))
            {
                return "folder_cycle";
            }
            if (!byId.TryGetValue(ancestorId, out var ancestor))
            {
                throw new InvalidOperationException("The saved folder hierarchy has a missing parent.");
            }
            ancestorId = ancestor.ParentId;
        }
        if (move.BeforeId is not null && (move.BeforeId == folder.Id ||
            !byId.TryGetValue(move.BeforeId, out var target) || target.ParentId != move.ParentId))
        {
            return "folder_target_not_found";
        }

        var sourceParentId = folder.ParentId;
        var destination = Siblings(folders, move.ParentId, folder.Id);
        var insertion = move.BeforeId is null ? destination.Count : destination.FindIndex(item => item.Id == move.BeforeId);
        destination.Insert(insertion, folder);
        folder.ParentId = move.ParentId;
        SetOrder(destination);
        if (sourceParentId != move.ParentId)
        {
            SetOrder(Siblings(folders, sourceParentId, folder.Id));
        }
        return null;
    }

    private static List<CampaignFolder> Siblings(IEnumerable<CampaignFolder> folders, string? parentId, string excludedId) =>
        folders.Where(item => item.ParentId == parentId && item.Id != excludedId)
            .OrderBy(item => item.SortOrder).ThenBy(item => item.Id, StringComparer.Ordinal).ToList();

    private static void SetOrder(IReadOnlyList<CampaignFolder> folders)
    {
        for (var index = 0; index < folders.Count; index++)
        {
            folders[index].SortOrder = index;
        }
    }
}
