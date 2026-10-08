using static MasterCompanion.Engine.Features.Gameplay.GameSnapshotCodec;
using System.Text.Json;
using System.Data;
using MasterCompanion.Contracts;
using MasterCompanion.Engine.Features.Characters;
using MasterCompanion.Engine.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Engine.Features.Gameplay;


public sealed class GameplayService(AppDbContext db, IEnumerable<ICampaignGameRules> modules,
    IEnumerable<ICampaignModule>? campaignModules = null)
{
    public async Task<GameExecution> ReadAsync(Guid campaignId, CancellationToken token = default)
    {
        // Keep state, tool projection and undo availability consistent if a write commits during this read.
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, token);
        var campaign = await db.Campaigns.AsNoTracking().SingleOrDefaultAsync(x => x.Id == campaignId, token);
        if (campaign is null)
        {
            return new(404, "campaign_not_found");
        }

        var rules = FindRules(campaign.ModuleId);
        if (rules is null)
        {
            return new(409, "game_module_unavailable");
        }

        var state = await db.GameStates.AsNoTracking().SingleOrDefaultAsync(x => x.CampaignId == campaignId, token);
        if (state is { Revision: < 1 })
        {
            throw new InvalidOperationException("The saved game revision is invalid.");
        }

        var snapshot = state is null ? Empty(rules) : Decode(state.SnapshotJson);
        snapshot = UpgradeSnapshot(snapshot, rules);
        return new(200, Response: new(state?.Revision ?? 0, snapshot, rules.Describe(snapshot),
            await LastOperationAsync(campaignId, token)));
    }

    public async Task<GameExecution> ExecuteAsync(Guid campaignId, GameOperationRequest request,
        CancellationToken token = default)
    {
        if (!GameRequestValidator.IsValidRequest(request))
        {
            return new(400, "invalid_game_operation");
        }
        // Lock the campaign even before its first game state exists. All gameplay writers use this lock.
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        var campaigns = await db.Campaigns.FromSqlInterpolated(
            $"SELECT * FROM engine.\"Campaigns\" WHERE \"Id\" = {campaignId} FOR UPDATE")
            .AsNoTracking().ToListAsync(token);
        var campaign = campaigns.SingleOrDefault();
        if (campaign is null)
        {
            return new(404, "campaign_not_found");
        }

        var rules = FindRules(campaign.ModuleId);
        if (rules is null)
        {
            return new(409, "game_module_unavailable");
        }

        var requestJson = JsonSerializer.Serialize(request, JsonOptions);
        var receipt = await db.GameOperations.AsNoTracking()
            .SingleOrDefaultAsync(x => x.CampaignId == campaignId && x.RequestId == request.RequestId, token);
        if (receipt is not null)
        {
            if (!JsonElement.DeepEquals(JsonSerializer.Deserialize<JsonElement>(receipt.RequestJson),
                JsonSerializer.Deserialize<JsonElement>(requestJson)))
            {
                return new(409, "game_request_conflict");
            }

            return new(200, Response: GameReceiptCodec.Decode(receipt, rules));
        }

        var state = await db.GameStates.SingleOrDefaultAsync(x => x.CampaignId == campaignId, token);
        if (state is { Revision: < 1 })
        {
            throw new InvalidOperationException("The saved game revision is invalid.");
        }

        var revision = state?.Revision ?? 0;
        if (request.ExpectedRevision != revision)
        {
            return new(409, "game_revision_conflict");
        }

        if (revision == long.MaxValue)
        {
            return new(409, "game_revision_limit");
        }

        var before = state is null ? Empty(rules) : Decode(state.SnapshotJson);
        before = UpgradeSnapshot(before, rules);
        GameSnapshot after;
        GameOperationSummary? last;
        if (request.Kind == "undo")
        {
            var target = await db.GameOperations.Where(x => x.CampaignId == campaignId && !x.Undone && x.Kind != "undo")
                .OrderByDescending(x => x.Revision).FirstOrDefaultAsync(token);
            if (target is null)
            {
                return new(409, "game_nothing_to_undo");
            }

            after = Decode(target.BeforeJson);
            after = UpgradeSnapshot(after, rules);
            target.Undone = true;
            last = await db.GameOperations.AsNoTracking()
                .Where(x => x.CampaignId == campaignId && !x.Undone && x.Kind != "undo" && x.RequestId != target.RequestId)
                .OrderByDescending(x => x.Revision)
                .Select(x => new GameOperationSummary(x.RequestId, x.Kind, x.Revision)).FirstOrDefaultAsync(token);
        }
        else
        {
            var transition = GameOperationRules.Apply(before, request, rules);
            if (transition is GameTransition.Rejected rejected)
            {
                return new(rejected.StatusCode, rejected.Code);
            }

            after = transition switch
            {
                GameTransition.Accepted accepted => accepted.Snapshot,
                _ => throw new InvalidOperationException("Unsupported gameplay transition result.")
            };
            last = new(request.RequestId, request.Kind, revision + 1);
        }

        var catalogError = await CharacterCatalogWrites.ApplyAsync(db, campaignId, after.Party, request.Character, token);
        if (catalogError is not null)
        {
            return new(409, catalogError);
        }
        var response = new GameStateResponse(revision + 1, after, rules.Describe(after), last);
        if (state is null)
        {
            state = new() { CampaignId = campaignId, Revision = response.Revision, SnapshotJson = Encode(after) };
            db.GameStates.Add(state);
        }
        else
        {
            state.Revision = response.Revision;
            state.SnapshotJson = Encode(after);
        }
        db.GameOperations.Add(new()
        {
            CampaignId = campaignId,
            RequestId = request.RequestId,
            Revision = response.Revision,
            Kind = request.Kind,
            RequestJson = requestJson,
            BeforeJson = Encode(before),
            ResponseJson = JsonSerializer.Serialize(response, JsonOptions),
            CreatedAtUtc = DateTime.UtcNow
        });
        try { await db.SaveChangesAsync(token); }
        catch (DbUpdateConcurrencyException) { return new(409, "game_revision_conflict"); }
        await transaction.CommitAsync(token);
        return new(200, Response: response);
    }

    private ICampaignGameRules? FindRules(string moduleId)
    {
        var rules = modules.SingleOrDefault(x => x.ModuleId == moduleId);
        if (rules is not null)
        {
            return rules;
        }

        return campaignModules?.SingleOrDefault(x => x.Manifest.Id == moduleId) is not null
            ? new NeutralGameRules(moduleId) : null;
    }
    private Task<GameOperationSummary?> LastOperationAsync(Guid campaignId, CancellationToken token) => db.GameOperations.AsNoTracking()
        .Where(x => x.CampaignId == campaignId && !x.Undone && x.Kind != "undo").OrderByDescending(x => x.Revision)
        .Select(x => new GameOperationSummary(x.RequestId, x.Kind, x.Revision)).FirstOrDefaultAsync(token);

}
