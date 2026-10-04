using MasterCompanion.Engine.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Engine.Features.Materials;

public static class SearchMaterials
{
    private const int MaxQueryLength = 160;
    private const int MaxRawQueryLength = 8_192;
    private const int MaxResults = 50;
    private const int MaxSnippetLength = 200;
    private const int SnippetContextLength = 60;

    public static void Map(IEndpointRouteBuilder endpoints) =>
        endpoints.MapGet("/api/campaigns/{campaignId:guid}/materials/search", SearchAsync);

    private static async Task<IResult> SearchAsync(Guid campaignId, HttpRequest request,
        AppDbContext db, CancellationToken token)
    {
        var queryValues = request.Query["query"];
        if (queryValues.Count != 1 || queryValues[0] is not { } input || input.Length > MaxRawQueryLength ||
            input.Any(character => char.IsControl(character) && !char.IsWhiteSpace(character)))
        {
            return Problem(400, "invalid_search_query");
        }

        var query = MaterialSearchText.Normalize(input);
        if (query.Length is < 1 or > MaxQueryLength)
        {
            return Problem(400, "invalid_search_query");
        }

        if (!await db.Campaigns.AsNoTracking().AnyAsync(campaign => campaign.Id == campaignId, token))
        {
            return Problem(404, "campaign_not_found");
        }

        var titleMatches = new List<MaterialSearchResult>();
        var contentMatches = new List<MaterialSearchResult>();
        var matchCount = 0;
        var materials = db.Materials.AsNoTracking()
            .Where(material => material.CampaignId == campaignId)
            .OrderBy(material => material.Title).ThenBy(material => material.Id)
            .Select(material => new
            {
                material.Id,
                material.Title,
                material.FolderId,
                material.DocumentJson,
                material.DocumentSchemaVersion
            })
            .AsAsyncEnumerable();

        await foreach (var material in materials.WithCancellation(token))
        {
            token.ThrowIfCancellationRequested();
            var text = MaterialSearchText.Extract(material.DocumentJson, material.DocumentSchemaVersion, token);
            var titleIndex = IndexOf(MaterialSearchText.Normalize(material.Title), query);
            var contentIndex = IndexOf(text, query);
            if (titleIndex < 0 && contentIndex < 0)
            {
                continue;
            }

            matchCount++;
            var matches = titleIndex >= 0 ? titleMatches : contentMatches;
            if (matches.Count < MaxResults)
            {
                matches.Add(new MaterialSearchResult(material.Id, material.Title, material.FolderId,
                    Snippet(text, contentIndex, query.Length)));
            }
        }

        var results = titleMatches.Concat(contentMatches).Take(MaxResults).ToArray();
        return Results.Ok(new MaterialSearchResponse(results, matchCount > MaxResults));
    }

    private static int IndexOf(string text, string query) =>
        text.IndexOf(query, StringComparison.OrdinalIgnoreCase);

    private static string Snippet(string text, int matchIndex, int queryLength)
    {
        var contextLength = Math.Min(SnippetContextLength, MaxSnippetLength - queryLength - 2);
        var start = Math.Max(0, matchIndex - contextLength);
        if (start > 0 && char.IsLowSurrogate(text[start]))
        {
            start--;
        }

        var prefix = start > 0 ? "…" : string.Empty;
        var available = MaxSnippetLength - prefix.Length;
        var end = Math.Min(text.Length, start + available);
        var hasSuffix = end < text.Length;
        if (hasSuffix)
        {
            end--;
        }

        if (end > start && char.IsHighSurrogate(text[end - 1]))
        {
            end--;
        }

        return prefix + text[start..end] + (hasSuffix ? "…" : string.Empty);
    }

    private static IResult Problem(int statusCode, string code) => Results.Problem(
        statusCode: statusCode,
        title: "Material search could not be completed",
        extensions: new Dictionary<string, object?> { ["code"] = code });
}
