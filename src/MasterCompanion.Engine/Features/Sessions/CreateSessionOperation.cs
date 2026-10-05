namespace MasterCompanion.Engine.Features.Sessions;

public sealed record CreateSessionOperation(Guid SessionId, string Title,
    string PreparationTitle, string NotesTitle) : SessionOperation(SessionId);
