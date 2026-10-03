using System.Text.Json;
using System.Text.Json.Nodes;
using MasterCompanion.Contracts;
using MasterCompanion.Engine.Features.Gameplay;
using MasterCompanion.Engine.Persistence;
using MasterCompanion.Modules.Ythryn.Gameplay;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Gameplay.Tests.Integration.Persistence;

[Collection("PostgreSQL")]
public sealed class UpgradePersistenceTests(PostgreSqlFixture database) : GameplayPersistenceTestBase(database)
{

    [Fact]
    public async Task ReadGame_SchemaTwo_ProjectsUpgradeWithoutChangingStoredReceipt()
    {
        // Arrange
        var campaignId = await SeedCampaignAsync(connectionString);
        var party = new[] { new GameCharacter(Guid.NewGuid(), "Existing campaign member") };
        var rules = new YthrynGameRules();
        var module = JsonNode.Parse(rules.Initialize(party).GetRawText())?.AsObject()
            ?? throw new InvalidOperationException("Missing upgrade fixture.");
        module.Remove("adventure");
        var snapshot = new GameSnapshot(480, party, [480L], 2, JsonSerializer.SerializeToElement(module));
        var request = Request(0, "longRest");
        var receipt = new GameStateResponse(1, snapshot, rules.Describe(snapshot), new(request.RequestId, "longRest", 1));
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var snapshotJson = JsonSerializer.Serialize(snapshot, options);
        await using (var db = CreateDb(connectionString))
        {
            db.GameStates.Add(new() { CampaignId = campaignId, Revision = 1, SnapshotJson = snapshotJson });
            db.GameOperations.Add(new() { CampaignId = campaignId, RequestId = request.RequestId, Revision = 1, Kind = "longRest",
                RequestJson = JsonSerializer.Serialize(request, options), BeforeJson = snapshotJson,
                ResponseJson = JsonSerializer.Serialize(receipt, options), CreatedAtUtc = DateTime.UtcNow });
            await db.SaveChangesAsync();
        }

        // Act
        var read = Success(await ReadAsync(connectionString, campaignId));

        // Assert
        Assert.True(read.Revision == 1 && read.Snapshot.ModuleSchemaVersion == 3 && read.Snapshot.TimeMinutes == 480 &&
            SameJson(snapshot.ModuleState.GetProperty("characters"), read.Snapshot.ModuleState.GetProperty("characters")) &&
            read.ModuleView.GetProperty("expedition").GetProperty("avarice").GetProperty("pending").GetBoolean(),
            "Existing schema-two state must expose first-rest reminders without resetting campaign data.");
        await using (var db = CreateDb(connectionString))
        {
            var stored = await db.GameStates.AsNoTracking().SingleAsync(x => x.CampaignId == campaignId);
            Assert.True(stored.Revision == 1 && SameJson(JsonSerializer.Deserialize<JsonElement>(stored.SnapshotJson),
                JsonSerializer.Deserialize<JsonElement>(snapshotJson)), "GET must leave stored schema-two documents and revision untouched.");
        }
        Assert.True(SameJson(Success(await ExecuteAsync(connectionString, campaignId, request)), receipt), "Schema-two historical receipts must remain exactly replayable.");
    }

