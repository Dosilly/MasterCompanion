namespace MasterCompanion.Engine.Features.Sessions;

public sealed record PinSessionMaterialOperation(Guid SessionId, string MaterialId) : SessionOperation(SessionId);
