using System.Text.Json;
using System.Text.Json.Nodes;
using MasterCompanion.Engine.Features.Gameplay;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Gameplay.Tests.Integration.Persistence;

[Collection("PostgreSQL")]
public sealed class RivalForcesPersistenceTests(PostgreSqlFixture database) : GameplayPersistenceTestBase(database)
{
    private static int Count(GameStateResponse state, string unit) => state.ModuleView.GetProperty("forces").GetProperty(unit).GetInt32();

    [Fact]
    public async Task ConfirmAuril_SurvivingCultists_ConversionReplaysAndUndoesAtomically()
    {
        var campaignId = await SeedCampaignAsync(connectionString);
        var initial = Success(await ExecuteAsync(connectionString, campaignId, Request(0, "configureParty", party: [new(Guid.NewGuid(), "Authored name")])));
        var before = Success(await ExecuteAsync(connectionString, campaignId, Request(initial.Revision, "module",
            command: JsonSerializer.SerializeToElement(new { kind = "recordForceLoss", unit = "cultFanatics", count = 5 }))));
        var request = Request(before.Revision, "module", command: JsonSerializer.SerializeToElement(new { kind = "confirmArrival", faction = "auril", minute = 0 }));

        var after = Success(await ExecuteAsync(connectionString, campaignId, request));
        var replay = Success(await ExecuteAsync(connectionString, campaignId, request));

        Assert.Equal(before.Revision + 1, after.Revision);
        Assert.Equal(0, Count(after, "cultFanatics"));
        Assert.Equal(15, Count(after, "coldlightWalkers"));
        Assert.Equal(15, Count(after, "convertedCultists"));
        Assert.Equal(0, after.Snapshot.TimeMinutes);
        Assert.True(SameJson(after, replay));
        Assert.True(SameJson(after, Success(await ReadAsync(connectionString, campaignId))));
        await AssertCountsAsync(connectionString, campaignId, 1, 3);

        var undone = Success(await ExecuteAsync(connectionString, campaignId, Request(after.Revision, "undo")));

        Assert.True(SameJson(before.Snapshot, undone.Snapshot));
        Assert.Equal(15, Count(undone, "cultFanatics"));
        Assert.Equal(0, Count(undone, "coldlightWalkers"));
        Assert.Equal(JsonValueKind.Null, undone.ModuleView.GetProperty("expedition").GetProperty("auril").GetProperty("arrivedAt").ValueKind);
    }

    [Fact]
    public async Task RecordLoss_RetryConflictAndInvalidCount_PreserveConfirmedResources()
    {
        var campaignId = await SeedCampaignAsync(connectionString);
        var before = Success(await ExecuteAsync(connectionString, campaignId, Request(0, "configureParty", party: [new(Guid.NewGuid(), "Authored name")])));
        var request = Request(before.Revision, "module", command: JsonSerializer.SerializeToElement(new { kind = "recordForceLoss", unit = "winterWolves", count = 2 }));

        var after = Success(await ExecuteAsync(connectionString, campaignId, request));
        var replay = Success(await ExecuteAsync(connectionString, campaignId, request));
        var conflict = await ExecuteAsync(connectionString, campaignId, Request(before.Revision, "module", command: JsonSerializer.SerializeToElement(new { kind = "recordForceLoss", unit = "winterWolves", count = 1 })));
        var invalid = await ExecuteAsync(connectionString, campaignId, Request(after.Revision, "module", command: JsonSerializer.SerializeToElement(new { kind = "recordForceLoss", unit = "winterWolves", count = 5 })));

        Assert.Equal(4, Count(after, "winterWolves"));
        Assert.True(SameJson(after, replay));
        AssertFailure(conflict, 409, "game_revision_conflict");
        AssertFailure(invalid, 400, "invalid_module_command");
        Assert.True(SameJson(after, Success(await ReadAsync(connectionString, campaignId))));
        await AssertCountsAsync(connectionString, campaignId, 1, 2);

        var undone = Success(await ExecuteAsync(connectionString, campaignId, Request(after.Revision, "undo")));

        Assert.True(SameJson(before.Snapshot, undone.Snapshot));
    }

    [Theory]
    [InlineData(false, 20, 0)]
    [InlineData(true, 0, 20)]
    public async Task Read_SchemaThree_ProjectsForcesWithoutChangingStoredStateOrReceipt(bool arrived, int cultists, int walkers)
    {
        var campaignId = await SeedCampaignAsync(connectionString);
        var current = Success(await ExecuteAsync(connectionString, campaignId, Request(0, "configureParty", party: [new(Guid.NewGuid(), "Preserved name")])));
        if (arrived)
        {
            current = Success(await ExecuteAsync(connectionString, campaignId, Request(current.Revision, "module", command: JsonSerializer.SerializeToElement(new { kind = "confirmArrival", faction = "auril", minute = 0 }))));
        }
        var node = RequiredObject(JsonNode.Parse(current.Snapshot.ModuleState.GetRawText()));
        node.Remove("forces");
        var historical = current.Snapshot with { ModuleSchemaVersion = 3, ModuleState = JsonSerializer.SerializeToElement(node) };
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var original = JsonSerializer.Serialize(historical, options);
        string receipt;
        await using (var db = CreateDb(connectionString))
        {
            var state = await db.GameStates.SingleAsync(x => x.CampaignId == campaignId);
            state.SnapshotJson = original;
            await db.SaveChangesAsync();
            await db.Entry(state).ReloadAsync();
            original = state.SnapshotJson;
            receipt = (await db.GameOperations.AsNoTracking().OrderByDescending(x => x.Revision).FirstAsync(x => x.CampaignId == campaignId)).ResponseJson;
        }

        var read = Success(await ReadAsync(connectionString, campaignId));

        Assert.Equal(current.Revision, read.Revision);
        Assert.Equal(4, read.Snapshot.ModuleSchemaVersion);
        Assert.Equal(cultists, Count(read, "cultFanatics"));
        Assert.Equal(walkers, Count(read, "coldlightWalkers"));
        Assert.True(SameJson(historical.Party, read.Snapshot.Party));
        Assert.True(SameJson(historical.ModuleState.GetProperty("adventure"), read.Snapshot.ModuleState.GetProperty("adventure")));
        await using var verification = CreateDb(connectionString);
        Assert.Equal(original, (await verification.GameStates.AsNoTracking().SingleAsync(x => x.CampaignId == campaignId)).SnapshotJson);
        Assert.Equal(receipt, (await verification.GameOperations.AsNoTracking().OrderByDescending(x => x.Revision).FirstAsync(x => x.CampaignId == campaignId)).ResponseJson);
    }
}
