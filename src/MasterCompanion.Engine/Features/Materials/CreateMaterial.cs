using System.Text.Json;
using System.Text.Json.Serialization;
using MasterCompanion.Engine.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace MasterCompanion.Engine.Features.Materials;

public static class CreateMaterial
{
    private const int MaxRequestBytes = 8_192;
    private const string EmptyDocument = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        AllowDuplicateProperties = false,
        RespectRequiredConstructorParameters = true,
        RespectNullableAnnotations = true,
        PropertyNameCaseInsensitive = false,
        NumberHandling = JsonNumberHandling.Strict,
        MaxDepth = 4
    };

    public static void Map(IEndpointRouteBuilder endpoints) =>
        endpoints.MapPost("/api/campaigns/{campaignId:guid}/materials", CreateAsync);

    private static async Task<IResult> CreateAsync(Guid campaignId, HttpRequest httpRequest,
        AppDbContext db, CancellationToken token)
    {
        if (!httpRequest.HasJsonContentType()) return Problem(415, "material_json_required");
        if (httpRequest.ContentLength > MaxRequestBytes) return Problem(413, "material_request_too_large");
        var buffer = new byte[MaxRequestBytes + 1];
        var length = 0;
        while (length < buffer.Length)
        {
            var read = await httpRequest.Body.ReadAsync(buffer.AsMemory(length), token);
            if (read == 0) break;
            length += read;
        }
        if (length > MaxRequestBytes) return Problem(413, "material_request_too_large");

        CreateMaterialRequest? request;
        try { request = JsonSerializer.Deserialize<CreateMaterialRequest>(buffer.AsSpan(0, length), JsonOptions); }
        catch (JsonException) { return Problem(400, "invalid_material_creation"); }
        if (request is null || request.Id == Guid.Empty) return Problem(400, "invalid_material_creation");
        var title = request.Title.Trim();
        if (title.Length is < 1 or > 300 || title.Any(char.IsControl) ||
            request.FolderId is { Length: < 1 or > 80 })
            return Problem(400, "invalid_material_creation");

        if (!await db.Campaigns.AsNoTracking().AnyAsync(x => x.Id == campaignId, token))
            return Problem(404, "campaign_not_found");
        var id = $"note-{request.Id:D}";
        var existing = await FindAsync(db, campaignId, id, token);
        if (existing is not null) return Replay(existing, title, request.FolderId);

        var group = string.Empty;
        if (request.FolderId is { } folderId)
        {
            var folder = await db.Folders.AsNoTracking().SingleOrDefaultAsync(
                x => x.CampaignId == campaignId && x.Id == folderId, token);
            if (folder is null) return Problem(400, "material_folder_not_found");
            group = folder.Title;
        }
        var maximumOrder = await db.Materials.Where(x => x.CampaignId == campaignId)
            .MaxAsync(x => (int?)x.SortOrder, token);
        var material = new Material
        {
            Id = id, CampaignId = campaignId, Title = title, FolderId = request.FolderId,
            Group = group, DocumentJson = EmptyDocument,
            DocumentSchemaVersion = 1, Revision = 1, SortOrder = checked((maximumOrder ?? -1) + 1)
        };
        db.Materials.Add(material);
        try { await db.SaveChangesAsync(token); }
        catch (DbUpdateException error) when (error.InnerException is PostgresException
            { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "PK_Materials" })
        {
            // A concurrent retry may have committed first. Never replace its document or revision.
            db.Entry(material).State = EntityState.Detached;
            existing = await FindAsync(db, campaignId, id, token);
            return existing is null ? Problem(409, "material_creation_conflict")
                : Replay(existing, title, request.FolderId);
        }
        return Results.Created($"/api/materials/{id}", Response(material));
    }

    private static Task<Material?> FindAsync(AppDbContext db, Guid campaignId, string id, CancellationToken token) =>
        db.Materials.AsNoTracking().SingleOrDefaultAsync(x => x.CampaignId == campaignId && x.Id == id, token);

    private static IResult Replay(Material material, string title, string? folderId) =>
        material.Title == title && material.FolderId == folderId
            ? Results.Ok(Response(material)) : Problem(409, "material_creation_conflict");

    private static MaterialResponse Response(Material material) => new(material.Id, material.Title, material.Group,
        JsonSerializer.Deserialize<JsonElement>(material.DocumentJson), material.DocumentSchemaVersion,
        material.Revision, material.FolderId);

    private static IResult Problem(int status, string code) => Results.Problem(statusCode: status,
        title: "Material creation could not be completed",
        extensions: new Dictionary<string, object?> { ["code"] = code });
}

public sealed record CreateMaterialRequest(Guid Id, string Title, string? FolderId);
