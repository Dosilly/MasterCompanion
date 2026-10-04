using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using MasterCompanion.Engine.Features.Folders;
using MasterCompanion.Engine.Persistence;
using MasterCompanion.Gameplay.Tests.Integration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MasterCompanion.Folders.Tests.Integration;

[Collection("PostgreSQL")]
public sealed class FolderOperationsHttpTests(PostgreSqlFixture database) : IAsyncLifetime
{
    private readonly Guid campaignId = Guid.NewGuid();
    private readonly Guid foreignCampaignId = Guid.NewGuid();
    private CampaignApiFactory? factory;
    private HttpClient? client;
    private CampaignApiFactory App => factory ?? throw new InvalidOperationException("The test host has not started.");
    private HttpClient Client => client ?? throw new InvalidOperationException("The test client has not started.");
    private string Path => $"/api/campaigns/{campaignId:D}/folders";

    public async Task InitializeAsync()
    {
        factory = new CampaignApiFactory(await database.CreateDatabaseAsync());
        client = factory.CreateClient();
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Campaigns.AddRange(
            new Campaign { Id = campaignId, Title = "Folders campaign", ModuleId = "neutral-test", ModuleVersion = "1" },
            new Campaign { Id = foreignCampaignId, Title = "Other campaign", ModuleId = "neutral-test", ModuleVersion = "1" });
        db.Folders.AddRange(
            Folder("a", null, 0), Folder("b", null, 1), Folder("c", null, 2),
            Folder("x", "a", 0), Folder("y", "a", 1), Folder("leaf", "x", 0),
            new CampaignFolder { CampaignId = foreignCampaignId, Id = "foreign", Title = "Foreign" },
            new CampaignFolder { CampaignId = foreignCampaignId, Id = "a", Title = "Foreign same ID" });
        db.Materials.Add(new Material
        {
            Id = $"note-{campaignId:D}", CampaignId = campaignId, Title = "Authored note", Group = "Original group",
            FolderId = "leaf", DocumentJson = """{"type":"doc","content":[{"type":"paragraph"}]}""",
            DocumentSchemaVersion = 1, Revision = 11, SortOrder = 2
        });
        db.GameStates.Add(new CampaignGameState { CampaignId = campaignId, Revision = 7, SnapshotJson = "{}" });
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
    public async Task Read_InitialFolders_ReturnsCampaignScopedStableOrderAndRevision()
    {
        // Act
        using var response = await Client.GetAsync(Path);
        var snapshot = await response.Content.ReadFromJsonAsync<FolderSnapshot>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(snapshot);
        Assert.Equal(0, snapshot.Revision);
        Assert.Equal(new[] { "a", "leaf", "x", "b", "y", "c" }, snapshot.Folders.Select(folder => folder.Id));
        Assert.Equal("x", snapshot.Folders.Single(folder => folder.Id == "leaf").ParentId);
        Assert.DoesNotContain(snapshot.Folders, folder => folder.Id == "foreign");
    }

    [Fact]
    public async Task Rename_TrimmedTitle_ChangesOnlyFolderTitleAndNavigationRevision()
    {
        // Arrange
        var materialBefore = await MaterialJsonAsync();
        var request = Rename("a", "  Renamed folder  ");

        // Act
        using var response = await SendAsync(request);
        var snapshot = await response.Content.ReadFromJsonAsync<FolderSnapshot>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(snapshot);
        Assert.Equal(1, snapshot.Revision);
        Assert.Equal("Renamed folder", snapshot.Folders.Single(folder => folder.Id == "a").Title);
        Assert.Equal(materialBefore, await MaterialJsonAsync());
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var game = await db.GameStates.AsNoTracking().SingleAsync(state => state.CampaignId == campaignId);
        Assert.Equal(7, game.Revision);
        Assert.Equal("{}", game.SnapshotJson);
        Assert.Equal(0, await db.GameOperations.CountAsync(operation => operation.CampaignId == campaignId));
        Assert.Equal("Foreign same ID", (await db.Folders.SingleAsync(folder => folder.CampaignId == foreignCampaignId && folder.Id == "a")).Title);
    }

    [Fact]
    public async Task Move_BeforeRootSibling_PersistsNewRootOrder()
    {
        // Act
        using var response = await SendAsync(Move("c", null, "a"));
        var current = await ReadAsync();

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new[] { "c", "a", "b" }, current.Folders.Where(folder => folder.ParentId is null).Select(folder => folder.Id));
        Assert.Equal(1, current.Revision);
    }

