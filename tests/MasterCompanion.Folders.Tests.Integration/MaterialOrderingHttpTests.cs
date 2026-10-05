using System.Net;
using System.Net.Http.Json;
using MasterCompanion.Engine.Features.Folders;
using MasterCompanion.Engine.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MasterCompanion.Folders.Tests.Integration;

public sealed partial class FolderOperationsHttpTests
{
    [Theory]
    [InlineData("second", "first", "second,first,third")]
    [InlineData("first", null, "second,third,first")]
    [InlineData("first", "third", "second,first,third")]
    public async Task Reorder_SiblingInsertion_PersistsOrderAndPreservesDocuments(string materialId, string? beforeId, string expected)
    {
        await AddOrderingMaterialsAsync();
        var documentBefore = await OrderingDocumentAsync();
        var request = new FolderOperationRequest(Guid.NewGuid(), 0, new ReorderMaterialOperation(materialId, "leaf", beforeId));

        using var response = await SendAsync(request);
        var snapshot = await ReadAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, snapshot.Revision);
        Assert.Equal(expected.Split(','), snapshot.MaterialOrder.Where(item => item.FolderId == "leaf" && item.Id != $"note-{campaignId:D}").Select(item => item.Id));
        Assert.Equal(documentBefore, await OrderingDocumentAsync());
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var persisted = await db.Materials.Where(item => item.CampaignId == campaignId && item.Id == materialId).SingleAsync();
        Assert.Equal(9, persisted.Revision);
        Assert.Equal("leaf", persisted.FolderId);
        Assert.Equal(7, (await db.GameStates.SingleAsync(item => item.CampaignId == campaignId)).Revision);
        Assert.Equal(0, await db.GameOperations.CountAsync());
    }

    [Fact]
    public async Task Reorder_UnfiledSiblings_RetainsNullOwnershipAndOtherFolders()
    {
        await AddOrderingMaterialsAsync();
        var request = new FolderOperationRequest(Guid.NewGuid(), 0, new ReorderMaterialOperation("unfiled-second", null, "unfiled-first"));

        using var response = await SendAsync(request);
        var snapshot = await ReadAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new[] { "unfiled-second", "unfiled-first" }, snapshot.MaterialOrder.Where(item => item.FolderId is null).Select(item => item.Id));
        Assert.Equal(new[] { "first", "second", "third", $"note-{campaignId:D}" }, snapshot.MaterialOrder.Where(item => item.FolderId == "leaf").Select(item => item.Id));
    }

    [Theory]
    [InlineData("first", "a", null, "material_folder_conflict")]
    [InlineData("first", "leaf", "unfiled-first", "material_order_target_invalid")]
    [InlineData("first", "leaf", "first", "material_order_target_invalid")]
    [InlineData("missing", "leaf", null, "material_not_found")]
    public async Task Reorder_InvalidOwnershipOrTarget_RejectsWithoutReceipt(string id, string? folderId, string? beforeId, string code)
    {
        await AddOrderingMaterialsAsync();
        var before = await ReadAsync();
        var request = new FolderOperationRequest(Guid.NewGuid(), 0, new ReorderMaterialOperation(id, folderId, beforeId));

        using var response = await SendAsync(request);
        var problem = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var after = await ReadAsync();

        Assert.Equal(code == "material_not_found" ? HttpStatusCode.NotFound : HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(code, problem.GetProperty("code").GetString());
        Assert.Equal(before.MaterialOrder, after.MaterialOrder);
        Assert.Equal(0, after.Revision);
        await using var scope = App.Services.CreateAsyncScope();
        Assert.Equal(0, await scope.ServiceProvider.GetRequiredService<AppDbContext>().FolderOperationReceipts.CountAsync());
    }

    [Fact]
    public async Task Reorder_StaleFolderChange_RejectsRevisionAndAllowsExactReplay()
    {
        await AddOrderingMaterialsAsync();
        var request = new FolderOperationRequest(Guid.NewGuid(), 0, new ReorderMaterialOperation("second", "leaf", "first"));
        var rename = new FolderOperationRequest(Guid.NewGuid(), 0, new RenameFolderOperation("a", "Concurrent"));

        using var ordered = await SendAsync(request);
        using var stale = await SendAsync(rename);
        using var replay = await SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, ordered.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Equal(await ordered.Content.ReadAsStringAsync(), await replay.Content.ReadAsStringAsync());
        Assert.Equal(1, (await ReadAsync()).Revision);
    }

    [Fact]
    public async Task CreateMaterial_AfterOrganizationRead_AdvancesRevisionAndRejectsStaleReorder()
    {
        await AddOrderingMaterialsAsync();
        var id = Guid.NewGuid();

        using var created = await Client.PostAsJsonAsync($"/api/campaigns/{campaignId:D}/materials", new { id, title = "New note", folderId = "leaf" });
        using var stale = await SendAsync(new FolderOperationRequest(Guid.NewGuid(), 0, new ReorderMaterialOperation("first", "leaf", null)));
        using var replay = await Client.PostAsJsonAsync($"/api/campaigns/{campaignId:D}/materials", new { id, title = "New note", folderId = "leaf" });
        var snapshot = await ReadAsync();

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Equal(1, snapshot.Revision);
        Assert.Equal($"note-{id:D}", snapshot.MaterialOrder.Last(item => item.FolderId == "leaf").Id);
    }

    private async Task<string> OrderingDocumentAsync()
    {
        await using var scope = App.Services.CreateAsyncScope();
        var materials = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Materials.AsNoTracking()
            .Where(item => item.CampaignId == campaignId).OrderBy(item => item.Id)
            .Select(item => new { item.Id, item.Title, item.Group, item.FolderId, item.DocumentJson, item.DocumentSchemaVersion, item.Revision })
            .ToListAsync();
        return System.Text.Json.JsonSerializer.Serialize(materials);
    }

    private async Task AddOrderingMaterialsAsync()
    {
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        foreach (var (id, folderId, order) in new[] {
            ("first", "leaf", -3), ("second", "leaf", -2), ("third", "leaf", -1),
            ("unfiled-first", (string?)null, 3), ("unfiled-second", (string?)null, 4) })
        {
            db.Materials.Add(new Material { Id = id, CampaignId = campaignId, Title = id, Group = "Original", FolderId = folderId,
                DocumentJson = """{"type":"doc","content":[{"type":"paragraph"}]}""", Revision = 9, SortOrder = order });
        }
        await db.SaveChangesAsync();
    }
}
