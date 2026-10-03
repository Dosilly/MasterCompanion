using System.Text.Json;
using System.Text.Json.Nodes;
using MasterCompanion.Contracts;
using MasterCompanion.Engine.Features.Gameplay;
using MasterCompanion.Engine.Persistence;
using MasterCompanion.Modules.Ythryn.Gameplay;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace MasterCompanion.Gameplay.Tests.Integration;

[Collection("PostgreSQL")]
public sealed class PartyPersistenceTests(PostgreSqlFixture database) : GameplayPersistenceTestBase(database)
{


    [Fact]
    public async Task Execute_PartyEditsAndShortRest_PreserveStateReplayAndUndo()
    {
        // Arrange
        var campaignId = await SeedCampaignAsync(connectionString);
        var first = new GameCharacter(Guid.NewGuid(), "Existing first");
        var second = new GameCharacter(Guid.NewGuid(), "Existing second");

        // Act
        var state = Success(await ExecuteAsync(connectionString, campaignId,
            Request(0, "configureParty", party: [first, second])));
        state = Success(await ExecuteAsync(connectionString, campaignId,
            Request(state.Revision, "advanceTime", minutes: 720)));
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = first.Id, success = false }))));
        var beforeShortRest = state;
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "shortRest")));

        // Assert
        Assert.True(state.Snapshot.TimeMinutes == 780 && state.Snapshot.RestEnds.Count == 0 &&
            SameJson(state.Snapshot.ModuleState, beforeShortRest.Snapshot.ModuleState) &&
            Character(state, first.Id).GetProperty("nextCheck").GetProperty("kind").GetString() == "recovery" &&
            Character(state, first.Id).GetProperty("nextCheck").GetProperty("minute").GetInt64() == 1440 &&
            !Character(state, first.Id).GetProperty("nextCheck").GetProperty("pending").GetBoolean() &&
            state.LastOperation?.Kind == "shortRest",
            "A confirmed short rest must advance one hour without scheduling long-rest recovery or changing infection state.");

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "longRest")));
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = first.Id, success = true, d6 = 6 }))));
        var recovered = state;
        var edit = Request(state.Revision, "updateParty", party: [second with { Name = "Renamed second" }, first with { Name = "Renamed first" }]);
        var renamed = Success(await ExecuteAsync(connectionString, campaignId, edit));

        // Assert
        Assert.True(renamed.Snapshot.Party.Select(x => x.Id).SequenceEqual([second.Id, first.Id]) &&
            renamed.Snapshot.Party[1].Name == "Renamed first" &&
            SameJson(StoredCharacter(recovered, first.Id), StoredCharacter(renamed, first.Id)) &&
            SameJson(StoredCharacter(recovered, second.Id), StoredCharacter(renamed, second.Id)) &&
            renamed.Snapshot.TimeMinutes == recovered.Snapshot.TimeMinutes &&
            renamed.Snapshot.RestEnds.SequenceEqual(recovered.Snapshot.RestEnds),
            "Renaming and reordering must persist the roster without resetting existing module state, time or rest history.");
        var added = new GameCharacter(Guid.NewGuid(), "New arrival");

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId,
            Request(renamed.Revision, "updateParty", party: [.. renamed.Snapshot.Party, added])));
        var nextCheck = Character(state, added.Id).GetProperty("nextCheck");

        // Assert
        Assert.True(nextCheck.GetProperty("minute").GetInt64() == state.Snapshot.TimeMinutes + 720 &&
            !nextCheck.GetProperty("pending").GetBoolean() &&
            SameJson(StoredCharacter(renamed, first.Id), StoredCharacter(state, first.Id)),
            "Joining later must initialize only the new member at current game time.");
        Assert.True(SameJson(Success(await ExecuteAsync(connectionString, campaignId, edit)), renamed),
            "An older party edit retry must return its exact original receipt after a later edit.");
        Assert.True(SameJson(Success(await ReadAsync(connectionString, campaignId)), state),
            "Reading after an old party receipt replay must retain the latest confirmed roster.");

        var beforeRemoval = state;

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId,
            Request(state.Revision, "updateParty", party: [added])));

        // Assert
        Assert.True(state.Snapshot.Party.Single().Id == added.Id &&
            state.Snapshot.ModuleState.GetProperty("characters").GetArrayLength() == 1,
            "Removal must atomically remove selected party identities and their owned module state.");

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "undo")));

        // Assert
        Assert.True(SameJson(state.Snapshot, beforeRemoval.Snapshot),
            "Undoing removal must restore the complete previous roster and infection state, rather than reinitialize members.");

        var beforeEmpty = state;

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "updateParty", party: [])));
        var empty = state;

        // Assert
        Assert.True(empty.Snapshot.Party.Count == 0 && empty.Snapshot.TimeMinutes == beforeEmpty.Snapshot.TimeMinutes &&
            empty.Snapshot.RestEnds.SequenceEqual(beforeEmpty.Snapshot.RestEnds) &&
            empty.ModuleView.GetProperty("characters").GetArrayLength() == 0,
            "Removing every member must preserve the campaign clock and long-rest history.");
        Assert.True(SameJson(Success(await ReadAsync(connectionString, campaignId)), empty),
            "An empty roster at nonzero time must remain readable in a separate database context.");
        AssertFailure(await ExecuteAsync(connectionString, campaignId, Request(empty.Revision, "shortRest")), 409, "game_party_required");

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId,
            Request(empty.Revision, "updateParty", party: [first])));

        // Assert
        Assert.True(Character(state, first.Id).GetProperty("status").GetString() == "healthy" &&
            Character(state, first.Id).GetProperty("nextCheck").GetProperty("minute").GetInt64() == empty.Snapshot.TimeMinutes + 720,
            "Adding a member to an empty roster must initialize current-time state without inheriting a removed infection.");

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "undo")));

        // Assert
        Assert.True(SameJson(state.Snapshot, empty.Snapshot), "Undo must restore an empty roster with its nonzero clock and rest history.");

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "undo")));

        // Assert
        Assert.True(SameJson(state.Snapshot, beforeEmpty.Snapshot), "Sequential undo must recover every removed member's original state.");
        await AssertCountsAsync(connectionString, campaignId, 1, 14);
    }

    [Fact]
    public async Task UpdateParty_InvalidOrConcurrentRequests_PreserveConfirmedRevision()
    {
        // Arrange
        var campaignId = await SeedCampaignAsync(connectionString);
        var character = new GameCharacter(Guid.NewGuid(), "Validated member");

        // Act
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

            // Assert
            AssertFailure(await ExecuteAsync(connectionString, campaignId, invalid), 400, "invalid_game_operation");
            Assert.True(SameJson(Success(await ReadAsync(connectionString, campaignId)), configured),
                "An invalid party edit or short-rest payload must preserve the roster, revision and state.");
        }
        await AssertCountsAsync(connectionString, campaignId, 1, 1);
        var edit = Request(1, "updateParty", party: [character with { Name = "Accepted rename" }]);
        var results = await Task.WhenAll(ExecuteAsync(connectionString, campaignId, edit),
            ExecuteAsync(connectionString, campaignId, Request(1, "shortRest")));

        // Assert
        Assert.True(results.Count(x => x.StatusCode == 200) == 1 &&
            results.Count(x => x.StatusCode == 409 && x.Code == "game_revision_conflict") == 1,
            "Party edits and time operations must share one optimistic revision and serialize atomically.");
        var winner = Success(results.Single(x => x.StatusCode == 200));
        Assert.True(SameJson(Success(await ReadAsync(connectionString, campaignId)), winner),
            "The latest roster, clock and module state must match the sole concurrent winner.");
        await AssertCountsAsync(connectionString, campaignId, 1, 2);
        AssertFailure(await ExecuteAsync(connectionString, campaignId, Request(1, "updateParty", party: [])),
            409, "game_revision_conflict");
    }

    [Fact]
    public async Task Execute_NeutralModule_UsesGenericGameplayWithoutYthrynRules()
    {
        // Arrange
        var campaignId = await SeedCampaignAsync(connectionString, "neutral-test-module");

        // Act
        var empty = Success(await ReadAsync(connectionString, campaignId));

        // Assert
        Assert.True(empty.Revision == 0 && empty.Snapshot.ModuleState.GetRawText() == "{}",
            "A registered content module without adventure rules must support neutral campaign gameplay.");
        var character = new GameCharacter(Guid.NewGuid(), "Neutral member");

        // Act
        var configured = Success(await ExecuteAsync(connectionString, campaignId,
            Request(0, "configureParty", party: [character])));
        var rested = Success(await ExecuteAsync(connectionString, campaignId, Request(configured.Revision, "shortRest")));
        var renamed = Success(await ExecuteAsync(connectionString, campaignId,
            Request(rested.Revision, "updateParty", party: [character with { Name = "Neutral rename" }])));

        // Assert
        Assert.True(renamed.Snapshot.TimeMinutes == 60 && renamed.Snapshot.Party.Single().Name == "Neutral rename" &&
            renamed.Snapshot.ModuleState.GetRawText() == "{}",
            "Neutral modules must support party editing and clock operations without module-specific gameplay rules.");
        AssertFailure(await ExecuteAsync(connectionString, campaignId, Request(renamed.Revision, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "unknown" }))), 400, "game_module_command_unsupported");

        // Act
        var restored = Success(await ExecuteAsync(connectionString, campaignId, Request(renamed.Revision, "undo")));

        // Assert
        Assert.True(SameJson(restored.Snapshot, rested.Snapshot), "Neutral party edits must participate in the same atomic undo history.");

        await using (var db = CreateDb(connectionString))
        {
            var saved = await db.GameStates.SingleAsync(x => x.CampaignId == campaignId);
            var json = RequiredObject(JsonNode.Parse(saved.SnapshotJson));
            json["moduleState"] = JsonNode.Parse("{\"unknownAdventureState\":true}");
            saved.SnapshotJson = json.ToJsonString();
            await db.SaveChangesAsync();
        }

        // Act
        await AssertInvalidStoredDataAsync(() => ReadAsync(connectionString, campaignId));
        await AssertInvalidStoredDataAsync(() => ExecuteAsync(connectionString, campaignId,
            Request(restored.Revision, "updateParty", party: [])));
        await using (var db = CreateDb(connectionString))
        {
            var saved = await db.GameStates.AsNoTracking().SingleAsync(x => x.CampaignId == campaignId);
            Assert.True(saved.Revision == restored.Revision && JsonSerializer.Deserialize<JsonElement>(saved.SnapshotJson)
                .GetProperty("moduleState").GetProperty("unknownAdventureState").GetBoolean(),
                "A module with absent adventure rules must refuse unknown saved state without resetting or discarding it.");
        }
        await AssertCountsAsync(connectionString, campaignId, 1, 4);
        var missing = await SeedCampaignAsync(connectionString, "unregistered-test-module");

        // Assert
        AssertFailure(await ReadAsync(connectionString, missing), 409, "game_module_unavailable");
        AssertFailure(await ExecuteAsync(connectionString, missing, Request(0, "updateParty", party: [character])),
            409, "game_module_unavailable");
        await AssertCountsAsync(connectionString, missing, 0, 0);
    }
}
