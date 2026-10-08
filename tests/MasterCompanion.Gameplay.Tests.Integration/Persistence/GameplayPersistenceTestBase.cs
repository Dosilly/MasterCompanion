using System.Text.Json;
using System.Text.Json.Nodes;
using MasterCompanion.Contracts;
using MasterCompanion.Engine.Features.Gameplay;
using MasterCompanion.Engine.Persistence;
using MasterCompanion.Modules.Ythryn.Gameplay;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Gameplay.Tests.Integration.Persistence;

public abstract class GameplayPersistenceTestBase(PostgreSqlFixture database) : IAsyncLifetime
{
    protected string connectionString = string.Empty;
    protected readonly List<Guid> ownedCampaigns = [];

    public async Task InitializeAsync()
    {
        connectionString = await database.CreateDatabaseAsync();
        await using var db = CreateDb(connectionString);
        await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        await using var db = CreateDb(connectionString);
        await db.Characters.Where(x => ownedCampaigns.Contains(x.CampaignId)).ExecuteDeleteAsync();
        await db.Materials.Where(x => ownedCampaigns.Contains(x.CampaignId)).ExecuteDeleteAsync();
        await db.Maps.Where(x => ownedCampaigns.Contains(x.CampaignId)).ExecuteDeleteAsync();
        await db.GameOperations.Where(x => ownedCampaigns.Contains(x.CampaignId)).ExecuteDeleteAsync();
        await db.GameStates.Where(x => ownedCampaigns.Contains(x.CampaignId)).ExecuteDeleteAsync();
        await db.Folders.Where(x => ownedCampaigns.Contains(x.CampaignId)).ExecuteDeleteAsync();
        await db.Campaigns.Where(x => ownedCampaigns.Contains(x.Id)).ExecuteDeleteAsync();
    }

    protected static AppDbContext CreateDb(string connectionString) =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).Options);

    protected static JsonObject RequiredObject(JsonNode? node) => node?.AsObject()
        ?? throw new InvalidOperationException("The test fixture is missing an expected JSON object.");

    protected static async Task AssertInvalidStoredDataAsync(Func<Task<GameExecution>> action)
    {
        var rejected = false;
        try { await action(); }
        catch (InvalidOperationException) { rejected = true; }
        Assert.True(rejected, "Corrupted stored gameplay data must throw rather than return a successful or expected HTTP outcome.");
    }

    protected static GameplayService CreateService(AppDbContext db) => new(db, [new YthrynGameRules()], [new NeutralTestModule()]);

    protected async Task<Guid> SeedCampaignAsync(string connectionString, string moduleId = "ythryn")
    {
        await using var db = CreateDb(connectionString);
        var id = Guid.NewGuid();
        ownedCampaigns.Add(id);
        db.Campaigns.Add(new Campaign { Id = id, Title = "Gameplay integration specimen", ModuleId = moduleId, ModuleVersion = "1.0.0" });
        await db.SaveChangesAsync();
        return id;
    }

    protected static async Task<GameExecution> ExecuteAsync(string connectionString, Guid campaignId, GameOperationRequest request,
        CancellationToken token = default)
    {
        await using var db = CreateDb(connectionString);
        return await CreateService(db).ExecuteAsync(campaignId, request, token);
    }

    protected static async Task<GameExecution> ReadAsync(string connectionString, Guid campaignId)
    {
        await using var db = CreateDb(connectionString);
        return await CreateService(db).ReadAsync(campaignId);
    }

    protected static GameOperationRequest Request(long revision, string kind, GameCharacter[]? party = null,
        long? minutes = null, JsonElement? command = null) => new(Guid.NewGuid(), revision, kind, party, minutes, command);

    protected static GameStateResponse Success(GameExecution result) => result is { StatusCode: 200, Response: { } response }
        ? response : throw new InvalidOperationException($"Expected accepted game operation, received {result.StatusCode} ({result.Code}).");

    protected static void AssertFailure(GameExecution result, int status, string code) =>
        Assert.True(result.StatusCode == status && result.Code == code && result.Response is null,
            $"Expected {status}/{code}, received {result.StatusCode}/{result.Code}.");

    protected static JsonElement Character(GameStateResponse state, Guid id) =>
        state.ModuleView.GetProperty("characters").EnumerateArray().Single(x => x.GetProperty("id").GetGuid() == id);

    protected static JsonElement StoredCharacter(GameStateResponse state, Guid id) =>
        state.Snapshot.ModuleState.GetProperty("characters").EnumerateArray().Single(x => x.GetProperty("id").GetGuid() == id);

    protected static void AssertCheck(GameStateResponse state, Guid id, string kind, long minute)
    {
        var check = Character(state, id).GetProperty("nextCheck");
        Assert.True(check.GetProperty("kind").GetString() == kind && check.GetProperty("minute").GetInt64() == minute &&
            check.GetProperty("pending").GetBoolean(), "The persisted state must expose the oldest pending check with its original deadline.");
    }

    protected static async Task AssertCountsAsync(string connectionString, Guid campaignId, int states, int operations)
    {
        await using var db = CreateDb(connectionString);
        Assert.True(await db.GameStates.CountAsync(x => x.CampaignId == campaignId) == states &&
            await db.GameOperations.CountAsync(x => x.CampaignId == campaignId) == operations,
            "Persisted state and journal counts must match accepted operations only.");
    }

    protected static bool SameJson<T>(T left, T right) =>
        JsonElement.DeepEquals(JsonSerializer.SerializeToElement(left), JsonSerializer.SerializeToElement(right));
}
