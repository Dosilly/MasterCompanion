using System.Text.Json;
using System.Text.Json.Nodes;
using MasterCompanion.Contracts;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace MasterCompanion.Gameplay.Tests.Integration.Persistence;

[Collection("PostgreSQL")]
public sealed class TransactionsPersistenceTests(PostgreSqlFixture database) : GameplayPersistenceTestBase(database)
{

    [Fact]
    public async Task Execute_RepeatedRequestsAndSequentialUndo_PreserveConfirmedReceipts()
    {
        // Arrange
        var campaignId = await SeedCampaignAsync(connectionString);

        // Act
        var unconfigured = Success(await ReadAsync(connectionString, campaignId));

        // Assert
        Assert.True(unconfigured.Revision == 0 && unconfigured.Snapshot.TimeMinutes == 0 && unconfigured.Snapshot.Party.Count == 0,
            "An unconfigured campaign must read as revision zero without a party.");
        await AssertCountsAsync(connectionString, campaignId, 0, 0);

        // Act
        var configured = Success(await ExecuteAsync(connectionString, campaignId,
            Request(0, "configureParty", party: [new GameCharacter(Guid.NewGuid(), "Character")])));
        var firstRequest = Request(1, "advanceTime", minutes: 30);
        var firstReceipt = Success(await ExecuteAsync(connectionString, campaignId, firstRequest));
        Success(await ExecuteAsync(connectionString, campaignId, Request(2, "advanceTime", minutes: 60)));
        var undoRequest = Request(3, "undo");
        var undoReceipt = Success(await ExecuteAsync(connectionString, campaignId, undoRequest));

        // Assert
        Assert.True(undoReceipt.Revision == 4 && SameJson(undoReceipt.Snapshot, firstReceipt.Snapshot),
            "Undo must restore the last time change while advancing the revision.");

        // Act
        var repeated = Success(await ExecuteAsync(connectionString, campaignId, firstRequest));

        // Assert
        Assert.True(SameJson(repeated, firstReceipt), "A repeated request must return its original receipt after later operations.");

        // Act
        var repeatedUndo = Success(await ExecuteAsync(connectionString, campaignId, undoRequest));

        // Assert
        Assert.True(SameJson(repeatedUndo, undoReceipt), "A repeated undo must return its original receipt without undoing again.");
        await AssertCountsAsync(connectionString, campaignId, 1, 4);

        // Act
        var differentRequest = await ExecuteAsync(connectionString, campaignId, firstRequest with { Minutes = 31 });

        // Assert
        AssertFailure(differentRequest, 409, "game_request_conflict");
        AssertFailure(await ExecuteAsync(connectionString, campaignId, Request(1, "advanceTime", minutes: 30)),
            409, "game_revision_conflict");
        Assert.True(SameJson(Success(await ReadAsync(connectionString, campaignId)), undoReceipt),
            "Receipt conflicts and stale revisions must leave current gameplay unchanged.");

        // Act
        var secondUndo = Success(await ExecuteAsync(connectionString, campaignId, Request(4, "undo")));

        // Assert
        Assert.True(secondUndo.Revision == 5 && SameJson(secondUndo.Snapshot, configured.Snapshot),
            "Sequential undo must skip previous undo receipts and already undone operations.");

        // Act
        var thirdUndo = Success(await ExecuteAsync(connectionString, campaignId, Request(5, "undo")));

        // Assert
        Assert.True(thirdUndo.Revision == 6 && SameJson(thirdUndo.Snapshot, unconfigured.Snapshot),
            "Undoing party configuration must restore the unconfigured snapshot with a new revision.");

        // Act
        var noUndo = await ExecuteAsync(connectionString, campaignId, Request(6, "undo"));

        // Assert
        Assert.True(noUndo.StatusCode == 409, "Undo with no active operation must report a conflict.");
        await AssertCountsAsync(connectionString, campaignId, 1, 6);
    }

