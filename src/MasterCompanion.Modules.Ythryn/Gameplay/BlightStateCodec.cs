using System.Text.Json;
using System.Text.Json.Serialization;
using MasterCompanion.Contracts;

using static MasterCompanion.Modules.Ythryn.Gameplay.BlightRules;
using static MasterCompanion.Modules.Ythryn.Gameplay.BlightJsonFields;

namespace MasterCompanion.Modules.Ythryn.Gameplay;

internal static class BlightStateCodec
{
    internal static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    private static InvalidOperationException Corrupt(string message) => new(message);
    internal static CheckDescription? LegacyNextCheck(BlightCharacter character, GameSnapshot snapshot)
    {
        if (character.Status == "healthy" && character.NextExposure is long exposure)
        {
            return new CheckDescription("exposure", exposure, exposure <= snapshot.TimeMinutes);
        }

        if (character.Status != "infected" || character.InfectedAt is not long infectedAt)
        {
            return null;
        }

        var processedThrough = character.LastResolvedRest ?? infectedAt;
        // A recovery rest must end strictly after infection, including when resolving overdue exposure.
        foreach (var minute in snapshot.RestEnds)
        {
            if (minute > processedThrough)
            {
                return new CheckDescription("rest", minute, minute <= snapshot.TimeMinutes);
            }
        }
        return null;
    }

    internal static BlightState ReadState(GameSnapshot snapshot)
    {
        if (snapshot.ModuleSchemaVersion is not (1 or 2 or 3 or 4))
        {
            throw Corrupt("Unsupported Arcane Blight state schema.");
        }

        if (snapshot.TimeMinutes is < 0 or > GameLimits.MaxTimeMinutes || snapshot.Party.Count > GameLimits.MaxPartySize ||
            snapshot.RestEnds.Count > GameLimits.MaxRestCount || snapshot.Party.Any(character => character.Id == Guid.Empty) ||
            snapshot.Party.Select(character => character.Id).Distinct().Count() != snapshot.Party.Count)
        {
            throw Corrupt("Invalid neutral game snapshot.");
        }

        long previous = 0;
        foreach (var minute in snapshot.RestEnds)
        {
            if (minute <= previous || minute > snapshot.TimeMinutes)
            {
                throw Corrupt("Invalid shared rest history.");
            }

            previous = minute;
        }

        var validRootFields = snapshot.ModuleSchemaVersion switch
        {
            4 => HasExactProperties(snapshot.ModuleState, "characters", "adventure", "forces"),
            3 => HasExactProperties(snapshot.ModuleState, "characters", "adventure"),
            _ => HasExactProperties(snapshot.ModuleState, "characters")
        };
        if (!validRootFields ||
            !snapshot.ModuleState.TryGetProperty("characters", out var items) || items.ValueKind != JsonValueKind.Array ||
            items.GetArrayLength() != snapshot.Party.Count)
        {
            throw Corrupt("Arcane Blight characters do not match the party.");
        }

        foreach (var item in items.EnumerateArray())
        {
            var validFields = snapshot.ModuleSchemaVersion == 1
                ? HasExactProperties(item, "id", "status", "dc", "failures", "infectedAt", "nextExposure", "lastResolvedRest")
                : HasExactProperties(item, "id", "status", "dc", "failures", "infectedAt", "nextExposure", "lastResolvedRest",
                    "nextRecovery", "recoveryStartedAt", "lastResolvedRecovery", "recoveryChecks");
            if (!validFields)
            {
                throw Corrupt("Invalid Arcane Blight character fields.");
            }

            if (item.GetProperty("status").ValueKind != JsonValueKind.String ||
                item.GetProperty("status").GetString() is not ("healthy" or "infected" or "immune" or "transformed"))
            {
                throw Corrupt("Unknown Arcane Blight character status.");
            }
        }
        BlightState state;
        try
        {
            if (snapshot.ModuleSchemaVersion == 1)
            {
                var legacy = snapshot.ModuleState.Deserialize<LegacyBlightState>(JsonOptions)
                    ?? throw Corrupt("Arcane Blight state is missing.");
                state = new BlightState(legacy.Characters.Select(character => new BlightCharacter(
                    character.Id, character.Status, character.Dc, character.Failures, character.InfectedAt,
                    character.NextExposure, character.LastResolvedRest, null, null, null, 0)).ToArray());
            }
            else if (snapshot.ModuleSchemaVersion == 2)
            {
                state = snapshot.ModuleState.Deserialize<BlightState>(JsonOptions)
                    ?? throw Corrupt("Arcane Blight state is missing.");
            }
            else
            {
                state = snapshot.ModuleState.Deserialize<BlightState>(ExpeditionRules.JsonOptions)
                    ?? throw Corrupt("Ythryn state is missing.");
                if (state.Adventure is null)
                {
                    throw Corrupt("Expedition state is missing.");
                }

                ExpeditionRules.Validate(state.Adventure, snapshot.TimeMinutes);
                if (snapshot.ModuleSchemaVersion == 4)
                {
                    RivalForcesRules.Validate(state.Forces ?? throw Corrupt("Rival forces state is missing."), state.Adventure);
                }
            }
        }
        catch (JsonException exception)
        {
            throw new InvalidOperationException("Ythryn game state is malformed.", exception);
        }

        var partyIds = snapshot.Party.Select(character => character.Id).ToHashSet();
        foreach (var character in state.Characters)
        {
            if (!partyIds.Remove(character.Id) || !ValidCharacter(character, snapshot))
            {
                throw Corrupt("Arcane Blight character state is inconsistent.");
            }
        }
        return state;
    }

