using System.Text.Json;
using System.Text.Json.Serialization;
using MasterCompanion.Contracts;

namespace MasterCompanion.Modules.Ythryn.Gameplay;

internal sealed record EncounterCheck(long Id, string Kind, long Minute);
internal sealed record EncounterResult(EncounterCheck Check, int Roll, string Outcome);
internal sealed record EncounterBand(int Min, int Max, string Outcome);
internal sealed record ExpeditionState(bool AurilEnabled,
    long? AvariceArrivedAt, long? AurilArrivedAt, long ExplorationMinutes, long NextId,
    EncounterCheck[] Pending, EncounterResult? LastResult);
internal sealed record ExpeditionTransition(ExpeditionState State, string? ErrorCode = null);

internal static class ExpeditionRules
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
    private const int MaxPending = 240;
    internal static ExpeditionState Initialize() => new(true, null, null, 0, 1, [], null);

    internal static bool Handles(JsonElement command) => command.ValueKind == JsonValueKind.Object &&
        command.TryGetProperty("kind", out var kind) && kind.ValueKind == JsonValueKind.String &&
        kind.GetString() is "configureExpedition" or "explore" or "searchBuilding" or "confirmArrival" or "resolveEncounter";

    internal static ExpeditionTransition Apply(ExpeditionState state, GameSnapshot before, GameSnapshot after, JsonElement command)
    {
        var elapsed = after.TimeMinutes - before.TimeMinutes;
        var kind = command.GetProperty("kind").GetString();
        ExpeditionTransition Reject(string code = "invalid_module_command") => new(state, code);
        if (kind == "configureExpedition")
        {
            if (elapsed != 0 || !Fields(command, "kind", "aurilEnabled") ||
                !Boolean(command, "aurilEnabled", out var enabled)) return Reject();
            if (state.AurilArrivedAt is not null && !enabled) return Reject("game_arrival_already_confirmed");
            return new(state with { AurilEnabled = enabled });
        }
        if (kind == "confirmArrival")
        {
            if (elapsed != 0 || !Fields(command, "kind", "faction", "minute") ||
                !Number(command, "minute", 0, after.TimeMinutes, out var minute) ||
                !command.TryGetProperty("faction", out var faction) || faction.ValueKind != JsonValueKind.String)
                return Reject();
            return faction.GetString() switch
            {
                "avarice" when state.AvariceArrivedAt is null => new(state with { AvariceArrivedAt = minute }),
                "auril" when state.AurilEnabled && state.AurilArrivedAt is null => new(state with { AurilArrivedAt = minute }),
                "avarice" or "auril" => Reject("game_arrival_already_confirmed"),
                _ => Reject()
            };
        }
        if (kind == "resolveEncounter")
        {
            if (elapsed != 0 || !Fields(command, "kind", "checkId", "roll") ||
                !Number(command, "checkId", 1, GameLimits.MaxTimeMinutes, out var id) ||
                !Number(command, "roll", 1, 100, out var roll)) return Reject();
            var check = state.Pending.FirstOrDefault();
            if (check is null || check.Id != id) return Reject("game_encounter_not_due");
            // Confirmation can be backdated before resolving an overdue roll. Deadlines never imply arrival.
            var outcome = Outcome(check, (int)roll, state);
            return new(state with { Pending = state.Pending.Skip(1).ToArray(), LastResult = new(check, (int)roll, outcome) });
        }
        var search = kind == "searchBuilding";
        bool unnumbered = false, newBuilding = false;
        if (search)
        {
            if (elapsed != 30 || !Fields(command, "kind", "unnumbered", "newBuilding") ||
                !Boolean(command, "unnumbered", out unnumbered) || !Boolean(command, "newBuilding", out newBuilding)) return Reject();
        }
        else if (kind != "explore" || elapsed is < 1 or > 1440 || !Fields(command, "kind")) return Reject();
        var pending = state.Pending.ToList();
        var nextId = state.NextId;
        var total = checked(state.ExplorationMinutes + elapsed);
        for (var offset = 60 - state.ExplorationMinutes % 60; offset <= elapsed; offset += 60)
            pending.Add(new(nextId++, "hourly", before.TimeMinutes + offset));
        if (search && unnumbered) pending.Add(new(nextId++, "building", after.TimeMinutes));
        if (search && newBuilding && state.AvariceArrivedAt is long arrival && arrival <= after.TimeMinutes)
            pending.Add(new(nextId++, "avaricePatrol", after.TimeMinutes));
        if (pending.Count > MaxPending) return Reject("game_encounter_queue_full");
        return new(state with { ExplorationMinutes = total, NextId = nextId, Pending = pending.ToArray() });
    }

    internal static object Describe(ExpeditionState state, GameSnapshot snapshot) => new
    {
        state.AurilEnabled,
        state.ExplorationMinutes, state.Pending, state.LastResult,
        pendingTable = state.Pending.FirstOrDefault() is { } check ? Table(check, state) : null,
        nextHourlyIn = 60 - state.ExplorationMinutes % 60,
        avarice = Arrival(snapshot.RestEnds.Count == 0 ? null : snapshot.RestEnds[0], state.AvariceArrivedAt, snapshot.TimeMinutes, true),
        auril = Arrival(1440, state.AurilArrivedAt, snapshot.TimeMinutes, state.AurilEnabled)
    };

    private static object Arrival(long? deadline, long? arrivedAt, long minute, bool enabled) => new
    { deadline, arrivedAt, enabled, remainingMinutes = deadline is long due ? Math.Max(0, due - minute) : (long?)null,
        pending = enabled && arrivedAt is null && deadline is long at && minute >= at };

    private static string Outcome(EncounterCheck check, int roll, ExpeditionState state)
    {
        if (check.Kind == "avaricePatrol") return roll <= 20 ? "avaricePatrol" : "none";
        return roll switch
        {
            <= 50 => "none",
            <= 55 => "tombTapper",
            <= 60 => state.AvariceArrivedAt <= check.Minute ? "cultFanatics" : "livingHands",
            <= 65 => state.AurilArrivedAt <= check.Minute ? "coldlightWalkers" : "spittingMimics",
            <= 70 => state.AurilArrivedAt <= check.Minute ? "frostGiantPatrol" : "gargoyles",
            <= 75 => "galvanPatrol",
            <= 80 => "hypnosPatrol",
            <= 90 => "nothics",
            _ => "iriolarthas"
        };
    }

    // Preview and confirmation share the same rules, including the original check's arrival chronology.
    private static EncounterBand[] Table(EncounterCheck check, ExpeditionState state)
    {
        var bands = new List<EncounterBand>();
        var min = 1;
        var outcome = Outcome(check, min, state);
        for (var roll = 2; roll <= 100; roll++)
        {
            var next = Outcome(check, roll, state);
            if (next == outcome) continue;
            bands.Add(new(min, roll - 1, outcome));
            min = roll;
            outcome = next;
        }
        bands.Add(new(min, 100, outcome));
        return bands.ToArray();
    }

    internal static void Validate(ExpeditionState state, long minute)
    {
        bool ValidArrival(long? arrival) => arrival is null || arrival >= 0 && arrival <= minute;
        if (!ValidArrival(state.AvariceArrivedAt) ||
            !ValidArrival(state.AurilArrivedAt) || (!state.AurilEnabled && state.AurilArrivedAt is not null) ||
            state.ExplorationMinutes < 0 || state.ExplorationMinutes > minute ||
            state.NextId is < 1 or > GameLimits.MaxTimeMinutes || state.Pending is null || state.Pending.Length > MaxPending)
            throw new InvalidOperationException("Invalid Ythryn expedition state.");
        long previousId = 0, previousMinute = 0;
        foreach (var check in state.Pending)
        {
            if (check is null || check.Id <= previousId || check.Id >= state.NextId || check.Minute < previousMinute ||
                check.Minute < 1 || check.Minute > minute || check.Kind is not ("hourly" or "building" or "avaricePatrol"))
                throw new InvalidOperationException("Invalid pending encounter sequence.");
            previousId = check.Id; previousMinute = check.Minute;
        }
        if (state.LastResult is { } result && (result.Check is null || result.Check.Id < 1 || result.Check.Id >= state.NextId ||
            result.Check.Minute < 1 || result.Check.Minute > minute || result.Roll is < 1 or > 100 ||
            result.Check.Kind is not ("hourly" or "building" or "avaricePatrol") ||
            result.Outcome is not ("none" or "tombTapper" or "livingHands" or "cultFanatics" or "spittingMimics" or
                "coldlightWalkers" or "gargoyles" or "frostGiantPatrol" or "galvanPatrol" or "hypnosPatrol" or "nothics" or "iriolarthas" or "avaricePatrol") ||
            (state.Pending.Length > 0 && result.Check.Id >= state.Pending[0].Id)))
            throw new InvalidOperationException("Invalid resolved encounter.");
    }

    private static bool Fields(JsonElement element, params string[] names)
    {
        var remaining = names.ToHashSet(StringComparer.Ordinal);
        foreach (var property in element.EnumerateObject()) if (!remaining.Remove(property.Name)) return false;
        return remaining.Count == 0;
    }
    private static bool Number(JsonElement element, string name, long min, long max, out long number)
    {
        number = 0;
        return element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number &&
            value.TryGetInt64(out number) && number >= min && number <= max;
    }
    private static bool Boolean(JsonElement element, string name, out bool result)
    {
        result = false;
        if (!element.TryGetProperty(name, out var value) || value.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return false;
        result = value.GetBoolean(); return true;
    }
}
