using System.Text.Json;

namespace MasterCompanion.Engine.Features.Materials;

/// <summary>Validates the supported editor schema before a campaign document is persisted.</summary>
internal static class MaterialDocumentSchema
{
    private const int MaxDepth = 32;
    private const int MaxNodes = 20_000;

    internal static bool IsValid(JsonElement document)
    {
        var remaining = MaxNodes;
        return Type(document) == "doc" && ValidateNode(document, 0, ref remaining);
    }

    private static bool ValidateNode(JsonElement node, int depth, ref int remaining)
    {
        if (depth > MaxDepth || --remaining < 0 || node.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        var type = Type(node);
        foreach (var property in node.EnumerateObject())
        {
            if (property.Name is not ("type" or "attrs" or "content" or "marks" or "text"))
            {
                return false;
            }
        }
        if (node.TryGetProperty("attrs", out var attrs) && !MaterialDocumentAttributes.IsValid(type, attrs))
        {
            return false;
        }

        if (node.TryGetProperty("text", out var text) &&
            (type != "text" || text.ValueKind != JsonValueKind.String || string.IsNullOrEmpty(text.GetString())))
        {
            return false;
        }

        if (type == "text" && !node.TryGetProperty("text", out _))
        {
            return false;
        }

        if (type == "image" && !node.TryGetProperty("attrs", out _))
        {
            return false;
        }

        if (node.TryGetProperty("marks", out var marks))
        {
            if (type is not ("text" or "hardBreak") || marks.ValueKind != JsonValueKind.Array || marks.GetArrayLength() > 6)
            {
                return false;
            }

            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var mark in marks.EnumerateArray())
            {
                if (!MaterialDocumentAttributes.IsValidMark(mark) || !seen.Add(Type(mark)))
                {
                    return false;
                }
            }
        }
        var children = Array.Empty<JsonElement>();
        if (node.TryGetProperty("content", out var content))
        {
            if (content.ValueKind != JsonValueKind.Array || content.GetArrayLength() > remaining)
            {
                return false;
            }

            children = content.EnumerateArray().ToArray();
        }
        if (!ValidChildren(type, children))
        {
            return false;
        }

        foreach (var child in children)
        {
            if (!ValidateNode(child, depth + 1, ref remaining))
            {
                return false;
            }
        }
        return true;
    }

    private static bool ValidChildren(string type, JsonElement[] children) => type switch
    {
        "doc" or "blockquote" or "tableCell" or "tableHeader" or "detailsContent" =>
            children.Length > 0 && children.All(child => IsBlock(Type(child))),
        "paragraph" or "heading" or "detailsSummary" => children.All(child => Type(child) is "text" or "hardBreak"),
        "codeBlock" => children.All(child => Type(child) == "text" && !child.TryGetProperty("marks", out _)),
        "bulletList" or "orderedList" => children.Length > 0 && children.All(child => Type(child) == "listItem"),
        "listItem" => children.Length > 0 && Type(children[0]) == "paragraph" && children.All(child => IsBlock(Type(child))),
        "table" => children.Length > 0 && children.All(child => Type(child) == "tableRow"),
        "tableRow" => children.All(child => Type(child) is "tableCell" or "tableHeader"),
        "details" => children.Length == 2 && Type(children[0]) == "detailsSummary" && Type(children[1]) == "detailsContent",
        "text" or "hardBreak" or "horizontalRule" or "image" => children.Length == 0,
        _ => false
    };

    private static bool IsBlock(string type) => type is "paragraph" or "heading" or "blockquote" or
        "codeBlock" or "bulletList" or "orderedList" or "table" or "details" or "horizontalRule" or "image";

    private static string Type(JsonElement value) => value.ValueKind == JsonValueKind.Object &&
        value.TryGetProperty("type", out var type) && type.ValueKind == JsonValueKind.String
            ? type.GetString() ?? string.Empty : string.Empty;
}
