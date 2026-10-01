using System.Text.Json;
using System.Text.Json.Nodes;
using MasterCompanion.Contracts;
using MasterCompanion.Modules.Ythryn.Gameplay;

namespace MasterCompanion.Gameplay.Tests;

public static class RulesTests
{
    private static readonly YthrynGameRules Rules = new();
    private static readonly Guid FirstId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid SecondId = Guid.Parse("10000000-0000-0000-0000-000000000002");

    public static void Run()
    {
        var cases = new Action[]
        {
            InitialAndUnconfiguredStates, ExposureDeadline, MultipleOverdueExposures,
            InfectionRevealsOverdueRest, IndependentCharacterResults, ValidRecoveryDice,
            RecoveryGrantsImmunity, RecoverySuccessRetainsFailures, ThirdFailureTransforms, HealingRestartsExposure,
            RejectMalformedCommands, RejectInappropriateDice, RejectEarlyAndTerminalChecks,
            RejectCorruptStates, RestMustFollowInfection, NeutralChangesPreserveRules,
            PartyChangesPreserveExistingCharacterState, AddedCharactersStartAtCurrentTime,
            ShortRestDoesNotScheduleRecovery
        };
        foreach (var test in cases) test();
        Console.WriteLine($"Arcane Blight rules: {cases.Length} cases passed.");
    }

    private static void InitialAndUnconfiguredStates()
    {
        var party = Array.Empty<GameCharacter>();
        var empty = new GameSnapshot(0, party, [], 1, Rules.Initialize(party));
        Rules.Validate(empty);
        Assert(Rules.Describe(empty).GetProperty("characters").GetArrayLength() == 0, "Unconfigured state must be readable.");
        var initial = Initial();
        Assert(Character(initial).GetProperty("status").GetString() == "healthy", "New characters must be healthy.");
        Assert(Character(initial).GetProperty("dc").GetInt32() == 15, "Initial DC must be 15.");
        Assert(Check(initial).GetProperty("minute").GetInt64() == 720, "First exposure must be at 720 minutes.");
    }

    private static void ExposureDeadline()
    {
        var before = At(Initial(), 719);
        Assert(!Check(before).GetProperty("pending").GetBoolean(), "Exposure must not be pending before 12 hours.");
        AssertError(before, Resolve(true), "game_check_not_due");
        var due = At(before, 720);
        Assert(Check(due).GetProperty("pending").GetBoolean(), "Exposure must be pending at exactly 12 hours.");
        var result = Apply(due, Resolve(true));
        Assert(Check(result).GetProperty("minute").GetInt64() == 1440, "Exposure success must schedule the next 12-hour interval.");
    }

    private static void MultipleOverdueExposures()
    {
        var state = At(Initial(), 2160);
        foreach (var expected in new long[] { 720, 1440, 2160 })
        {
            Assert(Check(state).GetProperty("minute").GetInt64() == expected, "Overdue exposures must resolve in deadline order.");
            state = Apply(state, Resolve(true));
            Assert(state.TimeMinutes == 2160, "Resolution must preserve engine time.");
        }
        Assert(Check(state).GetProperty("minute").GetInt64() == 2880, "All overdue exposures must remain resolvable.");
        Assert(!Check(state).GetProperty("pending").GetBoolean(), "Future exposure must not be pending.");
    }

    private static void InfectionRevealsOverdueRest()
    {
        var state = At(Initial(), 600);
        state = Rest(state, 1080);
        state = Apply(state, Resolve(false));
        Assert(StoredCharacter(state).GetProperty("infectedAt").GetInt64() == 720, "Infection must be dated at its exposure deadline.");
        Assert(Character(state).GetProperty("failures").GetInt32() == 0, "Exposure failure must not count as a recovery failure.");
        Assert(Check(state).GetProperty("kind").GetString() == "rest", "Overdue rest must appear after infection.");
        Assert(Check(state).GetProperty("minute").GetInt64() == 1080, "The known rest deadline must be preserved.");
        state = Apply(state, Resolve(true, 6));
        Assert(Character(state).GetProperty("dc").GetInt32() == 9, "Successful recovery must subtract d6 from DC.");
        Assert(Character(state).GetProperty("nextCheck").ValueKind == JsonValueKind.Null, "The same rest must not be processed twice.");
    }

