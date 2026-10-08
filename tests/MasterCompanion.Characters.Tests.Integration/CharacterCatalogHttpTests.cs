using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MasterCompanion.Engine.Features.Characters;
using MasterCompanion.Engine.Features.Gameplay;
using MasterCompanion.Engine.Persistence;
using MasterCompanion.Gameplay.Tests.Integration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using MasterCompanion.Contracts;

namespace MasterCompanion.Characters.Tests.Integration;

[Collection("PostgreSQL")]
public sealed class CharacterCatalogHttpTests(PostgreSqlFixture database) : IAsyncLifetime
{
    private readonly Guid campaignId = Guid.NewGuid();
    private CampaignApiFactory? factory;
    private HttpClient? client;
    private HttpClient Client => client ?? throw new InvalidOperationException("The test client has not started.");
    private CampaignApiFactory App => factory ?? throw new InvalidOperationException("The test host has not started.");
    private string GamePath => $"/api/campaigns/{campaignId}/game";
    private string CatalogPath => $"/api/campaigns/{campaignId}/characters";

    public async Task InitializeAsync()
    {
        var connection = await database.CreateDatabaseAsync();
        factory = new CampaignApiFactory(connection);
        client = factory.CreateClient();
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Campaigns.Add(new Campaign { Id = campaignId, Title = "Character test campaign", ModuleId = "ythryn", ModuleVersion = "0.1.0" });
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
    public async Task Create_NpcOutsideParty_IsRetainedWithoutEnteringModuleTools()
    {
        // Arrange
        var npc = Change("Independent NPC", "npc", false);

        // Act
        var state = await ExecuteAsync(Request(0, npc));
        var catalog = await CatalogAsync();

        // Assert
        Assert.Empty(state.Snapshot.Party);
        Assert.Equal(0, state.ModuleView.GetProperty("characters").GetArrayLength());
        var profile = Assert.Single(catalog.GetProperty("characters").EnumerateArray());
        Assert.Equal(npc.Id.ToString(), profile.GetProperty("id").GetString());
        Assert.Equal("npc", profile.GetProperty("kind").GetString());
        Assert.False(profile.GetProperty("inParty").GetBoolean());
        await AssertDocumentAsync(profile.GetProperty("backstoryMaterialId").GetString(), npc.BackstoryTitle);
        await AssertDocumentAsync(profile.GetProperty("notesMaterialId").GetString(), npc.NotesTitle);
    }

    [Fact]
    public async Task Membership_JoiningLeavingAndUndo_RetainsIndependentNarratives()
    {
        // Arrange
        var player = Change("Player character", "player", true);
        var npc = Change("NPC companion", "npc", false);
        var state = await ExecuteAsync(Request(0, player));
        state = await ExecuteAsync(Request(state.Revision, npc));
        var catalog = await CatalogAsync();
        var profile = Profile(catalog, npc.Id);
        var documentId = profile.GetProperty("backstoryMaterialId").GetString();
        var document = JsonSerializer.SerializeToElement(new { type = "doc", content = new[] { new { type = "paragraph", content = new[] { new { type = "text", text = "Retained NPC history" } } } } });

        // Act
        using var saved = await Client.PutAsJsonAsync($"/api/materials/{documentId}", new { title = npc.BackstoryTitle, document, expectedRevision = 1 });
        var afterNarrative = await Client.GetFromJsonAsync<GameStateResponse>(GamePath);
        state = await ExecuteAsync(Request(state.Revision, npc with { InParty = true }));
        var joined = state;
        state = await ExecuteAsync(Request(state.Revision, npc with { InParty = false }));
        var detached = await CatalogAsync();
        var undone = await ExecuteAsync(new(Guid.NewGuid(), state.Revision, "undo"));

        // Assert
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.NotNull(afterNarrative);
        Assert.Equal(2, afterNarrative.Revision);
        Assert.Equal(0, afterNarrative.Snapshot.TimeMinutes);
        Assert.Equal(new[] { player.Id, npc.Id }, joined.Snapshot.Party.Select(item => item.Id));
        Assert.Equal(2, joined.ModuleView.GetProperty("characters").GetArrayLength());
        Assert.Equal(player.Id, Assert.Single(state.Snapshot.Party).Id);
        Assert.False(Profile(detached, npc.Id).GetProperty("inParty").GetBoolean());
        Assert.Equal(new[] { player.Id, npc.Id }, undone.Snapshot.Party.Select(item => item.Id));
        var persisted = await Client.GetFromJsonAsync<JsonElement>($"/api/materials/{documentId}");
        Assert.Equal(2, persisted.GetProperty("revision").GetInt64());
        Assert.True(JsonElement.DeepEquals(document, persisted.GetProperty("document")));
        Assert.Equal(1, (await Client.GetFromJsonAsync<JsonElement>($"/api/materials/{Profile(catalog, player.Id).GetProperty("backstoryMaterialId").GetString()}"))
            .GetProperty("revision").GetInt64());
    }

    [Fact]
    public async Task Undo_Creation_KeepsCatalogAndDocumentsOutsideParty()
    {
        // Arrange
        var character = Change("Retained member", "player", true);
        var created = await ExecuteAsync(Request(0, character));

        // Act
        var undone = await ExecuteAsync(new(Guid.NewGuid(), created.Revision, "undo"));
        var catalog = await CatalogAsync();

        // Assert
        Assert.Empty(undone.Snapshot.Party);
        var profile = Profile(catalog, character.Id);
        Assert.False(profile.GetProperty("inParty").GetBoolean());
        await AssertDocumentAsync(profile.GetProperty("notesMaterialId").GetString(), character.NotesTitle);
    }

    [Fact]
    public async Task Rename_ActiveMember_PreservesIdentityModuleStateAndDocuments()
    {
        // Arrange
        var character = Change("Original member", "npc", true);
        var created = await ExecuteAsync(Request(0, character));
        var before = Profile(await CatalogAsync(), character.Id);

        // Act
        var renamed = await ExecuteAsync(Request(created.Revision, character with { Name = "Renamed member" }));
        var after = Profile(await CatalogAsync(), character.Id);

        // Assert
        Assert.Equal(character.Id, Assert.Single(renamed.Snapshot.Party).Id);
        Assert.Equal("Renamed member", renamed.Snapshot.Party[0].Name);
        Assert.True(JsonElement.DeepEquals(created.Snapshot.ModuleState, renamed.Snapshot.ModuleState));
        Assert.Equal(before.GetProperty("backstoryMaterialId").GetString(), after.GetProperty("backstoryMaterialId").GetString());
        Assert.Equal("npc", after.GetProperty("kind").GetString());
    }

    [Fact]
    public async Task ConcurrentChanges_AndReceiptReplay_HaveOneWinnerAndNoDuplicateDocuments()
    {
        // Arrange
        var first = Request(0, Change("First candidate", "player", true));
        var second = Request(0, Change("Second candidate", "npc", false));

        // Act
        var responses = await Task.WhenAll(Client.PostAsJsonAsync(GamePath + "/operations", first),
            Client.PostAsJsonAsync(GamePath + "/operations", second));
        using var firstResponse = responses[0];
        using var secondResponse = responses[1];
        var winner = firstResponse.StatusCode == HttpStatusCode.OK ? first : second;
        var winningResponse = firstResponse.StatusCode == HttpStatusCode.OK ? firstResponse : secondResponse;
        var winningCharacter = winner.Character ?? throw new InvalidOperationException("The winning request has no character.");
        using var replay = await Client.PostAsJsonAsync(GamePath + "/operations", winner);
        using var changedReplay = await Client.PostAsJsonAsync(GamePath + "/operations", winner with { Character = winningCharacter with { Name = "Different body" } });
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Assert
        Assert.Equal(new[] { HttpStatusCode.OK, HttpStatusCode.Conflict }, responses.Select(item => item.StatusCode).OrderBy(item => item));
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, changedReplay.StatusCode);
        var expectedReceipt = await winningResponse.Content.ReadFromJsonAsync<JsonElement>();
        var actualReceipt = await replay.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(JsonElement.DeepEquals(expectedReceipt, actualReceipt),
            $"Receipt replay must return the same JSON value. Expected: {expectedReceipt}; actual: {actualReceipt}.");
        Assert.Equal(1, await db.Characters.CountAsync(item => item.CampaignId == campaignId));
        Assert.Equal(2, await db.Materials.CountAsync(item => item.CampaignId == campaignId));
    }

