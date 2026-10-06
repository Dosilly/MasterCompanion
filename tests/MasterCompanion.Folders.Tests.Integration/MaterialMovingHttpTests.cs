using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MasterCompanion.Engine.Features.Folders;
using MasterCompanion.Engine.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MasterCompanion.Folders.Tests.Integration;

public sealed partial class FolderOperationsHttpTests
{
    [Theory]
    [InlineData("a", null)]
    [InlineData(null, "unfiled-second")]
    [InlineData("leaf", "first")]
    public async Task MoveMaterial_ValidDestination_PersistsPlacementWithoutChangingContentRevision(string? folderId, string? beforeId)
    {
        await AddOrderingMaterialsAsync();
        string documentBefore;
        await using (var beforeScope = App.Services.CreateAsyncScope())
        {
            documentBefore = await beforeScope.ServiceProvider.GetRequiredService<AppDbContext>().Materials.AsNoTracking()
                .Where(item => item.CampaignId == campaignId && item.Id == "second")
                .Select(item => item.DocumentJson).SingleAsync();
        }
        var request = new FolderOperationRequest(Guid.NewGuid(), 0, new MoveMaterialOperation("second", folderId, beforeId));

        using var response = await SendAsync(request);
        var snapshot = await ReadAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, snapshot.Revision);
        var siblings = snapshot.MaterialOrder.Where(item => item.FolderId == folderId).ToArray();
        var position = Array.FindIndex(siblings, item => item.Id == "second");
        Assert.Equal(beforeId, siblings.ElementAtOrDefault(position + 1)?.Id);
        await using var scope = App.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var material = await db.Materials.SingleAsync(item => item.CampaignId == campaignId && item.Id == "second");
        Assert.Equal(folderId, material.FolderId);
        Assert.Equal(9, material.Revision);
        Assert.Equal("second", material.Title);
        Assert.Equal("Original", material.Group);
        Assert.Equal(documentBefore, material.DocumentJson);
        Assert.Equal(7, (await db.GameStates.SingleAsync(item => item.CampaignId == campaignId)).Revision);
        Assert.Equal(0, await db.GameOperations.CountAsync());
        if (folderId != "leaf")
        {
            Assert.Equal(new[] { "first", "third", $"note-{campaignId:D}" },
                snapshot.MaterialOrder.Where(item => item.FolderId == "leaf").Select(item => item.Id));
        }
    }

    [Theory]
    [InlineData("second", "foreign", null, "folder_target_not_found")]
    [InlineData("second", "missing", null, "folder_target_not_found")]
    [InlineData("second", "a", "first", "material_order_target_invalid")]
    [InlineData("second", "a", "second", "material_order_target_invalid")]
    [InlineData("missing", "a", null, "material_not_found")]
    public async Task MoveMaterial_InvalidReference_RejectsWithoutChangingOrganization(string id, string? folderId, string? beforeId, string code)
    {
        await AddOrderingMaterialsAsync();
        var before = await OrderingDocumentAsync();
        var request = new FolderOperationRequest(Guid.NewGuid(), 0, new MoveMaterialOperation(id, folderId, beforeId));

        using var response = await SendAsync(request);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(code == "material_not_found" ? HttpStatusCode.NotFound : HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(code, problem.GetProperty("code").GetString());
        Assert.Equal(before, await OrderingDocumentAsync());
        Assert.Equal(0, (await ReadAsync()).Revision);
        await using var scope = App.Services.CreateAsyncScope();
        Assert.Equal(0, await scope.ServiceProvider.GetRequiredService<AppDbContext>().FolderOperationReceipts.CountAsync());
    }

    [Fact]
    public async Task MoveMaterial_ReplayAndStaleRequest_KeepOneConfirmedPlacement()
    {
        await AddOrderingMaterialsAsync();
        var request = new FolderOperationRequest(Guid.NewGuid(), 0, new MoveMaterialOperation("second", "a", null));

        using var response = await SendAsync(request);
        using var replay = await SendAsync(request);
        using var stale = await SendAsync(new FolderOperationRequest(Guid.NewGuid(), 0, new MoveMaterialOperation("first", "a", null)));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(await response.Content.ReadAsStringAsync(), await replay.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Equal(1, (await ReadAsync()).Revision);
        await using var scope = App.Services.CreateAsyncScope();
        Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<AppDbContext>().FolderOperationReceipts.CountAsync());
    }
}
