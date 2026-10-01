using System.Text.Json;
using System.Text.Json.Nodes;
using MasterCompanion.Contracts;
using MasterCompanion.Engine.Features.Gameplay;
using MasterCompanion.Engine.Persistence;
using MasterCompanion.Modules.Ythryn.Gameplay;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace MasterCompanion.Gameplay.Tests;

public static class PersistenceTests
{
    public static async Task RunAsync(string connectionString)
    {
        var connection = new NpgsqlConnectionStringBuilder(connectionString);
        if (connection.Database != "mastercompanion_gameplay_test")
            throw new InvalidOperationException("Persistence tests require an isolated mastercompanion_gameplay_test database.");

        await using (var db = CreateDb(connectionString))
            await db.Database.MigrateAsync();

        await DeferredChecksAndMaterialIsolationAsync(connectionString);
        await IdempotencyAndSequentialUndoAsync(connectionString);
        await ConcurrentRevisionsAsync(connectionString);
        await InvalidRequestsDoNotWriteAsync(connectionString);
        await JournalFailureRollsBackStateAsync(connectionString);
        await CorruptedReceiptsAreRejectedAsync(connectionString);
        await CorruptedRevisionsAreRejectedAsync(connectionString);
        await CancellationWhileWaitingForLockAsync(connectionString);
        Console.WriteLine("PostgreSQL gameplay tests passed: deferred checks, material isolation, receipts, undo, concurrency, input rejection, rollback, corruption rejection and cancellation.");
    }