    private static bool ValidCharacter(BlightCharacter character, GameSnapshot snapshot)
    {
        if (character.Dc is < 0 or > InitialDc || character.Failures is < 0 or > 3)
        {
            return false;
        }

        if (character.Status == "healthy")
        {
            return character.Dc == InitialDc && character.Failures == 0 && character.InfectedAt is null &&
                character.LastResolvedRest is null && character.NextExposure is long exposure &&
                exposure >= ExposureInterval && exposure <= snapshot.TimeMinutes + ExposureInterval &&
                character.NextRecovery is null && character.RecoveryStartedAt is null &&
                character.LastResolvedRecovery is null && character.RecoveryChecks == 0;
        }

        if (character.NextExposure is not null || character.InfectedAt is not long infectedAt ||
            infectedAt < ExposureInterval || infectedAt > snapshot.TimeMinutes)
        {
            return false;
        }

        if (character.LastResolvedRest is long rest &&
            (rest <= infectedAt || !snapshot.RestEnds.Contains(rest)))
        {
            return false;
        }

        int checks;
        if (snapshot.ModuleSchemaVersion == 1)
        {
            if (character.LastResolvedRest is null && (character.Dc != InitialDc || character.Failures != 0))
            {
                return false;
            }

            checks = character.LastResolvedRest is long lastRest
                ? snapshot.RestEnds.Count(minute => minute > infectedAt && minute <= lastRest) : 0;
        }
        else
        {
            if (!ValidRecoveryTimeline(character, snapshot, infectedAt, out checks))
            {
                return false;
            }
        }
        // Every successful recovery reduces DC by 1–6, and every failed recovery increments failures.
        var successes = checks - character.Failures;
        if (successes < 0)
        {
            return false;
        }

        if (character.Dc > 0 && (InitialDc - character.Dc < successes || InitialDc - character.Dc > successes * 6))
        {
            return false;
        }

        if (character.Dc == 0 && (successes * 6 < InitialDc || successes > InitialDc))
        {
            return false;
        }

        return character.Status switch
        {
            "infected" => character.Dc > 0 && character.Failures < 3,
            "immune" => character.Dc == 0 && character.Failures < 3 && checks > 0,
            "transformed" => character.Dc > 0 && character.Failures == 3 && checks > 0,
            _ => false
        };
    }

    private static bool ValidRecoveryTimeline(BlightCharacter character, GameSnapshot snapshot, long infectedAt, out int checks)
    {
        checks = 0;
        // Each success reduces the initial DC by at least one; transformation needs at most three failures.
        if (character.RecoveryStartedAt is not long start || start < infectedAt || start > snapshot.TimeMinutes ||
            (start != infectedAt && !snapshot.RestEnds.Contains(start)) || character.RecoveryChecks is < 0 or > 18)
        {
            return false;
        }

        var legacyChecks = snapshot.RestEnds.Count(minute => minute > infectedAt && minute <= start);
        if (start != infectedAt && (character.LastResolvedRest is not long legacyRest || legacyRest < start))
        {
            return false;
        }

        var through = start;
        long? lastRest = start != infectedAt ? start : null;
        for (var index = 0; index < character.RecoveryChecks; index++)
        {
            var check = RecoveryCheck(snapshot, through, checked(through + ExposureInterval));
            if (!check.Pending)
            {
                return false;
            }

            through = check.Minute;
            if (check.Kind == "rest")
            {
                lastRest = check.Minute;
            }
        }
        if (character.LastResolvedRecovery != (character.RecoveryChecks == 0 ? null : through) ||
            character.LastResolvedRest != lastRest)
        {
            return false;
        }

        var expectedTimer = character.Status == "infected" ? checked(through + ExposureInterval) : (long?)null;
        if (character.NextRecovery != expectedTimer)
        {
            return false;
        }

        checks = legacyChecks + character.RecoveryChecks;
        return checks <= 18;
    }

}
