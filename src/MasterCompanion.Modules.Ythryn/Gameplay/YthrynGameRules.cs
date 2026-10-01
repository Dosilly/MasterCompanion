using System.Text.Json;
using System.Text.Json.Serialization;
using MasterCompanion.Contracts;

namespace MasterCompanion.Modules.Ythryn.Gameplay;

public sealed class YthrynGameRules : ICampaignGameRules
{
    private const int InitialDc = 15;
    private const long ExposureInterval = 720;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    public string ModuleId => "ythryn";
    public int StateSchemaVersion => 2;

    public JsonElement Initialize(IReadOnlyList<GameCharacter> party) => Serialize(
        new BlightState(party.Select(character => Healthy(character.Id, 0)).ToArray()));

    public void Validate(GameSnapshot snapshot) => ReadState(snapshot);

    public GameSnapshot Upgrade(GameSnapshot snapshot)
    {
        var state = ReadState(snapshot);
        if (snapshot.ModuleSchemaVersion == StateSchemaVersion) return snapshot;
        var characters = state.Characters.Select(character =>
        {
            if (character.Status == "healthy") return character;
            var start = character.LastResolvedRest ?? character.InfectedAt
                ?? throw Corrupt("Infected Arcane Blight state has no infection time.");
            return character with
            {
                RecoveryStartedAt = start,
                NextRecovery = character.Status == "infected" ? checked(start + ExposureInterval) : null
            };
        }).ToArray();
        var upgraded = snapshot with { ModuleSchemaVersion = StateSchemaVersion, ModuleState = Serialize(new BlightState(characters)) };
        Validate(upgraded);
        return upgraded;
    }

    public ModuleTransition ReconcileParty(GameSnapshot before, GameSnapshot proposed)
    {
        var retained = ReadState(before).Characters.ToDictionary(character => character.Id);
        var characters = proposed.Party.Select(character => retained.TryGetValue(character.Id, out var existing)
            ? existing : Healthy(character.Id, proposed.TimeMinutes)).ToArray();
        var state = Serialize(new BlightState(characters));
        Validate(proposed with { ModuleState = state });
        return new ModuleTransition(state);
    }

    public ModuleTransition Transition(GameSnapshot before, GameSnapshot proposed, JsonElement? command)
    {
        var state = ReadState(before);
        if (command is null)
        {
            Validate(proposed with { ModuleState = before.ModuleState });
            return new ModuleTransition(before.ModuleState);
        }

        if (!TryReadCommand(command.Value, out var input))
            return Rejected(before, "invalid_module_command");
        var index = Array.FindIndex(state.Characters, character => character.Id == input.CharacterId);
        if (index < 0) return Rejected(before, "game_character_not_found");
        var character = state.Characters[index];
        BlightCharacter changed;
        if (input.Kind == "healCharacter")
        {
            if (character.Status != "infected") return Rejected(before, "game_character_not_infected");
            changed = Healthy(character.Id, proposed.TimeMinutes);
        }
        else
        {
            var check = NextCheck(character, proposed);
            if (check is null || !check.Pending) return Rejected(before, "game_check_not_due");
            // A d6 belongs only to a successful recovery check, never to exposure or failure.
            if ((check.Kind != "exposure" && input.Success == true) != (input.D6 is not null))
                return Rejected(before, "invalid_module_command");
            changed = check.Kind == "exposure"
                ? ResolveExposure(character, check.Minute, input.Success == true)
                : ResolveRecovery(character, check, input.Success == true, input.D6);
        }

        var characters = state.Characters.ToArray();
        characters[index] = changed;
        var nextState = Serialize(new BlightState(characters));
        Validate(proposed with { ModuleState = nextState });
        return new ModuleTransition(nextState);
    }

    public JsonElement Describe(GameSnapshot snapshot)
    {
        var state = ReadState(snapshot);
        return JsonSerializer.SerializeToElement(new BlightDescription(state.Characters.Select(character =>
            new CharacterDescription(character.Id, character.Status, character.Dc, character.Failures,
                snapshot.ModuleSchemaVersion == 1 ? LegacyNextCheck(character, snapshot) : NextCheck(character, snapshot))).ToArray()), JsonOptions);
    }

    private static BlightCharacter Healthy(Guid id, long minute) =>
        new(id, "healthy", InitialDc, 0, null, checked(minute + ExposureInterval), null, null, null, null, 0);

    private static BlightCharacter ResolveExposure(BlightCharacter character, long minute, bool success) => success
        ? character with { NextExposure = checked(minute + ExposureInterval) }
        : character with
        {
            Status = "infected", InfectedAt = minute, NextExposure = null,
            RecoveryStartedAt = minute, NextRecovery = checked(minute + ExposureInterval)
        };

