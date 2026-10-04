using System.Text;
using System.Text.Json;

namespace MasterCompanion.Engine.Features.Materials;

internal static class MaterialSearchText
{
    internal static string Extract(string documentJson, int schemaVersion, CancellationToken token)
    {
        if (schemaVersion != 1)
        {
            throw new InvalidOperationException("The material uses an unsupported document schema.");
        }

        using var document = JsonDocument.Parse(documentJson, new JsonDocumentOptions { MaxDepth = 128 });
        if (!MaterialDocumentSchema.IsValid(document.RootElement))
        {
            throw new InvalidOperationException("The persisted material document does not match the supported schema.");
        }

        var text = new StringBuilder();
        Append(document.RootElement, text, token);
        return Normalize(text.ToString());
    }

    internal static string Normalize(string text) => string.Join(' ',
        text.Normalize(NormalizationForm.FormC).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    private static void Append(JsonElement node, StringBuilder text, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        var type = node.GetProperty("type").GetString();
        if (type == "text")
        {
            text.Append(node.GetProperty("text").GetString());
            return;
        }

        if (type == "hardBreak")
        {
            text.Append(' ');
            return;
        }

        if (node.TryGetProperty("content", out var children))
        {
            foreach (var child in children.EnumerateArray())
            {
                Append(child, text, token);
            }
        }

        // Inline text and marks preserve words; distinct blocks and cells separate them.
        text.Append(' ');
    }
}
