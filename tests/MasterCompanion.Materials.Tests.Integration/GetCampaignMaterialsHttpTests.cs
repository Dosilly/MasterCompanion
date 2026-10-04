using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MasterCompanion.Engine.Features.Materials;
using MasterCompanion.Engine.Persistence;
using MasterCompanion.Gameplay.Tests.Integration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MasterCompanion.Materials.Tests.Integration;

[Collection("PostgreSQL")]
public sealed class GetCampaignMaterialsHttpTests(PostgreSqlFixture database) : IAsyncLifetime
{
    private readonly Guid campaignId = Guid.NewGuid();
    private readonly Guid otherCampaignId = Guid.NewGuid();
    private CampaignApiFactory? factory;
    private HttpClient? client;
    private CampaignApiFactory App => factory ?? throw new InvalidOperationException("The test host has not started.");
    private HttpClient Client => client ?? throw new InvalidOperationException("The test client has not started.");
    private string Path => $"/api/campaigns/{campaignId:D}/materials";

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
        campaignDb.Campaigns.AddRange(
            new Campaign { Id = campaignId, Title = "Material preload campaign", ModuleId = "neutral-test", ModuleVersion = "1" },
            new Campaign { Id = otherCampaignId, Title = "Other campaign", ModuleId = "neutral-test", ModuleVersion = "1" });
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
    public async Task GetCampaignMaterials_ForeignCampaignMaterials_AreExcludedAndOwnedMaterialsUseStableOrder()
    {
        // Arrange
        var last = Note("material-z", "First alphabetic title", 9);
        var second = Note("material-b", "Second title", 2);
        var first = Note("material-a", "Last alphabetic title", 2);
        var foreign = Note("foreign-material", "Foreign title", 0, otherCampaignId);
        await AddAsync(last, second, first, foreign);

        // Act
        using var response = await Client.GetAsync(Path);
        var materials = await response.Content.ReadFromJsonAsync<MaterialResponse[]>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(materials);
        Assert.Equal(new[] { first.Id, second.Id, last.Id }, materials.Select(material => material.Id));
    }

    [Fact]
    public async Task GetCampaignMaterials_AuthoredRichDocument_ReturnsCurrentDocumentMetadataAndRevision()
    {
        // Arrange
        const string document = """
            {"type":"doc","content":[
              {"type":"heading","attrs":{"level":2,"id":"authored-section"},"content":[{"type":"text","text":"Authored heading"}]},
              {"type":"paragraph","content":[{"type":"text","text":"Personal campaign text","marks":[{"type":"bold"}]}]}
            ]}
            """;
        var material = Note("note-authored", "Authored title", 1);
        material.DocumentJson = document;
        material.Group = "Authored group";
        material.Revision = 23;
        var folderId = "authored-folder";
        material.FolderId = folderId;
        await using (var scope = App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Folders.Add(new CampaignFolder { Id = folderId, CampaignId = campaignId, Title = "Authored folder" });
            db.Materials.Add(material);
            await db.SaveChangesAsync();
        }

        // Act
        using var response = await Client.GetAsync(Path);
        var materials = await response.Content.ReadFromJsonAsync<MaterialResponse[]>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(materials);
        var loaded = Assert.Single(materials);
        Assert.Equal(material.Id, loaded.Id);
        Assert.Equal(material.Title, loaded.Title);
        Assert.Equal(material.Group, loaded.Group);
        Assert.Equal(folderId, loaded.FolderId);
        Assert.Equal(1, loaded.DocumentSchemaVersion);
        Assert.Equal(23, loaded.Revision);
        Assert.True(JsonElement.DeepEquals(JsonSerializer.Deserialize<JsonElement>(document), loaded.Document));
    }

    [Fact]
    public async Task GetCampaignMaterials_EmptyCampaign_ReturnsEmptyArray()
    {
        // Arrange
        await AddAsync(Note("foreign-material", "Foreign title", 0, otherCampaignId));

        // Act
        using var response = await Client.GetAsync(Path);
        var materials = await response.Content.ReadFromJsonAsync<MaterialResponse[]>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(materials);
        Assert.Empty(materials);
    }

    [Fact]
    public async Task GetCampaignMaterials_MissingCampaign_ReturnsStableNotFound()
    {
        // Arrange
        var path = $"/api/campaigns/{Guid.NewGuid():D}/materials";

        // Act
        using var response = await Client.GetAsync(path);

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("campaign_not_found", problem.GetProperty("code").GetString());
    }

    [Fact]
    public async Task GetCampaignMaterials_RepeatedReads_DoNotModifyPersistedMaterials()
    {
        // Arrange
        await AddAsync(Note("owned-material", "Owned title", 1), Note("foreign-material", "Foreign title", 2, otherCampaignId));
        var before = await SnapshotAsync();

        // Act
        using var first = await Client.GetAsync(Path);
        using var repeated = await Client.GetAsync(Path);

        // Assert
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, repeated.StatusCode);
        Assert.Equal(await first.Content.ReadAsStringAsync(), await repeated.Content.ReadAsStringAsync());
        Assert.Equal(before, await SnapshotAsync());
    }

    private Material Note(string id, string title, int sortOrder, Guid? owner = null) => new()
    {
        Id = id,
        CampaignId = owner ?? campaignId,
        Title = title,
        Group = "",
        DocumentJson = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Persisted text"}]}]}""",
        DocumentSchemaVersion = 1,
        Revision = 7,
        SortOrder = sortOrder
    };

    private async Task AddAsync(params Material[] materials)
    {
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Materials.AddRange(materials);
        await db.SaveChangesAsync();
    }

    private async Task<string> SnapshotAsync()
    {
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var materials = await db.Materials.AsNoTracking()
            .Where(material => material.CampaignId == campaignId || material.CampaignId == otherCampaignId)
            .OrderBy(material => material.Id).ToArrayAsync();
        return JsonSerializer.Serialize(materials);
    }
}
