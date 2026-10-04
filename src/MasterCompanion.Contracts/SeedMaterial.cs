using System.Text.Json;

namespace MasterCompanion.Contracts;

public sealed record SeedMaterial(string Id, string Title, string Group, JsonElement Document, int SortOrder,
    string? FolderId);
