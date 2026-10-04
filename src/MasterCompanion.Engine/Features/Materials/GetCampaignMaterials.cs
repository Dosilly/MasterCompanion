using System.Text.Json;
using MasterCompanion.Engine.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Engine.Features.Materials;

public static class GetCampaignMaterials
{
    public static void Map(IEndpointRouteBuilder endpoints) =>
        endpoints.MapGet("/api/campaigns/{campaignId:guid}/materials", GetAsync);

    private static async Task<IResult> GetAsync(Guid campaignId, AppDbContext db, CancellationToken token)
    {
        if (!await db.Campaigns.AsNoTracking().AnyAsync(campaign => campaign.Id == campaignId, token))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Campaign materials could not be loaded",
                extensions: new Dictionary<string, object?> { ["code"] = "campaign_not_found" });
        }

        var materials = await db.Materials.AsNoTracking()
            .Where(material => material.CampaignId == campaignId)
            .OrderBy(material => material.SortOrder).ThenBy(material => material.Id)
            .Select(material => new
            {
                material.Id,
                material.Title,
                material.Group,
                material.DocumentJson,
                material.DocumentSchemaVersion,
                material.Revision,
                material.FolderId
            })
            .ToArrayAsync(token);

        var response = new MaterialResponse[materials.Length];
        for (var index = 0; index < materials.Length; index++)
        {
            token.ThrowIfCancellationRequested();
            var material = materials[index];
            response[index] = new MaterialResponse(material.Id, material.Title, material.Group,
                JsonSerializer.Deserialize<JsonElement>(material.DocumentJson),
                material.DocumentSchemaVersion, material.Revision, material.FolderId);
        }

        return Results.Ok(response);
    }
}
