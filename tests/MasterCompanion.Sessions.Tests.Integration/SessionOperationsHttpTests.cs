using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using MasterCompanion.Engine.Features.Materials;
using MasterCompanion.Engine.Features.Sessions;
using MasterCompanion.Engine.Persistence;
using MasterCompanion.Gameplay.Tests.Integration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MasterCompanion.Sessions.Tests.Integration;

[Collection("PostgreSQL")]
public sealed class SessionOperationsHttpTests(PostgreSqlFixture database) : IAsyncLifetime
{
    private readonly Guid campaignId = Guid.NewGuid();
    private readonly Guid otherCampaignId = Guid.NewGuid();
    private CampaignApiFactory? factory;
    private HttpClient? client;
    private CampaignApiFactory App => factory ?? throw new InvalidOperationException("The test host has not started.");
    private HttpClient Client => client ?? throw new InvalidOperationException("The test client has not started.");
    private string Path => $"/api/campaigns/{campaignId:D}/sessions";
    private string MaterialId => $"note-{campaignId:D}";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task InitializeAsync()
    {
        factory = new CampaignApiFactory(await database.CreateDatabaseAsync());
        client = factory.CreateClient();
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Campaigns.AddRange(
            new Campaign { Id = campaignId, Title = "Meetings campaign", ModuleId = "neutral-test", ModuleVersion = "1" },
            new Campaign { Id = otherCampaignId, Title = "Other campaign", ModuleId = "neutral-test", ModuleVersion = "1" });
        db.Materials.AddRange(Document(MaterialId, campaignId), Document("foreign-material", otherCampaignId));
        db.GameStates.Add(new CampaignGameState { CampaignId = campaignId, Revision = 7, SnapshotJson = "{\"timeMinutes\":180}" });
        await db.SaveChangesAsync();
    }

    public async Task DisposeAsync()
    {
        client?.Dispose();
        if (factory is not null)
        {
            await factory.DisposeAsync();
        }
    }

    [Fact]
    public async Task CreateSession_CreatesTwoIndependentDocumentsAndLeavesGameplayUnchanged()
    {
        // Arrange
        var operation = Create();

        // Act
        var response = await ChangeAsync(operation);
        var session = Assert.Single(response.Sessions);

        // Assert
        Assert.Equal(1, response.Revision);
        Assert.Equal("First meeting", session.Title);
        Assert.Equal("planned", session.Status);
        Assert.Empty(session.PinnedMaterialIds);
        Assert.Equal(string.Empty, session.Summary);
        Assert.Equal(string.Empty, session.FollowUp);
        Assert.NotEqual(session.PreparationMaterialId, session.NotesMaterialId);
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var documents = await db.Materials.Where(item => item.CampaignId == campaignId).ToListAsync();
        Assert.Equal(3, documents.Count);
        Assert.All(documents.Where(item => item.Id != MaterialId), item => Assert.Equal(1, item.Revision));
        Assert.Equal("First meeting preparation", documents.Single(item => item.Id == session.PreparationMaterialId).Title);
        Assert.Equal("First meeting notes", documents.Single(item => item.Id == session.NotesMaterialId).Title);
        Assert.Equal(7, (await db.GameStates.SingleAsync(item => item.CampaignId == campaignId)).Revision);
        Assert.Equal("{\"timeMinutes\":180}", (await db.GameStates.SingleAsync(item => item.CampaignId == campaignId)).SnapshotJson.Replace(" ", ""));
        Assert.Empty(await db.GameOperations.Where(item => item.CampaignId == campaignId).ToListAsync());
        Assert.Equal(0, (await db.Campaigns.SingleAsync(item => item.Id == campaignId)).FoldersRevision);
    }

