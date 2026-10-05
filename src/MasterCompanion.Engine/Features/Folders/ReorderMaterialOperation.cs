namespace MasterCompanion.Engine.Features.Folders;

public sealed record ReorderMaterialOperation(string MaterialId, string? FolderId, string? BeforeId) : FolderOperation;
