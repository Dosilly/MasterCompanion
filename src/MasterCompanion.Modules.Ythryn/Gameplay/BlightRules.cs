using MasterCompanion.Contracts;

namespace MasterCompanion.Modules.Ythryn.Gameplay;

internal static class BlightRules
{
    internal const int InitialDc = 15;
    internal const long ExposureInterval = 720;
    private static InvalidOperationException Corrupt(string message) => new(message);
    internal static BlightCharacter Healthy(Guid id, long minute) =>
        new(id, "healthy", InitialDc, 0, null, checked(minute + ExposureInterval), null, null, null, null, 0);

    internal static BlightCharacter ResolveExposure(BlightCharacter character, long minute, bool success) => success
        ? character with { NextExposure = checked(minute + ExposureInterval) }
        : character with
        {
            Status = "infected",
            InfectedAt = minute,
            NextExposure = null,
            RecoveryStartedAt = minute,
            NextRecovery = checked(minute + ExposureInterval)
        };

    internal static BlightCharacter ResolveRecovery(BlightCharacter character, CheckDescription check, bool success, int? d6)
    {
        var updated = character with
        {
            LastResolvedRest = check.Kind == "rest" ? check.Minute : character.LastResolvedRest,
            LastResolvedRecovery = check.Minute,
            RecoveryChecks = character.RecoveryChecks + 1,
            NextRecovery = checked(check.Minute + ExposureInterval)
        };
        if (success)
        {
            var dc = Math.Max(0, character.Dc - d6.GetValueOrDefault());
            return updated with { Dc = dc, Status = dc == 0 ? "immune" : "infected", NextRecovery = dc == 0 ? null : updated.NextRecovery };
        }
        var failures = character.Failures + 1;
        return updated with
        {
            Failures = failures,
            Status = failures == 3 ? "transformed" : "infected",
            NextRecovery = failures == 3 ? null : updated.NextRecovery
        };
    }

    internal static CheckDescription? NextCheck(BlightCharacter character, GameSnapshot snapshot)
    {
        if (character.Status == "healthy" && character.NextExposure is long exposure)
        {
            return new CheckDescription("exposure", exposure, exposure <= snapshot.TimeMinutes);
        }

        if (character.Status != "infected" || character.InfectedAt is not long infectedAt)
        {
            return null;
        }

        if (character.NextRecovery is not long recovery)
        {
            throw Corrupt("Infected Arcane Blight state has no recovery timer.");
        }

        var processedThrough = character.LastResolvedRecovery ?? character.RecoveryStartedAt ?? infectedAt;
        return RecoveryCheck(snapshot, processedThrough, recovery);
    }

    internal static CheckDescription RecoveryCheck(GameSnapshot snapshot, long processedThrough, long recovery)
    {
        // The earliest event is resolved first. A simultaneous rest and timer produce one rest check.
        foreach (var minute in snapshot.RestEnds)
        {
            if (minute > processedThrough && minute <= recovery)
            {
                return new CheckDescription("rest", minute, minute <= snapshot.TimeMinutes);
            }
        }
        return new CheckDescription("recovery", recovery, recovery <= snapshot.TimeMinutes);
    }

}