    [Fact]
    public async Task Lifecycle_NextMeetingPreservesCompletedRecordDocumentsAndGameTime()
    {
        // Arrange
        var first = Create();
        await ChangeAsync(first);
        await ChangeAsync(new UpdateSessionOperation(first.SessionId, "Renamed", "Played summary", "Unresolved clue"));
        await ChangeAsync(new StartSessionOperation(first.SessionId));
        await ChangeAsync(new CompleteSessionOperation(first.SessionId));
        var second = Create("Next meeting");

        // Act
        await ChangeAsync(second);
        var response = await ChangeAsync(new StartSessionOperation(second.SessionId));

        // Assert
        Assert.Equal(2, response.Sessions.Count);
        var completed = response.Sessions.Single(item => item.Id == first.SessionId);
        Assert.Equal("completed", completed.Status);
        Assert.Equal("Renamed", completed.Title);
        Assert.Equal("Played summary", completed.Summary);
        Assert.Equal("Unresolved clue", completed.FollowUp);
        Assert.Equal("active", response.Sessions.Single(item => item.Id == second.SessionId).Status);
        Assert.NotEqual(completed.NotesMaterialId, response.Sessions[1].NotesMaterialId);
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(7, (await db.GameStates.SingleAsync(item => item.CampaignId == campaignId)).Revision);
        Assert.Empty(await db.GameOperations.Where(item => item.CampaignId == campaignId).ToListAsync());
    }

    [Fact]
    public async Task PinAndUnpin_ReferenceExistingMaterialWithoutCopyingOrChangingIt()
    {
        // Arrange
        var create = Create();
        await ChangeAsync(create);

        // Act
        var pinned = await ChangeAsync(new PinSessionMaterialOperation(create.SessionId, MaterialId));
        var unpinned = await ChangeAsync(new UnpinSessionMaterialOperation(create.SessionId, MaterialId));

        // Assert
        Assert.Equal(new[] { MaterialId }, Assert.Single(pinned.Sessions).PinnedMaterialIds);
        Assert.Empty(Assert.Single(unpinned.Sessions).PinnedMaterialIds);
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(3, await db.Materials.CountAsync(item => item.CampaignId == campaignId));
        Assert.Equal(11, (await db.Materials.SingleAsync(item => item.Id == MaterialId)).Revision);
    }