    private static void IndependentCharacterResults()
    {
        var state = Rest(Initial(), 1080);
        state = Apply(state, Resolve(false));
        Assert(Character(state, SecondId).GetProperty("status").GetString() == "healthy", "One character's infection must not affect another.");
        Assert(Check(state, SecondId).GetProperty("kind").GetString() == "exposure", "Other character must retain the overdue exposure.");
        state = Apply(state, Resolve(true, null, SecondId));
        Assert(Check(state, FirstId).GetProperty("kind").GetString() == "rest", "Resolving another character must preserve the first character's pending rest.");
    }

    private static void ValidRecoveryDice()
    {
        for (var die = 1; die <= 6; die++)
        {
            var infected = Apply(Rest(Initial(), 1080), Resolve(false));
            var result = Apply(infected, Resolve(true, die));
            Assert(Character(result).GetProperty("dc").GetInt32() == 15 - die, "Every d6 face from one through six must be accepted.");
        }
    }

    private static void RecoveryGrantsImmunity()
    {
        foreach (var finalDie in new[] { 3, 6 })
        {
            var state = Apply(Rest(Initial(), 1080), Resolve(false));
            state = Apply(state, Resolve(true, 6));
            state = Apply(Rest(state, 1560), Resolve(true, 6));
            state = Apply(Rest(state, 2040), Resolve(true, finalDie));
            Assert(Character(state).GetProperty("status").GetString() == "immune", "DC reaching or passing zero must grant immunity.");
            Assert(Character(state).GetProperty("dc").GetInt32() == 0, "Immune DC must be clamped to zero.");
            state = Rest(state, 2520);
            Assert(Character(state).GetProperty("nextCheck").ValueKind == JsonValueKind.Null, "Immune characters must have no further checks.");
            AssertError(state, Heal(), "game_character_not_infected");
        }
    }

    private static void ThirdFailureTransforms()
    {
        var state = Apply(Rest(Initial(), 1080), Resolve(false));
        for (var failure = 1; failure <= 3; failure++)
        {
            if (failure > 1) state = Rest(state, state.TimeMinutes + 480);
            state = Apply(state, Resolve(false));
            Assert(Character(state).GetProperty("failures").GetInt32() == failure, "Recovery failures must accumulate.");
            Assert(Character(state).GetProperty("status").GetString() == (failure == 3 ? "transformed" : "infected"),
                "Transformation must occur only on the third recovery failure.");
        }
        Assert(Character(state).GetProperty("nextCheck").ValueKind == JsonValueKind.Null, "Transformed characters must have no further checks.");
        AssertError(state, Heal(), "game_character_not_infected");
    }

    private static void RecoverySuccessRetainsFailures()
    {
        var state = Apply(Rest(Initial(), 1080), Resolve(false));
        state = Apply(state, Resolve(false));
        state = Apply(Rest(state, 1560), Resolve(true, 6));
        Assert(Character(state).GetProperty("failures").GetInt32() == 1, "Recovery success must preserve previous failures.");
        state = Apply(Rest(state, 2040), Resolve(false));
        state = Apply(Rest(state, 2520), Resolve(false));
        Assert(Character(state).GetProperty("status").GetString() == "transformed", "Interleaved successes must not reset the third-failure threshold.");
    }

    private static void HealingRestartsExposure()
    {
        var state = Apply(Rest(Initial(), 1080), Resolve(false));
        state = Apply(state, Resolve(false));
        state = Apply(state, Heal());
        Assert(Character(state).GetProperty("status").GetString() == "healthy", "Magic healing must restore health without immunity.");
        Assert(Character(state).GetProperty("failures").GetInt32() == 0, "Healing must reset failures.");
        Assert(Check(state).GetProperty("minute").GetInt64() == 1800, "Healing must restart exposure from current engine time.");
        AssertError(state, Heal(), "game_character_not_infected");
        state = Apply(At(state, 1800), Resolve(false));
        Assert(StoredCharacter(state).GetProperty("infectedAt").GetInt64() == 1800, "Healing must not prevent later infection.");
    }

