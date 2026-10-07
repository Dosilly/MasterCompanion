using System.Text.Json;
using System.Text.Json.Serialization;
using MasterCompanion.Engine.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Engine.Features.Materials;

public static class SaveMaterial
{
    private const int MaxRequestBytes = 2_097_152;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        AllowDuplicateProperties = false,
        RespectRequiredConstructorParameters = true,
        RespectNullableAnnotations = true,
        PropertyNameCaseInsensitive = false,
        NumberHandling = JsonNumberHandling.Strict,
        MaxDepth = 128
    };

    public static void Map(IEndpointRouteBuilder endpoints) =>
        endpoints.MapPut("/api/materials/{id}", async (string id, HttpRequest httpRequest,
            AppDbContext db, CancellationToken token) =>
        {
            if (!httpRequest.HasJsonContentType())
            {
                return Problem(415, "material_json_required");
            }

            if (httpRequest.ContentLength > MaxRequestBytes)
            {
                return Problem(413, "material_request_too_large");
            }
            // Bound chunked requests as well as requests carrying Content-Length.
            var buffer = new byte[MaxRequestBytes + 1];
            var length = 0;
            while (length < buffer.Length)
            {
                var read = await httpRequest.Body.ReadAsync(buffer.AsMemory(length), token);
                if (read == 0)
                {
                    break;
                }

                length += read;
            }
            if (length > MaxRequestBytes)
            {
                return Problem(413, "material_request_too_large");
            }

            SaveMaterialRequest? request;
            try
            {
                request = JsonSerializer.Deserialize<SaveMaterialRequest>(buffer.AsSpan(0, length), JsonOptions);
            }
            catch (JsonException)
            {
                return Problem(400, "invalid_document");
            }
            if (request is null || request.ExpectedRevision < 1 || !MaterialDocumentSchema.IsValid(request.Document))
            {
                return Problem(400, "invalid_document");
            }

            var campaignId = await db.Materials.AsNoTracking().Where(item => item.Id == id)
                .Select(item => (Guid?)item.CampaignId).SingleOrDefaultAsync(token);
            if (campaignId is null)
            {
                return Results.NotFound();
            }
            // Material writes share the campaign lock with reference-aware deletion.
            await using var transaction = await db.Database.BeginTransactionAsync(token);
            await db.Campaigns.FromSqlInterpolated(
                $"SELECT * FROM engine.\"Campaigns\" WHERE \"Id\" = {campaignId.Value} FOR UPDATE").ToListAsync(token);
            var material = await db.Materials.SingleOrDefaultAsync(x => x.Id == id, token);
            if (material is null)
            {
                return Results.NotFound();
            }

            if (request.ExpectedRevision != material.Revision)
            {
                return Conflict();
            }

            if (material.Revision == long.MaxValue)
            {
                return Problem(409, "material_revision_limit");
            }

            material.DocumentJson = request.Document.GetRawText();
            material.Revision++;
            try { await db.SaveChangesAsync(token); }
            catch (DbUpdateConcurrencyException) { return Conflict(); }
            await transaction.CommitAsync(token);
            return Results.Ok(new { material.Revision });
        });

    private static IResult Problem(int statusCode, string code) => Results.Problem(
        statusCode: statusCode, title: "Material save could not be completed",
        extensions: new Dictionary<string, object?> { ["code"] = code });

    private static IResult Conflict() => Results.Problem(
        "The material revision has changed. Reload the current version before saving again.",
        statusCode: 409, title: "Material revision conflict",
        extensions: new Dictionary<string, object?> { ["code"] = "material_revision_conflict" });
}