    [Fact]
    public async Task Execute_LegacyStateUpgrade_PreservesAuthoredDataAndReceipts()
    {
        // Arrange
        var campaignId = await SeedCampaignAsync(connectionString);
        var character = new GameCharacter(Guid.NewGuid(), "Preserved authored name");
        var rules = new YthrynGameRules();
        GameSnapshot Legacy(long? resolvedRest, int dc) => new(1080, [character], [1080L], 1,
            JsonSerializer.SerializeToElement(new { characters = new[]
            {
                new { id = character.Id, status = "infected", dc, failures = 0,
                    infectedAt = (long?)720, nextExposure = (long?)null, lastResolvedRest = resolvedRest }
            } }));
        var beforeLegacy = Legacy(null, 15);
        var afterLegacy = Legacy(1080, 9);
        var oldRequest = Request(0, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = character.Id, success = true, d6 = 6 }));
        var oldReceipt = new GameStateResponse(1, afterLegacy, rules.Describe(afterLegacy),
            new GameOperationSummary(oldRequest.RequestId, "module", 1));
        var jsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var originalSnapshotJson = JsonSerializer.Serialize(afterLegacy, jsonOptions);
        var originalReceiptJson = JsonSerializer.Serialize(oldReceipt, jsonOptions);
        await using (var db = CreateDb(connectionString))
        {
            db.GameStates.Add(new CampaignGameState { CampaignId = campaignId, Revision = 1, SnapshotJson = originalSnapshotJson });
            db.GameOperations.Add(new GameOperation
            {
                CampaignId = campaignId, RequestId = oldRequest.RequestId, Revision = 1, Kind = "module",
                RequestJson = JsonSerializer.Serialize(oldRequest, jsonOptions),
                BeforeJson = JsonSerializer.Serialize(beforeLegacy, jsonOptions), ResponseJson = originalReceiptJson,
                CreatedAtUtc = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        // Act
        var upgraded = Success(await ReadAsync(connectionString, campaignId));

        // Assert
        Assert.True(upgraded.Revision == 1 && upgraded.Snapshot.ModuleSchemaVersion == 3 &&
            upgraded.Snapshot.Party.Single() == character && upgraded.Snapshot.TimeMinutes == 1080 &&
            Character(upgraded, character.Id).GetProperty("dc").GetInt32() == 9 &&
            Character(upgraded, character.Id).GetProperty("nextCheck").GetProperty("minute").GetInt64() == 1800,
            "Reading legacy state must project the new timer while preserving confirmed names, IDs, clock, outcomes and revision.");
        await using (var db = CreateDb(connectionString))
        {
            var stored = await db.GameStates.AsNoTracking().SingleAsync(x => x.CampaignId == campaignId);
            Assert.True(SameJson(JsonSerializer.Deserialize<JsonElement>(stored.SnapshotJson),
                JsonSerializer.Deserialize<JsonElement>(originalSnapshotJson)) && stored.Revision == 1,
                "A read-only upgrade must not rewrite the stored legacy snapshot or advance its revision.");
        }
        Assert.True(SameJson(Success(await ExecuteAsync(connectionString, campaignId, oldRequest)), oldReceipt),
            "A schema-one request retry must return its exact original rest-only receipt instead of a new projection.");

        // Act
        var advanced = Success(await ExecuteAsync(connectionString, campaignId, Request(1, "advanceTime", minutes: 720)));

        // Assert
        AssertCheck(advanced, character.Id, "recovery", 1800);

        // Act
        var resolved = Success(await ExecuteAsync(connectionString, campaignId, Request(advanced.Revision, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = character.Id, success = false }))));

        // Assert
        Assert.True(Character(resolved, character.Id).GetProperty("dc").GetInt32() == 9 &&
            Character(resolved, character.Id).GetProperty("failures").GetInt32() == 1,
            "Current recovery must accumulate with confirmed legacy outcomes after the upgrade.");
        Assert.True(SameJson(Success(await ExecuteAsync(connectionString, campaignId, oldRequest)), oldReceipt) &&
            SameJson(Success(await ReadAsync(connectionString, campaignId)), resolved),
            "An old receipt replay after current operations must not replace the latest clock, timer or outcomes.");

        // Act
        var undo = Success(await ExecuteAsync(connectionString, campaignId, Request(resolved.Revision, "undo")));

        // Assert
        Assert.True(SameJson(undo.Snapshot, advanced.Snapshot), "Undo must restore the current periodic check after upgrade.");

        // Act
        undo = Success(await ExecuteAsync(connectionString, campaignId, Request(undo.Revision, "undo")));

        // Assert
        Assert.True(SameJson(undo.Snapshot, upgraded.Snapshot), "Undoing time must preserve the upgraded legacy outcomes.");

        // Act
        undo = Success(await ExecuteAsync(connectionString, campaignId, Request(undo.Revision, "undo")));

        // Assert
        Assert.True(SameJson(undo.Snapshot, rules.Upgrade(beforeLegacy)),
            "Undoing a historical schema-one operation must restore and upgrade its own before-state without resetting infection.");
        Assert.True(SameJson(Success(await ExecuteAsync(connectionString, campaignId, oldRequest)), oldReceipt),
            "An undone legacy receipt must remain replayable with its original schema and projection.");
        await using (var db = CreateDb(connectionString))
        {
            var operation = await db.GameOperations.AsNoTracking().SingleAsync(x => x.CampaignId == campaignId && x.RequestId == oldRequest.RequestId);
            Assert.True(operation.Undone && SameJson(JsonSerializer.Deserialize<JsonElement>(operation.ResponseJson),
                JsonSerializer.Deserialize<JsonElement>(originalReceiptJson)),
                "Upgrade and undo must retain the immutable historical response while marking only the operation's undo flag.");
        }
        await AssertCountsAsync(connectionString, campaignId, 1, 6);
    }

    [Fact]
    public async Task Upgrade_HostileModule_RejectsChangesToEngineOwnedState()
    {
        // Arrange
        Func<GameSnapshot, GameSnapshot>[] mutations =
        [
            snapshot => snapshot with { TimeMinutes = snapshot.TimeMinutes + 1 },
            snapshot => snapshot with { Party = snapshot.Party.Select(member => member with { Name = "Unauthorized rename" }).ToArray() },
            snapshot => snapshot with { RestEnds = [720L] },
            snapshot =>
            {
                if (snapshot.Party is not IList<GameCharacter> mutableParty)
                    throw new InvalidOperationException("The upgrade fixture needs a mutable deserialized party.");
                mutableParty[0] = mutableParty[0] with { Name = "Unauthorized in-place rename" };
                return snapshot;
            },
            snapshot =>
            {
                var state = RequiredObject(JsonNode.Parse(snapshot.ModuleState.GetRawText()));
                var characters = state["characters"]?.AsArray()
                    ?? throw new InvalidOperationException("Missing upgrade test characters.");
                foreach (var character in characters)
                {
                    var item = RequiredObject(character);
                    foreach (var field in new[] { "nextRecovery", "recoveryStartedAt", "lastResolvedRecovery", "recoveryChecks" })
                        item.Remove(field);
                }
                return snapshot with { ModuleSchemaVersion = 1, ModuleState = JsonSerializer.Deserialize<JsonElement>(state.ToJsonString()) };
            }
        ];

        // Act
        foreach (var mutate in mutations)
        {
            // Arrange
            var campaignId = await SeedCampaignAsync(connectionString);

            // Act
            var configured = Success(await ExecuteAsync(connectionString, campaignId,
                Request(0, "configureParty", party: [new(Guid.NewGuid(), "Engine-owned member")])));
            var confirmed = Success(await ExecuteAsync(connectionString, campaignId,
                Request(configured.Revision, "advanceTime", minutes: 720)));
            await using (var db = CreateDb(connectionString))
            {
                var hostile = new GameplayService(db, [new HostileUpgradeRules(mutate)], [new NeutralTestModule()]);
                await AssertInvalidStoredDataAsync(() => hostile.ReadAsync(campaignId));
                await AssertInvalidStoredDataAsync(() => hostile.ExecuteAsync(campaignId, Request(confirmed.Revision, "shortRest")));
            }

            // Assert
            Assert.True(SameJson(Success(await ReadAsync(connectionString, campaignId)), confirmed),
                "A module upgrade that changes engine-owned time, party or rests, or fails to reach its current schema, must leave confirmed state untouched.");
            await AssertCountsAsync(connectionString, campaignId, 1, 2);
        }
    }

    private sealed class HostileUpgradeRules(Func<GameSnapshot, GameSnapshot> mutate) : ICampaignGameRules
    {
        private readonly YthrynGameRules rules = new();
        public string ModuleId => rules.ModuleId;
        public int StateSchemaVersion => rules.StateSchemaVersion;
        public JsonElement Initialize(IReadOnlyList<GameCharacter> party) => rules.Initialize(party);
        public void Validate(GameSnapshot snapshot) => rules.Validate(snapshot);
        public GameSnapshot Upgrade(GameSnapshot snapshot) => mutate(rules.Upgrade(snapshot));
        public ModuleTransition ReconcileParty(GameSnapshot before, GameSnapshot proposed) => rules.ReconcileParty(before, proposed);
        public ModuleTransition Transition(GameSnapshot before, GameSnapshot proposed, JsonElement? command) => rules.Transition(before, proposed, command);
        public JsonElement Describe(GameSnapshot snapshot) => rules.Describe(snapshot);
    }
}
