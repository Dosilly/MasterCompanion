using System.Net;
using System.Text;
using System.Text.Json;
using MasterCompanion.Engine.Features.Gameplay;
using MasterCompanion.Engine.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MasterCompanion.Gameplay.Tests.Integration;

[Collection("PostgreSQL")]
public sealed class HttpTests(PostgreSqlFixture database) : IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private string connectionString = string.Empty;
    private CampaignApiFactory? factory;
    private CampaignApiFactory App => factory ?? throw new InvalidOperationException("The test host has not started.");
    private HttpClient? httpClient;
    private HttpClient client => httpClient ?? throw new InvalidOperationException("The test client has not started.");
    private readonly Guid campaignId = Guid.NewGuid();
    private readonly Guid characterId = Guid.NewGuid();
    private string Path => $"/api/campaigns/{campaignId:D}/game";


    public async Task InitializeAsync()
    {
        connectionString = await database.CreateDatabaseAsync();
        await using (var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).Options))
        {
            await db.Database.MigrateAsync();
            db.Campaigns.Add(new Campaign { Id = campaignId, Title = "HTTP boundary specimen", ModuleId = "ythryn", ModuleVersion = "1.0.0" });
            db.Folders.Add(new CampaignFolder { CampaignId = campaignId, Id = "test-root", Title = "Test folder" });
            await db.SaveChangesAsync();
        }

        factory = new CampaignApiFactory(connectionString);
        httpClient = App.CreateClient();
    }

    public async Task DisposeAsync()
    {
        try
        {
            if (factory is null) return;
            await using var scope = App.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.GameOperations.Where(x => x.CampaignId == campaignId).ExecuteDeleteAsync();
            await db.GameStates.Where(x => x.CampaignId == campaignId).ExecuteDeleteAsync();
            await db.Folders.Where(x => x.CampaignId == campaignId).ExecuteDeleteAsync();
            await db.Campaigns.Where(x => x.Id == campaignId).ExecuteDeleteAsync();
        }
        finally
        {
            httpClient?.Dispose();
            if (factory is not null) await factory.DisposeAsync();
        }
    }

    private Task<GameStateResponse> ConfigurePartyAsync() => PostSuccessAsync(client, Path,
        new GameOperationRequest(Guid.NewGuid(), 0, "configureParty", [new(characterId, "HTTP character")]));

    [Fact]
    public async Task PostForceLoss_ThenAurilArrival_ConvertsSurvivorsAndUndoRestoresCultists()
    {
        var configured = await ConfigurePartyAsync();
        var before = await PostSuccessAsync(client, Path, new GameOperationRequest(Guid.NewGuid(), configured.Revision, "module",
            Command: JsonSerializer.SerializeToElement(new { kind = "recordForceLoss", unit = "cultFanatics", count = 5 })));
        var request = new GameOperationRequest(Guid.NewGuid(), before.Revision, "module",
            Command: JsonSerializer.SerializeToElement(new { kind = "confirmArrival", faction = "auril", minute = 0 }));

        var after = await PostSuccessAsync(client, Path, request);
        var replay = await PostSuccessAsync(client, Path, request);

        Assert.Equal(0, after.ModuleView.GetProperty("forces").GetProperty("cultFanatics").GetInt32());
        Assert.Equal(15, after.ModuleView.GetProperty("forces").GetProperty("coldlightWalkers").GetInt32());
        Assert.True(JsonElement.DeepEquals(JsonSerializer.SerializeToElement(after), JsonSerializer.SerializeToElement(replay)));

        var restored = await PostSuccessAsync(client, Path, new GameOperationRequest(Guid.NewGuid(), after.Revision, "undo"));

        Assert.True(JsonElement.DeepEquals(JsonSerializer.SerializeToElement(before.Snapshot), JsonSerializer.SerializeToElement(restored.Snapshot)));
    }

    [Fact]
    public async Task PostForceLoss_ExceedingRemainingCount_ReturnsProblemAndPreservesState()
    {
        var configured = await ConfigurePartyAsync();
        var request = new GameOperationRequest(Guid.NewGuid(), configured.Revision, "module",
            Command: JsonSerializer.SerializeToElement(new { kind = "recordForceLoss", unit = "gargoyles", count = 3 }));
        using var content = new StringContent(JsonSerializer.Serialize(request, JsonOptions), Encoding.UTF8, "application/json");

        using var response = await client.PostAsync(Path + "/operations", content);

        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "invalid_module_command");
        using var readResponse = await client.GetAsync(Path);
        var read = await ReadSuccessAsync(readResponse);
        Assert.Equal(configured.Revision, read.Revision);
        Assert.True(JsonElement.DeepEquals(JsonSerializer.SerializeToElement(configured.Snapshot), JsonSerializer.SerializeToElement(read.Snapshot)));
    }

    [Fact]
    public async Task PostOperation_MalformedInput_ReturnsProblemWithoutWrites()
    {
        // Arrange
        var path = Path;
        var requestId = Guid.NewGuid();
        var validPrefix = $"\"requestId\":\"{requestId:D}\",\"expectedRevision\":0,";
        var validParty = $"[{{\"id\":\"{characterId:D}\",\"name\":\"HTTP character\"}}]";
        var inputs = new[]
        {
            "{", "null", "[]", "{}",
            "{" + validPrefix + "\"kind\":\"unknown\"}",
            "{" + validPrefix + "\"kind\":\"updateParty\"}",
            "{" + validPrefix + "\"kind\":\"updateParty\",\"party\":" + validParty + ",\"minutes\":1}",
            "{" + validPrefix + "\"kind\":\"updateParty\",\"party\":[{\"id\":\"" + characterId.ToString("D") + "\",\"name\":\" \"}]}",
            "{" + validPrefix + "\"kind\":\"shortRest\",\"minutes\":60}",
            "{" + validPrefix + "\"kind\":\"shortRest\",\"command\":{}}",
            "{\"expectedRevision\":0,\"kind\":\"configureParty\",\"party\":" + validParty + "}",
            $"{{\"requestId\":\"{requestId:D}\",\"kind\":\"configureParty\",\"party\":{validParty}}}",
            $"{{\"requestId\":\"{requestId:D}\",\"expectedRevision\":\"0\",\"kind\":\"configureParty\",\"party\":{validParty}}}",
            "{" + validPrefix + "\"kind\":\"configureParty\",\"party\":" + validParty + ",\"unknown\":true}",
            "{" + validPrefix + "\"kind\":\"configureParty\",\"party\":[{\"id\":\"" + characterId.ToString("D") + "\",\"name\":\"HTTP character\",\"unknown\":true}]}",
            "{" + validPrefix + "\"kind\":\"configureParty\",\"party\":[{\"id\":\"invalid-id\",\"name\":\"Character\"}]}",
            "{" + validPrefix + "\"kind\":\"configureParty\",\"party\":[null]}",
            "{" + validPrefix + "\"kind\":\"configureParty\",\"party\":[{\"id\":\"" + characterId.ToString("D") + "\",\"name\":null}]}",
            "{" + validPrefix + "\"kind\":\"configureParty\",\"party\":" + validParty + ",\"expectedRevision\":1}",
            "{" + validPrefix + "\"kind\":\"configureParty\",\"party\":[{\"id\":\"" + characterId.ToString("D") + "\",\"name\":\"Character\",\"name\":\"Different\"}]}",
            "{" + validPrefix + "\"kind\":\"module\",\"command\":{\"kind\":\"healCharacter\",\"kind\":\"resolveCheck\"}}",
            "{" + validPrefix + "\"kind\":\"module\",\"command\":{\"kind\":\"healCharacter\",\"characterId\":\"" + characterId.ToString("D") +
                "\",\"nested\":" + new string('[', 20) + "0" + new string(']', 20) + "}}"
        };

        // Act / Assert: every malformed request is independent and must leave no rows.
        foreach (var input in inputs)
        {
            using var content = new StringContent(input, Encoding.UTF8, "application/json");
            using var response = await client.PostAsync(path + "/operations", content);
            await AssertProblemAsync(response, HttpStatusCode.BadRequest, "invalid_game_operation");
            await AssertNoGameplayWritesAsync(App.Services, campaignId);
        }


    }

    [Fact]
    public async Task PostOperation_UnsupportedMediaOrOversizedBody_ReturnsProblemWithoutWrites()
    {
        // Arrange
        var path = Path;

        // Act / Assert
        using (var content = new StringContent("{}", Encoding.UTF8, "text/plain"))
        using (var response = await client.PostAsync(path + "/operations", content))
            await AssertProblemAsync(response, HttpStatusCode.UnsupportedMediaType, "game_json_required");

        var oversized = new string(' ', 65_537);
        using (var content = new StringContent(oversized, Encoding.UTF8, "application/json"))
        using (var response = await client.PostAsync(path + "/operations", content))
            await AssertProblemAsync(response, HttpStatusCode.RequestEntityTooLarge, "game_request_too_large");

        using (var content = new UnknownLengthJsonContent(Encoding.UTF8.GetBytes(oversized)))
        using (var response = await client.PostAsync(path + "/operations", content))
            await AssertProblemAsync(response, HttpStatusCode.RequestEntityTooLarge, "game_request_too_large");
        await AssertNoGameplayWritesAsync(App.Services, campaignId);


    }

    [Fact]
    public async Task GetGame_UnconfiguredCampaign_ReadsWithoutWritingState()
    {
        // Arrange
        var path = Path;

        // Act
        using var response = await client.GetAsync(path);
        var state = await ReadSuccessAsync(response);

        // Assert
        Assert.Equal(0, state.Revision);
        Assert.Empty(state.Snapshot.Party);
        await AssertNoGameplayWritesAsync(App.Services, campaignId);
    }

    [Fact]
    public async Task GetGame_MissingCampaign_ReturnsNotFound()
    {
        // Arrange
        var path = $"/api/campaigns/{Guid.NewGuid():D}/game";

        // Act
        using var response = await client.GetAsync(path);

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.NotFound, "campaign_not_found");
    }

    [Fact]
    public async Task PostOperation_ConfigureAndAdvance_PersistsStateAndRejectsStaleRevision()
    {
        // Arrange
        var path = Path;

        // Act / Assert: confirm configuration, then advance from its confirmed revision.
        var configure = new GameOperationRequest(Guid.NewGuid(), 0, "configureParty", [new(characterId, "HTTP character")]);
        var configured = await PostSuccessAsync(client, path, configure);
        Assert.True(configured.Revision == 1 && configured.Snapshot.Party.Single().Id == characterId,
            "The HTTP endpoint must persist a valid typed party configuration.");
        var advance = new GameOperationRequest(Guid.NewGuid(), 1, "advanceTime", Minutes: 30);
        var advanced = await PostSuccessAsync(client, path, advance);
        Assert.True(advanced.Revision == 2 && advanced.Snapshot.TimeMinutes == 30,
            "A valid HTTP time operation must return its confirmed revision and time.");
        using (var response = await client.GetAsync(path))
        {
            var read = await ReadSuccessAsync(response);
            Assert.True(read.Revision == advanced.Revision && read.Snapshot.TimeMinutes == advanced.Snapshot.TimeMinutes,
                "HTTP GET in a separate scope must read the confirmed operation.");
        }
        using (var content = new StringContent(JsonSerializer.Serialize(advance with { RequestId = Guid.NewGuid() }, JsonOptions), Encoding.UTF8, "application/json"))
        using (var response = await client.PostAsync(path + "/operations", content))
            await AssertProblemAsync(response, HttpStatusCode.Conflict, "game_revision_conflict");


    }

    [Fact]
    public async Task PostOperation_PartyEdit_ReplaysReceiptAndUndoesWithoutOverwritingCurrentState()
    {
        // Arrange
        var path = Path;
        var configured = await ConfigurePartyAsync();
        var advanced = await PostSuccessAsync(client, path,
            new GameOperationRequest(Guid.NewGuid(), configured.Revision, "advanceTime", Minutes: 30));

        // Act / Assert: short rest, roster changes, historical replay, then undo.
        var shortRest = await PostSuccessAsync(client, path,
            new GameOperationRequest(Guid.NewGuid(), advanced.Revision, "shortRest"));
        Assert.True(shortRest.Revision == 3 && shortRest.Snapshot.TimeMinutes == 90 && shortRest.Snapshot.RestEnds.Count == 0,
            "A typed HTTP short rest must advance sixty minutes without recording a completed long rest.");
        var renameRequest = new GameOperationRequest(Guid.NewGuid(), shortRest.Revision, "updateParty",
            [new(characterId, "Renamed HTTP character")]);
        var renamed = await PostSuccessAsync(client, path, renameRequest);
        Assert.True(renamed.Revision == 4 && renamed.Snapshot.Party.Single().Id == characterId &&
            renamed.Snapshot.Party.Single().Name == "Renamed HTTP character" &&
            JsonElement.DeepEquals(renamed.Snapshot.ModuleState, shortRest.Snapshot.ModuleState),
            "The HTTP party editor must retain identity and module state while changing a name.");
        var empty = await PostSuccessAsync(client, path,
            new GameOperationRequest(Guid.NewGuid(), renamed.Revision, "updateParty", []));
        Assert.True(empty.Revision == 5 && empty.Snapshot.Party.Count == 0 && empty.Snapshot.TimeMinutes == 90,
            "An explicit empty HTTP roster must retain nonzero game time.");
        var replayed = await PostSuccessAsync(client, path, renameRequest);
        Assert.True(replayed.Revision == renamed.Revision &&
            JsonElement.DeepEquals(JsonSerializer.SerializeToElement(replayed), JsonSerializer.SerializeToElement(renamed)),
            "Replaying a party edit through HTTP must return its original confirmed receipt.");
        using (var response = await client.GetAsync(path))
        {
            var read = await ReadSuccessAsync(response);
            Assert.True(read.Revision == empty.Revision && read.Snapshot.Party.Count == 0,
                "An old party receipt must not overwrite the latest persisted HTTP roster.");
        }
        var restored = await PostSuccessAsync(client, path,
            new GameOperationRequest(Guid.NewGuid(), empty.Revision, "undo"));
        Assert.True(restored.Revision == 6 && JsonElement.DeepEquals(JsonSerializer.SerializeToElement(restored.Snapshot),
            JsonSerializer.SerializeToElement(renamed.Snapshot)),
            "HTTP undo must restore the roster and owned module state removed by the latest party operation.");

    }

    [Fact]
    public async Task PostOperation_RecoveryAndExpedition_PersistReplayRejectAndUndoAtomically()
    {
        // Arrange
        var path = Path;
        var configured = await ConfigurePartyAsync();
        var restored = await PostSuccessAsync(client, path,
            new GameOperationRequest(Guid.NewGuid(), configured.Revision, "advanceTime", Minutes: 90));

        // Act / Assert: recovery timer, expedition operation, rejection, replay and undo.
        var recoveryState = await PostSuccessAsync(client, path,
            new GameOperationRequest(Guid.NewGuid(), restored.Revision, "advanceTime", Minutes: 630));
        recoveryState = await PostSuccessAsync(client, path, new GameOperationRequest(Guid.NewGuid(), recoveryState.Revision, "module",
            Command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId, success = false })));
        recoveryState = await PostSuccessAsync(client, path, new GameOperationRequest(Guid.NewGuid(), recoveryState.Revision, "longRest"));
        recoveryState = await PostSuccessAsync(client, path, new GameOperationRequest(Guid.NewGuid(), recoveryState.Revision, "module",
            Command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId, success = true, d6 = 5 })));
        recoveryState = await PostSuccessAsync(client, path,
            new GameOperationRequest(Guid.NewGuid(), recoveryState.Revision, "advanceTime", Minutes: 240));
        var early = new GameOperationRequest(Guid.NewGuid(), recoveryState.Revision, "module",
            Command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId, success = false }));
        using (var content = new StringContent(JsonSerializer.Serialize(early, JsonOptions), Encoding.UTF8, "application/json"))
        using (var response = await client.PostAsync(path + "/operations", content))
            await AssertProblemAsync(response, HttpStatusCode.BadRequest, "game_check_not_due");
        var pending = await PostSuccessAsync(client, path,
            new GameOperationRequest(Guid.NewGuid(), recoveryState.Revision, "advanceTime", Minutes: 480));
        var periodicRequest = new GameOperationRequest(Guid.NewGuid(), pending.Revision, "module",
            Command: JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId, success = false }));
        var periodic = await PostSuccessAsync(client, path, periodicRequest);
        var activityRequest = new GameOperationRequest(Guid.NewGuid(), periodic.Revision, "module", Minutes: 60,
            Command: JsonSerializer.SerializeToElement(new { kind = "explore" }));
        var activity = await PostSuccessAsync(client, path, activityRequest);
        Assert.True(activity.Snapshot.TimeMinutes == periodic.Snapshot.TimeMinutes + 60 &&
            activity.ModuleView.GetProperty("expedition").GetProperty("pending").GetArrayLength() == 1,
            "HTTP module activities must persist their engine time and encounter together.");
        Assert.True(JsonElement.DeepEquals(JsonSerializer.SerializeToElement(await PostSuccessAsync(client, path, activityRequest)),
            JsonSerializer.SerializeToElement(activity)), "HTTP exploration retries must return the exact receipt.");
        var malformedActivity = new GameOperationRequest(Guid.NewGuid(), activity.Revision, "module", Minutes: 29,
            Command: JsonSerializer.SerializeToElement(new { kind = "searchBuilding", unnumbered = true, newBuilding = true }));
        using (var content = new StringContent(JsonSerializer.Serialize(malformedActivity, JsonOptions), Encoding.UTF8, "application/json"))
        using (var response = await client.PostAsync(path + "/operations", content))
            await AssertProblemAsync(response, HttpStatusCode.BadRequest, "invalid_module_command");
        using (var response = await client.GetAsync(path))
            Assert.True(JsonElement.DeepEquals(JsonSerializer.SerializeToElement(await ReadSuccessAsync(response)), JsonSerializer.SerializeToElement(activity)),
                "Rejected HTTP activities must preserve current time, checks and revision.");
        var activityUndo = await PostSuccessAsync(client, path, new GameOperationRequest(Guid.NewGuid(), activity.Revision, "undo"));
        Assert.True(JsonElement.DeepEquals(JsonSerializer.SerializeToElement(activityUndo.Snapshot), JsonSerializer.SerializeToElement(periodic.Snapshot)),
            "HTTP undo must restore the whole exploration operation.");
        var periodicCharacter = periodic.ModuleView.GetProperty("characters").EnumerateArray().Single();
        Assert.True(periodic.Snapshot.TimeMinutes == 1920 && periodicCharacter.GetProperty("dc").GetInt32() == 10 &&
            periodicCharacter.GetProperty("failures").GetInt32() == 1 &&
            periodicCharacter.GetProperty("nextCheck").GetProperty("kind").GetString() == "recovery" &&
            periodicCharacter.GetProperty("nextCheck").GetProperty("minute").GetInt64() == 2640,
            "HTTP recovery must honor the rest-reset deadline and persist the periodic outcome and next timer together.");
        Assert.True(JsonElement.DeepEquals(JsonSerializer.SerializeToElement(await PostSuccessAsync(client, path, periodicRequest)),
            JsonSerializer.SerializeToElement(periodic)), "An HTTP periodic retry must not increment failures twice.");
        var undone = await PostSuccessAsync(client, path, new GameOperationRequest(Guid.NewGuid(), activityUndo.Revision, "undo"));
        Assert.True(JsonElement.DeepEquals(JsonSerializer.SerializeToElement(undone.Snapshot), JsonSerializer.SerializeToElement(pending.Snapshot)),
            "HTTP undo must restore the periodic check and its previous recovery totals.");


    }

    private static async Task AssertNoGameplayWritesAsync(IServiceProvider services, Guid campaignId)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(!await db.GameStates.AnyAsync(x => x.CampaignId == campaignId) &&
            !await db.GameOperations.AnyAsync(x => x.CampaignId == campaignId),
            "Rejected HTTP input and unconfigured reads must not persist gameplay state or journal rows.");
    }

    private static async Task AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.True(response.StatusCode == status && response.Content.Headers.ContentType?.MediaType == "application/problem+json",
            $"Expected ProblemDetails status {(int)status}, received {(int)response.StatusCode}.");
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var problem = document.RootElement;
        Assert.True(problem.GetProperty("status").GetInt32() == (int)status && problem.GetProperty("code").GetString() == code &&
            problem.GetProperty("title").GetString() is { Length: > 0 } && !problem.TryGetProperty("exception", out _),
            $"Expected stable ProblemDetails error code {code} without exception diagnostics.");
    }

    private static async Task<GameStateResponse> PostSuccessAsync(HttpClient client, string path, GameOperationRequest request)
    {
        using var content = new StringContent(JsonSerializer.Serialize(request, JsonOptions), Encoding.UTF8, "application/json");
        using var response = await client.PostAsync(path + "/operations", content);
        return await ReadSuccessAsync(response);
    }

    private static async Task<GameStateResponse> ReadSuccessAsync(HttpResponseMessage response)
    {
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"Expected a successful HTTP game response, received {(int)response.StatusCode}.");
        return JsonSerializer.Deserialize<GameStateResponse>(await response.Content.ReadAsStringAsync(), JsonOptions)
            ?? throw new InvalidOperationException("A successful HTTP response must contain a game state.");
    }


    private sealed class UnknownLengthJsonContent : HttpContent
    {
        private readonly byte[] bytes;

        public UnknownLengthJsonContent(byte[] bytes)
        {
            this.bytes = bytes;
            Headers.ContentType = new("application/json");
        }

        protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) => stream.WriteAsync(bytes).AsTask();
        protected override bool TryComputeLength(out long length) { length = 0; return false; }
    }
}
