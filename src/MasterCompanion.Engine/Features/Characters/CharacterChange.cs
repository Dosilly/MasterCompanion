namespace MasterCompanion.Engine.Features.Characters;

public sealed record CharacterChange(Guid Id, string Name, string Kind, bool InParty,
    string BackstoryTitle, string NotesTitle);
