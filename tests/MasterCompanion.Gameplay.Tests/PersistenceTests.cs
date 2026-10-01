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
        await PeriodicRecoveryReceiptsAndUndoAsync(connectionString);
        await LegacyStateAndReceiptsSurviveUpgradeAsync(connectionString);
        await ModuleUpgradeCannotChangeEngineStateAsync(connectionString);
        await EditablePartyAndShortRestAsync(connectionString);
        await PartyRevisionAndValidationAsync(connectionString);
        await RegisteredModulesSupportNeutralGameplayAsync(connectionString);
        await IdempotencyAndSequentialUndoAsync(connectionString);
        await ConcurrentRevisionsAsync(connectionString);
        await InvalidRequestsDoNotWriteAsync(connectionString);
        await JournalFailureRollsBackStateAsync(connectionString);
        await CorruptedReceiptsAreRejectedAsync(connectionString);
        await CorruptedRevisionsAreRejectedAsync(connectionString);
        await CancellationWhileWaitingForLockAsync(connectionString);
        Console.WriteLine("PostgreSQL gameplay tests passed: editable parties, short rests, neutral modules, periodic recovery, legacy upgrade and receipts, module ownership, deferred checks, material isolation, undo, concurrency, input rejection, rollback, corruption rejection and cancellation.");
    }

    private static async Task EditablePartyAndShortRestAsync(string connectionString)
    {
        var campaignId = await SeedCampaignAsync(connectionString);
        var first = new GameCharacter(Guid.NewGuid(), "Existing first");
        var second = new GameCharacter(Guid.NewGuid(), "Existing second");
        var state = Success(await ExecuteAsync(connectionString, campaignId,
            Request(0, "configureParty", party: [first, second])));
        state = Success(await ExecuteAsync(connectionString, campaignId,
            Request(state.Revision, "advanceTime", minutes: 720)));
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = first.Id, success = false }))));
        var beforeShortRest = state;
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "shortRest")));
        Require(state.Snapshot.TimeMinutes == 780 && state.Snapshot.RestEnds.Count == 0 &&
            SameJson(state.Snapshot.ModuleState, beforeShortRest.Snapshot.ModuleState) &&
            Character(state, first.Id).GetProperty("nextCheck").GetProperty("kind").GetString() == "recovery" &&
            Character(state, first.Id).GetProperty("nextCheck").GetProperty("minute").GetInt64() == 1440 &&
            !Character(state, first.Id).GetProperty("nextCheck").GetProperty("pending").GetBoolean() &&
            state.LastOperation?.Kind == "shortRest",
            "A confirmed short rest must advance one hour without scheduling long-rest recovery or changing infection state.");
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "longRest")));
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = first.Id, success = true, d6 = 6 }))));
        var recovered = state;
        var edit = Request(state.Revision, "updateParty", party: [second with { Name = "Renamed second" }, first with { Name = "Renamed first" }]);
        var renamed = Success(await ExecuteAsync(connectionString, campaignId, edit));
        Require(renamed.Snapshot.Party.Select(x => x.Id).SequenceEqual([second.Id, first.Id]) &&
            renamed.Snapshot.Party[1].Name == "Renamed first" &&
            SameJson(StoredCharacter(recovered, first.Id), StoredCharacter(renamed, first.Id)) &&
            SameJson(StoredCharacter(recovered, second.Id), StoredCharacter(renamed, second.Id)) &&
            renamed.Snapshot.TimeMinutes == recovered.Snapshot.TimeMinutes &&
            renamed.Snapshot.RestEnds.SequenceEqual(recovered.Snapshot.RestEnds),
            "Renaming and reordering must persist the roster without resetting existing module state, time or rest history.");
        var added = new GameCharacter(Guid.NewGuid(), "New arrival");
        state = Success(await ExecuteAsync(connectionString, campaignId,
            Request(renamed.Revision, "updateParty", party: [.. renamed.Snapshot.Party, added])));
        var nextCheck = Character(state, added.Id).GetProperty("nextCheck");
        Require(nextCheck.GetProperty("minute").GetInt64() == state.Snapshot.TimeMinutes + 720 &&
            !nextCheck.GetProperty("pending").GetBoolean() &&
            SameJson(StoredCharacter(renamed, first.Id), StoredCharacter(state, first.Id)),
            "Joining later must initialize only the new member at current game time.");
        Require(SameJson(Success(await ExecuteAsync(connectionString, campaignId, edit)), renamed),
            "An older party edit retry must return its exact original receipt after a later edit.");
        Require(SameJson(Success(await ReadAsync(connectionString, campaignId)), state),
            "Reading after an old party receipt replay must retain the latest confirmed roster.");

        var beforeRemoval = state;
        state = Success(await ExecuteAsync(connectionString, campaignId,
            Request(state.Revision, "updateParty", party: [added])));
        Require(state.Snapshot.Party.Single().Id == added.Id &&
            state.Snapshot.ModuleState.GetProperty("characters").GetArrayLength() == 1,
            "Removal must atomically remove selected party identities and their owned module state.");
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "undo")));
        Require(SameJson(state.Snapshot, beforeRemoval.Snapshot),
            "Undoing removal must restore the complete previous roster and infection state, rather than reinitialize members.");

        var beforeEmpty = state;
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "updateParty", party: [])));
        var empty = state;
        Require(empty.Snapshot.Party.Count == 0 && empty.Snapshot.TimeMinutes == beforeEmpty.Snapshot.TimeMinutes &&
            empty.Snapshot.RestEnds.SequenceEqual(beforeEmpty.Snapshot.RestEnds) &&
            empty.ModuleView.GetProperty("characters").GetArrayLength() == 0,
            "Removing every member must preserve the campaign clock and long-rest history.");
        Require(SameJson(Success(await ReadAsync(connectionString, campaignId)), empty),
            "An empty roster at nonzero time must remain readable in a separate database context.");
        AssertFailure(await ExecuteAsync(connectionString, campaignId, Request(empty.Revision, "shortRest")), 409, "game_party_required");
        state = Success(await ExecuteAsync(connectionString, campaignId,
            Request(empty.Revision, "updateParty", party: [first])));
        Require(Character(state, first.Id).GetProperty("status").GetString() == "healthy" &&
            Character(state, first.Id).GetProperty("nextCheck").GetProperty("minute").GetInt64() == empty.Snapshot.TimeMinutes + 720,
            "Adding a member to an empty roster must initialize current-time state without inheriting a removed infection.");
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "undo")));
        Require(SameJson(state.Snapshot, empty.Snapshot), "Undo must restore an empty roster with its nonzero clock and rest history.");
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "undo")));
        Require(SameJson(state.Snapshot, beforeEmpty.Snapshot), "Sequential undo must recover every removed member's original state.");
        await AssertCountsAsync(connectionString, campaignId, 1, 14);
    }

    private static async Task PartyRevisionAndValidationAsync(string connectionString)
    {
        var campaignId = await SeedCampaignAsync(connectionString);
        var character = new GameCharacter(Guid.NewGuid(), "Validated member");
        var configured = Success(await ExecuteAsync(connectionString, campaignId,
            Request(0, "configureParty", party: [character])));
        var oversized = Enumerable.Range(0, GameLimits.MaxPartySize + 1)
            .Select(index => new GameCharacter(Guid.NewGuid(), $"Member {index}")).ToArray();
        foreach (var invalid in new[]
        {
            Request(1, "updateParty"),
            Request(1, "updateParty", party: [character, character]),
            Request(1, "updateParty", party: [character with { Name = " " }]),
            Request(1, "updateParty", party: [character with { Name = " padded " }]),
            Request(1, "updateParty", party: [character with { Name = "Line\nbreak" }]),
            Request(1, "updateParty", party: [character with { Name = new string('a', GameLimits.MaxCharacterNameLength + 1) }]),
            Request(1, "updateParty", party: [character with { Id = Guid.Empty }]),
            Request(1, "updateParty", party: oversized),
            Request(1, "updateParty", party: [], minutes: 1),
            Request(1, "shortRest", minutes: 60),
            Request(1, "shortRest", party: [character])
        })
        {
            AssertFailure(await ExecuteAsync(connectionString, campaignId, invalid), 400, "invalid_game_operation");
            Require(SameJson(Success(await ReadAsync(connectionString, campaignId)), configured),
                "An invalid party edit or short-rest payload must preserve the roster, revision and state.");
        }
        await AssertCountsAsync(connectionString, campaignId, 1, 1);
        var edit = Request(1, "updateParty", party: [character with { Name = "Accepted rename" }]);
        var results = await Task.WhenAll(ExecuteAsync(connectionString, campaignId, edit),
            ExecuteAsync(connectionString, campaignId, Request(1, "shortRest")));
        Require(results.Count(x => x.StatusCode == 200) == 1 &&
            results.Count(x => x.StatusCode == 409 && x.Code == "game_revision_conflict") == 1,
            "Party edits and time operations must share one optimistic revision and serialize atomically.");
        var winner = Success(results.Single(x => x.StatusCode == 200));
        Require(SameJson(Success(await ReadAsync(connectionString, campaignId)), winner),
            "The latest roster, clock and module state must match the sole concurrent winner.");
        await AssertCountsAsync(connectionString, campaignId, 1, 2);
        AssertFailure(await ExecuteAsync(connectionString, campaignId, Request(1, "updateParty", party: [])),
            409, "game_revision_conflict");
    }

    private static async Task RegisteredModulesSupportNeutralGameplayAsync(string connectionString)
    {
        var campaignId = await SeedCampaignAsync(connectionString, "neutral-test-module");
        var empty = Success(await ReadAsync(connectionString, campaignId));
        Require(empty.Revision == 0 && empty.Snapshot.ModuleState.GetRawText() == "{}",
            "A registered content module without adventure rules must support neutral campaign gameplay.");
        var character = new GameCharacter(Guid.NewGuid(), "Neutral member");
        var configured = Success(await ExecuteAsync(connectionString, campaignId,
            Request(0, "configureParty", party: [character])));
        var rested = Success(await ExecuteAsync(connectionString, campaignId, Request(configured.Revision, "shortRest")));
        var renamed = Success(await ExecuteAsync(connectionString, campaignId,
            Request(rested.Revision, "updateParty", party: [character with { Name = "Neutral rename" }])));
        Require(renamed.Snapshot.TimeMinutes == 60 && renamed.Snapshot.Party.Single().Name == "Neutral rename" &&
            renamed.Snapshot.ModuleState.GetRawText() == "{}",
            "Neutral modules must support party editing and clock operations without module-specific gameplay rules.");
        AssertFailure(await ExecuteAsync(connectionString, campaignId, Request(renamed.Revision, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "unknown" }))), 400, "game_module_command_unsupported");
        var restored = Success(await ExecuteAsync(connectionString, campaignId, Request(renamed.Revision, "undo")));
        Require(SameJson(restored.Snapshot, rested.Snapshot), "Neutral party edits must participate in the same atomic undo history.");

        await using (var db = CreateDb(connectionString))
        {
            var saved = await db.GameStates.SingleAsync(x => x.CampaignId == campaignId);
            var json = RequiredObject(JsonNode.Parse(saved.SnapshotJson));
            json["moduleState"] = JsonNode.Parse("{\"unknownAdventureState\":true}");
            saved.SnapshotJson = json.ToJsonString();
            await db.SaveChangesAsync();
        }
        await AssertInvalidStoredDataAsync(() => ReadAsync(connectionString, campaignId));
        await AssertInvalidStoredDataAsync(() => ExecuteAsync(connectionString, campaignId,
            Request(restored.Revision, "updateParty", party: [])));
        await using (var db = CreateDb(connectionString))
        {
            var saved = await db.GameStates.AsNoTracking().SingleAsync(x => x.CampaignId == campaignId);
            Require(saved.Revision == restored.Revision && JsonSerializer.Deserialize<JsonElement>(saved.SnapshotJson)
                .GetProperty("moduleState").GetProperty("unknownAdventureState").GetBoolean(),
                "A module with absent adventure rules must refuse unknown saved state without resetting or discarding it.");
        }
        await AssertCountsAsync(connectionString, campaignId, 1, 4);
        var missing = await SeedCampaignAsync(connectionString, "unregistered-test-module");
        AssertFailure(await ReadAsync(connectionString, missing), 409, "game_module_unavailable");
        AssertFailure(await ExecuteAsync(connectionString, missing, Request(0, "updateParty", party: [character])),
            409, "game_module_unavailable");
        await AssertCountsAsync(connectionString, missing, 0, 0);
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

    private static async Task PeriodicRecoveryReceiptsAndUndoAsync(string connectionString)
    {
        var campaignId = await SeedCampaignAsync(connectionString);
        var character = new GameCharacter(Guid.NewGuid(), "Periodic recovery member");
        var state = Success(await ExecuteAsync(connectionString, campaignId,
            Request(0, "configureParty", party: [character])));
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "advanceTime", minutes: 720)));
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = character.Id, success = false }))));
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "longRest")));
        AssertCheck(state, character.Id, "rest", 1200);
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = character.Id, success = true, d6 = 4 }))));
        Require(Character(state, character.Id).GetProperty("nextCheck").GetProperty("minute").GetInt64() == 1920,
            "Confirmed long-rest recovery must persist a twelve-hour timer from its end, replacing the previous deadline.");
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "advanceTime", minutes: 720)));
        AssertCheck(state, character.Id, "recovery", 1920);
        var before = state;
        var recoveryRequest = Request(state.Revision, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = character.Id, success = false }));
        var receipt = Success(await ExecuteAsync(connectionString, campaignId, recoveryRequest));
        Require(receipt.Revision == before.Revision + 1 && receipt.Snapshot.TimeMinutes == before.Snapshot.TimeMinutes &&
            Character(receipt, character.Id).GetProperty("failures").GetInt32() == 1 &&
            Character(receipt, character.Id).GetProperty("dc").GetInt32() == 11 &&
            Character(receipt, character.Id).GetProperty("nextCheck").GetProperty("minute").GetInt64() == 2640,
            "A periodic recovery must atomically persist its outcome, timer and next revision without advancing the clock.");
        Require(SameJson(Success(await ExecuteAsync(connectionString, campaignId, recoveryRequest)), receipt),
            "Retrying a periodic recovery must return the original receipt without incrementing failures twice.");
        AssertFailure(await ExecuteAsync(connectionString, campaignId,
            Request(before.Revision, "advanceTime", minutes: 1)), 409, "game_revision_conflict");
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(receipt.Revision, "undo")));
        Require(SameJson(state.Snapshot, before.Snapshot),
            "Undoing periodic recovery must restore its original DC, failure count and pending timer atomically.");
        Require(SameJson(Success(await ExecuteAsync(connectionString, campaignId, recoveryRequest)), receipt) &&
            SameJson(Success(await ReadAsync(connectionString, campaignId)), state),
            "Replaying an undone periodic check must preserve its historical receipt without reapplying its outcome.");
        await AssertCountsAsync(connectionString, campaignId, 1, 8);
    }

    private static async Task LegacyStateAndReceiptsSurviveUpgradeAsync(string connectionString)
    {
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
        var upgraded = Success(await ReadAsync(connectionString, campaignId));
        Require(upgraded.Revision == 1 && upgraded.Snapshot.ModuleSchemaVersion == 2 &&
            upgraded.Snapshot.Party.Single() == character && upgraded.Snapshot.TimeMinutes == 1080 &&
            Character(upgraded, character.Id).GetProperty("dc").GetInt32() == 9 &&
            Character(upgraded, character.Id).GetProperty("nextCheck").GetProperty("minute").GetInt64() == 1800,
            "Reading legacy state must project the new timer while preserving confirmed names, IDs, clock, outcomes and revision.");
        await using (var db = CreateDb(connectionString))
        {
            var stored = await db.GameStates.AsNoTracking().SingleAsync(x => x.CampaignId == campaignId);
            Require(SameJson(JsonSerializer.Deserialize<JsonElement>(stored.SnapshotJson),
                JsonSerializer.Deserialize<JsonElement>(originalSnapshotJson)) && stored.Revision == 1,
                "A read-only upgrade must not rewrite the stored legacy snapshot or advance its revision.");
        }
        Require(SameJson(Success(await ExecuteAsync(connectionString, campaignId, oldRequest)), oldReceipt),
            "A schema-one request retry must return its exact original rest-only receipt instead of a new projection.");
        var advanced = Success(await ExecuteAsync(connectionString, campaignId, Request(1, "advanceTime", minutes: 720)));
        AssertCheck(advanced, character.Id, "recovery", 1800);
        var resolved = Success(await ExecuteAsync(connectionString, campaignId, Request(advanced.Revision, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = character.Id, success = false }))));
        Require(Character(resolved, character.Id).GetProperty("dc").GetInt32() == 9 &&
            Character(resolved, character.Id).GetProperty("failures").GetInt32() == 1,
            "Current recovery must accumulate with confirmed legacy outcomes after the upgrade.");
        Require(SameJson(Success(await ExecuteAsync(connectionString, campaignId, oldRequest)), oldReceipt) &&
            SameJson(Success(await ReadAsync(connectionString, campaignId)), resolved),
            "An old receipt replay after current operations must not replace the latest clock, timer or outcomes.");
        var undo = Success(await ExecuteAsync(connectionString, campaignId, Request(resolved.Revision, "undo")));
        Require(SameJson(undo.Snapshot, advanced.Snapshot), "Undo must restore the current periodic check after upgrade.");
        undo = Success(await ExecuteAsync(connectionString, campaignId, Request(undo.Revision, "undo")));
        Require(SameJson(undo.Snapshot, upgraded.Snapshot), "Undoing time must preserve the upgraded legacy outcomes.");
        undo = Success(await ExecuteAsync(connectionString, campaignId, Request(undo.Revision, "undo")));
        Require(SameJson(undo.Snapshot, rules.Upgrade(beforeLegacy)),
            "Undoing a historical schema-one operation must restore and upgrade its own before-state without resetting infection.");
        Require(SameJson(Success(await ExecuteAsync(connectionString, campaignId, oldRequest)), oldReceipt),
            "An undone legacy receipt must remain replayable with its original schema and projection.");
        await using (var db = CreateDb(connectionString))
        {
            var operation = await db.GameOperations.AsNoTracking().SingleAsync(x => x.CampaignId == campaignId && x.RequestId == oldRequest.RequestId);
            Require(operation.Undone && SameJson(JsonSerializer.Deserialize<JsonElement>(operation.ResponseJson),
                JsonSerializer.Deserialize<JsonElement>(originalReceiptJson)),
                "Upgrade and undo must retain the immutable historical response while marking only the operation's undo flag.");
        }
        await AssertCountsAsync(connectionString, campaignId, 1, 6);
    }

    private static async Task ModuleUpgradeCannotChangeEngineStateAsync(string connectionString)
    {
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
        foreach (var mutate in mutations)
        {
            var campaignId = await SeedCampaignAsync(connectionString);
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
            Require(SameJson(Success(await ReadAsync(connectionString, campaignId)), confirmed),
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
                await ExecuteAsync(connectionString, campaignId, Request(1, "updateParty", party:
                    [configured.Snapshot.Party[0] with { Name = "Attempted rename" }, new(Guid.NewGuid(), "Attempted addition")]));
            }
            catch (PostgresException error) when (error.MessageText == "Injected journal persistence failure")
            {
                threw = true;
            }
            Require(threw, "An unexpected journal failure must propagate rather than report success.");
            Require(SameJson(Success(await ReadAsync(connectionString, campaignId)), configured),
                "A failed journal insert must roll back party names, membership, owned module state and revision in the same transaction.");
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

    private static GameplayService CreateService(AppDbContext db) => new(db, [new YthrynGameRules()], [new NeutralTestModule()]);

    private static async Task<Guid> SeedCampaignAsync(string connectionString, string moduleId = "ythryn")
    {
        await using var db = CreateDb(connectionString);
        var id = Guid.NewGuid();
        db.Campaigns.Add(new Campaign { Id = id, Title = "Gameplay integration specimen", ModuleId = moduleId, ModuleVersion = "1.0.0" });
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

    private static JsonElement StoredCharacter(GameStateResponse state, Guid id) =>
        state.Snapshot.ModuleState.GetProperty("characters").EnumerateArray().Single(x => x.GetProperty("id").GetGuid() == id);

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
