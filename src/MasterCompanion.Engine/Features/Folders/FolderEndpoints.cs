using System.Data;
using System.Text.Json;
using MasterCompanion.Engine.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Engine.Features.Folders;

public static class FolderEndpoints
{
    public static void Map(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/campaigns/{campaignId:guid}/folders", ReadAsync);
        endpoints.MapPost("/api/campaigns/{campaignId:guid}/folders", ChangeAsync);
    }

    private static async Task<IResult> ReadAsync(Guid campaignId, AppDbContext db, CancellationToken token)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, token);
        var campaign = await db.Campaigns.AsNoTracking().SingleOrDefaultAsync(item => item.Id == campaignId, token);
        if (campaign is null)
        {
            return Problem(404, "campaign_not_found");
        }
        var folders = await db.Folders.AsNoTracking().Where(item => item.CampaignId == campaignId).ToListAsync(token);
        var materials = await db.Materials.AsNoTracking().Where(item => item.CampaignId == campaignId)
            .OrderBy(item => item.SortOrder).ThenBy(item => item.Id)
            .Select(item => new OrderedMaterial(item.Id, item.FolderId)).ToListAsync(token);
        return Results.Ok(FolderSnapshot.From(campaign.FoldersRevision, folders, materials));
    }

    private static async Task<IResult> ChangeAsync(Guid campaignId, HttpRequest httpRequest, AppDbContext db,
        CancellationToken token)
    {
        var decoded = await FolderRequestDecoder.ReadAsync(httpRequest, token);
        if (decoded is FolderRequestDecoder.Rejected rejected)
        {
            return Problem(rejected.Status, rejected.Code);
        }
        var request = decoded switch
        {
            FolderRequestDecoder.Accepted accepted => accepted.Request,
            _ => throw new InvalidOperationException("The folder request decoding result is unsupported.")
        };

        // Share the campaign lock with gameplay writers; revision, folders and receipt commit together.
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        var campaigns = await db.Campaigns.FromSqlInterpolated(
            $"SELECT * FROM engine.\"Campaigns\" WHERE \"Id\" = {campaignId} FOR UPDATE").ToListAsync(token);
        var campaign = campaigns.SingleOrDefault();
        if (campaign is null)
        {
            return Problem(404, "campaign_not_found");
        }

        FolderSnapshot.ValidateRevision(campaign.FoldersRevision);
        var requestJson = JsonSerializer.Serialize(request, FolderRequestDecoder.JsonOptions);
        var receipt = await db.FolderOperationReceipts.AsNoTracking().SingleOrDefaultAsync(
            item => item.CampaignId == campaignId && item.RequestId == request.RequestId, token);
        if (receipt is not null)
        {
            if (!JsonElement.DeepEquals(JsonSerializer.Deserialize<JsonElement>(receipt.RequestJson),
                JsonSerializer.Deserialize<JsonElement>(requestJson)))
            {
                return Problem(409, "folder_request_conflict");
            }
            var replay = JsonSerializer.Deserialize<FolderSnapshot>(receipt.ResponseJson, FolderRequestDecoder.JsonOptions)
                ?? throw new InvalidOperationException("The saved folder receipt is invalid.");
            return Results.Ok(replay);
        }
        if (request.ExpectedRevision != campaign.FoldersRevision)
        {
            return Problem(409, "folder_revision_conflict");
        }
        if (campaign.FoldersRevision >= FolderRequestDecoder.MaxRevision)
        {
            return Problem(409, "folder_revision_limit");
        }

        var folders = await db.Folders.Where(item => item.CampaignId == campaignId).ToListAsync(token);
        var materials = await db.Materials.Where(item => item.CampaignId == campaignId).ToListAsync(token);
        var error = request.Operation is ReorderMaterialOperation reorder
            ? MaterialOrdering.Apply(materials, reorder)
            : FolderChanges.Apply(folders, request.Operation);
        if (error is not null)
        {
            return Problem(error is "folder_not_found" or "material_not_found" ? 404 : 400, error);
        }
        campaign.FoldersRevision++;
        var response = FolderSnapshot.From(campaign.FoldersRevision, folders, materials
            .OrderBy(item => item.SortOrder).ThenBy(item => item.Id, StringComparer.Ordinal)
            .Select(item => new OrderedMaterial(item.Id, item.FolderId)));
        db.FolderOperationReceipts.Add(new FolderOperationReceipt
        {
            CampaignId = campaignId,
            RequestId = request.RequestId,
            Revision = response.Revision,
            RequestJson = requestJson,
            ResponseJson = JsonSerializer.Serialize(response, FolderRequestDecoder.JsonOptions),
            CreatedAtUtc = DateTime.UtcNow
        });
        try
        {
            await db.SaveChangesAsync(token);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Problem(409, "folder_revision_conflict");
        }
        await transaction.CommitAsync(token);
        return Results.Ok(response);
    }

    private static IResult Problem(int status, string code) => Results.Problem(statusCode: status,
        title: "Folder operation could not be completed",
        extensions: new Dictionary<string, object?> { ["code"] = code });
}
