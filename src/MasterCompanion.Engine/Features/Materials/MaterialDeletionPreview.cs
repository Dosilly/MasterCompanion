namespace MasterCompanion.Engine.Features.Materials;

public sealed record MaterialDeletionPreview(string Id, string Title, long Revision, string ReferencesToken,
    IReadOnlyList<string> DocumentLinks, IReadOnlyList<string> MapMarkers,
    IReadOnlyList<string> PinnedSessions, IReadOnlyList<string> OwningSessions,
    IReadOnlyList<string> OwningCharacters);
