using MasterCompanion.Engine.Persistence;

namespace MasterCompanion.Engine.Features.Folders;

public sealed record FolderSnapshot(long Revision, IReadOnlyList<FolderSummary> Folders)
{
    internal static FolderSnapshot From(long revision, IEnumerable<CampaignFolder> folders)
    {
        ValidateRevision(revision);
        return new(revision, folders.OrderBy(folder => folder.SortOrder).ThenBy(folder => folder.Id, StringComparer.Ordinal)
            .Select(folder => new FolderSummary(folder.Id, folder.Title, folder.ParentId)).ToArray());
    }

    internal static void ValidateRevision(long revision)
    {
        if (revision is < 0 or > FolderRequestDecoder.MaxRevision)
        {
            throw new InvalidOperationException("The saved folder revision is invalid.");
        }
    }
}
