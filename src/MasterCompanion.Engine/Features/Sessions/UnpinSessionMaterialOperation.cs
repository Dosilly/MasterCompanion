namespace MasterCompanion.Engine.Features.Sessions;

public sealed record UnpinSessionMaterialOperation(Guid SessionId, string MaterialId) : SessionOperation(SessionId);
