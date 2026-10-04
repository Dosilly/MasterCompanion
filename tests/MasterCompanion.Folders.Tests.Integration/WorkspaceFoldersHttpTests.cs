using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MasterCompanion.Engine.Features.Folders;
using MasterCompanion.Gameplay.Tests.Integration;

namespace MasterCompanion.Folders.Tests.Integration;

[Collection("PostgreSQL")]
public sealed class WorkspaceFoldersHttpTests(PostgreSqlFixture database)
{
    [Fact]
    public async Task Workspace_ConfirmedFolderChange_ProjectsCurrentRevisionAndFolderMetadata()
    {
        // Arrange
        await using var app = new CampaignApiFactory(await database.CreateDatabaseAsync());
        using var client = app.CreateClient();
        var initial = await client.GetFromJsonAsync<JsonElement>("/api/workspace");
        var campaignId = initial.GetProperty("campaignId").GetGuid();
        var folderId = initial.GetProperty("folders")[0].GetProperty("id").GetString()
            ?? throw new InvalidOperationException("The initialized folder ID is missing.");
        var request = new FolderOperationRequest(Guid.NewGuid(), initial.GetProperty("foldersRevision").GetInt64(),
            new RenameFolderOperation(folderId, "Renamed workspace folder"));

        // Act
        using var changed = await client.PostAsJsonAsync($"/api/campaigns/{campaignId:D}/folders", request);
        var snapshot = await changed.Content.ReadFromJsonAsync<FolderSnapshot>();
        var workspace = await client.GetFromJsonAsync<JsonElement>("/api/workspace");

        // Assert
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        Assert.NotNull(snapshot);
        Assert.Equal(snapshot.Revision, workspace.GetProperty("foldersRevision").GetInt64());
        var folders = workspace.GetProperty("folders").Deserialize<FolderSummary[]>(new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.NotNull(folders);
        Assert.Equal(snapshot.Folders, folders);
        Assert.Equal(initial.GetProperty("materials").GetRawText(), workspace.GetProperty("materials").GetRawText());
    }
}