    private static async Task DeferredChecksAndMaterialIsolationAsync(string connectionString)
    {
        var campaignId = await SeedCampaignAsync(connectionString);
        var materialId = Guid.NewGuid().ToString("N");
        const string document = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Authored campaign notes\"}]}]}";
        await using (var db = CreateDb(connectionString))
        {
            db.Materials.Add(new Material
            {
                Id = materialId, CampaignId = campaignId, Title = "Authored specimen", Group = "Notes",
                DocumentJson = document, Revision = 7
            });
            await db.SaveChangesAsync();
        }

        var untouchedCampaign = await SeedCampaignAsync(connectionString);
        var first = new GameCharacter(Guid.NewGuid(), "First character");
        var second = new GameCharacter(Guid.NewGuid(), "Second character");
        var configured = Success(await ExecuteAsync(connectionString, campaignId,
            Request(0, "configureParty", party: [first, second])));
        Require(configured.Revision == 1, "Party initialization must advance the game revision.");
        Success(await ExecuteAsync(connectionString, campaignId, Request(1, "advanceTime", minutes: 600)));
        var rest = Success(await ExecuteAsync(connectionString, campaignId, Request(2, "longRest")));
        Require(rest.Snapshot.TimeMinutes == 1080 && rest.Snapshot.RestEnds.SequenceEqual([1080L]),
            "Shared rest must persist the elapsed time and its end together.");
        AssertCheck(rest, first.Id, "exposure", 720);
        AssertCheck(rest, second.Id, "exposure", 720);

        var infected = Success(await ExecuteAsync(connectionString, campaignId, Request(3, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = first.Id, success = false }))));
        Require(Character(infected, first.Id).GetProperty("status").GetString() == "infected",
            "The deferred exposure failure must infect the selected character.");
        AssertCheck(infected, first.Id, "rest", 1080);
        Require(Character(infected, second.Id).GetProperty("status").GetString() == "healthy",
            "One character's resolution must preserve the other character's health.");
        AssertCheck(infected, second.Id, "exposure", 720);

        var resolved = Success(await ExecuteAsync(connectionString, campaignId, Request(4, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = first.Id, success = true, d6 = 6 }))));
        Require(resolved.Snapshot.TimeMinutes == 1080 && Character(resolved, first.Id).GetProperty("dc").GetInt32() == 9,
            "Resolving a rest must preserve time and apply the supplied die to the selected character.");

        var persisted = Success(await ReadAsync(connectionString, campaignId));
        Require(persisted.Revision == 5 && SameJson(persisted.Snapshot, resolved.Snapshot),
            "A fresh context must recover the complete confirmed gameplay snapshot.");
        var undo = Success(await ExecuteAsync(connectionString, campaignId, Request(5, "undo")));
        Require(SameJson(undo.Snapshot, infected.Snapshot), "Undo must restore the module state before the resolved rest.");

        await using (var db = CreateDb(connectionString))
        {
            var material = await db.Materials.AsNoTracking().SingleAsync(x => x.Id == materialId);
            Require(material.Revision == 7 && SameJson(JsonSerializer.Deserialize<JsonElement>(document),
                JsonSerializer.Deserialize<JsonElement>(material.DocumentJson)),
                "Gameplay and undo must preserve authored material content and its independent revision.");
            Require(!await db.GameStates.AnyAsync(x => x.CampaignId == untouchedCampaign) &&
                !await db.GameOperations.AnyAsync(x => x.CampaignId == untouchedCampaign),
                "Gameplay writes must remain scoped to the selected campaign.");
        }
    }

    private static async Task IdempotencyAndSequentialUndoAsync(string connectionString)
    {
        var campaignId = await SeedCampaignAsync(connectionString);
        var unconfigured = Success(await ReadAsync(connectionString, campaignId));
        Require(unconfigured.Revision == 0 && unconfigured.Snapshot.TimeMinutes == 0 && unconfigured.Snapshot.Party.Count == 0,
            "An unconfigured campaign must read as revision zero without a party.");
        await AssertCountsAsync(connectionString, campaignId, 0, 0);

        var configured = Success(await ExecuteAsync(connectionString, campaignId,
            Request(0, "configureParty", party: [new GameCharacter(Guid.NewGuid(), "Character")])));
        var firstRequest = Request(1, "advanceTime", minutes: 30);
        var firstReceipt = Success(await ExecuteAsync(connectionString, campaignId, firstRequest));
        Success(await ExecuteAsync(connectionString, campaignId, Request(2, "advanceTime", minutes: 60)));
        var undoRequest = Request(3, "undo");
        var undoReceipt = Success(await ExecuteAsync(connectionString, campaignId, undoRequest));
        Require(undoReceipt.Revision == 4 && SameJson(undoReceipt.Snapshot, firstReceipt.Snapshot),
            "Undo must restore the last time change while advancing the revision.");

        var repeated = Success(await ExecuteAsync(connectionString, campaignId, firstRequest));
        Require(SameJson(repeated, firstReceipt), "A repeated request must return its original receipt after later operations.");
        var repeatedUndo = Success(await ExecuteAsync(connectionString, campaignId, undoRequest));
        Require(SameJson(repeatedUndo, undoReceipt), "A repeated undo must return its original receipt without undoing again.");
        await AssertCountsAsync(connectionString, campaignId, 1, 4);

        var differentRequest = await ExecuteAsync(connectionString, campaignId, firstRequest with { Minutes = 31 });
        AssertFailure(differentRequest, 409, "game_request_conflict");
        AssertFailure(await ExecuteAsync(connectionString, campaignId, Request(1, "advanceTime", minutes: 30)),
            409, "game_revision_conflict");
        Require(SameJson(Success(await ReadAsync(connectionString, campaignId)), undoReceipt),
            "Receipt conflicts and stale revisions must leave current gameplay unchanged.");

        var secondUndo = Success(await ExecuteAsync(connectionString, campaignId, Request(4, "undo")));
        Require(secondUndo.Revision == 5 && SameJson(secondUndo.Snapshot, configured.Snapshot),
            "Sequential undo must skip previous undo receipts and already undone operations.");
        var thirdUndo = Success(await ExecuteAsync(connectionString, campaignId, Request(5, "undo")));
        Require(thirdUndo.Revision == 6 && SameJson(thirdUndo.Snapshot, unconfigured.Snapshot),
            "Undoing party configuration must restore the unconfigured snapshot with a new revision.");
        var noUndo = await ExecuteAsync(connectionString, campaignId, Request(6, "undo"));
        Require(noUndo.StatusCode == 409, "Undo with no active operation must report a conflict.");
        await AssertCountsAsync(connectionString, campaignId, 1, 6);
    }

    private static async Task ConcurrentRevisionsAsync(string connectionString)
    {
        var campaignId = await SeedCampaignAsync(connectionString);
        Success(await ExecuteAsync(connectionString, campaignId,
            Request(0, "configureParty", party: [new GameCharacter(Guid.NewGuid(), "Concurrent character")])));
        var results = await Task.WhenAll(
            ExecuteAsync(connectionString, campaignId, Request(1, "advanceTime", minutes: 30)),
            ExecuteAsync(connectionString, campaignId, Request(1, "advanceTime", minutes: 60)));
        Require(results.Count(x => x.StatusCode == 200) == 1 &&
            results.Count(x => x.StatusCode == 409 && x.Code == "game_revision_conflict") == 1,
            "Concurrent writers using the same revision must yield one success and one revision conflict.");
        var winner = Success(results.Single(x => x.StatusCode == 200));
        Require(SameJson(Success(await ReadAsync(connectionString, campaignId)), winner),
            "The persisted state must match the sole accepted concurrent operation.");
        await AssertCountsAsync(connectionString, campaignId, 1, 2);

        var firstWriteCampaign = await SeedCampaignAsync(connectionString);
        var party = new[] { new GameCharacter(Guid.NewGuid(), "Initial concurrent character") };
        var initial = await Task.WhenAll(
            ExecuteAsync(connectionString, firstWriteCampaign, Request(0, "configureParty", party: party)),
            ExecuteAsync(connectionString, firstWriteCampaign, Request(0, "configureParty", party: party)));
        Require(initial.Count(x => x.StatusCode == 200) == 1 &&
            initial.Count(x => x.StatusCode == 409 && x.Code == "game_revision_conflict") == 1,
            "The campaign lock must serialize concurrent initialization before a game-state row exists.");
        await AssertCountsAsync(connectionString, firstWriteCampaign, 1, 1);

        var duplicateRequest = Request(1, "advanceTime", minutes: 30);
        var duplicates = await Task.WhenAll(
            ExecuteAsync(connectionString, firstWriteCampaign, duplicateRequest),
            ExecuteAsync(connectionString, firstWriteCampaign, duplicateRequest));
        Require(SameJson(Success(duplicates[0]), Success(duplicates[1])) && Success(duplicates[0]).Revision == 2,
            "Simultaneous identical retries must share one confirmed receipt without duplicate time changes.");
        await AssertCountsAsync(connectionString, firstWriteCampaign, 1, 2);
    }

    private static async Task InvalidRequestsDoNotWriteAsync(string connectionString)
    {
        var campaignId = await SeedCampaignAsync(connectionString);
        var character = new GameCharacter(Guid.NewGuid(), "Validation character");
        AssertFailure(await ExecuteAsync(connectionString, campaignId,
            Request(0, "configureParty", party: [character, character])), 400, "invalid_game_operation");
        await AssertCountsAsync(connectionString, campaignId, 0, 0);
        var configured = Success(await ExecuteAsync(connectionString, campaignId, Request(0, "configureParty", party: [character])));
        foreach (var request in new[]
        {
            Request(1, "advanceTime", minutes: -1),
            Request(1, "advanceTime", minutes: GameLimits.MaxAdvanceMinutes + 1),
            Request(1, "unknown"),
            Request(1, "module", command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = character.Id, success = true })),
            Request(1, "module", command: JsonSerializer.SerializeToElement(new { kind = "healCharacter", characterId = Guid.NewGuid() }))
        })
        {
            var rejected = await ExecuteAsync(connectionString, campaignId, request);
            Require(rejected.StatusCode == 400 && rejected.Code is not null,
                "Invalid engine or module input must return a stable validation error.");
            Require(SameJson(Success(await ReadAsync(connectionString, campaignId)), configured),
                "Rejected input must preserve the complete state and revision.");
            await AssertCountsAsync(connectionString, campaignId, 1, 1);
        }
        AssertFailure(await ReadAsync(connectionString, Guid.NewGuid()), 404, "campaign_not_found");
        AssertFailure(await ExecuteAsync(connectionString, Guid.NewGuid(), Request(0, "advanceTime", minutes: 30)),
            404, "campaign_not_found");
    }

    private static async Task JournalFailureRollsBackStateAsync(string connectionString)
    {
        var campaignId = await SeedCampaignAsync(connectionString);
        var configured = Success(await ExecuteAsync(connectionString, campaignId,
            Request(0, "configureParty", party: [new GameCharacter(Guid.NewGuid(), "Rollback character")])));
        var suffix = Guid.NewGuid().ToString("N");
        var function = "reject_test_operation_" + suffix;
        var trigger = "reject_test_operation_" + suffix;
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        // A deferred constraint failure occurs at commit after both snapshot and journal writes.
        await using (var create = new NpgsqlCommand($"""
            CREATE FUNCTION engine.{function}() RETURNS trigger LANGUAGE plpgsql AS $test$
            BEGIN
                IF NEW."CampaignId" = '{campaignId:D}'::uuid THEN
                    RAISE EXCEPTION 'Injected journal persistence failure';
                END IF;
                RETURN NEW;
            END;
            $test$;
            CREATE CONSTRAINT TRIGGER {trigger} AFTER INSERT ON engine."GameOperations"
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION engine.{function}();
            """, connection))
            await create.ExecuteNonQueryAsync();
        try
        {
            var threw = false;
            try
            {
                await ExecuteAsync(connectionString, campaignId, Request(1, "advanceTime", minutes: 30));
            }
            catch (PostgresException error) when (error.MessageText == "Injected journal persistence failure")
            {
                threw = true;
            }
            Require(threw, "An unexpected journal failure must propagate rather than report success.");
            Require(SameJson(Success(await ReadAsync(connectionString, campaignId)), configured),
                "A failed journal insert must roll back the snapshot and revision in the same transaction.");
            await AssertCountsAsync(connectionString, campaignId, 1, 1);
        }
        finally
        {
            await using var remove = new NpgsqlCommand($"DROP TRIGGER {trigger} ON engine.\"GameOperations\"; DROP FUNCTION engine.{function}();", connection);
            await remove.ExecuteNonQueryAsync();
        }
    }

    private static AppDbContext CreateDb(string connectionString) =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).Options);

    private static async Task CorruptedReceiptsAreRejectedAsync(string connectionString)
    {
        var mutations = new Action<JsonObject>[]
        {
            receipt => RequiredObject(receipt["snapshot"])["moduleSchemaVersion"] = 99,
            receipt => receipt["revision"] = -1,
            receipt =>
            {
                var characters = RequiredObject(receipt["moduleView"])["characters"]?.AsArray()
                    ?? throw new InvalidOperationException("The test receipt has no character projection.");
                RequiredObject(characters[0])["status"] = "transformed";
            }
        };
        foreach (var mutate in mutations)
        {
            var campaignId = await SeedCampaignAsync(connectionString);
            var request = Request(0, "configureParty", party: [new GameCharacter(Guid.NewGuid(), "Receipt integrity character")]);
            var confirmed = Success(await ExecuteAsync(connectionString, campaignId, request));
            JsonElement corruptedReceipt;
            await using (var db = CreateDb(connectionString))
            {
                var operation = await db.GameOperations.SingleAsync(x => x.CampaignId == campaignId && x.RequestId == request.RequestId);
                var receipt = RequiredObject(JsonNode.Parse(operation.ResponseJson));
                mutate(receipt);
                operation.ResponseJson = receipt.ToJsonString();
                corruptedReceipt = JsonSerializer.Deserialize<JsonElement>(operation.ResponseJson);
                await db.SaveChangesAsync();
            }
            await AssertInvalidStoredDataAsync(() => ExecuteAsync(connectionString, campaignId, request));
            Require(SameJson(Success(await ReadAsync(connectionString, campaignId)), confirmed),
                "Rejecting a corrupted replay must preserve the current confirmed game state.");
            await using (var db = CreateDb(connectionString))
            {
                var operation = await db.GameOperations.AsNoTracking().SingleAsync(x => x.CampaignId == campaignId && x.RequestId == request.RequestId);
                Require(!operation.Undone && operation.Revision == 1 &&
                    SameJson(JsonSerializer.Deserialize<JsonElement>(operation.ResponseJson), corruptedReceipt),
                    "A rejected corrupted replay must neither repair nor replace journal data silently.");
            }
            await AssertCountsAsync(connectionString, campaignId, 1, 1);
        }
    }

    private static async Task CorruptedRevisionsAreRejectedAsync(string connectionString)
    {
        foreach (var revision in new[] { 0L, -1L })
        {
            var campaignId = await SeedCampaignAsync(connectionString);
            Success(await ExecuteAsync(connectionString, campaignId,
                Request(0, "configureParty", party: [new GameCharacter(Guid.NewGuid(), "Revision integrity character")])));
            string snapshot;
            await using (var db = CreateDb(connectionString))
            {
                var state = await db.GameStates.SingleAsync(x => x.CampaignId == campaignId);
                snapshot = state.SnapshotJson;
                state.Revision = revision;
                await db.SaveChangesAsync();
            }
            await AssertInvalidStoredDataAsync(() => ReadAsync(connectionString, campaignId));
            await AssertInvalidStoredDataAsync(() => ExecuteAsync(connectionString, campaignId, Request(1, "advanceTime", minutes: 30)));
            await using (var db = CreateDb(connectionString))
            {
                var state = await db.GameStates.AsNoTracking().SingleAsync(x => x.CampaignId == campaignId);
                Require(state.Revision == revision && SameJson(JsonSerializer.Deserialize<JsonElement>(state.SnapshotJson),
                    JsonSerializer.Deserialize<JsonElement>(snapshot)),
                    "Corrupted revision rejection must preserve stored content and avoid silent revision repair.");
            }
            await AssertCountsAsync(connectionString, campaignId, 1, 1);
        }
    }

    private static async Task CancellationWhileWaitingForLockAsync(string connectionString)
    {
        var campaignId = await SeedCampaignAsync(connectionString);
        var configured = Success(await ExecuteAsync(connectionString, campaignId,
            Request(0, "configureParty", party: [new GameCharacter(Guid.NewGuid(), "Cancellation character")])));
        var request = Request(1, "advanceTime", minutes: 30);
        await using (var connection = new NpgsqlConnection(connectionString))
        {
            await connection.OpenAsync();
            await using var transaction = await connection.BeginTransactionAsync();
            await using var command = new NpgsqlCommand("SELECT \"Id\" FROM engine.\"Campaigns\" WHERE \"Id\" = @campaignId FOR UPDATE", connection, transaction);
            command.Parameters.AddWithValue("campaignId", campaignId);
            await command.ExecuteScalarAsync();
            using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(1));
            var canceled = false;
            try
            {
                await ExecuteAsync(connectionString, campaignId, request, cancellation.Token).WaitAsync(TimeSpan.FromSeconds(5));
            }
            catch (OperationCanceledException) when (cancellation.IsCancellationRequested)
            {
                canceled = true;
            }
            Require(canceled, "Cancellation must interrupt a gameplay writer waiting on the campaign lock.");
            Require(SameJson(Success(await ReadAsync(connectionString, campaignId)), configured),
                "A canceled lock waiter must preserve the current confirmed game state.");
            await AssertCountsAsync(connectionString, campaignId, 1, 1);
            await transaction.RollbackAsync();
        }
        var retry = Success(await ExecuteAsync(connectionString, campaignId, request));
        Require(retry.Revision == 2 && retry.Snapshot.TimeMinutes == 30,
            "After lock release, retrying the canceled request identity must apply the operation once.");
        await AssertCountsAsync(connectionString, campaignId, 1, 2);
    }

    private static JsonObject RequiredObject(JsonNode? node) => node?.AsObject()
        ?? throw new InvalidOperationException("The test fixture is missing an expected JSON object.");

    private static async Task AssertInvalidStoredDataAsync(Func<Task<GameExecution>> action)
    {
        var rejected = false;
        try { await action(); }
        catch (InvalidOperationException) { rejected = true; }
        Require(rejected, "Corrupted stored gameplay data must throw rather than return a successful or expected HTTP outcome.");
    }

    private static GameplayService CreateService(AppDbContext db) => new(db, [new YthrynGameRules()]);

    private static async Task<Guid> SeedCampaignAsync(string connectionString)
    {
        await using var db = CreateDb(connectionString);
        var id = Guid.NewGuid();
        db.Campaigns.Add(new Campaign { Id = id, Title = "Gameplay integration specimen", ModuleId = "ythryn", ModuleVersion = "1.0.0" });
        await db.SaveChangesAsync();
        return id;
    }

    private static async Task<GameExecution> ExecuteAsync(string connectionString, Guid campaignId, GameOperationRequest request,
        CancellationToken token = default)
    {
        await using var db = CreateDb(connectionString);
        return await CreateService(db).ExecuteAsync(campaignId, request, token);
    }

    private static async Task<GameExecution> ReadAsync(string connectionString, Guid campaignId)
    {
        await using var db = CreateDb(connectionString);
        return await CreateService(db).ReadAsync(campaignId);
    }

    private static GameOperationRequest Request(long revision, string kind, GameCharacter[]? party = null,
        long? minutes = null, JsonElement? command = null) => new(Guid.NewGuid(), revision, kind, party, minutes, command);

    private static GameStateResponse Success(GameExecution result) => result is { StatusCode: 200, Response: { } response }
        ? response : throw new InvalidOperationException($"Expected accepted game operation, received {result.StatusCode} ({result.Code}).");

    private static void AssertFailure(GameExecution result, int status, string code) =>
        Require(result.StatusCode == status && result.Code == code && result.Response is null,
            $"Expected {status}/{code}, received {result.StatusCode}/{result.Code}.");

    private static JsonElement Character(GameStateResponse state, Guid id) =>
        state.ModuleView.GetProperty("characters").EnumerateArray().Single(x => x.GetProperty("id").GetGuid() == id);

    private static void AssertCheck(GameStateResponse state, Guid id, string kind, long minute)
    {
        var check = Character(state, id).GetProperty("nextCheck");
        Require(check.GetProperty("kind").GetString() == kind && check.GetProperty("minute").GetInt64() == minute &&
            check.GetProperty("pending").GetBoolean(), "The persisted state must expose the oldest pending check with its original deadline.");
    }

    private static async Task AssertCountsAsync(string connectionString, Guid campaignId, int states, int operations)
    {
        await using var db = CreateDb(connectionString);
        Require(await db.GameStates.CountAsync(x => x.CampaignId == campaignId) == states &&
            await db.GameOperations.CountAsync(x => x.CampaignId == campaignId) == operations,
            "Persisted state and journal counts must match accepted operations only.");
    }

    private static bool SameJson<T>(T left, T right) =>
        JsonElement.DeepEquals(JsonSerializer.SerializeToElement(left), JsonSerializer.SerializeToElement(right));

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }
}
