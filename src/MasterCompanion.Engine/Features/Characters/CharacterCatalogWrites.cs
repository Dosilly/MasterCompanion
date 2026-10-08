using MasterCompanion.Contracts;
using MasterCompanion.Engine.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Engine.Features.Characters;

// Called inside the gameplay transaction; documents survive membership changes and undo.
internal static class CharacterCatalogWrites
{
    internal const int MaxCharacters = 1_000;

    internal static bool IsValid(CharacterChange change) => change.Id != Guid.Empty &&
        ValidText(change.Name, GameLimits.MaxCharacterNameLength) && change.Kind is "player" or "npc" &&
        ValidText(change.BackstoryTitle, 300) && ValidText(change.NotesTitle, 300);

    private static bool ValidText(string value, int maximum) => !string.IsNullOrWhiteSpace(value) &&
        value.Length <= maximum && value == value.Trim() && !value.Any(char.IsControl);

    internal static async Task<string?> ApplyAsync(AppDbContext db, Guid campaignId,
        IReadOnlyList<GameCharacter> party, CharacterChange? change, CancellationToken token)
    {
        var characters = await db.Characters.Where(item => item.CampaignId == campaignId)
            .Take(MaxCharacters + 1).ToListAsync(token);
        var newIds = party.Select(item => item.Id).Concat(change is null ? [] : [change.Id])
            .Distinct().Except(characters.Select(item => item.Id)).ToArray();
        if (characters.Count + newIds.Length > MaxCharacters)
        {
            return "character_limit";
        }
        if (newIds.Length > 0)
        {
            var campaign = await db.Campaigns.SingleAsync(item => item.Id == campaignId, token);
            if (campaign.FoldersRevision >= 9_007_199_254_740_991)
            {
                return "character_revision_limit";
            }
            var order = await db.Materials.Where(item => item.CampaignId == campaignId)
                .MaxAsync(item => (int?)item.SortOrder, token) ?? -1;
            foreach (var id in newIds)
            {
                var name = change?.Id == id ? change.Name : party.Single(item => item.Id == id).Name;
                var character = new CampaignCharacter
                {
                    CampaignId = campaignId,
                    Id = id,
                    Name = name,
                    Kind = change?.Id == id ? change.Kind : "player",
                    BackstoryMaterialId = $"c-{campaignId:N}-{id:N}-b",
                    NotesMaterialId = $"c-{campaignId:N}-{id:N}-n"
                };
                characters.Add(character);
                db.Characters.Add(character);
                db.Materials.AddRange(NewDocument(campaignId, character.BackstoryMaterialId,
                        change?.Id == id ? change.BackstoryTitle : name, checked(++order)),
                    NewDocument(campaignId, character.NotesMaterialId,
                        change?.Id == id ? change.NotesTitle : name, checked(++order)));
            }
            campaign.FoldersRevision++;
        }
        foreach (var member in party)
        {
            characters.Single(item => item.Id == member.Id).Name = member.Name;
        }
        if (change is not null)
        {
            var character = characters.Single(item => item.Id == change.Id);
            character.Name = change.Name;
            character.Kind = change.Kind;
        }
        return null;
    }

    private static Material NewDocument(Guid campaignId, string id, string title, int order) => new()
    {
        Id = id,
        CampaignId = campaignId,
        Title = title,
        Group = string.Empty,
        DocumentJson = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}",
        DocumentSchemaVersion = 1,
        Revision = 1,
        SortOrder = order
    };
}
