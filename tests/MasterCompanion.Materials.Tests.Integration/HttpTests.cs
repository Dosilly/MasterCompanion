using System.Net;
using System.Text;
using System.Text.Json;
using MasterCompanion.Engine.Features.Materials;
using MasterCompanion.Engine.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace MasterCompanion.Materials.Tests.Integration;

[Collection("PostgreSQL")]
public sealed class HttpTests(PostgreSqlFixture database) : IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private const string AuthoredDocument = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Preserved campaign content\"}]}]}";

    private NpgsqlConnectionStringBuilder? settings;
    private NpgsqlConnectionStringBuilder connection => settings ?? throw new InvalidOperationException("The test database has not started.");
    private CampaignApiFactory? factory;
    private CampaignApiFactory App => factory ?? throw new InvalidOperationException("The test host has not started.");
    private HttpClient? httpClient;
    private HttpClient client => httpClient ?? throw new InvalidOperationException("The test client has not started.");
    private readonly Guid campaignId = Guid.NewGuid();
    private readonly Guid otherCampaignId = Guid.NewGuid();
    private readonly string folderId = "folder-" + Guid.NewGuid().ToString("N");
    private readonly string otherFolderId = "folder-" + Guid.NewGuid().ToString("N");
    private readonly string authoredId = "specimen-" + Guid.NewGuid().ToString("N");
    private string? originalData;
    private string Path => $"/api/campaigns/{campaignId:D}/materials";


    public async Task InitializeAsync()
    {
        settings = new NpgsqlConnectionStringBuilder(await database.CreateDatabaseAsync());
        await using (var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connection.ConnectionString).Options))
        {
            await db.Database.MigrateAsync();
            db.Campaigns.Add(new Campaign { Id = campaignId, Title = "Material test campaign", ModuleId = "neutral-test", ModuleVersion = "1" });
            db.Folders.Add(new CampaignFolder { CampaignId = campaignId, Id = folderId, Title = "Authored folder", SortOrder = 5 });
            db.Materials.Add(new Material { Id = authoredId, CampaignId = campaignId, Title = "Authored material",
                FolderId = folderId, Group = "Authored group", DocumentJson = AuthoredDocument, Revision = 7, SortOrder = 2 });
            db.GameStates.Add(new CampaignGameState { CampaignId = campaignId, Revision = 4, SnapshotJson = "{\"owned\":true}" });
            db.GameOperations.Add(new GameOperation { CampaignId = campaignId, RequestId = Guid.NewGuid(), Revision = 4,
                Kind = "specimen", RequestJson = "{}", BeforeJson = "{}", ResponseJson = "{}", CreatedAtUtc = DateTime.UtcNow });
            db.Maps.Add(new CampaignMap { Id = "map-" + Guid.NewGuid().ToString("N"), CampaignId = campaignId, DefinitionJson = "{}" });
            await db.SaveChangesAsync();

        }
        factory = new CampaignApiFactory(connection.ConnectionString);
        httpClient = App.CreateClient();
        await using var scope = App.Services.CreateAsyncScope();
        var startedDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        startedDb.Campaigns.Add(new Campaign { Id = otherCampaignId, Title = "Other material campaign", ModuleId = "neutral-test", ModuleVersion = "1" });
        startedDb.Folders.Add(new CampaignFolder { CampaignId = otherCampaignId, Id = otherFolderId, Title = "Other folder", SortOrder = 7 });
        await startedDb.SaveChangesAsync();
        originalData = await SnapshotAsync(startedDb, campaignId, otherCampaignId, authoredId);
    }

    public async Task DisposeAsync()
    {
        try
        {
            if (factory is null) return;
            await using var scope = App.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            try
            {
                if (originalData is not null)
                    Assert.Equal(originalData, await SnapshotAsync(db, campaignId, otherCampaignId, authoredId));
            }
            finally
            {
                var ownedIds = new[] { campaignId, otherCampaignId };
                await db.Materials.Where(x => ownedIds.Contains(x.CampaignId)).ExecuteDeleteAsync();
                await db.Maps.Where(x => ownedIds.Contains(x.CampaignId)).ExecuteDeleteAsync();
                await db.GameOperations.Where(x => ownedIds.Contains(x.CampaignId)).ExecuteDeleteAsync();
                await db.GameStates.Where(x => ownedIds.Contains(x.CampaignId)).ExecuteDeleteAsync();
                await db.Folders.Where(x => ownedIds.Contains(x.CampaignId)).ExecuteDeleteAsync();
                await db.Campaigns.Where(x => ownedIds.Contains(x.Id)).ExecuteDeleteAsync();
            }
        }
        finally
        {
            httpClient?.Dispose();
            if (factory is not null) await factory.DisposeAsync();
        }
    }

    private CreateMaterialRequest NewRequest() => new(Guid.NewGuid(), "  Separate campaign note  ", folderId);

    [Fact]
    public async Task CreateMaterial_MalformedInput_ReturnsProblemWithoutWrites()
    {
        // Arrange
        var request = NewRequest();

        // Act / Assert: each rejected boundary case must leave the campaign unchanged.
        await AssertRejectedInputAsync(client, Path, request);
        await AssertCountAsync(App.Services, campaignId, 1);
    }

    [Fact]
    public async Task CreateMaterial_MissingOrForeignFolder_RejectsWithoutWrites()
    {
        // Arrange
        var foreign = new CreateMaterialRequest(Guid.NewGuid(), "Other folder", otherFolderId);
        var missing = new CreateMaterialRequest(Guid.NewGuid(), "Missing folder", "missing");

        // Act / Assert
        await AssertProblemAsync(client, Path, foreign, 400, "material_folder_not_found");
        await AssertProblemAsync(client, Path, missing, 400, "material_folder_not_found");
        await AssertCountAsync(App.Services, campaignId, 1);
    }

    [Fact]
    public async Task CreateMaterial_MissingCampaign_ReturnsNotFound()
    {
        // Arrange
        var path = $"/api/campaigns/{Guid.NewGuid():D}/materials";
        var request = NewRequest();

        // Act
        using var response = await client.PostAsync(path, JsonContent(request));

        // Assert
        await AssertProblemAsync(response, 404, "campaign_not_found");
        await AssertCountAsync(App.Services, campaignId, 1);
    }

    [Fact]
    public async Task CreateMaterial_ValidRequest_ReturnsStableIdentityAndEmptyDocument()
    {
        // Arrange
        var request = NewRequest();

        // Act
        var created = await PostMaterialAsync(client, Path, request, HttpStatusCode.Created);

        // Assert
        Assert.True(created.Id == $"note-{request.Id:D}" && created.Title == "Separate campaign note" &&
            created.FolderId == folderId && created.Group == "Authored folder" && created.Revision == 1 &&
            created.DocumentSchemaVersion == 1 && created.Document.GetProperty("content").EnumerateArray().Single()
                .GetProperty("type").GetString() == "paragraph", "Creation must return a stable empty campaign material with folder metadata.");
        await AssertCountAsync(App.Services, campaignId, 2);
    }

    [Fact]
    public async Task CreateMaterial_RetryAfterEditing_PreservesCurrentDocumentAndRevision()
    {
        // Arrange
        var path = Path;
        var request = NewRequest();
        var created = await PostMaterialAsync(client, path, request, HttpStatusCode.Created);
        using (var saved = await client.PutAsync($"/api/materials/{created.Id}", JsonContent(new SaveMaterialRequest(
            JsonSerializer.Deserialize<JsonElement>(AuthoredDocument), created.Revision))))
            Assert.True(saved.StatusCode == HttpStatusCode.OK, "The new material must use existing revision-protected saves.");

        // Act
        var replay = await PostMaterialAsync(client, path, request, HttpStatusCode.OK);
        Assert.True(replay.Revision == 2 && JsonElement.DeepEquals(replay.Document,
            JsonSerializer.Deserialize<JsonElement>(AuthoredDocument)), "A creation retry after editing must return current content without resetting revision.");

        // Assert
        await AssertCountAsync(App.Services, campaignId, 2);
    }

    [Fact]
    public async Task CreateMaterial_ReusedIdentityWithDifferentInput_ReturnsConflictAndPreservesSave()
    {
        // Arrange
        var path = Path;
        var request = NewRequest();
        var created = await PostMaterialAsync(client, path, request, HttpStatusCode.Created);
        using (var saved = await client.PutAsync($"/api/materials/{created.Id}", JsonContent(new SaveMaterialRequest(
            JsonSerializer.Deserialize<JsonElement>(AuthoredDocument), created.Revision))))
            Assert.True(saved.StatusCode == HttpStatusCode.OK, "The new material must use existing revision-protected saves.");

        // Act / Assert: each conflicting request targets the same confirmed material.
        await AssertProblemAsync(client, path, request with { Title = "Different title" }, 409, "material_creation_conflict");
        await AssertProblemAsync(client, path, request with { FolderId = null }, 409, "material_creation_conflict");
        await AssertProblemAsync(client, $"/api/campaigns/{otherCampaignId:D}/materials",
            request with { FolderId = null }, 409, "material_creation_conflict");
        await AssertCountAsync(App.Services, otherCampaignId, 0);
        using (var staleSave = await client.PutAsync($"/api/materials/{created.Id}", JsonContent(new SaveMaterialRequest(
            JsonSerializer.Deserialize<JsonElement>("{\"type\":\"doc\",\"content\":[]}"), 1))))
            await AssertProblemAsync(staleSave, 409, "material_revision_conflict");


        await AssertCountAsync(App.Services, campaignId, 2);
    }

    [Fact]
    public async Task CreateMaterial_ConcurrentIdenticalRequests_CreateOneMaterial()
    {
        // Arrange
        var path = Path;
        var concurrent = new CreateMaterialRequest(Guid.NewGuid(), "Concurrent note", null);

        // Act
        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => client.PostAsync(path, JsonContent(concurrent))));
        try
        {
            Assert.True(responses.Count(x => x.StatusCode == HttpStatusCode.Created) == 1 &&
                responses.Count(x => x.StatusCode == HttpStatusCode.OK) == 7,
                "Simultaneous identical requests must create one material and confirm every retry.");
            foreach (var response in responses)
            {
                var material = await ReadMaterialAsync(response);
                Assert.True(material.Id == $"note-{concurrent.Id:D}" && material.Group.Length == 0 && material.FolderId is null,
                    "Concurrent unfiled creation must retain identity and neutral group data.");
            }
        }
        finally { foreach (var response in responses) response.Dispose(); }

        // Assert
        await AssertCountAsync(App.Services, campaignId, 2);
    }

    [Fact]
    public async Task CreateMaterial_ConcurrentDifferentInput_PreservesSingleWinner()
    {
        // Arrange
        var path = Path;
        var differing = new CreateMaterialRequest(Guid.NewGuid(), "First concurrent title", null);

        // Act
        var differentResponses = await Task.WhenAll(client.PostAsync(path, JsonContent(differing)),
            client.PostAsync(path, JsonContent(differing with { Title = "Other concurrent title" })));
        try
        {
            Assert.True(differentResponses.Count(x => x.StatusCode == HttpStatusCode.Created) == 1 &&
                differentResponses.Count(x => x.StatusCode == HttpStatusCode.Conflict) == 1,
                "Concurrent UUID reuse with different input must preserve the sole winning material.");
        }
        finally { foreach (var response in differentResponses) response.Dispose(); }

        // Assert
        await AssertCountAsync(App.Services, campaignId, 2);
    }

    [Fact]
    public async Task CreateMaterial_CancelledDatabaseWait_AllowsConfirmedRetry()
    {
        // Arrange: the helper holds a database lock and owns the request ID.

        // Act / Assert
        await AssertCancellationAsync(client, Path, connection.ConnectionString, connection.ApplicationName ?? throw new InvalidOperationException("The test application name is missing."));
        await AssertCountAsync(App.Services, campaignId, 2);
    }

    [Fact]
    public async Task CreateMaterial_PersistenceFailure_RollsBackAndAllowsRetry()
    {
        // Arrange: the helper injects a trigger failure and removes it in finally.

        // Act / Assert
        await AssertPersistenceFailureAsync(client, Path, connection.ConnectionString);
        await AssertCountAsync(App.Services, campaignId, 2);
    }

    [Fact]
    public async Task InitializeCampaign_ExistingNotes_PreservesDocumentsRevisionsAndHistory()
    {
        // Arrange
        await PostMaterialAsync(client, Path, NewRequest(), HttpStatusCode.Created);
        await using var finalScope = App.Services.CreateAsyncScope();
        var finalDb = finalScope.ServiceProvider.GetRequiredService<AppDbContext>();
        await finalDb.Folders.Where(x => x.CampaignId == otherCampaignId).ExecuteDeleteAsync();
        await finalDb.Campaigns.Where(x => x.Id == otherCampaignId).ExecuteDeleteAsync();
        Assert.True(await finalDb.Campaigns.CountAsync() == 1,
            "Initializer verification requires only the runner-owned campaign in the isolated database.");
        var beforeInitialization = await SnapshotAsync(finalDb, campaignId, otherCampaignId, authoredId);
        originalData = beforeInitialization;
        var beforeMaterials = JsonSerializer.Serialize(await finalDb.Materials.AsNoTracking()
            .Where(x => x.CampaignId == campaignId).OrderBy(x => x.Id).ToArrayAsync(), JsonOptions);

        // Act
        await CampaignInitializer.ApplyAsync(finalDb, Array.Empty<MasterCompanion.Contracts.ICampaignModule>());

        // Assert
        var afterMaterials = JsonSerializer.Serialize(await finalDb.Materials.AsNoTracking()
            .Where(x => x.CampaignId == campaignId).OrderBy(x => x.Id).ToArrayAsync(), JsonOptions);
        Assert.True(beforeMaterials == afterMaterials && beforeInitialization ==
            await SnapshotAsync(finalDb, campaignId, otherCampaignId, authoredId),
            "Repeated initialization must preserve authored and newly created materials, revisions and independent gameplay history.");

    }

    private static async Task AssertRejectedInputAsync(HttpClient client, string path, CreateMaterialRequest request)
    {
        var valid = JsonSerializer.Serialize(request, JsonOptions);
        var invalidInputs = new[] { "{", "null", "[]", "{}", valid.Replace(request.Id.ToString("D"), "invalid-id"), valid.Replace("\"id\":", "\"id\":null,\"id\":"),
            valid.Replace("\"title\":", "\"title\":null,\"title\":"), valid[..^1] + ",\"document\":{}}",
            $"{{\"id\":\"{request.Id:D}\",\"title\":\"Note\"}}",
            $"{{\"id\":\"{request.Id:D}\",\"title\":null,\"folderId\":null}}",
            $"{{\"id\":\"{request.Id:D}\",\"title\":23,\"folderId\":null}}",
            $"{{\"id\":\"{request.Id:D}\",\"title\":\"Note\",\"folderId\":23}}",
            $"{{\"id\":\"{request.Id:D}\",\"title\":\"Note\",\"folderId\":{{\"a\":{{\"b\":{{\"c\":{{\"d\":1}}}}}}}}}}" };
        foreach (var input in invalidInputs)
        {
            using var response = await client.PostAsync(path, new StringContent(input, Encoding.UTF8, "application/json"));
            await AssertProblemAsync(response, 400, "invalid_material_creation");
        }
        foreach (var input in new[] { request with { Id = Guid.Empty }, request with { Title = " " },
            request with { Title = new string('a', 301) }, request with { Title = "Line\nbreak" },
            request with { FolderId = "" }, request with { FolderId = new string('a', 81) } })
            await AssertProblemAsync(client, path, input, 400, "invalid_material_creation");
        using (var media = await client.PostAsync(path, new StringContent(valid, Encoding.UTF8, "text/plain")))
            await AssertProblemAsync(media, 415, "material_json_required");
        var oversized = Encoding.UTF8.GetBytes(new string(' ', 8_193));
        using (var large = await client.PostAsync(path, new StringContent(new string(' ', 8_193), Encoding.UTF8, "application/json")))
            await AssertProblemAsync(large, 413, "material_request_too_large");
        using (var chunked = await client.PostAsync(path, new UnknownLengthJsonContent(oversized)))
            await AssertProblemAsync(chunked, 413, "material_request_too_large");
    }

    private static async Task AssertCancellationAsync(HttpClient client, string path, string connectionString, string applicationName)
    {
        var request = new CreateMaterialRequest(Guid.NewGuid(), "Cancelled then retried", null);
        await using var blocker = new NpgsqlConnection(connectionString);
        await blocker.OpenAsync();
        await using (var transaction = await blocker.BeginTransactionAsync())
        {
            await using (var command = new NpgsqlCommand("LOCK TABLE engine.\"Materials\" IN ACCESS EXCLUSIVE MODE", blocker, transaction))
                await command.ExecuteNonQueryAsync();
            using var cancellation = new CancellationTokenSource();
            var pending = client.PostAsync(path, JsonContent(request), cancellation.Token);
            await WaitForDatabaseRequestAsync(connectionString, applicationName, true);
            cancellation.Cancel();
            try { using var response = await pending; throw new InvalidOperationException("The blocked creation must honor cancellation."); }
            catch (OperationCanceledException) { }
            await WaitForDatabaseRequestAsync(connectionString, applicationName, false);
            await transaction.RollbackAsync();
        }
        await using (var probe = new NpgsqlConnection(connectionString))
        {
            await probe.OpenAsync();
            await using var command = new NpgsqlCommand("SELECT count(*) FROM engine.\"Materials\" WHERE \"Id\" = @id", probe);
            command.Parameters.AddWithValue("id", $"note-{request.Id:D}");
            Assert.True(Convert.ToInt64(await command.ExecuteScalarAsync()) == 0, "Cancelled creation must not persist a material.");
        }
        await PostMaterialAsync(client, path, request, HttpStatusCode.Created);
    }

    private static async Task WaitForDatabaseRequestAsync(string connectionString, string applicationName, bool blocked)
    {
        var probeSettings = new NpgsqlConnectionStringBuilder(connectionString) { ApplicationName = "material-tests-probe" };
        await using var probe = new NpgsqlConnection(probeSettings.ConnectionString);
        await probe.OpenAsync();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        while (true)
        {
            await using var command = new NpgsqlCommand("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = @name AND state = 'active' AND wait_event_type = 'Lock' AND query LIKE '%Materials%')", probe);
            command.Parameters.AddWithValue("name", applicationName);
            var waiting = await command.ExecuteScalarAsync(timeout.Token) is true;
            if (waiting == blocked) return;
            await Task.Delay(20, timeout.Token);
        }
    }

    private static async Task AssertPersistenceFailureAsync(HttpClient client, string path, string connectionString)
    {
        var request = new CreateMaterialRequest(Guid.NewGuid(), "Failed write then retried", null);
        var name = "reject_material_" + Guid.NewGuid().ToString("N");
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        var create = $"CREATE FUNCTION engine.{name}() RETURNS trigger LANGUAGE plpgsql AS $test$ BEGIN IF NEW.\"Id\" = 'note-{request.Id:D}' THEN RAISE EXCEPTION 'Injected material insertion failure'; END IF; RETURN NEW; END; $test$; CREATE TRIGGER {name} BEFORE INSERT ON engine.\"Materials\" FOR EACH ROW EXECUTE FUNCTION engine.{name}();";
        await using (var command = new NpgsqlCommand(create, connection)) await command.ExecuteNonQueryAsync();
        try
        {
            using var failed = await client.PostAsync(path, JsonContent(request));
            Assert.True(failed.StatusCode == HttpStatusCode.InternalServerError, "Unexpected persistence failures must never report successful creation.");
            await using var count = new NpgsqlCommand("SELECT count(*) FROM engine.\"Materials\" WHERE \"Id\" = @id", connection);
            count.Parameters.AddWithValue("id", $"note-{request.Id:D}");
            Assert.True(Convert.ToInt64(await count.ExecuteScalarAsync()) == 0, "A failed insertion must leave no partial material.");
        }
        finally
        {
            await using var cleanup = new NpgsqlCommand($"DROP TRIGGER {name} ON engine.\"Materials\"; DROP FUNCTION engine.{name}();", connection);
            await cleanup.ExecuteNonQueryAsync();
        }
        await PostMaterialAsync(client, path, request, HttpStatusCode.Created);
    }

    private static async Task<string> SnapshotAsync(AppDbContext db, Guid campaignId, Guid otherCampaignId, string authoredId) =>
        JsonSerializer.Serialize(new
        {
            campaigns = await db.Campaigns.AsNoTracking().Where(x => x.Id == campaignId || x.Id == otherCampaignId).OrderBy(x => x.Id).ToArrayAsync(),
            folders = await db.Folders.AsNoTracking().Where(x => x.CampaignId == campaignId || x.CampaignId == otherCampaignId).OrderBy(x => x.Id).ToArrayAsync(),
            materials = await db.Materials.AsNoTracking().Where(x => x.Id == authoredId).ToArrayAsync(),
            maps = await db.Maps.AsNoTracking().Where(x => x.CampaignId == campaignId).ToArrayAsync(),
            state = await db.GameStates.AsNoTracking().Where(x => x.CampaignId == campaignId).ToArrayAsync(),
            history = await db.GameOperations.AsNoTracking().Where(x => x.CampaignId == campaignId).ToArrayAsync()
        }, JsonOptions);

    private static async Task AssertCountAsync(IServiceProvider services, Guid campaignId, int expected)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(await db.Materials.CountAsync(x => x.CampaignId == campaignId) == expected,
            $"Expected exactly {expected} persisted campaign materials.");
    }

    private static StringContent JsonContent<T>(T value) => new(JsonSerializer.Serialize(value, JsonOptions), Encoding.UTF8, "application/json");

    private static async Task<MaterialResponse> PostMaterialAsync(HttpClient client, string path, CreateMaterialRequest request, HttpStatusCode status)
    {
        using var response = await client.PostAsync(path, JsonContent(request));
        Assert.True(response.StatusCode == status, $"Expected creation status {(int)status}, received {(int)response.StatusCode}.");
        var material = await ReadMaterialAsync(response);
        if (status == HttpStatusCode.Created)
            Assert.True(response.Headers.Location?.OriginalString == $"/api/materials/{material.Id}", "Creation must expose the stable material Location.");
        return material;
    }

    private static async Task<MaterialResponse> ReadMaterialAsync(HttpResponseMessage response) =>
        JsonSerializer.Deserialize<MaterialResponse>(await response.Content.ReadAsStringAsync(), JsonOptions)
            ?? throw new InvalidOperationException("A successful creation response must contain a material.");

    private static async Task AssertProblemAsync(HttpClient client, string path, CreateMaterialRequest request, int status, string code)
    {
        using var response = await client.PostAsync(path, JsonContent(request));
        await AssertProblemAsync(response, status, code);
    }

    private static async Task AssertProblemAsync(HttpResponseMessage response, int status, string code)
    {
        Assert.True((int)response.StatusCode == status && response.Content.Headers.ContentType?.MediaType == "application/problem+json",
            $"Expected ProblemDetails status {status}, received {(int)response.StatusCode}.");
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(document.RootElement.GetProperty("code").GetString() == code,
            $"Expected stable ProblemDetails code {code}.");
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
