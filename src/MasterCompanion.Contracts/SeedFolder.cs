namespace MasterCompanion.Contracts;

public sealed record SeedFolder(string Id, string Title, string? ParentId, int SortOrder);
