namespace MasterCompanion.Engine.Features.Folders;

public sealed record MoveMaterialOperation(string MaterialId, string? FolderId, string? BeforeId) : FolderOperation;
