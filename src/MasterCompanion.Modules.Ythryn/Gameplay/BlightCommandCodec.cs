using System.Text.Json;

using static MasterCompanion.Modules.Ythryn.Gameplay.BlightJsonFields;

namespace MasterCompanion.Modules.Ythryn.Gameplay;

internal static class BlightCommandCodec
{
    internal static bool TryReadCommand(JsonElement element, out BlightCommand command)
    {
        command = new BlightCommand("", Guid.Empty, null, null);
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty("kind", out var kindValue) ||
            kindValue.ValueKind != JsonValueKind.String || !element.TryGetProperty("characterId", out var idValue) ||
            idValue.ValueKind != JsonValueKind.String || !idValue.TryGetGuid(out var id) || id == Guid.Empty)
        {
            return false;
        }

        var kind = kindValue.GetString();
        if (kind == "healCharacter" && HasExactProperties(element, "kind", "characterId"))
        {
            command = new BlightCommand(kind, id, null, null);
            return true;
        }
        if (kind != "resolveCheck" || !element.TryGetProperty("success", out var successValue) ||
            successValue.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
        {
            return false;
        }

        int? d6 = null;
        if (element.TryGetProperty("d6", out var die))
        {
            if (!HasExactProperties(element, "kind", "characterId", "success", "d6") ||
                die.ValueKind != JsonValueKind.Number || !die.TryGetInt32(out var result) || result is < 1 or > 6)
            {
                return false;
            }

            d6 = result;
        }
        else if (!HasExactProperties(element, "kind", "characterId", "success"))
        {
            return false;
        }

        command = new BlightCommand(kind, id, successValue.GetBoolean(), d6);
        return true;
    }

}
