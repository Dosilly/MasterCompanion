namespace MasterCompanion.Engine.Features.Sessions;

public sealed record StartSessionOperation(Guid SessionId) : SessionOperation(SessionId);
