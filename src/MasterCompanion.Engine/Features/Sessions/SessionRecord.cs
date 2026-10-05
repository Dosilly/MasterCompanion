namespace MasterCompanion.Engine.Features.Sessions;

public sealed record SessionRecord(Guid Id, string Title, string Status, string PreparationMaterialId,
    string NotesMaterialId, string Summary, string FollowUp, IReadOnlyList<string> PinnedMaterialIds);
