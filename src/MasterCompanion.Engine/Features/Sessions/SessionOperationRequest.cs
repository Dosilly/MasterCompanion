namespace MasterCompanion.Engine.Features.Sessions;

public sealed record SessionOperationRequest(Guid RequestId, long ExpectedRevision, SessionOperation Operation);
