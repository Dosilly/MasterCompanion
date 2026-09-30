using MasterCompanion.Contracts;
using MasterCompanion.Engine.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Engine.Features.Assets;

public static class GetAsset
{
    public static void Map(IEndpointRouteBuilder endpoints) =>
        endpoints.MapGet("/api/assets/{assetId}", async (string assetId, AppDbContext db,
            IEnumerable<ICampaignModule> modules, CancellationToken token) =>
        {
            var moduleId = await db.Campaigns.AsNoTracking().Select(x => x.ModuleId).SingleAsync(token);
            var asset = modules.Single(x => x.Manifest.Id == moduleId).OpenAsset(assetId);
            return asset is null ? Results.NotFound() : Results.Stream(asset.Content, asset.ContentType);
        });
}
