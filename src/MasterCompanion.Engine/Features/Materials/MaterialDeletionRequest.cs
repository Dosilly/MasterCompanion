namespace MasterCompanion.Engine.Features.Materials;

public sealed record MaterialDeletionRequest(Guid RequestId, long ExpectedRevision, string ReferencesToken);
