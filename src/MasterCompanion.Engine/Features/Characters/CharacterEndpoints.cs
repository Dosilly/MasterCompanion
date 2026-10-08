using System.Data;
using MasterCompanion.Engine.Features.Gameplay;
using MasterCompanion.Engine.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Engine.Features.Characters;

public static class CharacterEndpoints
{
    public static void Map(IEndpointRouteBuilder endpoints) =>
        endpoints.MapGet("/api/campaigns/{campaignId:guid}/characters", ReadAsync);

    private static async Task<IResult> ReadAsync(Guid campaignId, AppDbContext db, CancellationToken token)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, token);
        if (!await db.Campaigns.AnyAsync(item => item.Id == campaignId, token))
        {
            return Results.NotFound();
        }
        var game = await db.GameStates.AsNoTracking().SingleOrDefaultAsync(item => item.CampaignId == campaignId, token);
        var party = game is null ? [] : GameSnapshotCodec.Decode(game.SnapshotJson).Party;
        var characters = await db.Characters.AsNoTracking().Where(item => item.CampaignId == campaignId)
            .OrderBy(item => item.Name).ThenBy(item => item.Id).Take(CharacterCatalogWrites.MaxCharacters + 1).ToListAsync(token);
        if (characters.Count > CharacterCatalogWrites.MaxCharacters)
        {
            throw new InvalidOperationException("The saved character catalog exceeds its supported limit.");
        }
        return Results.Ok(new
        {
            revision = game?.Revision ?? 0,
            characters = characters.Select(item => new
            {
                item.Id,
                item.Name,
                item.Kind,
                inParty = party.Any(member => member.Id == item.Id),
                item.BackstoryMaterialId,
                item.NotesMaterialId
            })
        });
    }
}
