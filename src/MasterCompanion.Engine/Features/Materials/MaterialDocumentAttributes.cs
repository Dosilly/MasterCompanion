using System.Text.Json;

namespace MasterCompanion.Engine.Features.Materials;

internal static class MaterialDocumentAttributes
{
    internal static bool IsValid(string type, JsonElement attrs)
    {
        if (attrs.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        foreach (var attribute in attrs.EnumerateObject())
        {
            var valid = (type, attribute.Name) switch
            {
                ("paragraph" or "heading" or "blockquote" or "table" or "bulletList" or "orderedList" or "listItem" or "details", "sourceId") => OptionalString(attribute.Value, 300),
                ("heading", "level") => Integer(attribute.Value, 1, 6),
                ("orderedList", "start") => Integer(attribute.Value, 1, int.MaxValue),
                ("orderedList", "type") => attribute.Value.ValueKind == JsonValueKind.Null ||
                    attribute.Value.ValueKind == JsonValueKind.String && attribute.Value.GetString() is "1" or "a" or "A" or "i" or "I",
                ("codeBlock", "language") => OptionalString(attribute.Value, 100),
                ("tableCell" or "tableHeader", "colspan" or "rowspan") => Integer(attribute.Value, 1, 1_000),
                ("tableCell" or "tableHeader", "colwidth") => ColumnWidths(attribute.Value),
                ("tableCell" or "tableHeader", "align") => attribute.Value.ValueKind == JsonValueKind.Null ||
                    attribute.Value.ValueKind == JsonValueKind.String && attribute.Value.GetString() is "left" or "center" or "right",
                ("image", "src") => SafeUrl(attribute.Value, image: true),
                ("image", "alt" or "title") => OptionalString(attribute.Value, 2_000),
                ("image", "width" or "height") => attribute.Value.ValueKind == JsonValueKind.Null || Integer(attribute.Value, 1, 20_000),
                _ => false
            };
            if (!valid)
            {
                return false;
            }
        }
        return type != "image" || attrs.TryGetProperty("src", out _);
    }

    internal static bool IsValidMark(JsonElement mark)
    {
        if (mark.ValueKind != JsonValueKind.Object || !mark.TryGetProperty("type", out var type) ||
            type.ValueKind != JsonValueKind.String ||
            mark.EnumerateObject().Any(property => property.Name is not ("type" or "attrs")))
        {
            return false;
        }

        var name = type.GetString();
        if (name is not ("link" or "bold" or "code" or "italic" or "strike" or "underline"))
        {
            return false;
        }

        if (!mark.TryGetProperty("attrs", out var attrs))
        {
            return name != "link";
        }

        if (attrs.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        if (name != "link")
        {
            return !attrs.EnumerateObject().Any();
        }

        if (!attrs.TryGetProperty("href", out var href) || !SafeUrl(href, image: false))
        {
            return false;
        }

        foreach (var attribute in attrs.EnumerateObject())
        {
            var valid = attribute.Name switch
            {
                "href" => true,
                "target" => attribute.Value.ValueKind == JsonValueKind.Null ||
                    attribute.Value.ValueKind == JsonValueKind.String && attribute.Value.GetString() is "_blank" or "_self",
                "rel" or "class" => OptionalString(attribute.Value, 300),
                "title" => OptionalString(attribute.Value, 2_000),
                _ => false
            };
            if (!valid)
            {
                return false;
            }
        }
        return true;
    }

    private static bool OptionalString(JsonElement value, int maximumLength) => value.ValueKind == JsonValueKind.Null ||
        value.ValueKind == JsonValueKind.String && value.GetString() is { } text &&
        text.Length <= maximumLength && !text.Any(char.IsControl);

    private static bool Integer(JsonElement value, int minimum, int maximum) => value.ValueKind == JsonValueKind.Number &&
        value.TryGetInt32(out var number) && number >= minimum && number <= maximum;

    private static bool ColumnWidths(JsonElement value) => value.ValueKind == JsonValueKind.Null ||
        value.ValueKind == JsonValueKind.Array && value.GetArrayLength() is > 0 and <= 1_000 &&
        value.EnumerateArray().All(width => Integer(width, 0, 20_000));

    private static bool SafeUrl(JsonElement value, bool image)
    {
        if (value.ValueKind != JsonValueKind.String || value.GetString() is not { Length: > 0 and <= 2_000 } url ||
            url != url.Trim() || url.Any(char.IsControl) || url.Contains('\\'))
        {
            return false;
        }

        if (!image && url.StartsWith('#'))
        {
            return url.Length > 1;
        }

        if (image && url.StartsWith("/api/assets/", StringComparison.Ordinal))
        {
            return url.Length > "/api/assets/".Length && !url.Contains("..", StringComparison.Ordinal) && !url.Contains('?') && !url.Contains('#');
        }

        return Uri.TryCreate(url, UriKind.Absolute, out var uri) &&
            (uri.Scheme is "https" or "http" || !image && uri.Scheme == "mailto");
    }
}