    private static BlightCharacter ResolveRecovery(BlightCharacter character, CheckDescription check, bool success, int? d6)
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
            Failures = failures, Status = failures == 3 ? "transformed" : "infected",
            NextRecovery = failures == 3 ? null : updated.NextRecovery
        };
    }

    private static CheckDescription? NextCheck(BlightCharacter character, GameSnapshot snapshot)
    {
        if (character.Status == "healthy" && character.NextExposure is long exposure)
            return new CheckDescription("exposure", exposure, exposure <= snapshot.TimeMinutes);
        if (character.Status != "infected" || character.InfectedAt is not long infectedAt) return null;
        if (character.NextRecovery is not long recovery) throw Corrupt("Infected Arcane Blight state has no recovery timer.");
        var processedThrough = character.LastResolvedRecovery ?? character.RecoveryStartedAt ?? infectedAt;
        return RecoveryCheck(snapshot, processedThrough, recovery);
    }

    private static CheckDescription RecoveryCheck(GameSnapshot snapshot, long processedThrough, long recovery)
    {
        // The earliest event is resolved first. A simultaneous rest and timer produce one rest check.
        foreach (var minute in snapshot.RestEnds)
        {
            if (minute > processedThrough && minute <= recovery)
                return new CheckDescription("rest", minute, minute <= snapshot.TimeMinutes);
        }
        return new CheckDescription("recovery", recovery, recovery <= snapshot.TimeMinutes);
    }

    private static CheckDescription? LegacyNextCheck(BlightCharacter character, GameSnapshot snapshot)
    {
        if (character.Status == "healthy" && character.NextExposure is long exposure)
            return new CheckDescription("exposure", exposure, exposure <= snapshot.TimeMinutes);
        if (character.Status != "infected" || character.InfectedAt is not long infectedAt) return null;
        var processedThrough = character.LastResolvedRest ?? infectedAt;
        // A recovery rest must end strictly after infection, including when resolving overdue exposure.
        foreach (var minute in snapshot.RestEnds)
        {
            if (minute > processedThrough) return new CheckDescription("rest", minute, minute <= snapshot.TimeMinutes);
        }
        return null;
    }

    private BlightState ReadState(GameSnapshot snapshot)
    {
        if (snapshot.ModuleSchemaVersion is not (1 or 2))
            throw Corrupt("Unsupported Arcane Blight state schema.");
        if (snapshot.TimeMinutes is < 0 or > GameLimits.MaxTimeMinutes || snapshot.Party.Count > GameLimits.MaxPartySize ||
            snapshot.RestEnds.Count > GameLimits.MaxRestCount || snapshot.Party.Any(character => character.Id == Guid.Empty) ||
            snapshot.Party.Select(character => character.Id).Distinct().Count() != snapshot.Party.Count)
            throw Corrupt("Invalid neutral game snapshot.");
        long previous = 0;
        foreach (var minute in snapshot.RestEnds)
        {
            if (minute <= previous || minute > snapshot.TimeMinutes) throw Corrupt("Invalid shared rest history.");
            previous = minute;
        }

        if (!HasExactProperties(snapshot.ModuleState, "characters") ||
            !snapshot.ModuleState.TryGetProperty("characters", out var items) || items.ValueKind != JsonValueKind.Array ||
            items.GetArrayLength() != snapshot.Party.Count)
            throw Corrupt("Arcane Blight characters do not match the party.");
        foreach (var item in items.EnumerateArray())
        {
            var validFields = snapshot.ModuleSchemaVersion == 1
                ? HasExactProperties(item, "id", "status", "dc", "failures", "infectedAt", "nextExposure", "lastResolvedRest")
                : HasExactProperties(item, "id", "status", "dc", "failures", "infectedAt", "nextExposure", "lastResolvedRest",
                    "nextRecovery", "recoveryStartedAt", "lastResolvedRecovery", "recoveryChecks");
            if (!validFields)
                throw Corrupt("Invalid Arcane Blight character fields.");
            if (item.GetProperty("status").ValueKind != JsonValueKind.String ||
                item.GetProperty("status").GetString() is not ("healthy" or "infected" or "immune" or "transformed"))
                throw Corrupt("Unknown Arcane Blight character status.");
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
            else
                state = snapshot.ModuleState.Deserialize<BlightState>(JsonOptions)
                    ?? throw Corrupt("Arcane Blight state is missing.");
        }
        catch (JsonException exception)
        {
            throw new InvalidOperationException("Arcane Blight state is malformed.", exception);
        }

        var partyIds = snapshot.Party.Select(character => character.Id).ToHashSet();
        foreach (var character in state.Characters)
        {
            if (!partyIds.Remove(character.Id) || !ValidCharacter(character, snapshot))
                throw Corrupt("Arcane Blight character state is inconsistent.");
        }
        return state;
    }

    private static bool ValidCharacter(BlightCharacter character, GameSnapshot snapshot)
    {
        if (character.Dc is < 0 or > InitialDc || character.Failures is < 0 or > 3) return false;
        if (character.Status == "healthy")
            return character.Dc == InitialDc && character.Failures == 0 && character.InfectedAt is null &&
                character.LastResolvedRest is null && character.NextExposure is long exposure &&
                exposure >= ExposureInterval && exposure <= snapshot.TimeMinutes + ExposureInterval &&
                character.NextRecovery is null && character.RecoveryStartedAt is null &&
                character.LastResolvedRecovery is null && character.RecoveryChecks == 0;
        if (character.NextExposure is not null || character.InfectedAt is not long infectedAt ||
            infectedAt < ExposureInterval || infectedAt > snapshot.TimeMinutes) return false;
        if (character.LastResolvedRest is long rest &&
            (rest <= infectedAt || !snapshot.RestEnds.Contains(rest))) return false;
        int checks;
        if (snapshot.ModuleSchemaVersion == 1)
        {
            if (character.LastResolvedRest is null && (character.Dc != InitialDc || character.Failures != 0)) return false;
            checks = character.LastResolvedRest is long lastRest
                ? snapshot.RestEnds.Count(minute => minute > infectedAt && minute <= lastRest) : 0;
        }
        else
        {
            if (!ValidRecoveryTimeline(character, snapshot, infectedAt, out checks)) return false;
        }
        // Every successful recovery reduces DC by 1–6, and every failed recovery increments failures.
        var successes = checks - character.Failures;
        if (successes < 0) return false;
        if (character.Dc > 0 && (InitialDc - character.Dc < successes || InitialDc - character.Dc > successes * 6)) return false;
        if (character.Dc == 0 && (successes * 6 < InitialDc || successes > InitialDc)) return false;
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
            return false;
        var legacyChecks = snapshot.RestEnds.Count(minute => minute > infectedAt && minute <= start);
        if (start != infectedAt && (character.LastResolvedRest is not long legacyRest || legacyRest < start)) return false;
        var through = start;
        long? lastRest = start != infectedAt ? start : null;
        for (var index = 0; index < character.RecoveryChecks; index++)
        {
            var check = RecoveryCheck(snapshot, through, checked(through + ExposureInterval));
            if (!check.Pending) return false;
            through = check.Minute;
            if (check.Kind == "rest") lastRest = check.Minute;
        }
        if (character.LastResolvedRecovery != (character.RecoveryChecks == 0 ? null : through) ||
            character.LastResolvedRest != lastRest)
            return false;
        var expectedTimer = character.Status == "infected" ? checked(through + ExposureInterval) : (long?)null;
        if (character.NextRecovery != expectedTimer) return false;
        checks = legacyChecks + character.RecoveryChecks;
        return checks <= 18;
    }

    private static bool TryReadCommand(JsonElement element, out BlightCommand command)
    {
        command = new BlightCommand("", Guid.Empty, null, null);
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty("kind", out var kindValue) ||
            kindValue.ValueKind != JsonValueKind.String || !element.TryGetProperty("characterId", out var idValue) ||
            idValue.ValueKind != JsonValueKind.String || !idValue.TryGetGuid(out var id) || id == Guid.Empty) return false;
        var kind = kindValue.GetString();
        if (kind == "healCharacter" && HasExactProperties(element, "kind", "characterId"))
        {
            command = new BlightCommand(kind, id, null, null);
            return true;
        }
        if (kind != "resolveCheck" || !element.TryGetProperty("success", out var successValue) ||
            successValue.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return false;
        int? d6 = null;
        if (element.TryGetProperty("d6", out var die))
        {
            if (!HasExactProperties(element, "kind", "characterId", "success", "d6") ||
                die.ValueKind != JsonValueKind.Number || !die.TryGetInt32(out var result) || result is < 1 or > 6) return false;
            d6 = result;
        }
        else if (!HasExactProperties(element, "kind", "characterId", "success")) return false;
        command = new BlightCommand(kind, id, successValue.GetBoolean(), d6);
        return true;
    }

    private static bool HasExactProperties(JsonElement element, params string[] names)
    {
        if (element.ValueKind != JsonValueKind.Object) return false;
        var expected = names.ToHashSet(StringComparer.Ordinal);
        foreach (var property in element.EnumerateObject())
        {
            if (!expected.Remove(property.Name)) return false;
        }
        return expected.Count == 0;
    }

    private static JsonElement Serialize(BlightState state) => JsonSerializer.SerializeToElement(state, JsonOptions);
    private static ModuleTransition Rejected(GameSnapshot snapshot, string code) => new(snapshot.ModuleState, code);
    private static InvalidOperationException Corrupt(string message) => new(message);
    private sealed record BlightState(BlightCharacter[] Characters);
    private sealed record BlightCharacter(Guid Id, string Status, int Dc, int Failures,
        long? InfectedAt, long? NextExposure, long? LastResolvedRest, long? NextRecovery,
        long? RecoveryStartedAt, long? LastResolvedRecovery, int RecoveryChecks);
    private sealed record LegacyBlightState(LegacyBlightCharacter[] Characters);
    private sealed record LegacyBlightCharacter(Guid Id, string Status, int Dc, int Failures,
        long? InfectedAt, long? NextExposure, long? LastResolvedRest);
    private sealed record BlightCommand(string Kind, Guid CharacterId, bool? Success, int? D6);
    private sealed record BlightDescription(CharacterDescription[] Characters);
    private sealed record CharacterDescription(Guid Id, string Status, int Dc, int Failures, CheckDescription? NextCheck);
    private sealed record CheckDescription(string Kind, long Minute, bool Pending);
}