    [Fact]
    public async Task Execute_ConcurrentRevision_ConfirmsOneWinner()
    {
        // Arrange
        var campaignId = await SeedCampaignAsync(connectionString);

        // Act
        Success(await ExecuteAsync(connectionString, campaignId,
            Request(0, "configureParty", party: [new GameCharacter(Guid.NewGuid(), "Concurrent character")])));
        var results = await Task.WhenAll(
            ExecuteAsync(connectionString, campaignId, Request(1, "advanceTime", minutes: 30)),
            ExecuteAsync(connectionString, campaignId, Request(1, "advanceTime", minutes: 60)));

        // Assert
        Assert.True(results.Count(x => x.StatusCode == 200) == 1 &&
            results.Count(x => x.StatusCode == 409 && x.Code == "game_revision_conflict") == 1,
            "Concurrent writers using the same revision must yield one success and one revision conflict.");
        var winner = Success(results.Single(x => x.StatusCode == 200));
        Assert.True(SameJson(Success(await ReadAsync(connectionString, campaignId)), winner),
            "The persisted state must match the sole accepted concurrent operation.");
        await AssertCountsAsync(connectionString, campaignId, 1, 2);

        var firstWriteCampaign = await SeedCampaignAsync(connectionString);
        var party = new[] { new GameCharacter(Guid.NewGuid(), "Initial concurrent character") };

        // Act
        var initial = await Task.WhenAll(
            ExecuteAsync(connectionString, firstWriteCampaign, Request(0, "configureParty", party: party)),
            ExecuteAsync(connectionString, firstWriteCampaign, Request(0, "configureParty", party: party)));

        // Assert
        Assert.True(initial.Count(x => x.StatusCode == 200) == 1 &&
            initial.Count(x => x.StatusCode == 409 && x.Code == "game_revision_conflict") == 1,
            "The campaign lock must serialize concurrent initialization before a game-state row exists.");
        await AssertCountsAsync(connectionString, firstWriteCampaign, 1, 1);

        var duplicateRequest = Request(1, "advanceTime", minutes: 30);

        // Act
        var duplicates = await Task.WhenAll(
            ExecuteAsync(connectionString, firstWriteCampaign, duplicateRequest),
            ExecuteAsync(connectionString, firstWriteCampaign, duplicateRequest));

        // Assert
        Assert.True(SameJson(Success(duplicates[0]), Success(duplicates[1])) && Success(duplicates[0]).Revision == 2,
            "Simultaneous identical retries must share one confirmed receipt without duplicate time changes.");
        await AssertCountsAsync(connectionString, firstWriteCampaign, 1, 2);
    }

    [Fact]
    public async Task Execute_InvalidRequests_LeaveStateAndJournalUnchanged()
    {
        // Arrange
        var campaignId = await SeedCampaignAsync(connectionString);
        var character = new GameCharacter(Guid.NewGuid(), "Validation character");

        // Assert
        AssertFailure(await ExecuteAsync(connectionString, campaignId,
            Request(0, "configureParty", party: [character, character])), 400, "invalid_game_operation");
        await AssertCountsAsync(connectionString, campaignId, 0, 0);

        // Act
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

            // Act
            var rejected = await ExecuteAsync(connectionString, campaignId, request);

            // Assert
            Assert.True(rejected.StatusCode == 400 && rejected.Code is not null,
                "Invalid engine or module input must return a stable validation error.");
            Assert.True(SameJson(Success(await ReadAsync(connectionString, campaignId)), configured),
                "Rejected input must preserve the complete state and revision.");
            await AssertCountsAsync(connectionString, campaignId, 1, 1);
        }

