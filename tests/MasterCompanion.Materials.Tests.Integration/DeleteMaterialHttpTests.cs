using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text;
using MasterCompanion.Engine.Features.Materials;
using MasterCompanion.Engine.Features.Sessions;
using MasterCompanion.Engine.Persistence;
using MasterCompanion.Gameplay.Tests.Integration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MasterCompanion.Materials.Tests.Integration;

[Collection("PostgreSQL")]
public sealed class DeleteMaterialHttpTests(PostgreSqlFixture database) : IAsyncLifetime
{
    private const string EmptyDocument = """{"type":"doc","content":[{"type":"paragraph"}]}""";
    private readonly Guid campaignId = Guid.NewGuid();
    private readonly string materialId = "note-" + Guid.NewGuid().ToString("D");
    private CampaignApiFactory? factory;
    private HttpClient? client;
    private HttpClient Client => client ?? throw new InvalidOperationException("The test client has not started.");
    private CampaignApiFactory App => factory ?? throw new InvalidOperationException("The test host has not started.");
    private string Path => $"/api/campaigns/{campaignId}/materials/{materialId}/deletion";

    public async Task InitializeAsync()
    {
        var connection = await database.CreateDatabaseAsync();
        await using (var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options))
        {
            await db.Database.MigrateAsync();
        }
        factory = new CampaignApiFactory(connection);
        client = factory.CreateClient();
        await using var scope = App.Services.CreateAsyncScope();
        var campaignDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        campaignDb.Campaigns.Add(new Campaign { Id = campaignId, Title = "Deletion campaign", ModuleId = "neutral-test", ModuleVersion = "1", FoldersRevision = 1, SessionsRevision = 1 });
        campaignDb.Materials.Add(NewMaterial(materialId, "Target"));
        await campaignDb.SaveChangesAsync();
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
    public async Task Deletion_WithReferences_UnpinsAtomicallyAndKeepsLinkedDocumentsAndMap()
    {
        // Arrange
        var sourceId = "source-" + Guid.NewGuid();
        var preparationId = "prep-" + Guid.NewGuid();
        var notesId = "notes-" + Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        await using (var scope = App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var source = NewMaterial(sourceId, "Incoming link");
            source.DocumentJson = $$$"""{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Target","marks":[{"type":"link","attrs":{"href":"#material/{{{materialId}}}/section"}}]}]}]}""";
            db.Materials.AddRange(source, NewMaterial(preparationId, "Preparation"), NewMaterial(notesId, "Notes"));
            db.Sessions.Add(new CampaignSession { CampaignId = campaignId, Id = sessionId, Title = "Pinned session", PreparationMaterialId = preparationId, NotesMaterialId = notesId, PinnedMaterialIdsJson = JsonSerializer.Serialize(new[] { materialId, sourceId }), Sequence = 1 });
            db.Maps.Add(new CampaignMap { CampaignId = campaignId, Id = "map-" + Guid.NewGuid(), DefinitionJson = $$$"""{"title":"Map","markers":[{"code":"A","title":"Marker","materialId":"{{{materialId}}}","x":1,"y":1}]}""" });
            await db.SaveChangesAsync();
        }
        var preview = await Preview();
        var request = new MaterialDeletionRequest(Guid.NewGuid(), preview.Revision, preview.ReferencesToken);

        // Act
        using var response = await Client.PostAsJsonAsync(Path, request);
        using var replay = await Client.PostAsJsonAsync(Path, request);

        // Assert
        Assert.Equal(new[] { "Incoming link" }, preview.DocumentLinks);
        Assert.Equal(new[] { "Map / Marker" }, preview.MapMarkers);
        Assert.Equal(new[] { "Pinned session" }, preview.PinnedSessions);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        await using var verification = App.Services.CreateAsyncScope();
        var persisted = verification.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await persisted.Materials.AnyAsync(item => item.Id == materialId));
        Assert.True(await persisted.Materials.AnyAsync(item => item.Id == sourceId));
        Assert.Single(await persisted.Maps.Where(item => item.CampaignId == campaignId).ToListAsync());
        var session = await persisted.Sessions.SingleAsync(item => item.CampaignId == campaignId && item.Id == sessionId);
        Assert.Equal(new[] { sourceId }, JsonSerializer.Deserialize<string[]>(session.PinnedMaterialIdsJson));
        var campaign = await persisted.Campaigns.SingleAsync(item => item.Id == campaignId);
        Assert.Equal(2, campaign.SessionsRevision);
        Assert.Equal(2, campaign.FoldersRevision);
        Assert.Single(await persisted.MaterialDeletionReceipts.Where(item => item.CampaignId == campaignId).ToListAsync());
        using var staleSessionSave = await Client.PostAsJsonAsync($"/api/campaigns/{campaignId}/sessions",
            new SessionOperationRequest(Guid.NewGuid(), 1,
                new UpdateSessionOperation(sessionId, "Stale session draft", "Draft summary", "Draft follow-up")));
        await AssertProblem(staleSessionSave, HttpStatusCode.Conflict, "session_revision_conflict");
        Assert.Equal("Pinned session", session.Title);
        using var changedRetry = await Client.PostAsJsonAsync(Path, request with { ExpectedRevision = 2 });
        await AssertProblem(changedRetry, HttpStatusCode.Conflict, "material_deletion_request_conflict");
    }

    [Fact]
    public async Task Deletion_RequiredSessionDocument_IsRejectedAndRemainsAvailable()
    {
        // Arrange
        await using (var scope = App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var notes = "notes-" + Guid.NewGuid();
            db.Materials.Add(NewMaterial(notes, "Notes"));
            db.Sessions.Add(new CampaignSession { CampaignId = campaignId, Id = Guid.NewGuid(), Title = "Owner", PreparationMaterialId = materialId, NotesMaterialId = notes, Sequence = 1 });
            await db.SaveChangesAsync();
        }
        var preview = await Preview();

        // Act
        using var response = await Client.PostAsJsonAsync(Path, new MaterialDeletionRequest(Guid.NewGuid(), preview.Revision, preview.ReferencesToken));

        // Assert
        Assert.Equal(new[] { "Owner" }, preview.OwningSessions);
        await AssertProblem(response, HttpStatusCode.Conflict, "material_session_document");
        using var material = await Client.GetAsync($"/api/materials/{materialId}");
        Assert.Equal(HttpStatusCode.OK, material.StatusCode);
    }

    [Fact]
    public async Task Deletion_AfterSave_RejectsStaleRevisionAndPreservesSavedContent()
    {
        // Arrange
        var preview = await Preview();
        var document = JsonSerializer.Deserialize<JsonElement>(EmptyDocument);
        using var save = await Client.PutAsJsonAsync($"/api/materials/{materialId}", new SaveMaterialRequest("Renamed target", document, 1));
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);

        // Act
        using var response = await Client.PostAsJsonAsync(Path, new MaterialDeletionRequest(Guid.NewGuid(), preview.Revision, preview.ReferencesToken));

        // Assert
        await AssertProblem(response, HttpStatusCode.Conflict, "material_revision_conflict");
        var current = await Preview();
        Assert.Equal(2, current.Revision);
        Assert.Equal("Renamed target", current.Title);
    }

    [Fact]
    public async Task Deletion_IncomingLinkChangedAfterPreview_RequiresNewConfirmation()
    {
        // Arrange
        var sourceId = "source-" + Guid.NewGuid();
        await using (var scope = App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Materials.Add(NewMaterial(sourceId, "Source"));
            await db.SaveChangesAsync();
        }
        var preview = await Preview();
        var document = JsonSerializer.Deserialize<JsonElement>($$$"""{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Target","marks":[{"type":"link","attrs":{"href":"#material/{{{materialId}}}"}}]}]}]}""");
        using var save = await Client.PutAsJsonAsync($"/api/materials/{sourceId}", new SaveMaterialRequest("Source", document, 1));
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);

        // Act
        using var response = await Client.PostAsJsonAsync(Path, new MaterialDeletionRequest(Guid.NewGuid(), preview.Revision, preview.ReferencesToken));

        // Assert
        await AssertProblem(response, HttpStatusCode.Conflict, "material_references_changed");
        Assert.Equal(new[] { "Source" }, (await Preview()).DocumentLinks);
    }

    [Fact]
    public async Task Deletion_ForeignCampaignTarget_IsNotFoundWithoutReceipt()
    {
        // Arrange
        var foreignPath = $"/api/campaigns/{Guid.NewGuid()}/materials/{materialId}/deletion";
        var preview = await Preview();

        // Act
        using var response = await Client.PostAsJsonAsync(foreignPath, new MaterialDeletionRequest(Guid.NewGuid(), preview.Revision, preview.ReferencesToken));

        // Assert
        await AssertProblem(response, HttpStatusCode.NotFound, "campaign_not_found");
        Assert.Equal(1, (await Preview()).Revision);
    }

    [Fact]
    public async Task Deletion_ConcurrentDifferentRequests_OnlyOneSucceeds()
    {
        // Arrange
        var preview = await Preview();
        var first = new MaterialDeletionRequest(Guid.NewGuid(), preview.Revision, preview.ReferencesToken);
        var second = first with { RequestId = Guid.NewGuid() };

        // Act
        var responses = await Task.WhenAll(Client.PostAsJsonAsync(Path, first), Client.PostAsJsonAsync(Path, second));

        // Assert
        try
        {
            Assert.Equal(new[] { HttpStatusCode.OK, HttpStatusCode.NotFound }, responses.Select(response => response.StatusCode).Order().ToArray());
        }
        finally
        {
            foreach (var response in responses) response.Dispose();
        }
    }

    [Fact]
    public async Task Deletion_RacingSave_PreservesEitherTheConfirmedSaveOrTheConfirmedDeletion()
    {
        // Arrange
        var preview = await Preview();
        var deletion = new MaterialDeletionRequest(Guid.NewGuid(), preview.Revision, preview.ReferencesToken);
        var save = new SaveMaterialRequest("Renamed racing target", JsonSerializer.Deserialize<JsonElement>(EmptyDocument), 1);

        // Act
        var deleting = Client.PostAsJsonAsync(Path, deletion);
        var saving = Client.PutAsJsonAsync($"/api/materials/{materialId}", save);
        using var deletionResponse = await deleting;
        using var saveResponse = await saving;

        // Assert
        if (deletionResponse.StatusCode == HttpStatusCode.OK)
        {
            Assert.Equal(HttpStatusCode.NotFound, saveResponse.StatusCode);
            using var missing = await Client.GetAsync($"/api/materials/{materialId}");
            Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        }
        else
        {
            await AssertProblem(deletionResponse, HttpStatusCode.Conflict, "material_revision_conflict");
            Assert.Equal(HttpStatusCode.OK, saveResponse.StatusCode);
            var current = await Preview();
            Assert.Equal(2, current.Revision);
            Assert.Equal("Renamed racing target", current.Title);
        }
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("null")]
    [InlineData("""{"requestId":"00000000-0000-0000-0000-000000000000","expectedRevision":1,"referencesToken":"AAAA"}""")]
    [InlineData("""{"requestId":"7111199a-6369-4229-a731-95af63c3d97f","expectedRevision":0,"referencesToken":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}""")]
    [InlineData("""{"requestId":"7111199a-6369-4229-a731-95af63c3d97f","expectedRevision":1,"referencesToken":null}""")]
    [InlineData("""{"requestId":"7111199a-6369-4229-a731-95af63c3d97f","expectedRevision":1,"referencesToken":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","extra":true}""")]
    public async Task Deletion_InvalidEnvelope_IsRejectedWithoutDeleting(string json)
    {
        // Arrange
        using var content = new StringContent(json, Encoding.UTF8, "application/json");

        // Act
        using var response = await Client.PostAsync(Path, content);

        // Assert
        await AssertProblem(response, HttpStatusCode.BadRequest, "invalid_material_deletion");
        Assert.Equal(1, (await Preview()).Revision);
    }

    private Material NewMaterial(string id, string title) => new() { Id = id, CampaignId = campaignId, Title = title, Group = "", DocumentJson = EmptyDocument, Revision = 1, DocumentSchemaVersion = 1 };
    private async Task<MaterialDeletionPreview> Preview() => await Client.GetFromJsonAsync<MaterialDeletionPreview>(Path) ?? throw new InvalidOperationException("The deletion preview is missing.");
    private static async Task AssertProblem(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(code, problem.GetProperty("code").GetString());
    }
}