    private static void RejectMalformedCommands()
    {
        var state = At(Initial(), 720);
        var id = FirstId.ToString();
        string[] commands =
        [
            "null", "[]", "{}", "{\"kind\":\"unknown\"}",
            $"{{\"kind\":\"resolveCheck\",\"characterId\":\"{id}\",\"success\":true,\"extra\":0}}",
            $"{{\"kind\":\"resolveCheck\",\"kind\":\"resolveCheck\",\"characterId\":\"{id}\",\"success\":true}}",
            $"{{\"kind\":\"resolveCheck\",\"characterId\":\"{id}\",\"success\":\"true\"}}",
            $"{{\"kind\":\"resolveCheck\",\"characterId\":\"{id}\"}}",
            "{\"kind\":\"healCharacter\",\"characterId\":\"invalid\"}",
            $"{{\"kind\":\"healCharacter\",\"characterId\":\"{id}\",\"success\":true}}"
        ];
        foreach (var json in commands) AssertError(state, Json(json), "invalid_module_command");
        AssertError(state, Resolve(true, null, Guid.Parse("20000000-0000-0000-0000-000000000001")), "game_character_not_found");
    }

    private static void RejectInappropriateDice()
    {
        var exposed = At(Initial(), 1080);
        AssertError(exposed, Resolve(true, 1), "invalid_module_command");
        AssertError(exposed, Resolve(false, 1), "invalid_module_command");
        var infected = Apply(Rest(Initial(), 1080), Resolve(false));
        AssertError(infected, Resolve(true), "invalid_module_command");
        AssertError(infected, Resolve(false, 1), "invalid_module_command");
        foreach (var die in new[] { 0, 7, -1 }) AssertError(infected, Resolve(true, die), "invalid_module_command");
        AssertError(infected, Json($"{{\"kind\":\"resolveCheck\",\"characterId\":\"{FirstId}\",\"success\":true,\"d6\":1.5}}"), "invalid_module_command");
    }

    private static void RejectEarlyAndTerminalChecks()
    {
        var infected = Apply(At(Initial(), 720), Resolve(false));
        AssertError(infected, Resolve(true, 1), "game_check_not_due");
        var immune = Apply(Rest(infected, 1200), Resolve(true, 6));
        immune = Apply(Rest(immune, 1680), Resolve(true, 6));
        immune = Apply(Rest(immune, 2160), Resolve(true, 3));
        AssertError(immune, Resolve(false), "game_check_not_due");
    }

    private static void RejectCorruptStates()
    {
        var initial = Initial();
        AssertCorrupt(initial with { ModuleSchemaVersion = 2 });
        AssertCorrupt(initial with { TimeMinutes = -1 });
        AssertCorrupt(initial with { TimeMinutes = GameLimits.MaxTimeMinutes + 1 });
        AssertCorrupt(initial with { ModuleState = Json("null") });
        AssertCorrupt(initial with { ModuleState = Json("{\"characters\":null}") });
        AssertCorrupt(initial with { ModuleState = Json("{\"characters\":[]}") });
        AssertCorrupt(initial with { ModuleState = Json("{\"characters\":[],\"extra\":0}") });
        AssertCorrupt(initial with { Party = [new GameCharacter(FirstId, "A"), new GameCharacter(FirstId, "B")] });
        AssertCorrupt(initial with { RestEnds = [1] });
        AssertCorrupt(initial with { TimeMinutes = 10, RestEnds = [5, 5] });
        foreach (var (field, value) in new (string, JsonNode?)[]
        {
            ("id", JsonValue.Create(SecondId)), ("status", JsonValue.Create("unknown")),
            ("dc", JsonValue.Create(14)), ("failures", JsonValue.Create(1)),
            ("nextExposure", JsonValue.Create(721)), ("nextExposure", null),
            ("infectedAt", JsonValue.Create(0)), ("lastResolvedRest", JsonValue.Create(0)),
            ("extra", JsonValue.Create(true))
        })
        {
            AssertCorrupt(Mutate(initial, field, value));
        }
        var infected = Apply(Rest(initial, 1080), Resolve(false));
        AssertCorrupt(Mutate(infected, "dc", JsonValue.Create(14)));
        AssertCorrupt(Mutate(infected, "lastResolvedRest", JsonValue.Create(900)));
        AssertCorrupt(Mutate(infected, "failures", JsonValue.Create(3)));
        var missingField = JsonNode.Parse(initial.ModuleState.GetRawText()) as JsonObject
            ?? throw new InvalidOperationException("Test state must be an object.");
        var missingCharacters = missingField["characters"] as JsonArray
            ?? throw new InvalidOperationException("Test characters must be an array.");
        var missingCharacter = missingCharacters[0] as JsonObject
            ?? throw new InvalidOperationException("Test character must be an object.");
        missingCharacter.Remove("lastResolvedRest");
        AssertCorrupt(initial with { ModuleState = Json(missingField.ToJsonString()) });
    }

