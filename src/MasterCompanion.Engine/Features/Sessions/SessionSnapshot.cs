using System.Text.Json;
using MasterCompanion.Engine.Persistence;

namespace MasterCompanion.Engine.Features.Sessions;

public sealed record SessionSnapshot(long Revision, IReadOnlyList<SessionRecord> Sessions)
{
    internal static SessionSnapshot From(long revision, IEnumerable<CampaignSession> sessions) => new(revision,
        sessions.OrderBy(item => item.Sequence).Select(item => new SessionRecord(item.Id, item.Title, item.Status,
            item.PreparationMaterialId, item.NotesMaterialId, item.Summary, item.FollowUp,
            JsonSerializer.Deserialize<string[]>(item.PinnedMaterialIdsJson)
                ?? throw new InvalidOperationException("The saved session pins are invalid."))).ToArray());
}
