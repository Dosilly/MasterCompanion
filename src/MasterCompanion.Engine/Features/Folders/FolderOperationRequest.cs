namespace MasterCompanion.Engine.Features.Folders;

public sealed record FolderOperationRequest(Guid RequestId, long ExpectedRevision, FolderOperation Operation);