    private static void RestMustFollowInfection()
    {
        var state = Apply(Rest(Initial(), 720), Resolve(false));
        Assert(Character(state).GetProperty("nextCheck").ValueKind == JsonValueKind.Null, "Rest at the infection instant must not count as recovery after infection.");
        state = Rest(state, 1200);
        Assert(Check(state).GetProperty("minute").GetInt64() == 1200, "Recovery must use the first rest after infection.");
    }

    private static void NeutralChangesPreserveRules()
    {
        var state = Apply(Rest(Initial(), 1080), Resolve(false));
        var before = state.ModuleState.GetRawText();
        state = Rest(state, 1560);
        Assert(state.ModuleState.GetRawText() == before, "Time and rest changes must preserve module state until an explicit outcome.");
        state = Apply(state, Resolve(false));
        Assert(Check(state).GetProperty("minute").GetInt64() == 1560, "Resolving the earliest rest must reveal the next overdue rest.");
    }

    private static void PartyChangesPreserveExistingCharacterState()
    {
        var before = Apply(Rest(Initial(), 1080), Resolve(false));
        before = Apply(before, Resolve(true, 6));
        var proposed = before with
        {
            Party = [new(SecondId, "Renamed second"), new(FirstId, "Renamed first")]
        };
        var transition = Rules.ReconcileParty(before, proposed);
        Assert(transition.ErrorCode is null, "A valid party edit must succeed.");
        var renamed = proposed with { ModuleState = transition.State };
        Rules.Validate(renamed);
        foreach (var id in new[] { FirstId, SecondId })
            Assert(JsonElement.DeepEquals(StoredCharacter(before, id), StoredCharacter(renamed, id)),
                "Renaming and reordering must retain every stored character field by stable identity.");
        Assert(Character(renamed).GetProperty("dc").GetInt32() == 9,
            "A renamed infected character must retain its recovery DC.");

        var removed = renamed with { Party = [renamed.Party[0]] };
        removed = removed with { ModuleState = Rules.ReconcileParty(renamed, removed).State };
        Rules.Validate(removed);
        Assert(removed.ModuleState.GetProperty("characters").GetArrayLength() == 1 &&
            JsonElement.DeepEquals(StoredCharacter(before, SecondId), StoredCharacter(removed, SecondId)),
            "Removing one member must remove only that member's module state.");
    }

    private static void AddedCharactersStartAtCurrentTime()
    {
        var before = Rest(Initial(), 1560);
        var newId = Guid.Parse("10000000-0000-0000-0000-000000000003");
        var proposed = before with { Party = [.. before.Party, new(newId, "New arrival")] };
        var added = proposed with { ModuleState = Rules.ReconcileParty(before, proposed).State };
        Rules.Validate(added);
        Assert(Check(added, newId).GetProperty("minute").GetInt64() == 2280 &&
            !Check(added, newId).GetProperty("pending").GetBoolean(),
            "A new party member's first exposure must be twelve hours after joining, without inherited overdue checks.");
        Assert(JsonElement.DeepEquals(StoredCharacter(before), StoredCharacter(added)),
            "Adding a member must preserve existing overdue checks.");
        var empty = added with { Party = [] };
        empty = empty with { ModuleState = Rules.ReconcileParty(added, empty).State };
        Rules.Validate(empty);
        Assert(empty.TimeMinutes == 1560 && empty.RestEnds.SequenceEqual([1560L]) &&
            Rules.Describe(empty).GetProperty("characters").GetArrayLength() == 0,
            "An empty roster must remain valid without resetting its clock or rest history.");
        var rejoined = empty with { Party = [new(FirstId, "Returned member")] };
        rejoined = rejoined with { ModuleState = Rules.ReconcileParty(empty, rejoined).State };
        Assert(Check(rejoined).GetProperty("minute").GetInt64() == 2280,
            "Rejoining after removal must initialize a new current-time state; undo is the operation that restores removed state.");
    }