    [Theory]
    [InlineData("", "npc")]
    [InlineData(" padded ", "player")]
    [InlineData("Control\nname", "npc")]
    [InlineData("Valid name", "unknown")]
    public async Task InvalidMetadata_RejectsWithoutCatalogOrGameplayWrites(string name, string kind)
    {
        // Arrange
        var request = Request(0, Change(name, kind, false));

        // Act
        using var response = await Client.PostAsJsonAsync(GamePath + "/operations", request);
        var catalog = await CatalogAsync();

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(catalog.GetProperty("characters").EnumerateArray());
        Assert.Equal(0, catalog.GetProperty("revision").GetInt64());
    }

    [Fact]
    public async Task ProfileDocument_DeletionAndStaleSave_AreRejected()
    {
        // Arrange
        var character = Change("Protected profile", "player", true);
        await ExecuteAsync(Request(0, character));
        var profile = Profile(await CatalogAsync(), character.Id);
        var id = profile.GetProperty("notesMaterialId").GetString();
        var path = $"/api/campaigns/{campaignId}/materials/{id}/deletion";
        var preview = await Client.GetFromJsonAsync<JsonElement>(path);
        var document = JsonSerializer.SerializeToElement(new { type = "doc", content = new[] { new { type = "paragraph" } } });

        // Act
        using var deletion = await Client.PostAsJsonAsync(path, new { requestId = Guid.NewGuid(), expectedRevision = 1, referencesToken = preview.GetProperty("referencesToken").GetString() });
        using var save = await Client.PutAsJsonAsync($"/api/materials/{id}", new { title = "Updated notes", document, expectedRevision = 1 });
        using var conflict = await Client.PutAsJsonAsync($"/api/materials/{id}", new { title = "Stale notes", document, expectedRevision = 1 });

        // Assert
        Assert.Equal("Protected profile", Assert.Single(preview.GetProperty("owningCharacters").EnumerateArray()).GetString());
        Assert.Equal(HttpStatusCode.Conflict, deletion.StatusCode);
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
        await AssertDocumentAsync(id, "Updated notes");
    }

