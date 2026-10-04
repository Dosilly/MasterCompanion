namespace MasterCompanion.Engine.Features.Folders;

public sealed record RenameFolderOperation(string FolderId, string Title) : FolderOperation(FolderId);
