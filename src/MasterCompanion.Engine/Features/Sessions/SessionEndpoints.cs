using System.Data;
using System.Text.Json;
using MasterCompanion.Engine.Persistence;
using MasterCompanion.Engine.Features.Folders;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Engine.Features.Sessions;

public static class SessionEndpoints
{
    public static void Map(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/campaigns/{campaignId:guid}/sessions", ReadAsync);
        endpoints.MapPost("/api/campaigns/{campaignId:guid}/sessions", ChangeAsync);
    }

    private static async Task<IResult> ReadAsync(Guid campaignId, AppDbContext db, CancellationToken token)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, token);
        var campaign = await db.Campaigns.AsNoTracking().SingleOrDefaultAsync(item => item.Id == campaignId, token);
        if (campaign is null)
        {
            return Problem(404, "campaign_not_found");
        }
        var sessions = await db.Sessions.AsNoTracking().Where(item => item.CampaignId == campaignId)
            .OrderBy(item => item.Sequence).Take(1_001).ToListAsync(token);
        if (sessions.Count > 1_000)
        {
            throw new InvalidOperationException("The saved session collection exceeds its supported limit.");
        }
        return Results.Ok(SessionSnapshot.From(campaign.SessionsRevision, sessions));
    }

    private static async Task<IResult> ChangeAsync(Guid campaignId, HttpRequest httpRequest, AppDbContext db,
        CancellationToken token)
    {
        var decoded = await SessionRequestDecoder.ReadAsync(httpRequest, token);
        if (decoded is SessionRequestDecoder.Rejected rejected)
        {
            return Problem(rejected.Status, rejected.Code);
        }
        var request = decoded switch
        {
            SessionRequestDecoder.Accepted accepted => accepted.Request,
            _ => throw new InvalidOperationException("The session decoding result is unsupported.")
        };

        // The campaign lock owns record changes, new documents and the immutable receipt.
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        var campaigns = await db.Campaigns.FromSqlInterpolated(
            $"SELECT * FROM engine.\"Campaigns\" WHERE \"Id\" = {campaignId} FOR UPDATE").ToListAsync(token);
        var campaign = campaigns.SingleOrDefault();
        if (campaign is null)
        {
            return Problem(404, "campaign_not_found");
        }
        var requestJson = JsonSerializer.Serialize(request, SessionRequestDecoder.JsonOptions);
        var receipt = await db.SessionOperationReceipts.AsNoTracking().SingleOrDefaultAsync(
            item => item.CampaignId == campaignId && item.RequestId == request.RequestId, token);
        if (receipt is not null)
        {
            if (!JsonElement.DeepEquals(JsonSerializer.Deserialize<JsonElement>(receipt.RequestJson),
                JsonSerializer.Deserialize<JsonElement>(requestJson)))
            {
                return Problem(409, "session_request_conflict");
            }
            return Results.Ok(JsonSerializer.Deserialize<SessionSnapshot>(receipt.ResponseJson,
                SessionRequestDecoder.JsonOptions) ?? throw new InvalidOperationException("The saved session receipt is invalid."));
        }
        if (request.ExpectedRevision != campaign.SessionsRevision)
        {
            return Problem(409, "session_revision_conflict");
        }
        if (campaign.SessionsRevision >= SessionRequestDecoder.MaxRevision)
        {
            return Problem(409, "session_revision_limit");
        }
        if (request.Operation is CreateSessionOperation && campaign.FoldersRevision >= FolderRequestDecoder.MaxRevision)
        {
            return Problem(409, "session_revision_limit");
        }
        if (request.Operation is PinSessionMaterialOperation pin &&
            !await db.Materials.AsNoTracking().AnyAsync(item => item.CampaignId == campaignId && item.Id == pin.MaterialId, token))
        {
            return Problem(404, "session_material_not_found");
        }
        var sessions = await db.Sessions.Where(item => item.CampaignId == campaignId)
            .OrderBy(item => item.Sequence).Take(1_001).ToListAsync(token);
        var deleted = request.Operation is DeleteSessionOperation
            ? sessions.SingleOrDefault(item => item.Id == request.Operation.SessionId)
            : null;
        var error = SessionChanges.Apply(sessions, campaignId, campaign.SessionsRevision + 1, request.Operation);
        if (error is not null)
        {
            return Problem(error == "session_not_found" ? 404 : 409, error);
        }
        if (request.Operation is CreateSessionOperation create)
        {
            campaign.FoldersRevision++;
            var created = sessions.Single(item => item.Id == create.SessionId);
            db.Sessions.Add(created);
            var maximumOrder = await db.Materials.Where(item => item.CampaignId == campaignId)
                .MaxAsync(item => (int?)item.SortOrder, token) ?? -1;
            db.Materials.AddRange(NewDocument(campaignId, created.PreparationMaterialId, create.PreparationTitle, checked(maximumOrder + 1)),
                NewDocument(campaignId, created.NotesMaterialId, create.NotesTitle, checked(maximumOrder + 2)));
        }
        if (deleted is not null)
        {
            // Materials are independently owned documents; deleting their meeting keeps them intact.
            db.Sessions.Remove(deleted);
        }
        campaign.SessionsRevision++;
        var snapshot = SessionSnapshot.From(campaign.SessionsRevision, sessions);
        db.SessionOperationReceipts.Add(new SessionOperationReceipt
        {
            CampaignId = campaignId,
            RequestId = request.RequestId,
            Revision = snapshot.Revision,
            RequestJson = requestJson,
            ResponseJson = JsonSerializer.Serialize(snapshot, SessionRequestDecoder.JsonOptions),
            CreatedAtUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync(token);
        await transaction.CommitAsync(token);
        return Results.Ok(snapshot);
    }

    private static Material NewDocument(Guid campaignId, string id, string title, int order) => new()
    {
        CampaignId = campaignId,
        Id = id,
        Title = title.Trim(),
        Group = string.Empty,
        DocumentJson = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}",
        DocumentSchemaVersion = 1,
        Revision = 1,
        SortOrder = order
    };

    private static IResult Problem(int status, string code) => Results.Problem(statusCode: status,
        title: "Session operation could not be completed",
        extensions: new Dictionary<string, object?> { ["code"] = code });
}
