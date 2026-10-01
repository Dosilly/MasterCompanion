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
    public int StateSchemaVersion => 1;

    public JsonElement Initialize(IReadOnlyList<GameCharacter> party) => Serialize(
        new BlightState(party.Select(character => Healthy(character.Id, 0)).ToArray()));

    public void Validate(GameSnapshot snapshot) => ReadState(snapshot);

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
            if ((check.Kind == "rest" && input.Success == true) != (input.D6 is not null))
                return Rejected(before, "invalid_module_command");
            changed = check.Kind == "exposure"
                ? ResolveExposure(character, check.Minute, input.Success == true)
                : ResolveRest(character, check.Minute, input.Success == true, input.D6);
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
                NextCheck(character, snapshot))).ToArray()), JsonOptions);
    }

    private static BlightCharacter Healthy(Guid id, long minute) =>
        new(id, "healthy", InitialDc, 0, null, checked(minute + ExposureInterval), null);

    private static BlightCharacter ResolveExposure(BlightCharacter character, long minute, bool success) => success
        ? character with { NextExposure = checked(minute + ExposureInterval) }
        : character with { Status = "infected", InfectedAt = minute, NextExposure = null };

    private static BlightCharacter ResolveRest(BlightCharacter character, long minute, bool success, int? d6)
    {
        if (success)
        {
            var dc = Math.Max(0, character.Dc - d6.GetValueOrDefault());
            return character with { Dc = dc, Status = dc == 0 ? "immune" : "infected", LastResolvedRest = minute };
        }
        var failures = character.Failures + 1;
        return character with { Failures = failures, Status = failures == 3 ? "transformed" : "infected", LastResolvedRest = minute };
    }

    private static CheckDescription? NextCheck(BlightCharacter character, GameSnapshot snapshot)
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
        if (snapshot.ModuleSchemaVersion != StateSchemaVersion)
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
            if (!HasExactProperties(item, "id", "status", "dc", "failures", "infectedAt", "nextExposure", "lastResolvedRest"))
                throw Corrupt("Invalid Arcane Blight character fields.");
            if (item.GetProperty("status").ValueKind != JsonValueKind.String ||
                item.GetProperty("status").GetString() is not ("healthy" or "infected" or "immune" or "transformed"))
                throw Corrupt("Unknown Arcane Blight character status.");
        }
        BlightState state;
        try
        {
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
                exposure >= ExposureInterval && exposure <= snapshot.TimeMinutes + ExposureInterval;
        if (character.NextExposure is not null || character.InfectedAt is not long infectedAt ||
            infectedAt < ExposureInterval || infectedAt > snapshot.TimeMinutes) return false;
        if (character.LastResolvedRest is long rest &&
            (rest <= infectedAt || !snapshot.RestEnds.Contains(rest))) return false;
        // Successful recovery always reduces DC; failed recovery always increments failures.
        if (character.LastResolvedRest is null && (character.Dc != InitialDc || character.Failures != 0)) return false;
        var resolvedRests = character.LastResolvedRest is long lastRest
            ? snapshot.RestEnds.Count(minute => minute > infectedAt && minute <= lastRest) : 0;
        var successes = resolvedRests - character.Failures;
        if (successes < 0) return false;
        if (character.Dc > 0 && (InitialDc - character.Dc < successes || InitialDc - character.Dc > successes * 6)) return false;
        if (character.Dc == 0 && (successes * 6 < InitialDc || successes > InitialDc)) return false;
        return character.Status switch
        {
            "infected" => character.Dc > 0 && character.Failures < 3,
            "immune" => character.Dc == 0 && character.Failures < 3 && character.LastResolvedRest is not null,
            "transformed" => character.Dc > 0 && character.Failures == 3 && character.LastResolvedRest is not null,
            _ => false
        };
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
        long? InfectedAt, long? NextExposure, long? LastResolvedRest);
    private sealed record BlightCommand(string Kind, Guid CharacterId, bool? Success, int? D6);
    private sealed record BlightDescription(CharacterDescription[] Characters);
    private sealed record CharacterDescription(Guid Id, string Status, int Dc, int Failures, CheckDescription? NextCheck);
    private sealed record CheckDescription(string Kind, long Minute, bool Pending);
}
