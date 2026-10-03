using System.Text.Json;
using MasterCompanion.Contracts;
using MasterCompanion.Engine.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Gameplay.Tests.Integration.Persistence;

[Collection("PostgreSQL")]
public sealed class RecoveryPersistenceTests(PostgreSqlFixture database) : GameplayPersistenceTestBase(database)
{

    [Fact]
    public async Task Execute_DeferredChecks_PreserveChronologyAndMaterialContent()
    {
        // Arrange
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

        // Act
        var configured = Success(await ExecuteAsync(connectionString, campaignId,
            Request(0, "configureParty", party: [first, second])));

        // Assert
        Assert.True(configured.Revision == 1, "Party initialization must advance the game revision.");

        // Act
        Success(await ExecuteAsync(connectionString, campaignId, Request(1, "advanceTime", minutes: 600)));
        var rest = Success(await ExecuteAsync(connectionString, campaignId, Request(2, "longRest")));

        // Assert
        Assert.True(rest.Snapshot.TimeMinutes == 1080 && rest.Snapshot.RestEnds.SequenceEqual([1080L]),
            "Shared rest must persist the elapsed time and its end together.");
        AssertCheck(rest, first.Id, "exposure", 720);
        AssertCheck(rest, second.Id, "exposure", 720);

        // Act
        var infected = Success(await ExecuteAsync(connectionString, campaignId, Request(3, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = first.Id, success = false }))));

        // Assert
        Assert.True(Character(infected, first.Id).GetProperty("status").GetString() == "infected",
            "The deferred exposure failure must infect the selected character.");
        AssertCheck(infected, first.Id, "rest", 1080);
        Assert.True(Character(infected, second.Id).GetProperty("status").GetString() == "healthy",
            "One character's resolution must preserve the other character's health.");
        AssertCheck(infected, second.Id, "exposure", 720);

        // Act
        var resolved = Success(await ExecuteAsync(connectionString, campaignId, Request(4, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = first.Id, success = true, d6 = 6 }))));

        // Assert
        Assert.True(resolved.Snapshot.TimeMinutes == 1080 && Character(resolved, first.Id).GetProperty("dc").GetInt32() == 9,
            "Resolving a rest must preserve time and apply the supplied die to the selected character.");

        // Act
        var persisted = Success(await ReadAsync(connectionString, campaignId));

        // Assert
        Assert.True(persisted.Revision == 5 && SameJson(persisted.Snapshot, resolved.Snapshot),
            "A fresh context must recover the complete confirmed gameplay snapshot.");

        // Act
        var undo = Success(await ExecuteAsync(connectionString, campaignId, Request(5, "undo")));

        // Assert
        Assert.True(SameJson(undo.Snapshot, infected.Snapshot), "Undo must restore the module state before the resolved rest.");

        await using (var db = CreateDb(connectionString))
        {
            var material = await db.Materials.AsNoTracking().SingleAsync(x => x.Id == materialId);
            Assert.True(material.Revision == 7 && SameJson(JsonSerializer.Deserialize<JsonElement>(document),
                JsonSerializer.Deserialize<JsonElement>(material.DocumentJson)),
                "Gameplay and undo must preserve authored material content and its independent revision.");
            Assert.True(!await db.GameStates.AnyAsync(x => x.CampaignId == untouchedCampaign) &&
                !await db.GameOperations.AnyAsync(x => x.CampaignId == untouchedCampaign),
                "Gameplay writes must remain scoped to the selected campaign.");
        }
    }

    [Fact]
    public async Task ResolveRecovery_PeriodicOutcome_ReplaysAndUndoesAtomically()
    {
        // Arrange
        var campaignId = await SeedCampaignAsync(connectionString);
        var character = new GameCharacter(Guid.NewGuid(), "Periodic recovery member");

        // Act
        var state = Success(await ExecuteAsync(connectionString, campaignId,
            Request(0, "configureParty", party: [character])));
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "advanceTime", minutes: 720)));
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = character.Id, success = false }))));
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "longRest")));

        // Assert
        AssertCheck(state, character.Id, "rest", 1200);

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = character.Id, success = true, d6 = 4 }))));

        // Assert
        Assert.True(Character(state, character.Id).GetProperty("nextCheck").GetProperty("minute").GetInt64() == 1920,
            "Confirmed long-rest recovery must persist a twelve-hour timer from its end, replacing the previous deadline.");

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(state.Revision, "advanceTime", minutes: 720)));

        // Assert
        AssertCheck(state, character.Id, "recovery", 1920);
        var before = state;
        var recoveryRequest = Request(state.Revision, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = character.Id, success = false }));

        // Act
        var receipt = Success(await ExecuteAsync(connectionString, campaignId, recoveryRequest));

        // Assert
        Assert.True(receipt.Revision == before.Revision + 1 && receipt.Snapshot.TimeMinutes == before.Snapshot.TimeMinutes &&
            Character(receipt, character.Id).GetProperty("failures").GetInt32() == 1 &&
            Character(receipt, character.Id).GetProperty("dc").GetInt32() == 11 &&
            Character(receipt, character.Id).GetProperty("nextCheck").GetProperty("minute").GetInt64() == 2640,
            "A periodic recovery must atomically persist its outcome, timer and next revision without advancing the clock.");
        Assert.True(SameJson(Success(await ExecuteAsync(connectionString, campaignId, recoveryRequest)), receipt),
            "Retrying a periodic recovery must return the original receipt without incrementing failures twice.");
        AssertFailure(await ExecuteAsync(connectionString, campaignId,
            Request(before.Revision, "advanceTime", minutes: 1)), 409, "game_revision_conflict");

        // Act
        state = Success(await ExecuteAsync(connectionString, campaignId, Request(receipt.Revision, "undo")));

        // Assert
        Assert.True(SameJson(state.Snapshot, before.Snapshot),
            "Undoing periodic recovery must restore its original DC, failure count and pending timer atomically.");
        Assert.True(SameJson(Success(await ExecuteAsync(connectionString, campaignId, recoveryRequest)), receipt) &&
            SameJson(Success(await ReadAsync(connectionString, campaignId)), state),
            "Replaying an undone periodic check must preserve its historical receipt without reapplying its outcome.");
        await AssertCountsAsync(connectionString, campaignId, 1, 8);
    }
}
