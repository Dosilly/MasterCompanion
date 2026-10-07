using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MasterCompanion.Engine.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Engine.Features.Materials;

internal static class MaterialDeletionReferences
{
    internal static async Task<MaterialDeletionPreview> ReadAsync(AppDbContext db, Material material,
        long sessionsRevision, CancellationToken token)
    {
        var documents = await db.Materials.AsNoTracking().Where(item => item.CampaignId == material.CampaignId && item.Id != material.Id)
            .OrderBy(item => item.Id).Select(item => new { item.Id, item.Title, item.Revision, item.DocumentJson }).ToListAsync(token);
        var links = documents.Where(item => ContainsLink(JsonSerializer.Deserialize<JsonElement>(item.DocumentJson), material.Id)).ToList();
        var maps = await db.Maps.AsNoTracking().Where(item => item.CampaignId == material.CampaignId)
            .OrderBy(item => item.Id).ToListAsync(token);
        var markers = new List<string>();
        foreach (var map in maps)
        {
            var definition = JsonSerializer.Deserialize<JsonElement>(map.DefinitionJson);
            var entries = definition.GetProperty("markers");
            foreach (var marker in entries.EnumerateArray())
            {
                if (marker.TryGetProperty("materialId", out var target) && target.GetString() == material.Id)
                {
                    markers.Add(definition.GetProperty("title").GetString() + " / " + marker.GetProperty("title").GetString());
                }
            }
        }
        var sessions = await db.Sessions.AsNoTracking().Where(item => item.CampaignId == material.CampaignId)
            .OrderBy(item => item.Sequence).ToListAsync(token);
        var pins = sessions.Where(item => (JsonSerializer.Deserialize<string[]>(item.PinnedMaterialIdsJson)
            ?? throw new InvalidOperationException("The saved session pin collection is invalid.")).Contains(material.Id));
        var owners = sessions.Where(item => item.PreparationMaterialId == material.Id || item.NotesMaterialId == material.Id);
        // Confirmation binds reference consequences to their exact confirmed snapshot.
        var fingerprint = JsonSerializer.Serialize(new
        {
            sessionsRevision,
            links = links.Select(item => new { item.Id, item.Revision }),
            maps = maps.Select(item => new { item.Id, item.DefinitionJson })
        });
        var referenceToken = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(fingerprint)));
        return new(material.Id, material.Title, material.Revision, referenceToken, links.Select(item => item.Title).ToArray(),
            markers, pins.Select(item => item.Title).ToArray(), owners.Select(item => item.Title).ToArray());
    }

    private static bool ContainsLink(JsonElement node, string id)
    {
        if (node.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in node.EnumerateObject())
            {
                if (property.Name == "href" && property.Value.ValueKind == JsonValueKind.String &&
                    property.Value.GetString() is { } href &&
                    (href == $"#material/{id}" || href.StartsWith($"#material/{id}/", StringComparison.Ordinal)))
                {
                    return true;
                }
                if (ContainsLink(property.Value, id))
                {
                    return true;
                }
            }
        }
        else if (node.ValueKind == JsonValueKind.Array)
        {
            return node.EnumerateArray().Any(item => ContainsLink(item, id));
        }
        return false;
    }
}