    [Fact]
    public async Task FullParty_RejectsJoiningButAllowsCatalogCreationOutsideParty()
    {
        // Arrange
        var party = Enumerable.Range(1, 20).Select(index => new GameCharacter(Guid.NewGuid(), $"Member {index}")).ToArray();
        var configured = await ExecuteAsync(new(Guid.NewGuid(), 0, "configureParty", party));
        var candidate = Change("Catalog candidate", "player", true);

        // Act
        using var rejected = await Client.PostAsJsonAsync(GamePath + "/operations", Request(configured.Revision, candidate));
        var afterRejection = await CatalogAsync();
        var accepted = await ExecuteAsync(Request(configured.Revision, candidate with { InParty = false }));
        var afterCreation = await CatalogAsync();

        // Assert
        Assert.Equal(HttpStatusCode.Conflict, rejected.StatusCode);
        Assert.Equal(20, afterRejection.GetProperty("characters").GetArrayLength());
        Assert.Equal(21, afterCreation.GetProperty("characters").GetArrayLength());
        Assert.False(Profile(afterCreation, candidate.Id).GetProperty("inParty").GetBoolean());
        Assert.Equal(party, accepted.Snapshot.Party);
    }

    [Fact]
    public async Task Catalog_IdenticalCharacterIdsInSeparateCampaigns_RemainIndependent()
    {
        // Arrange
        var first = Change("First campaign character", "player", true);
        var otherCampaign = Guid.NewGuid();
        await ExecuteAsync(Request(0, first));
        await using (var scope = App.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Campaigns.Add(new Campaign { Id = otherCampaign, Title = "Second campaign", ModuleId = "ythryn", ModuleVersion = "1" });
            await db.SaveChangesAsync();
        }

        // Act
        using var response = await Client.PostAsJsonAsync($"/api/campaigns/{otherCampaign}/game/operations",
            Request(0, first with { Name = "Second campaign NPC", Kind = "npc", InParty = false }));
        var secondProfile = Profile(await Client.GetFromJsonAsync<JsonElement>($"/api/campaigns/{otherCampaign}/characters"), first.Id);
        var firstProfile = Profile(await CatalogAsync(), first.Id);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(first.Name, firstProfile.GetProperty("name").GetString());
        Assert.Equal("Second campaign NPC", secondProfile.GetProperty("name").GetString());
        Assert.NotEqual(firstProfile.GetProperty("backstoryMaterialId").GetString(), secondProfile.GetProperty("backstoryMaterialId").GetString());
    }

