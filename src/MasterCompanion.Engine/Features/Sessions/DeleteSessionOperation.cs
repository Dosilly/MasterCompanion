namespace MasterCompanion.Engine.Features.Sessions;

public sealed record DeleteSessionOperation(Guid SessionId) : SessionOperation(SessionId);
