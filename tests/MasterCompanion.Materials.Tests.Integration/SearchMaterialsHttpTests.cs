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
public sealed class SearchMaterialsHttpTests(PostgreSqlFixture database) : IAsyncLifetime
{
    private readonly Guid campaignId = Guid.NewGuid();
    private readonly Guid otherCampaignId = Guid.NewGuid();
    private CampaignApiFactory? factory;
    private HttpClient? client;
    private CampaignApiFactory App => factory ?? throw new InvalidOperationException("The test host has not started.");
    private HttpClient Client => client ?? throw new InvalidOperationException("The test client has not started.");
    private string Path => $"/api/campaigns/{campaignId:D}/materials/search";

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
            new Campaign { Id = campaignId, Title = "Search campaign", ModuleId = "neutral-test", ModuleVersion = "1" },
            new Campaign { Id = otherCampaignId, Title = "Other search campaign", ModuleId = "neutral-test", ModuleVersion = "1" });
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
    [InlineData("ŻÓŁW", "żółw", true)]
    [InlineData("ŻÓŁW", "zolw", false)]
    [InlineData("café", "cafe\u0301", true)]
    [InlineData("A frozen\n\t tower", " frozen   tower ", true)]
    [InlineData("A frozen tower", "frozen fortress", false)]
    [InlineData("A frozen tower", "\u00ad", false)]
    [InlineData("A frozen tower", "\u200d", false)]
    [InlineData("A frozen tower", "fro\u00adzen", false)]
    [InlineData("A frozen tower", "%", false)]
    [InlineData("A frozen tower", "_", false)]
    public async Task SearchMaterials_PhraseQuery_UsesNormalizedCaseInsensitiveText(string text, string query, bool matches)
    {
        // Arrange
        var material = Note("Neutral title", Document(text));
        await AddAsync(material);

        // Act
        var response = await SearchAsync(query);

        // Assert
        Assert.Equal(matches ? new[] { material.Id } : Array.Empty<string>(), response.Results.Select(result => result.Id));
        Assert.False(response.HasMore);
    }

    [Fact]
    public async Task SearchMaterials_TitleMatches_RankBeforeContentAndKeepFolderOwnership()
    {
        // Arrange
        var folderId = "folder-" + Guid.NewGuid().ToString("N");
        await using (var scope = App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Folders.Add(new CampaignFolder { CampaignId = campaignId, Id = folderId, Title = "Search folder" });
            await db.SaveChangesAsync();
        }

        var contentMatch = Note("A document", Document("The tower is frozen."));
        var titleMatch = Note("Z frozen tower", Document("Visible introductory text."));
        titleMatch.FolderId = folderId;
        await AddAsync(contentMatch, titleMatch);

        // Act
        var response = await SearchAsync("frozen");

        // Assert
        Assert.Equal(new[] { titleMatch.Id, contentMatch.Id }, response.Results.Select(result => result.Id));
        Assert.Equal(folderId, response.Results[0].FolderId);
        Assert.Equal("Visible introductory text.", response.Results[0].Snippet);
        Assert.Equal("The tower is frozen.", response.Results[1].Snippet);
    }

    [Theory]
    [InlineData("visible label", true)]
    [InlineData("joined word", true)]
    [InlineData("next block", true)]
    [InlineData("wordnext", false)]
    [InlineData("urlsecret", false)]
    [InlineData("altsecret", false)]
    [InlineData("paragraph", false)]
    public async Task SearchMaterials_RichDocument_SearchesVisibleTextAcrossInlineAndBlockBoundaries(string query, bool matches)
    {
        // Arrange
        const string richDocument = """
            {"type":"doc","content":[
              {"type":"paragraph","content":[
                {"type":"text","text":"visible label","marks":[{"type":"link","attrs":{"href":"https://example.test/urlsecret"}}]},
                {"type":"hardBreak"},{"type":"text","text":"joined "},{"type":"text","text":"word","marks":[{"type":"bold"}]}]},
              {"type":"paragraph","content":[{"type":"text","text":"next block"}]},
              {"type":"image","attrs":{"src":"https://example.test/image.png","alt":"altsecret"}}
            ]}
            """;
        var material = Note("Neutral title", richDocument);
        await AddAsync(material);

        // Act
        var response = await SearchAsync(query);

        // Assert
        Assert.Equal(matches ? new[] { material.Id } : Array.Empty<string>(), response.Results.Select(result => result.Id));
        if (matches)
        {
            Assert.Equal("visible label joined word next block", response.Results[0].Snippet);
        }
    }

    [Fact]
    public async Task SearchMaterials_NestedRichBlocks_IncludeListTableAndDetailsTextInReadingOrder()
    {
        // Arrange
        const string document = """
            {"type":"doc","content":[
              {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"List text"}]}]}]},
              {"type":"table","content":[{"type":"tableRow","content":[
                {"type":"tableHeader","content":[{"type":"paragraph","content":[{"type":"text","text":"Heading"}]}]},
                {"type":"tableCell","content":[{"type":"paragraph","content":[{"type":"text","text":"Cell text"}]}]}
              ]}]},
              {"type":"details","content":[
                {"type":"detailsSummary","content":[{"type":"text","text":"Summary"}]},
                {"type":"detailsContent","content":[{"type":"paragraph","content":[{"type":"text","text":"Hidden detail"}]}]}
              ]}
            ]}
            """;
        var material = Note("Neutral title", document);
        await AddAsync(material);

        // Act
        var response = await SearchAsync("cell text summary hidden detail");

        // Assert
        var result = Assert.Single(response.Results);
        Assert.Equal(material.Id, result.Id);
        Assert.Equal("List text Heading Cell text Summary Hidden detail", result.Snippet);
    }

    [Fact]
    public async Task SearchMaterials_ForeignCampaignMatch_IsExcludedWithoutMutatingMaterials()
    {
        // Arrange
        var owned = Note("Own material", Document("Frozen tower"));
        var foreign = Note("Foreign frozen tower", Document("Frozen tower"), otherCampaignId);
        await AddAsync(owned, foreign);
        var before = await SnapshotAsync();

        // Act
        var response = await SearchAsync("frozen");

        // Assert
        Assert.Equal(new[] { owned.Id }, response.Results.Select(result => result.Id));
        Assert.Equal(before, await SnapshotAsync());
    }

    [Fact]
    public async Task SearchMaterials_ConfirmedSave_SearchesCurrentContentAndRemovesPreviousMatch()
    {
        // Arrange
        var material = Note("Neutral title", Document("Previous phrase"));
        await AddAsync(material);
        var nextDocument = JsonSerializer.Deserialize<JsonElement>(Document("Current phrase"));

        // Act
        using var save = await Client.PutAsJsonAsync($"/api/materials/{material.Id}", new SaveMaterialRequest(nextDocument, material.Revision));
        var current = await SearchAsync("current phrase");
        var previous = await SearchAsync("previous phrase");

        // Assert
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);
        Assert.Equal(new[] { material.Id }, current.Results.Select(result => result.Id));
        Assert.Equal("Current phrase", current.Results[0].Snippet);
        Assert.Empty(previous.Results);
    }

    [Fact]
    public async Task SearchMaterials_MoreThanResultLimit_ReturnsFiftyWithTitlePriorityAndHasMore()
    {
        // Arrange
        var contentMatches = Enumerable.Range(0, 51)
            .Select(index => Note($"A document {index:D2}", Document("Matching phrase"))).ToArray();
        var titleMatch = Note("Z matching phrase", Document("Introductory text"));
        await AddAsync([.. contentMatches, titleMatch]);

        // Act
        var first = await SearchAsync("matching phrase");
        var repeated = await SearchAsync("matching phrase");

        // Assert
        Assert.Equal(50, first.Results.Count);
        Assert.True(first.HasMore);
        Assert.Equal(titleMatch.Id, first.Results[0].Id);
        Assert.Equal(contentMatches.Take(49).Select(material => material.Id), first.Results.Skip(1).Select(result => result.Id));
        Assert.Equal(first.Results, repeated.Results);
    }

    [Fact]
    public async Task SearchMaterials_LongContent_ReturnsBoundedSnippetAroundMatch()
    {
        // Arrange
        var text = string.Concat(Enumerable.Repeat("❄️ Faraway text. ", 50)) + "Frozen tower " + new string('z', 300);
        var material = Note("Neutral title", Document(text));
        await AddAsync(material);

        // Act
        var response = await SearchAsync("frozen tower");

        // Assert
        var result = Assert.Single(response.Results);
        Assert.Contains("Frozen tower", result.Snippet);
        Assert.StartsWith("…", result.Snippet);
        Assert.EndsWith("…", result.Snippet);
        Assert.InRange(result.Snippet.Length, 1, 200);
    }

    [Theory]
    [InlineData("")]
    [InlineData("?query=")]
    [InlineData("?query=%20%09%20")]
    [InlineData("?query=one&query=two")]
    [InlineData("?query=%00")]
    public async Task SearchMaterials_InvalidQuery_ReturnsStableProblemWithoutWrites(string suffix)
    {
        // Arrange
        await AddAsync(Note("Authored title", Document("Preserved content")));
        var before = await SnapshotAsync();

        // Act
        using var response = await Client.GetAsync(Path + suffix);

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.BadRequest, "invalid_search_query");
        Assert.Equal(before, await SnapshotAsync());
    }

    [Theory]
    [InlineData(160, HttpStatusCode.OK)]
    [InlineData(161, HttpStatusCode.BadRequest)]
    public async Task SearchMaterials_QueryLength_EnforcesBoundary(int length, HttpStatusCode expected)
    {
        // Arrange
        var query = new string('a', length);

        // Act
        using var response = await Client.GetAsync(Path + "?query=" + query);

        // Assert
        Assert.Equal(expected, response.StatusCode);
        if (expected == HttpStatusCode.BadRequest)
        {
            await AssertProblemAsync(response, expected, "invalid_search_query");
        }
    }

    [Fact]
    public async Task SearchMaterials_MissingCampaign_ReturnsStableNotFound()
    {
        // Arrange
        var path = $"/api/campaigns/{Guid.NewGuid():D}/materials/search?query=frozen";

        // Act
        using var response = await Client.GetAsync(path);

        // Assert
        await AssertProblemAsync(response, HttpStatusCode.NotFound, "campaign_not_found");
    }

    [Theory]
    [InlineData("""{"type":"doc","content":[{"type":"unknown"}]}""", 1)]
    [InlineData("""{"type":"doc","content":[{"type":"paragraph"}]}""", 2)]
    public async Task SearchMaterials_UnsupportedPersistedDocument_FailsWithoutWrites(string document, int schemaVersion)
    {
        // Arrange
        var material = Note("Frozen title", document);
        material.DocumentSchemaVersion = schemaVersion;
        await AddAsync(material);
        var before = await SnapshotAsync();

        // Act
        using var response = await Client.GetAsync(Path + "?query=frozen");

        // Assert
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(before, await SnapshotAsync());
    }

    private Material Note(string title, string document, Guid? owner = null) => new()
    {
        Id = "note-" + Guid.NewGuid().ToString("D"),
        CampaignId = owner ?? campaignId,
        Title = title,
        Group = "",
        DocumentJson = document,
        DocumentSchemaVersion = 1,
        Revision = 7
    };

    private static string Document(string text) => JsonSerializer.Serialize(new
    {
        type = "doc",
        content = new[] { new { type = "paragraph", content = new[] { new { type = "text", text } } } }
    });

    private async Task AddAsync(params Material[] materials)
    {
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Materials.AddRange(materials);
        await db.SaveChangesAsync();
    }

    private async Task<MaterialSearchResponse> SearchAsync(string query)
    {
        using var response = await Client.GetAsync(Path + "?query=" + Uri.EscapeDataString(query));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<MaterialSearchResponse>()
            ?? throw new InvalidOperationException("The search endpoint returned no response body.");
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

    private static async Task AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(code, problem.GetProperty("code").GetString());
    }
}
