using System.Text.Json;
using System.Text.Json.Serialization;
using System.Data;
using MasterCompanion.Contracts;
using MasterCompanion.Engine.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Engine.Features.Gameplay;

public sealed record GameOperationRequest(Guid RequestId, long ExpectedRevision, string Kind,
    GameCharacter[]? Party = null, long? Minutes = null, JsonElement? Command = null);
public sealed record GameOperationSummary(Guid RequestId, string Kind, long Revision);
public sealed record GameStateResponse(long Revision, GameSnapshot Snapshot, JsonElement ModuleView,
    GameOperationSummary? LastOperation);
public sealed record GameExecution(int StatusCode, string? Code = null, GameStateResponse? Response = null);

public sealed class GameplayService(AppDbContext db, IEnumerable<ICampaignGameRules> modules,
    IEnumerable<ICampaignModule>? campaignModules = null)
{
    internal static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        AllowDuplicateProperties = false,
        RespectRequiredConstructorParameters = true,
        RespectNullableAnnotations = true,
        PropertyNameCaseInsensitive = false,
        NumberHandling = JsonNumberHandling.Strict,
        MaxDepth = 16
    };

    public async Task<GameExecution> ReadAsync(Guid campaignId, CancellationToken token = default)
    {
        // Keep state, tool projection and undo availability consistent if a write commits during this read.
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, token);
        var campaign = await db.Campaigns.AsNoTracking().SingleOrDefaultAsync(x => x.Id == campaignId, token);
        if (campaign is null) return new(404, "campaign_not_found");
        var rules = FindRules(campaign.ModuleId);
        if (rules is null) return new(409, "game_module_unavailable");
        var state = await db.GameStates.AsNoTracking().SingleOrDefaultAsync(x => x.CampaignId == campaignId, token);
        if (state is { Revision: < 1 }) throw new InvalidOperationException("The saved game revision is invalid.");
        var snapshot = state is null ? Empty(rules) : Decode(state.SnapshotJson);
        snapshot = UpgradeSnapshot(snapshot, rules);
        return new(200, Response: new(state?.Revision ?? 0, snapshot, rules.Describe(snapshot),
            await LastOperationAsync(campaignId, token)));
    }

    public async Task<GameExecution> ExecuteAsync(Guid campaignId, GameOperationRequest request,
        CancellationToken token = default)
    {
        if (!IsValidRequest(request)) return new(400, "invalid_game_operation");
        // Lock the campaign even before its first game state exists. All gameplay writers use this lock.
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        var campaigns = await db.Campaigns.FromSqlInterpolated(
            $"SELECT * FROM engine.\"Campaigns\" WHERE \"Id\" = {campaignId} FOR UPDATE")
            .AsNoTracking().ToListAsync(token);
        var campaign = campaigns.SingleOrDefault();
        if (campaign is null) return new(404, "campaign_not_found");
        var rules = FindRules(campaign.ModuleId);
        if (rules is null) return new(409, "game_module_unavailable");
        var requestJson = JsonSerializer.Serialize(request, JsonOptions);
        var receipt = await db.GameOperations.AsNoTracking()
            .SingleOrDefaultAsync(x => x.CampaignId == campaignId && x.RequestId == request.RequestId, token);
        if (receipt is not null)
        {
            if (!JsonElement.DeepEquals(JsonSerializer.Deserialize<JsonElement>(receipt.RequestJson),
                JsonSerializer.Deserialize<JsonElement>(requestJson))) return new(409, "game_request_conflict");
            var confirmed = JsonSerializer.Deserialize<GameStateResponse>(receipt.ResponseJson, JsonOptions)
                ?? throw new InvalidOperationException("The saved game receipt is invalid.");
            ValidateSnapshot(confirmed.Snapshot, rules);
            if (confirmed.Revision < 1 || confirmed.Revision != receipt.Revision ||
                !JsonElement.DeepEquals(confirmed.ModuleView, rules.Describe(confirmed.Snapshot)) ||
                (receipt.Kind != "undo" && confirmed.LastOperation != new GameOperationSummary(receipt.RequestId, receipt.Kind, receipt.Revision)) ||
                (confirmed.LastOperation is { } operation && (operation.RequestId == Guid.Empty ||
                    operation.Revision < 1 || operation.Revision > confirmed.Revision ||
                    operation.Kind is not ("configureParty" or "updateParty" or "advanceTime" or "shortRest" or "longRest" or "module"))))
                throw new InvalidOperationException("The saved game receipt is inconsistent.");
            return new(200, Response: confirmed);
        }

        var state = await db.GameStates.SingleOrDefaultAsync(x => x.CampaignId == campaignId, token);
        if (state is { Revision: < 1 }) throw new InvalidOperationException("The saved game revision is invalid.");
        var revision = state?.Revision ?? 0;
        if (request.ExpectedRevision != revision) return new(409, "game_revision_conflict");
        if (revision == long.MaxValue) return new(409, "game_revision_limit");
        var before = state is null ? Empty(rules) : Decode(state.SnapshotJson);
        before = UpgradeSnapshot(before, rules);
        GameSnapshot after;
        GameOperationSummary? last;
        if (request.Kind == "undo")
        {
            var target = await db.GameOperations.Where(x => x.CampaignId == campaignId && !x.Undone && x.Kind != "undo")
                .OrderByDescending(x => x.Revision).FirstOrDefaultAsync(token);
            if (target is null) return new(409, "game_nothing_to_undo");
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
            if (request.Kind == "configureParty")
            {
                if (before.Party.Count != 0 || before.TimeMinutes != 0 || before.RestEnds.Count != 0)
                    return new(409, "game_party_already_configured");
                var party = request.Party ?? throw new InvalidOperationException("Validated party is missing.");
                after = before with { Party = party, ModuleState = rules.Initialize(party) };
            }
            else if (request.Kind == "updateParty")
            {
                var party = request.Party ?? throw new InvalidOperationException("Validated party is missing.");
                after = before with { Party = party };
                var reconciliation = rules.ReconcileParty(before, after);
                if (reconciliation.ErrorCode is not null) return new(400, reconciliation.ErrorCode);
                after = after with { ModuleState = reconciliation.State };
            }
            else
            {
                if (before.Party.Count == 0) return new(409, "game_party_required");
                var minutes = request.Kind switch
                {
                    "longRest" => 480,
                    "shortRest" => 60,
                    _ => request.Minutes ?? 0
                };
                if (before.TimeMinutes > GameLimits.MaxTimeMinutes - minutes)
                    return new(400, "game_time_limit");
                if (request.Kind == "longRest" && before.RestEnds.Count >= GameLimits.MaxRestCount)
                    return new(409, "game_rest_limit");
                after = before with
                {
                    TimeMinutes = before.TimeMinutes + minutes,
                    RestEnds = request.Kind == "longRest" ? [.. before.RestEnds, before.TimeMinutes + minutes] : before.RestEnds
                };
                var transition = rules.Transition(before, after, request.Command);
                if (transition.ErrorCode is not null) return new(400, transition.ErrorCode);
                after = after with { ModuleState = transition.State };
            }
            ValidateSnapshot(after, rules);
            last = new(request.RequestId, request.Kind, revision + 1);
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
            CampaignId = campaignId, RequestId = request.RequestId, Revision = response.Revision,
            Kind = request.Kind, RequestJson = requestJson, BeforeJson = Encode(before),
            ResponseJson = JsonSerializer.Serialize(response, JsonOptions), CreatedAtUtc = DateTime.UtcNow
        });
        try { await db.SaveChangesAsync(token); }
        catch (DbUpdateConcurrencyException) { return new(409, "game_revision_conflict"); }
        await transaction.CommitAsync(token);
        return new(200, Response: response);
    }

    private ICampaignGameRules? FindRules(string moduleId)
    {
        var rules = modules.SingleOrDefault(x => x.ModuleId == moduleId);
        if (rules is not null) return rules;
        return campaignModules?.SingleOrDefault(x => x.Manifest.Id == moduleId) is not null
            ? new NeutralGameRules(moduleId) : null;
    }
    private static GameSnapshot Empty(ICampaignGameRules rules) => new(0, [], [], rules.StateSchemaVersion, rules.Initialize([]));
    private static string Encode(GameSnapshot snapshot) => JsonSerializer.Serialize(snapshot, JsonOptions);
    private static GameSnapshot Decode(string json) => JsonSerializer.Deserialize<GameSnapshot>(json, JsonOptions)
        ?? throw new InvalidOperationException("The saved game snapshot is invalid.");
    private Task<GameOperationSummary?> LastOperationAsync(Guid campaignId, CancellationToken token) => db.GameOperations.AsNoTracking()
        .Where(x => x.CampaignId == campaignId && !x.Undone && x.Kind != "undo").OrderByDescending(x => x.Revision)
        .Select(x => new GameOperationSummary(x.RequestId, x.Kind, x.Revision)).FirstOrDefaultAsync(token);

    private static bool IsValidParty(IReadOnlyList<GameCharacter> party) => party.Count <= GameLimits.MaxPartySize &&
        party.All(x => x is not null && x.Id != Guid.Empty && !string.IsNullOrWhiteSpace(x.Name) &&
            x.Name.Length <= GameLimits.MaxCharacterNameLength && x.Name == x.Name.Trim() && !x.Name.Any(char.IsControl)) &&
        party.Select(x => x.Id).Distinct().Count() == party.Count;

    private static bool IsValidRequest(GameOperationRequest request)
    {
        if (request.RequestId == Guid.Empty || request.ExpectedRevision < 0) return false;
        return request.Kind switch
        {
            "configureParty" => request.Party is { Length: > 0 } && IsValidParty(request.Party) && request.Minutes is null && request.Command is null,
            "updateParty" => request.Party is not null && IsValidParty(request.Party) && request.Minutes is null && request.Command is null,
            "advanceTime" => request.Party is null && request.Minutes is > 0 and <= GameLimits.MaxAdvanceMinutes && request.Command is null,
            "shortRest" or "longRest" or "undo" => request.Party is null && request.Minutes is null && request.Command is null,
            "module" => request.Party is null && request.Minutes is null && request.Command is { ValueKind: JsonValueKind.Object },
            _ => false
        };
    }

    private static void ValidateSnapshot(GameSnapshot snapshot, ICampaignGameRules rules)
    {
        if (snapshot.TimeMinutes is < 0 or > GameLimits.MaxTimeMinutes || snapshot.Party is null || snapshot.RestEnds is null ||
            !IsValidParty(snapshot.Party) || snapshot.RestEnds.Count > GameLimits.MaxRestCount)
            throw new InvalidOperationException("The saved game snapshot violates the supported schema.");
        long previous = 0;
        foreach (var minute in snapshot.RestEnds)
        {
            if (minute <= previous || minute > snapshot.TimeMinutes)
                throw new InvalidOperationException("The saved rest sequence is invalid.");
            previous = minute;
        }
        rules.Validate(snapshot);
    }

    private static GameSnapshot UpgradeSnapshot(GameSnapshot snapshot, ICampaignGameRules rules)
    {
        ValidateSnapshot(snapshot, rules);
        var party = snapshot.Party.ToArray();
        var restEnds = snapshot.RestEnds.ToArray();
        var upgraded = rules.Upgrade(snapshot);
        if (upgraded.ModuleSchemaVersion != rules.StateSchemaVersion || upgraded.TimeMinutes != snapshot.TimeMinutes ||
            upgraded.Party is null || !upgraded.Party.SequenceEqual(party) ||
            upgraded.RestEnds is null || !upgraded.RestEnds.SequenceEqual(restEnds))
            throw new InvalidOperationException("A module state upgrade changed engine-owned data or returned an unsupported schema.");
        ValidateSnapshot(upgraded, rules);
        return upgraded;
    }
}
