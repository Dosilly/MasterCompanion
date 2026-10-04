using System.Text.Json;

namespace MasterCompanion.Contracts;

public sealed record SeedMap(string Id, JsonElement Definition);