    [Theory]
    [InlineData("b", null)]
    [InlineData(null, "b")]
    public async Task Move_SubtreeToAnotherParent_KeepsDescendantsAndMaterialOwnership(string? parentId, string? beforeId)
    {
        // Arrange
        var materialBefore = await MaterialJsonAsync();

        // Act
        using var response = await SendAsync(Move("x", parentId, beforeId));
        var current = await ReadAsync();

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(parentId, current.Folders.Single(folder => folder.Id == "x").ParentId);
        Assert.Equal("x", current.Folders.Single(folder => folder.Id == "leaf").ParentId);
        Assert.Equal(new[] { "y" }, current.Folders.Where(folder => folder.ParentId == "a").Select(folder => folder.Id));
        if (parentId is null)
        {
            Assert.Equal(new[] { "a", "x", "b", "c" }, current.Folders.Where(folder => folder.ParentId is null).Select(folder => folder.Id));
        }
        Assert.Equal(materialBefore, await MaterialJsonAsync());
    }

    [Theory]
    [InlineData("a", "a", null, "folder_cycle")]
    [InlineData("a", "leaf", null, "folder_cycle")]
    [InlineData("x", "foreign", null, "folder_parent_not_found")]
    [InlineData("x", "b", "y", "folder_target_not_found")]
    [InlineData("x", "a", "x", "folder_target_not_found")]
    [InlineData("x", null, "foreign", "folder_target_not_found")]
    public async Task Move_InvalidHierarchy_RejectsWithoutFolderOrRevisionChanges(string folderId, string? parentId,
        string? beforeId, string code)
    {
        // Arrange
        var before = await ReadAsync();

        // Act
        using var response = await SendAsync(Move(folderId, parentId, beforeId));

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.BadRequest, code);
        Assert.Equal(JsonSerializer.Serialize(before), JsonSerializer.Serialize(await ReadAsync()));
        Assert.Equal(0, await ReceiptCountAsync());
    }

    [Fact]
    public async Task Rename_ForeignFolder_ReturnsNotFoundWithoutChangingForeignCampaign()
    {
        // Act
        using var response = await SendAsync(Rename("foreign", "Attempted rename"));

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.NotFound, "folder_not_found");
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal("Foreign", (await db.Folders.SingleAsync(folder => folder.CampaignId == foreignCampaignId && folder.Id == "foreign")).Title);
        Assert.Equal(0, (await ReadAsync()).Revision);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Folders_MissingCampaign_ReturnsCampaignNotFound(bool write)
    {
        // Arrange
        var path = $"/api/campaigns/{Guid.NewGuid():D}/folders";

        // Act
        using var response = write ? await Client.PostAsJsonAsync(path, Rename("a", "Attempted")) : await Client.GetAsync(path);

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.NotFound, "campaign_not_found");
    }

    [Theory]
    [InlineData(1)]
    [InlineData(300)]
    public async Task Rename_BoundaryTitleLength_IsAccepted(int length)
    {
        // Arrange
        var title = new string('a', length);

        // Act
        using var response = await SendAsync(Rename("a", title));

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(title, (await ReadAsync()).Folders.Single(folder => folder.Id == "a").Title);
    }

    [Fact]
    public async Task Rename_OverlongTitle_IsRejected()
    {
        // Act
        using var response = await SendAsync(Rename("a", new string('a', 301)));

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "invalid_folder_operation");
        Assert.Equal(0, (await ReadAsync()).Revision);
    }

    [Fact]
    public async Task Change_ConcurrentRevision_AllowsOneWinnerAndOneReceipt()
    {
        // Act
        var responses = await Task.WhenAll(SendAsync(Rename("a", "First writer")), SendAsync(Rename("b", "Second writer")));
        try
        {
            // Assert
            Assert.Single(responses, response => response.StatusCode == HttpStatusCode.OK);
            var conflict = Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Conflict);
            await AssertProblemAsync(conflict, HttpStatusCode.Conflict, "folder_revision_conflict");
            var winner = await responses.Single(response => response.StatusCode == HttpStatusCode.OK).Content.ReadAsStringAsync();
            using var persisted = await Client.GetAsync(Path);
            Assert.Equal(winner, await persisted.Content.ReadAsStringAsync());
            Assert.Equal(1, await ReceiptCountAsync());
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
    public async Task Change_ConcurrentExactRetries_ReturnsSameReceiptAndAdvancesOnce()
    {
        // Arrange
        var request = Move("x", "b", null);

        // Act
        var responses = await Task.WhenAll(SendAsync(request), SendAsync(request));
        try
        {
            // Assert
            Assert.All(responses, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
            Assert.Equal(await responses[0].Content.ReadAsStringAsync(), await responses[1].Content.ReadAsStringAsync());
            Assert.Equal(1, (await ReadAsync()).Revision);
            Assert.Equal(1, await ReceiptCountAsync());
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
    public async Task Change_ExactRetryAfterLaterChange_ReplaysOriginalSnapshot()
    {
        // Arrange
        var request = Rename("a", "First title");
        using var first = await SendAsync(request);
        using var later = await SendAsync(Rename("a", "Later title", 1));

        // Act
        using var repeated = await SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, repeated.StatusCode);
        Assert.Equal(await first.Content.ReadAsStringAsync(), await repeated.Content.ReadAsStringAsync());
        var current = await ReadAsync();
        Assert.Equal(2, current.Revision);
        Assert.Equal("Later title", current.Folders.Single(folder => folder.Id == "a").Title);
        Assert.Equal(2, await ReceiptCountAsync());
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Change_ReusedRequestIdWithChangedInput_ReturnsRequestConflict(bool changeTitle)
    {
        // Arrange
        var request = Rename("a", "Accepted title");
        using var accepted = await SendAsync(request);
        var changed = changeTitle ? request with { Operation = new RenameFolderOperation("a", "Changed title") }
            : request with { ExpectedRevision = 1 };

        // Act
        using var response = await SendAsync(changed);

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.Conflict, "folder_request_conflict");
        Assert.Equal(1, (await ReadAsync()).Revision);
        Assert.Equal(1, await ReceiptCountAsync());
    }

    [Theory]
    [InlineData("null")]
    [InlineData("{\"kind\":\"rename\",\"folderId\":\"a\",\"title\":null}")]
    [InlineData("{\"kind\":\"rename\",\"folderId\":\"a\",\"title\":\" \"}")]
    [InlineData("{\"kind\":\"rename\",\"folderId\":\"a\",\"title\":\"A\\nB\"}")]
    [InlineData("{\"kind\":\"rename\",\"folderId\":\"a\",\"title\":\"New\",\"parentId\":null}")]
    [InlineData("{\"kind\":\"rename\",\"folderId\":\"a\",\"folderId\":\"b\",\"title\":\"New\"}")]
    [InlineData("{\"kind\":\"move\",\"folderId\":\"a\",\"parentId\":null}")]
    [InlineData("{\"kind\":\"move\",\"folderId\":\"a\",\"parentId\":null,\"beforeId\":null,\"title\":\"New\"}")]
    [InlineData("{\"kind\":\"delete\",\"folderId\":\"a\"}")]
    [InlineData("{\"folderId\":\"a\",\"title\":\"New\"}")]
    public async Task Change_InvalidOperationShape_ReturnsValidationProblem(string operation)
    {
        // Arrange
        var json = $$"""{"requestId":"{{Guid.NewGuid():D}}","expectedRevision":0,"operation":{{operation}}}""";
        using var body = new StringContent(json, Encoding.UTF8, "application/json");

        // Act
        using var response = await Client.PostAsync(Path, body);

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "invalid_folder_operation");
        Assert.Equal(0, (await ReadAsync()).Revision);
        Assert.Equal(0, await ReceiptCountAsync());
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(9_007_199_254_740_992)]
    public async Task Change_InvalidRevision_ReturnsValidationProblem(long revision)
    {
        // Act
        using var response = await SendAsync(Rename("a", "Attempted", revision));

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "invalid_folder_operation");
        Assert.Equal(0, (await ReadAsync()).Revision);
    }

    [Fact]
    public async Task Change_StaleRevision_ReturnsConflictWithoutMutation()
    {
        // Arrange
        using var accepted = await SendAsync(Rename("a", "Accepted"));

        // Act
        using var response = await SendAsync(Move("b", "a", null));

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.Conflict, "folder_revision_conflict");
        Assert.Null((await ReadAsync()).Folders.Single(folder => folder.Id == "b").ParentId);
        Assert.Equal(1, await ReceiptCountAsync());
    }

    [Fact]
    public async Task Change_MaxSafeRevision_ReturnsLimitWithoutMutation()
    {
        // Arrange
        const long revision = 9_007_199_254_740_991;
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var campaign = await db.Campaigns.SingleAsync(item => item.Id == campaignId);
        campaign.FoldersRevision = revision;
        await db.SaveChangesAsync();

        // Act
        using var response = await SendAsync(Rename("a", "Attempted", revision));

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.Conflict, "folder_revision_limit");
        Assert.Equal(revision, (await ReadAsync()).Revision);
        Assert.Equal(0, await ReceiptCountAsync());
    }

    [Theory]
    [InlineData("text/plain", 1, HttpStatusCode.UnsupportedMediaType, "folder_json_required")]
    [InlineData("application/json", 8193, HttpStatusCode.RequestEntityTooLarge, "folder_request_too_large")]
    public async Task Change_UnsupportedBody_ReturnsStableProblem(string contentType, int length, HttpStatusCode status, string code)
    {
        // Arrange
        using var body = new StringContent(new string('x', length), Encoding.UTF8, contentType);

        // Act
        using var response = await Client.PostAsync(Path, body);

        // Assert
        await AssertProblemAsync(response, status, code);
    }

    [Fact]
    public async Task Change_DeferredReceiptFailure_RollsBackFoldersRevisionAndReceipt()
    {
        // Arrange
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            CREATE FUNCTION engine.reject_test_folder_receipt() RETURNS trigger LANGUAGE plpgsql AS $test$
            BEGIN
                RAISE EXCEPTION 'Injected folder receipt persistence failure';
            END;
            $test$;
            CREATE CONSTRAINT TRIGGER reject_test_folder_receipt AFTER INSERT ON engine."FolderOperationReceipts"
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION engine.reject_test_folder_receipt();
            """);
        var before = await ReadAsync();
        var request = Move("x", "b", null);
        try
        {
            // Act
            using var response = await SendAsync(request);

            // Assert
            Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
            Assert.Equal(JsonSerializer.Serialize(before), JsonSerializer.Serialize(await ReadAsync()));
            Assert.Equal(0, await ReceiptCountAsync());
        }
        finally
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                DROP TRIGGER reject_test_folder_receipt ON engine."FolderOperationReceipts";
                DROP FUNCTION engine.reject_test_folder_receipt();
                """);
        }

        // Act
        using var retry = await SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        Assert.Equal(1, (await ReadAsync()).Revision);
    }

    private CampaignFolder Folder(string id, string? parentId, int order) => new()
    {
        CampaignId = campaignId, Id = id, Title = $"Folder {id}", ParentId = parentId, SortOrder = order
    };

    private static FolderOperationRequest Rename(string id, string title, long revision = 0) =>
        new(Guid.NewGuid(), revision, new RenameFolderOperation(id, title));

    private static FolderOperationRequest Move(string id, string? parentId, string? beforeId, long revision = 0) =>
        new(Guid.NewGuid(), revision, new MoveFolderOperation(id, parentId, beforeId));

    private Task<HttpResponseMessage> SendAsync(FolderOperationRequest request) => Client.PostAsJsonAsync(Path, request);

    private async Task<FolderSnapshot> ReadAsync() => await Client.GetFromJsonAsync<FolderSnapshot>(Path)
        ?? throw new InvalidOperationException("The folder snapshot is missing.");

    private async Task<int> ReceiptCountAsync()
    {
        await using var scope = App.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<AppDbContext>().FolderOperationReceipts
            .CountAsync(receipt => receipt.CampaignId == campaignId);
    }

    private async Task<string> MaterialJsonAsync()
    {
        await using var scope = App.Services.CreateAsyncScope();
        var material = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Materials.AsNoTracking()
            .SingleAsync(item => item.CampaignId == campaignId);
        return JsonSerializer.Serialize(material);
    }

    private static async Task AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(code, problem.GetProperty("code").GetString());
    }
}
