using System.Text.Json;
using MasterCompanion.Engine.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Engine.Features.Materials;

public static class GetMaterial
{
    public static void Map(IEndpointRouteBuilder endpoints) =>
        endpoints.MapGet("/api/materials/{id}", async (string id, AppDbContext db, CancellationToken token) =>
        {
            var material = await db.Materials.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, token);
            return material is null
                ? Results.NotFound()
                : Results.Ok(new MaterialResponse(material.Id, material.Title, material.Group,
                    JsonSerializer.Deserialize<JsonElement>(material.DocumentJson),
                    material.DocumentSchemaVersion, material.Revision, material.FolderId));
        });
}

public sealed record MaterialResponse(string Id, string Title, string Group, JsonElement Document,
    int DocumentSchemaVersion, long Revision, string? FolderId);
