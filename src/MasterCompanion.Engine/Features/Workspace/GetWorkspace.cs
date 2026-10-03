using MasterCompanion.Engine.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using MasterCompanion.Contracts;

namespace MasterCompanion.Engine.Features.Workspace;

public static class GetWorkspace
{
    public static void Map(IEndpointRouteBuilder endpoints) =>
        endpoints.MapGet("/api/workspace", async (AppDbContext db, IEnumerable<ICampaignModule> modules,
            CancellationToken token) =>
        {
            var campaign = await db.Campaigns.AsNoTracking().SingleAsync(token);
            var maps = await db.Maps.AsNoTracking().Where(x => x.CampaignId == campaign.Id)
                .Select(x => x.DefinitionJson).ToListAsync(token);
            return Results.Ok(new
            {
                campaignId = campaign.Id, title = campaign.Title,
                moduleId = campaign.ModuleId, moduleVersion = campaign.ModuleVersion,
                startMaterialId = modules.Single(x => x.Manifest.Id == campaign.ModuleId).Manifest.StartMaterialId,
                maps = maps.Select(x => JsonSerializer.Deserialize<JsonElement>(x)),
                folders = await db.Folders.AsNoTracking().Where(x => x.CampaignId == campaign.Id)
                    .OrderBy(x => x.SortOrder).Select(x => new { x.Id, x.Title, x.ParentId }).ToListAsync(token),
                materials = await db.Materials.AsNoTracking().OrderBy(x => x.SortOrder).ThenBy(x => x.Id)
                    .Where(x => x.CampaignId == campaign.Id)
                    .Select(x => new { x.Id, x.Title, x.Group, x.FolderId }).ToListAsync(token)
            });
        });
}
