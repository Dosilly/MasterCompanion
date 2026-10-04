using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using MasterCompanion.Engine.Features.Materials;
using MasterCompanion.Engine.Persistence;
using MasterCompanion.Gameplay.Tests.Integration;
using MasterCompanion.Modules.Ythryn;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MasterCompanion.Materials.Tests.Integration;

[Collection("PostgreSQL")]
public sealed class SaveMaterialHttpTests(PostgreSqlFixture database) : IAsyncLifetime
{
    private const string OriginalDocument = """{"type":"doc","content":[{"type":"paragraph"}]}""";
    private readonly string materialId = "note-" + Guid.NewGuid().ToString("D");
    private CampaignApiFactory? factory;
    private HttpClient? client;
    private HttpClient Client => client ?? throw new InvalidOperationException("The test client has not started.");
    private CampaignApiFactory App => factory ?? throw new InvalidOperationException("The test host has not started.");
    private string Path => $"/api/materials/{materialId}";

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
        var campaignId = Guid.NewGuid();
        campaignDb.Campaigns.Add(new Campaign
        {
            Id = campaignId,
            Title = "Save validation campaign",
            ModuleId = "neutral-test",
            ModuleVersion = "1"
        });
        campaignDb.Materials.Add(new Material
        {
            Id = materialId,
            CampaignId = campaignId,
            Title = "Test-owned note",
            Group = "",
            DocumentJson = OriginalDocument,
            DocumentSchemaVersion = 1,
            Revision = 1
        });
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

    [Theory]
    [InlineData("null")]
    [InlineData("{}")]
    [InlineData("""{"type":"doc","content":[]}""")]
    [InlineData("""{"type":"doc","content":[{"type":"script"}]}""")]
    [InlineData("""{"type":"doc","content":[{"type":"text","text":"Outside a paragraph"}]}""")]
    [InlineData("""{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":""}]}]}""")]
    [InlineData("""{"type":"doc","content":[{"type":"paragraph","attrs":{"onclick":"run()"}}]}""")]
    [InlineData("""{"type":"doc","content":[{"type":"heading","attrs":{"level":7}}]}""")]
    [InlineData("""{"type":"doc","content":[{"type":"bulletList","content":[{"type":"paragraph"}]}]}""")]
    [InlineData("""{"type":"doc","content":[{"type":"details","content":[{"type":"detailsSummary"}]}]}""")]
    [InlineData("""{"type":"doc","content":[{"type":"image","attrs":{"src":"javascript:alert(1)"}}]}""")]
    [InlineData("""{"type":"doc","content":[{"type":"image","attrs":{"src":"/api/assets/../secret"}}]}""")]
    [InlineData("""{"type":"doc","content":[{"type":"image","attrs":{"src":"data:image/svg+xml,unsafe"}}]}""")]
    [InlineData("""{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Link","marks":[{"type":"link","attrs":{"href":"javascript:alert(1)"}}]}]}]}""")]
    [InlineData("""{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Text","marks":[{"type":"unknown"}]}]}]}""")]
    [InlineData("""{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Text","marks":[{"type":"bold"},{"type":"bold"}]}]}]}""")]
    [InlineData("""{"type":"doc","content":[{"type":"paragraph"}],"unexpected":true}""")]
    [InlineData("""{"type":"doc","type":"doc","content":[{"type":"paragraph"}]}""")]
    public async Task SaveMaterial_InvalidDocument_RejectsWithoutChangingContentOrRevision(string document)
    {
        // Arrange
        using var body = Json($$"""{"document":{{document}},"expectedRevision":1}""");

        // Act
        using var response = await Client.PutAsync(Path, body);

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "invalid_document");
        await AssertOriginalAsync();
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("""{"expectedRevision":1}""")]
    [InlineData("""{"document":{"type":"doc","content":[{"type":"paragraph"}]}}""")]
    [InlineData("""{"document":{"type":"doc","content":[{"type":"paragraph"}]},"expectedRevision":0}""")]
    [InlineData("""{"document":{"type":"doc","content":[{"type":"paragraph"}]},"expectedRevision":"1"}""")]
    [InlineData("""{"document":{"type":"doc","content":[{"type":"paragraph"}]},"expectedRevision":1,"extra":true}""")]
    public async Task SaveMaterial_InvalidEnvelope_RejectsWithoutWrites(string json)
    {
        // Arrange
        using var body = Json(json);

        // Act
        using var response = await Client.PutAsync(Path, body);

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "invalid_document");
        await AssertOriginalAsync();
    }

    [Theory]
    [InlineData(33, 1)]
    [InlineData(0, 20_001)]
    public async Task SaveMaterial_ExcessiveDepthOrNodeCount_RejectsWithoutWrites(int depth, int paragraphs)
    {
        // Arrange
        var nested = """{"type":"paragraph"}""";
        for (var index = 0; index < depth; index++)
        {
            nested = $$"""{"type":"blockquote","content":[{{nested}}]}""";
        }

        var content = string.Join(',', Enumerable.Repeat(nested, paragraphs));
        using var body = Json($$"""{"document":{"type":"doc","content":[{{content}}]},"expectedRevision":1}""");

        // Act
        using var response = await Client.PutAsync(Path, body);

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "invalid_document");
        await AssertOriginalAsync();
    }

    [Fact]
    public async Task SaveMaterial_OversizedRequest_RejectsWithoutWrites()
    {
        // Arrange
        using var body = Json(new string(' ', 2_097_153));

        // Act
        using var response = await Client.PutAsync(Path, body);

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.RequestEntityTooLarge, "material_request_too_large");
        await AssertOriginalAsync();
    }

    [Fact]
    public async Task SaveMaterial_StaleRevision_PreservesConfirmedContent()
    {
        // Arrange
        var document = JsonSerializer.Deserialize<JsonElement>(OriginalDocument);

        // Act
        using var response = await Client.PutAsJsonAsync(Path, new SaveMaterialRequest(document, 2));

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.Conflict, "material_revision_conflict");
        await AssertOriginalAsync();
    }

    [Fact]
    public async Task SaveMaterial_ModuleCatalogDocuments_PreserveRichContentAcrossConfirmedSaves()
    {
        // Arrange
        var materials = await new YthrynModule().LoadMaterialsAsync();
        Assert.Equal(106, materials.Count);
        long revision = 1;

        // Act / Assert: the supported schema must preserve every authored source document exactly.
        foreach (var material in materials)
        {
            using var response = await Client.PutAsJsonAsync(Path, new SaveMaterialRequest(material.Document, revision));
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var saved = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(++revision, saved.GetProperty("revision").GetInt64());
            await using var scope = App.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var persisted = await db.Materials.AsNoTracking().SingleAsync(item => item.Id == materialId);
            Assert.Equal(revision, persisted.Revision);
            Assert.True(JsonElement.DeepEquals(material.Document, JsonSerializer.Deserialize<JsonElement>(persisted.DocumentJson)),
                $"The supported document schema must preserve material '{material.Id}'.");
        }
    }

    private async Task AssertOriginalAsync()
    {
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var material = await db.Materials.AsNoTracking().SingleAsync(item => item.Id == materialId);
        Assert.Equal(1, material.Revision);
        Assert.True(JsonElement.DeepEquals(JsonSerializer.Deserialize<JsonElement>(OriginalDocument),
            JsonSerializer.Deserialize<JsonElement>(material.DocumentJson)),
            "A rejected save must preserve the complete persisted document.");
    }

    private static StringContent Json(string value) => new(value, Encoding.UTF8, "application/json");

    private static async Task AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(code, problem.GetProperty("code").GetString());
    }
}
