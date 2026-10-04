using System.Text.Json;

namespace MasterCompanion.Modules.Ythryn.Gameplay;

internal static class ForceLossCommandCodec
{
    internal static bool Handles(JsonElement command) => command.ValueKind == JsonValueKind.Object &&
        command.TryGetProperty("kind", out var kind) && kind.ValueKind == JsonValueKind.String &&
        kind.GetString() == "recordForceLoss";

    internal static ForceLossCommand? Read(JsonElement command)
    {
        if (!Handles(command))
        {
            return null;
        }
        var fields = new HashSet<string>(["kind", "unit", "count"], StringComparer.Ordinal);
        foreach (var property in command.EnumerateObject())
        {
            if (!fields.Remove(property.Name))
            {
                return null;
            }
        }
        if (fields.Count != 0 || command.GetProperty("unit").ValueKind != JsonValueKind.String ||
            command.GetProperty("count").ValueKind != JsonValueKind.Number ||
            !command.GetProperty("count").TryGetInt32(out var count) || count < 1 ||
            command.GetProperty("unit").GetString() is not { } unit)
        {
            return null;
        }
        return new(unit, count);
    }
}