    [Theory]
    [InlineData("start-active")]
    [InlineData("complete-planned")]
    [InlineData("start-completed")]
    [InlineData("start-second")]
    public async Task Lifecycle_InvalidTransition_ReturnsConflictAndPreservesCollection(string scenario)
    {
        // Arrange
        var first = Create();
        await ChangeAsync(first);
        SessionOperation operation = new CompleteSessionOperation(first.SessionId);
        if (scenario != "complete-planned")
        {
            await ChangeAsync(new StartSessionOperation(first.SessionId));
            operation = new StartSessionOperation(first.SessionId);
        }
        if (scenario == "start-completed")
        {
            await ChangeAsync(new CompleteSessionOperation(first.SessionId));
        }
        if (scenario == "start-second")
        {
            var second = Create("Second");
            await ChangeAsync(second);
            operation = new StartSessionOperation(second.SessionId);
        }
        var before = await ReadAsync();

        // Act
        using var response = await SendAsync(new(Guid.NewGuid(), before.Revision, operation));

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.Conflict, "session_transition_conflict");
        Assert.Equal(JsonSerializer.Serialize(before), JsonSerializer.Serialize(await ReadAsync()));
    }

    [Fact]
    public async Task Create_ExactConcurrentRetry_ReplaysOneReceiptWithoutDuplicateDocuments()
    {
        // Arrange
        var request = new SessionOperationRequest(Guid.NewGuid(), 0, Create());

        // Act
        var responses = await Task.WhenAll(SendAsync(request), SendAsync(request));
        try
        {
            // Assert
            Assert.All(responses, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
            Assert.Equal(await responses[0].Content.ReadAsStringAsync(), await responses[1].Content.ReadAsStringAsync());
            await using var scope = App.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(1, await db.Sessions.CountAsync(item => item.CampaignId == campaignId));
            Assert.Equal(3, await db.Materials.CountAsync(item => item.CampaignId == campaignId));
            Assert.Equal(1, await db.SessionOperationReceipts.CountAsync(item => item.CampaignId == campaignId));
        }
        finally
        {
            foreach (var response in responses)
            {
                response.Dispose();
            }
        }
    }

    [Fact]
    public async Task Create_ReplayAfterDocumentSaveAndSessionUpdate_ReturnsOriginalReceiptWithoutOverwritingEdits()
    {
        // Arrange
        var request = new SessionOperationRequest(Guid.NewGuid(), 0, Create());
        using var original = await SendAsync(request);
        var originalBody = await original.Content.ReadAsStringAsync();
        var first = Assert.Single((await ReadAsync()).Sessions);
        using var saved = await Client.PutAsJsonAsync($"/api/materials/{first.NotesMaterialId}", new
        {
            expectedRevision = 1,
            document = JsonSerializer.Deserialize<JsonElement>("{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Played notes\"}]}]}")
        });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        await ChangeAsync(new UpdateSessionOperation(first.Id, "Changed meeting", "Summary", "Next"));

        // Act
        using var replay = await SendAsync(request);

        // Assert
        Assert.Equal(originalBody, await replay.Content.ReadAsStringAsync());
        Assert.Equal("Changed meeting", Assert.Single((await ReadAsync()).Sessions).Title);
        var document = await Client.GetFromJsonAsync<MaterialResponse>($"/api/materials/{first.NotesMaterialId}");
        Assert.NotNull(document);
        Assert.Equal(2, document.Revision);
        Assert.Contains("Played notes", document.Document.ToString());
    }

    [Fact]
    public async Task Update_ConcurrentDifferentRequests_OnlyOneRevisionCommits()
    {
        // Arrange
        var create = Create();
        await ChangeAsync(create);
        var first = new SessionOperationRequest(Guid.NewGuid(), 1, new UpdateSessionOperation(create.SessionId, "One", "", ""));
        var second = new SessionOperationRequest(Guid.NewGuid(), 1, new UpdateSessionOperation(create.SessionId, "Two", "", ""));

        // Act
        var responses = await Task.WhenAll(SendAsync(first), SendAsync(second));
        try
        {
            // Assert
            Assert.Equal(new[] { HttpStatusCode.OK, HttpStatusCode.Conflict }, responses.Select(item => item.StatusCode).Order());
            Assert.Equal(2, (await ReadAsync()).Revision);
        }
        finally
        {
            foreach (var response in responses)
            {
                response.Dispose();
            }
        }
    }

    [Fact]
    public async Task Receipt_DifferentPayloadWithSameRequestId_ReturnsConflict()
    {
        // Arrange
        var create = Create();
        var request = new SessionOperationRequest(Guid.NewGuid(), 0, create);
        using var first = await SendAsync(request);

        // Act
        using var response = await SendAsync(request with { Operation = create with { Title = "Different" } });

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.Conflict, "session_request_conflict");
        Assert.Equal(1, (await ReadAsync()).Revision);
    }

    [Fact]
    public async Task Create_DocumentWriteFailure_RollsBackSessionDocumentsRevisionAndReceipt()
    {
        // Arrange
        var create = Create();
        await using (var scope = App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Materials.Add(Document($"session-{create.SessionId:D}-notes", otherCampaignId));
            await db.SaveChangesAsync();
        }

        // Act
        using var response = await SendAsync(new(Guid.NewGuid(), 0, create));

        // Assert
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal(0, (await ReadAsync()).Revision);
        await using var check = App.Services.CreateAsyncScope();
        var current = check.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await current.Sessions.Where(item => item.CampaignId == campaignId).ToListAsync());
        Assert.Empty(await current.SessionOperationReceipts.Where(item => item.CampaignId == campaignId).ToListAsync());
        Assert.Equal(1, await current.Materials.CountAsync(item => item.CampaignId == campaignId));
    }

    [Fact]
    public async Task Pin_ForeignCampaignMaterial_RejectsWithoutChangingSession()
    {
        // Arrange
        var create = Create();
        await ChangeAsync(create);

        // Act
        using var response = await SendAsync(new(Guid.NewGuid(), 1, new PinSessionMaterialOperation(create.SessionId, "foreign-material")));

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.NotFound, "session_material_not_found");
        Assert.Empty(Assert.Single((await ReadAsync()).Sessions).PinnedMaterialIds);
    }

    [Fact]
    public async Task ReadAndUpdate_ForeignSession_AreCampaignScoped()
    {
        // Arrange
        var create = Create();
        await ChangeAsync(create);

        // Act
        using var read = await Client.GetAsync($"/api/campaigns/{otherCampaignId:D}/sessions");
        using var update = await Client.PostAsJsonAsync($"/api/campaigns/{otherCampaignId:D}/sessions",
            new SessionOperationRequest(Guid.NewGuid(), 0, new UpdateSessionOperation(create.SessionId, "Foreign", "", "")));

        // Assert
        Assert.Empty((await read.Content.ReadFromJsonAsync<SessionSnapshot>() ?? throw new InvalidOperationException("Missing snapshot.")).Sessions);
        await AssertProblemAsync(update, HttpStatusCode.NotFound, "session_not_found");
        Assert.Equal("First meeting", Assert.Single((await ReadAsync()).Sessions).Title);
    }

    [Theory]
    [InlineData("unknown-kind")]
    [InlineData("extra-field")]
    [InlineData("duplicate-field")]
    [InlineData("null-operation")]
    [InlineData("empty-title")]
    [InlineData("long-title")]
    [InlineData("long-summary")]
    [InlineData("control-title")]
    [InlineData("missing-title")]
    [InlineData("null-title")]
    [InlineData("empty-id")]
    [InlineData("fractional-revision")]
    public async Task Change_InvalidBoundaryInput_RejectsWithoutMutation(string scenario)
    {
        // Arrange
        var operation = Create();
        var json = JsonSerializer.Serialize(new SessionOperationRequest(Guid.NewGuid(), 0, operation), JsonOptions);
        json = scenario switch
        {
            "unknown-kind" => json.Replace("\"create\"", "\"unsupported\""),
            "extra-field" => json.Insert(1, "\"extra\":true,"),
            "duplicate-field" => json.Insert(1, "\"expectedRevision\":0,"),
            "null-operation" => json[..json.IndexOf("\"operation\"", StringComparison.Ordinal)] + "\"operation\":null}",
            "empty-title" => json.Replace("First meeting\"", "\""),
            "long-title" => json.Replace("First meeting\"", new string('a', 301) + "\""),
            "long-summary" => JsonSerializer.Serialize(new SessionOperationRequest(Guid.NewGuid(), 0,
                new UpdateSessionOperation(operation.SessionId, "Title", new string('a', 20_001), "")), JsonOptions),
            "control-title" => json.Replace("First meeting\"", "Bad\\u0000title\""),
            "missing-title" => json.Replace("\"title\":\"First meeting\",", ""),
            "null-title" => json.Replace("\"title\":\"First meeting\"", "\"title\":null"),
            "empty-id" => json.Replace(operation.SessionId.ToString(), Guid.Empty.ToString()),
            "fractional-revision" => json.Replace("\"expectedRevision\":0", "\"expectedRevision\":0.5"),
            _ => throw new InvalidOperationException("Unsupported input scenario.")
        };

        // Act
        using var response = await Client.PostAsync(Path, new StringContent(json, Encoding.UTF8, "application/json"));

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "invalid_session_operation");
        Assert.Equal(0, (await ReadAsync()).Revision);
        Assert.Empty((await ReadAsync()).Sessions);
    }

    private static CreateSessionOperation Create(string title = "First meeting") =>
        new(Guid.NewGuid(), title, title + " preparation", title + " notes");

    private static Material Document(string id, Guid owner) => new()
    {
        Id = id,
        CampaignId = owner,
        Title = "Authored note",
        Group = "",
        DocumentJson = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}",
        DocumentSchemaVersion = 1,
        Revision = 11
    };

    private async Task<SessionSnapshot> ChangeAsync(SessionOperation operation)
    {
        using var response = await SendAsync(new(Guid.NewGuid(), (await ReadAsync()).Revision, operation));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<SessionSnapshot>() ?? throw new InvalidOperationException("Missing snapshot.");
    }

    private async Task<SessionSnapshot> ReadAsync() =>
        await Client.GetFromJsonAsync<SessionSnapshot>(Path) ?? throw new InvalidOperationException("Missing snapshot.");

    private Task<HttpResponseMessage> SendAsync(SessionOperationRequest request) => Client.PostAsJsonAsync(Path, request, JsonOptions);

    private static async Task AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(code, body.RootElement.GetProperty("code").GetString());
    }
}
