using System.Text.Json;

namespace MasterCompanion.Contracts;

public sealed record ModuleTransition(JsonElement State, string? ErrorCode = null);
