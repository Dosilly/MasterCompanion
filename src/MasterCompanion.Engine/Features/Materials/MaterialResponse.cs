using System.Text.Json;

namespace MasterCompanion.Engine.Features.Materials;

public sealed record MaterialResponse(string Id, string Title, string Group, JsonElement Document,
    int DocumentSchemaVersion, long Revision, string? FolderId);