    private static CharacterChange Change(string name, string kind, bool inParty) =>
        new(Guid.NewGuid(), name, kind, inParty, "Backstory", "Campaign notes");

    [Fact]
    public async Task Migration_ExistingRoster_InstantiatesIndependentProfileDocuments()
    {
        // Arrange
        var connection = await database.CreateDatabaseAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options);
        await db.GetService<IMigrator>().MigrateAsync("20261007160620_MaterialDeletionReceipts");
        var member = new GameCharacter(Guid.NewGuid(), "Existing party member");
        var snapshot = JsonSerializer.Serialize(new GameSnapshot(120, [member], [], 1,
            JsonSerializer.SerializeToElement(new { })), new JsonSerializerOptions(JsonSerializerDefaults.Web));
        db.Campaigns.Add(new Campaign { Id = campaignId, Title = "Existing campaign", ModuleId = "neutral", ModuleVersion = "1" });
        db.GameStates.Add(new CampaignGameState { CampaignId = campaignId, Revision = 3, SnapshotJson = snapshot });
        await db.SaveChangesAsync();

        // Act
        await db.Database.MigrateAsync();
        var profile = await db.Characters.AsNoTracking().SingleAsync(item => item.CampaignId == campaignId);
        var documents = await db.Materials.AsNoTracking().Where(item => item.CampaignId == campaignId).ToListAsync();

        // Assert
        Assert.Equal(member.Id, profile.Id);
        Assert.Equal(member.Name, profile.Name);
        Assert.Equal("player", profile.Kind);
        Assert.Equal(new[] { profile.BackstoryMaterialId, profile.NotesMaterialId }.Order(), documents.Select(item => item.Id).Order());
        Assert.All(documents, document => Assert.Equal(1, document.Revision));
        Assert.Equal(3, (await db.GameStates.AsNoTracking().SingleAsync(item => item.CampaignId == campaignId)).Revision);
    }

    private static GameOperationRequest Request(long revision, CharacterChange change) =>
        new(Guid.NewGuid(), revision, "updateCharacter", Character: change);

    private async Task<GameStateResponse> ExecuteAsync(GameOperationRequest request)
    {
        using var response = await Client.PostAsJsonAsync(GamePath + "/operations", request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<GameStateResponse>()
            ?? throw new InvalidOperationException("The response has no game state.");
    }

    private async Task<JsonElement> CatalogAsync() => await Client.GetFromJsonAsync<JsonElement>(CatalogPath);

    private static JsonElement Profile(JsonElement catalog, Guid id) =>
        catalog.GetProperty("characters").EnumerateArray().Single(item => item.GetProperty("id").GetString() == id.ToString());

    private async Task AssertDocumentAsync(string? id, string title)
    {
        var document = await Client.GetFromJsonAsync<JsonElement>($"/api/materials/{id}");
        Assert.Equal(title, document.GetProperty("title").GetString());
    }
}
