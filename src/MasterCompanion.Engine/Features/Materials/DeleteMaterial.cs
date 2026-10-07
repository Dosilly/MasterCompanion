using System.Text.Json;
using System.Text.Json.Serialization;
using MasterCompanion.Engine.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Engine.Features.Materials;

public static class DeleteMaterial
{
    private const long MaxRevision = 9_007_199_254_740_991;
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

    public static void Map(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/campaigns/{campaignId:guid}/materials/{id}/deletion", PreviewAsync);
        endpoints.MapPost("/api/campaigns/{campaignId:guid}/materials/{id}/deletion", DeleteAsync);
    }

    private static async Task<IResult> PreviewAsync(Guid campaignId, string id, AppDbContext db, CancellationToken token)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.RepeatableRead, token);
        var campaign = await db.Campaigns.AsNoTracking().SingleOrDefaultAsync(item => item.Id == campaignId, token);
        var material = await db.Materials.AsNoTracking().SingleOrDefaultAsync(item => item.CampaignId == campaignId && item.Id == id, token);
        if (campaign is null || material is null)
        {
            return Problem(404, "material_not_found");
        }
        return Results.Ok(await MaterialDeletionReferences.ReadAsync(db, material, campaign.SessionsRevision, token));
    }

    private static async Task<IResult> DeleteAsync(Guid campaignId, string id, HttpRequest httpRequest,
        AppDbContext db, CancellationToken token)
    {
        if (!httpRequest.HasJsonContentType())
        {
            return Problem(415, "material_json_required");
        }
        var buffer = new byte[4_097];
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
        if (length > 4_096)
        {
            return Problem(413, "material_request_too_large");
        }
        MaterialDeletionRequest? request;
        try
        {
            request = JsonSerializer.Deserialize<MaterialDeletionRequest>(buffer.AsSpan(0, length), JsonOptions);
        }
        catch (JsonException)
        {
            return Problem(400, "invalid_material_deletion");
        }
        if (request is null || request.RequestId == Guid.Empty || request.ExpectedRevision is < 1 or > MaxRevision ||
            request.ReferencesToken.Length != 64 || request.ReferencesToken.Any(character => !Uri.IsHexDigit(character)))
        {
            return Problem(400, "invalid_material_deletion");
        }
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        var campaigns = await db.Campaigns.FromSqlInterpolated(
            $"SELECT * FROM engine.\"Campaigns\" WHERE \"Id\" = {campaignId} FOR UPDATE").ToListAsync(token);
        var campaign = campaigns.SingleOrDefault();
        if (campaign is null)
        {
            return Problem(404, "campaign_not_found");
        }
        var requestJson = JsonSerializer.Serialize(request, JsonOptions);
        var receipt = await db.MaterialDeletionReceipts.AsNoTracking().SingleOrDefaultAsync(
            item => item.CampaignId == campaignId && item.RequestId == request.RequestId, token);
        if (receipt is not null)
        {
            return receipt.MaterialId == id && JsonElement.DeepEquals(JsonSerializer.Deserialize<JsonElement>(receipt.RequestJson), JsonSerializer.Deserialize<JsonElement>(requestJson))
                ? Results.Ok(new { id }) : Problem(409, "material_deletion_request_conflict");
        }
        // Lock the exact target revision after the shared campaign lock; saves use the same lock order.
        var materials = await db.Materials.FromSqlInterpolated(
            $"SELECT * FROM engine.\"Materials\" WHERE \"CampaignId\" = {campaignId} AND \"Id\" = {id} FOR UPDATE").ToListAsync(token);
        var material = materials.SingleOrDefault();
        if (material is null)
        {
            return Problem(404, "material_not_found");
        }
        if (material.Revision != request.ExpectedRevision)
        {
            return Problem(409, "material_revision_conflict");
        }
        var preview = await MaterialDeletionReferences.ReadAsync(db, material, campaign.SessionsRevision, token);
        if (preview.OwningSessions.Count > 0)
        {
            return Problem(409, "material_session_document");
        }
        if (preview.ReferencesToken != request.ReferencesToken)
        {
            return Problem(409, "material_references_changed");
        }
        if (campaign.FoldersRevision >= MaxRevision || campaign.SessionsRevision >= MaxRevision)
        {
            return Problem(409, "material_revision_limit");
        }
        if (preview.PinnedSessions.Count > 0)
        {
            var sessions = await db.Sessions.Where(item => item.CampaignId == campaignId).ToListAsync(token);
            foreach (var session in sessions)
            {
                var pins = JsonSerializer.Deserialize<string[]>(session.PinnedMaterialIdsJson)
                    ?? throw new InvalidOperationException("The session pin collection is invalid.");
                if (pins.Contains(id))
                {
                    session.PinnedMaterialIdsJson = JsonSerializer.Serialize(pins.Where(pin => pin != id));
                }
            }
            campaign.SessionsRevision++;
        }
        campaign.FoldersRevision++;
        db.Materials.Remove(material);
        db.MaterialDeletionReceipts.Add(new MaterialDeletionReceipt
        {
            CampaignId = campaignId,
            RequestId = request.RequestId,
            MaterialId = id,
            RequestJson = requestJson,
            CreatedAtUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync(token);
        await transaction.CommitAsync(token);
        return Results.Ok(new { id });
    }

    private static IResult Problem(int status, string code) => Results.Problem(statusCode: status,
        title: "Material deletion could not be completed",
        extensions: new Dictionary<string, object?> { ["code"] = code });
}
