using System.Text.Json;

namespace MasterCompanion.Modules.Ythryn.Gameplay;

internal static class BlightJsonFields
{
    internal static bool HasExactProperties(JsonElement element, params string[] names)
    {
        if (element.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        var expected = names.ToHashSet(StringComparer.Ordinal);
        foreach (var property in element.EnumerateObject())
        {
            if (!expected.Remove(property.Name))
            {
                return false;
            }
        }
        return expected.Count == 0;
    }

}
