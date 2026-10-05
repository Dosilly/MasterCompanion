namespace MasterCompanion.Engine.Features.Sessions;

public sealed record CompleteSessionOperation(Guid SessionId) : SessionOperation(SessionId);
