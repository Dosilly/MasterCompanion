namespace MasterCompanion.Engine.Features.Folders;

public sealed record MoveFolderOperation(string FolderId, string? ParentId, string? BeforeId) : FolderOperation(FolderId);