    private static void ShortRestDoesNotScheduleRecovery()
    {
        var infected = Apply(At(Initial(), 720), Resolve(false));
        var afterShortRest = At(infected, 780);
        Assert(afterShortRest.RestEnds.Count == 0 &&
            Character(afterShortRest).GetProperty("nextCheck").ValueKind == JsonValueKind.Null &&
            JsonElement.DeepEquals(infected.ModuleState, afterShortRest.ModuleState),
            "An hour without a completed long rest must not create an Arcane Blight recovery check or alter infection.");
        var longRest = Rest(afterShortRest, 1260);
        Assert(Check(longRest).GetProperty("minute").GetInt64() == 1260,
            "The next completed long rest must still schedule recovery after a short rest.");
    }

    private static GameSnapshot Initial()
    {
        GameCharacter[] party = [new(FirstId, "First"), new(SecondId, "Second")];
        return new GameSnapshot(0, party, [], 1, Rules.Initialize(party));
    }

    private static GameSnapshot At(GameSnapshot state, long minute)
    {
        var proposed = state with { TimeMinutes = minute };
        return proposed with { ModuleState = Rules.Transition(state, proposed, null).State };
    }

    private static GameSnapshot Rest(GameSnapshot state, long minute)
    {
        var proposed = state with { TimeMinutes = minute, RestEnds = state.RestEnds.Append(minute).ToArray() };
        return proposed with { ModuleState = Rules.Transition(state, proposed, null).State };
    }

    private static GameSnapshot Apply(GameSnapshot state, JsonElement command)
    {
        var transition = Rules.Transition(state, state, command);
        Assert(transition.ErrorCode is null, $"Expected accepted command, received {transition.ErrorCode}.");
        var result = state with { ModuleState = transition.State };
        Rules.Validate(result);
        return result;
    }

    private static JsonElement Resolve(bool success, int? die = null, Guid? id = null) => die is int d6
        ? JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = id ?? FirstId, success, d6 })
        : JsonSerializer.SerializeToElement(new { kind = "resolveCheck", characterId = id ?? FirstId, success });
    private static JsonElement Heal() => JsonSerializer.SerializeToElement(new { kind = "healCharacter", characterId = FirstId });
    private static JsonElement Character(GameSnapshot state, Guid? id = null) => Rules.Describe(state).GetProperty("characters")
        .EnumerateArray().Single(character => character.GetProperty("id").GetGuid() == (id ?? FirstId));
    private static JsonElement StoredCharacter(GameSnapshot state, Guid? id = null) => state.ModuleState.GetProperty("characters")
        .EnumerateArray().Single(character => character.GetProperty("id").GetGuid() == (id ?? FirstId));
    private static JsonElement Check(GameSnapshot state, Guid? id = null) => Character(state, id).GetProperty("nextCheck");
    private static JsonElement Json(string json) => JsonSerializer.Deserialize<JsonElement>(json);

    private static GameSnapshot Mutate(GameSnapshot state, string field, JsonNode? value)
    {
        var root = JsonNode.Parse(state.ModuleState.GetRawText()) as JsonObject
            ?? throw new InvalidOperationException("Test state must be an object.");
        var characters = root["characters"] as JsonArray
            ?? throw new InvalidOperationException("Test characters must be an array.");
        var character = characters[0] as JsonObject
            ?? throw new InvalidOperationException("Test character must be an object.");
        character[field] = value;
        return state with { ModuleState = Json(root.ToJsonString()) };
    }

    private static void AssertError(GameSnapshot state, JsonElement command, string code)
    {
        var transition = Rules.Transition(state, state, command);
        Assert(transition.ErrorCode == code, $"Expected {code}, received {transition.ErrorCode}.");
        Assert(transition.State.GetRawText() == state.ModuleState.GetRawText(), "Rejected command must preserve the entire state.");
    }

    private static void AssertCorrupt(GameSnapshot state)
    {
        try { Rules.Validate(state); }
        catch (InvalidOperationException) { return; }
        throw new InvalidOperationException("Corrupt state must be rejected without resetting it.");
    }

    private static void Assert(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }
}
