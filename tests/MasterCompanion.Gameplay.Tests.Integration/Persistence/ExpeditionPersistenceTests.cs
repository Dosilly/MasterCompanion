using System.Text.Json;

namespace MasterCompanion.Gameplay.Tests.Integration.Persistence;

[Collection("PostgreSQL")]
public sealed class ExpeditionPersistenceTests(PostgreSqlFixture database) : GameplayPersistenceTestBase(database)
{

    [Fact]
    public async Task Expedition_Operations_CommitAtomicallyReplayAndUndo()
    {
        // Arrange
        var campaignId = await SeedCampaignAsync(connectionString);

        // Act
        var state = Success(await ExecuteAsync(connectionString, campaignId, Request(0, "configureParty", party: [new(Guid.NewGuid(), "Authored member")])));
        var initial = state;
        var exploration = Request(state.Revision, "module", minutes: 90, command: JsonSerializer.SerializeToElement(new { kind = "explore" }));
        state = Success(await ExecuteAsync(connectionString, campaignId, exploration));

        // Assert
        Assert.True(state.Snapshot.TimeMinutes == 90 && state.ModuleView.GetProperty("expedition").GetProperty("pending").GetArrayLength() == 1,
            "Exploration time, queue, revision and journal must commit together.");
        Assert.True(SameJson(Success(await ExecuteAsync(connectionString, campaignId, exploration)), state), "An uncertain exploration retry must not add time or checks twice.");

        // Act
        var rejected = await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "module", minutes: 29,
            command: JsonSerializer.SerializeToElement(new { kind = "searchBuilding", unnumbered = true, newBuilding = true })));

        // Assert
        AssertFailure(rejected, 400, "invalid_module_command");
        Assert.True(SameJson(Success(await ReadAsync(connectionString, campaignId)), state), "A rejected activity must not persist its proposed time advance.");

        // Act
        var stale = await ExecuteAsync(connectionString, campaignId, Request(initial.Revision, "module", minutes: 30,
            command: JsonSerializer.SerializeToElement(new { kind = "searchBuilding", unnumbered = true, newBuilding = true })));

        // Assert
        AssertFailure(stale, 409, "game_revision_conflict");
        var beforeSearch = state;

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "module", minutes: 30,
            command: JsonSerializer.SerializeToElement(new { kind = "searchBuilding", unnumbered = true, newBuilding = true }))));

        // Assert
        Assert.True(state.Snapshot.TimeMinutes == 120 && state.ModuleView.GetProperty("expedition").GetProperty("pending").GetArrayLength() == 3,
            "A search crossing an exploration hour must commit both occurrences atomically.");

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "undo")));

        // Assert
        Assert.True(SameJson(state.Snapshot, beforeSearch.Snapshot), "Undo must restore both engine time and the exact pending encounter queue.");
        var beforeRest = state;

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "longRest")));

        // Assert
        Assert.True(state.ModuleView.GetProperty("expedition").GetProperty("avarice").GetProperty("pending").GetBoolean() &&
            state.ModuleView.GetProperty("expedition").GetProperty("pending").GetArrayLength() == 1,
            "The first persisted rest must trigger Avarice's reminder without exploration rolls.");
        var beforeArrival = state;
        var arrival = Request(state.Revision, "module", command: JsonSerializer.SerializeToElement(new { kind = "confirmArrival", faction = "avarice", minute = state.Snapshot.TimeMinutes }));

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId, arrival));

        // Assert
        Assert.True(SameJson(Success(await ExecuteAsync(connectionString, campaignId, arrival)), state), "Arrival confirmation must be idempotent.");

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "undo")));

        // Assert
        Assert.True(SameJson(state.Snapshot, beforeArrival.Snapshot), "Undo must restore the unconfirmed arrival reminder.");

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "undo")));

        // Assert
        Assert.True(SameJson(state.Snapshot, beforeRest.Snapshot) && state.ModuleView.GetProperty("expedition").GetProperty("avarice").GetProperty("deadline").ValueKind == JsonValueKind.Null,
            "Undo of the first rest must restore waiting for a long rest.");
        var beforeRoll = state;
        var roll = Request(state.Revision, "module", command: JsonSerializer.SerializeToElement(new { kind = "resolveEncounter", checkId = 1, roll = 100 }));

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId, roll));

        // Assert
        Assert.True(state.ModuleView.GetProperty("expedition").GetProperty("lastResult").GetProperty("outcome").GetString() == "iriolarthas",
            "Confirmed dice results must survive a new database context.");
        Assert.True(SameJson(Success(await ExecuteAsync(connectionString, campaignId, roll)), state), "A roll retry must not resolve the next queued encounter.");

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "undo")));

        // Assert
        Assert.True(SameJson(state.Snapshot, beforeRoll.Snapshot), "Roll undo must restore the original check identity and result.");
        var zeroCampaign = await SeedCampaignAsync(connectionString);

        // Act
        var zeroState = Success(await ExecuteAsync(connectionString, zeroCampaign, Request(0, "configureParty", party: [new(Guid.NewGuid(), "First roster")])));
        zeroState = Success(await ExecuteAsync(connectionString, zeroCampaign, Request(zeroState.Revision, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "confirmArrival", faction = "avarice", minute = 0 }))));
        zeroState = Success(await ExecuteAsync(connectionString, zeroCampaign, Request(zeroState.Revision, "updateParty", party: [])));
        var newRoster = Success(await ExecuteAsync(connectionString, zeroCampaign, Request(zeroState.Revision, "configureParty", party: [new(Guid.NewGuid(), "Replacement roster")])));

        // Assert
        Assert.True(SameJson(zeroState.Snapshot.ModuleState.GetProperty("adventure"), newRoster.Snapshot.ModuleState.GetProperty("adventure")),
            "Configuring an empty roster at time zero must preserve existing campaign-owned arrival state.");
    }
}
