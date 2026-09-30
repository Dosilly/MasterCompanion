using System.Text.Json;
using MasterCompanion.Engine.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Engine.Features.Materials;

public static class SaveMaterial
{
    public static void Map(IEndpointRouteBuilder endpoints) =>
        endpoints.MapPut("/api/materials/{id}", async (string id, SaveMaterialRequest request,
            AppDbContext db, CancellationToken token) =>
        {
            if (request.Document.ValueKind != JsonValueKind.Object ||
                !request.Document.TryGetProperty("type", out var type) ||
                type.ValueKind != JsonValueKind.String || type.GetString() != "doc" ||
                !request.Document.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array)
                return Results.Problem("The document must have type 'doc' and a content array.",
                    statusCode: 400, title: "Invalid material document",
                    extensions: new Dictionary<string, object?> { ["code"] = "invalid_document" });

            var material = await db.Materials.SingleOrDefaultAsync(x => x.Id == id, token);
            if (material is null) return Results.NotFound();
            if (request.ExpectedRevision != material.Revision) return Conflict();

            material.DocumentJson = request.Document.GetRawText();
            material.Revision++;
            try { await db.SaveChangesAsync(token); }
            catch (DbUpdateConcurrencyException) { return Conflict(); }
            return Results.Ok(new { material.Revision });
        });

    private static IResult Conflict() => Results.Problem(
        "The material revision has changed. Reload the current version before saving again.",
        statusCode: 409, title: "Material revision conflict",
        extensions: new Dictionary<string, object?> { ["code"] = "material_revision_conflict" });
}

public sealed record SaveMaterialRequest(JsonElement Document, long ExpectedRevision);