        // Assert
        AssertFailure(await ReadAsync(connectionString, Guid.NewGuid()), 404, "campaign_not_found");
        AssertFailure(await ExecuteAsync(connectionString, Guid.NewGuid(), Request(0, "advanceTime", minutes: 30)),
            404, "campaign_not_found");
    }

    [Fact]
    public async Task Execute_JournalFailure_RollsBackStateAndRevision()
    {
        // Arrange
        var campaignId = await SeedCampaignAsync(connectionString);

        // Act
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
                await ExecuteAsync(connectionString, campaignId, Request(1, "updateParty", party:
                    [configured.Snapshot.Party[0] with { Name = "Attempted rename" }, new(Guid.NewGuid(), "Attempted addition")]));
            }
            catch (PostgresException error) when (error.MessageText == "Injected journal persistence failure")
            {
                threw = true;
            }
            Assert.True(threw, "An unexpected journal failure must propagate rather than report success.");
            Assert.True(SameJson(Success(await ReadAsync(connectionString, campaignId)), configured),
                "A failed journal insert must roll back party names, membership, owned module state and revision in the same transaction.");
            await AssertCountsAsync(connectionString, campaignId, 1, 1);
        }
        finally
        {
            await using var remove = new NpgsqlCommand($"DROP TRIGGER {trigger} ON engine.\"GameOperations\"; DROP FUNCTION engine.{function}();", connection);
            await remove.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task Replay_CorruptReceipt_RejectsWithoutRepair()
    {
        // Arrange
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

        // Act
        foreach (var mutate in mutations)
        {
            // Arrange
            var campaignId = await SeedCampaignAsync(connectionString);
            var request = Request(0, "configureParty", party: [new GameCharacter(Guid.NewGuid(), "Receipt integrity character")]);

            // Act
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

            // Assert
            Assert.True(SameJson(Success(await ReadAsync(connectionString, campaignId)), confirmed),
                "Rejecting a corrupted replay must preserve the current confirmed game state.");
            await using (var db = CreateDb(connectionString))
            {
                var operation = await db.GameOperations.AsNoTracking().SingleAsync(x => x.CampaignId == campaignId && x.RequestId == request.RequestId);
                Assert.True(!operation.Undone && operation.Revision == 1 &&
                    SameJson(JsonSerializer.Deserialize<JsonElement>(operation.ResponseJson), corruptedReceipt),
                    "A rejected corrupted replay must neither repair nor replace journal data silently.");
            }
            await AssertCountsAsync(connectionString, campaignId, 1, 1);
        }
    }

    [Fact]
    public async Task ReadGame_CorruptRevision_RejectsWithoutRepair()
    {

        // Act
        foreach (var revision in new[] { 0L, -1L })
        {
            // Arrange
            var campaignId = await SeedCampaignAsync(connectionString);

            // Act
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
                Assert.True(state.Revision == revision && SameJson(JsonSerializer.Deserialize<JsonElement>(state.SnapshotJson),
                    JsonSerializer.Deserialize<JsonElement>(snapshot)),
                    "Corrupted revision rejection must preserve stored content and avoid silent revision repair.");
            }
            await AssertCountsAsync(connectionString, campaignId, 1, 1);
        }
    }

    [Fact]
    public async Task Execute_CancelledLockWait_PreservesConfirmedState()
    {
        // Arrange
        var campaignId = await SeedCampaignAsync(connectionString);

        // Act
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
            Assert.True(canceled, "Cancellation must interrupt a gameplay writer waiting on the campaign lock.");
            Assert.True(SameJson(Success(await ReadAsync(connectionString, campaignId)), configured),
                "A canceled lock waiter must preserve the current confirmed game state.");
            await AssertCountsAsync(connectionString, campaignId, 1, 1);
            await transaction.RollbackAsync();
        }
        var retry = Success(await ExecuteAsync(connectionString, campaignId, request));

        // Assert
        Assert.True(retry.Revision == 2 && retry.Snapshot.TimeMinutes == 30,
            "After lock release, retrying the canceled request identity must apply the operation once.");
        await AssertCountsAsync(connectionString, campaignId, 1, 2);
    }
}
