using System.Text.Json;
using System.Text.Json.Serialization;
using MasterCompanion.Contracts;

namespace MasterCompanion.Engine.Features.Gameplay;

internal static class GameSnapshotCodec
{
    internal static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        AllowDuplicateProperties = false,
        RespectRequiredConstructorParameters = true,
        RespectNullableAnnotations = true,
        PropertyNameCaseInsensitive = false,
        NumberHandling = JsonNumberHandling.Strict,
        MaxDepth = 16
    };

    internal static GameSnapshot Empty(ICampaignGameRules rules) => new(0, [], [], rules.StateSchemaVersion, rules.Initialize([]));
    internal static string Encode(GameSnapshot snapshot) => JsonSerializer.Serialize(snapshot, JsonOptions);
    internal static GameSnapshot Decode(string json) => JsonSerializer.Deserialize<GameSnapshot>(json, JsonOptions)
        ?? throw new InvalidOperationException("The saved game snapshot is invalid.");
    internal static void ValidateSnapshot(GameSnapshot snapshot, ICampaignGameRules rules)
    {
        if (snapshot.TimeMinutes is < 0 or > GameLimits.MaxTimeMinutes || snapshot.Party is null || snapshot.RestEnds is null ||
            !GameRequestValidator.IsValidParty(snapshot.Party) || snapshot.RestEnds.Count > GameLimits.MaxRestCount)
        {
            throw new InvalidOperationException("The saved game snapshot violates the supported schema.");
        }

        long previous = 0;
        foreach (var minute in snapshot.RestEnds)
        {
            if (minute <= previous || minute > snapshot.TimeMinutes)
            {
                throw new InvalidOperationException("The saved rest sequence is invalid.");
            }

            previous = minute;
        }
        rules.Validate(snapshot);
    }

    internal static GameSnapshot UpgradeSnapshot(GameSnapshot snapshot, ICampaignGameRules rules)
    {
        ValidateSnapshot(snapshot, rules);
        var party = snapshot.Party.ToArray();
        var restEnds = snapshot.RestEnds.ToArray();
        var upgraded = rules.Upgrade(snapshot);
        if (upgraded.ModuleSchemaVersion != rules.StateSchemaVersion || upgraded.TimeMinutes != snapshot.TimeMinutes ||
            upgraded.Party is null || !upgraded.Party.SequenceEqual(party) ||
            upgraded.RestEnds is null || !upgraded.RestEnds.SequenceEqual(restEnds))
        {
            throw new InvalidOperationException("A module state upgrade changed engine-owned data or returned an unsupported schema.");
        }

        ValidateSnapshot(upgraded, rules);
        return upgraded;
    }
}
