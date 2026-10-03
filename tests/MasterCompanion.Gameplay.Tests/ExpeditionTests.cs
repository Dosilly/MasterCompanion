using System.Text.Json;
using System.Text.Json.Nodes;
using MasterCompanion.Contracts;
using MasterCompanion.Modules.Ythryn.Gameplay;

namespace MasterCompanion.Gameplay.Tests;

public static class ExpeditionTests
{
    private static readonly YthrynGameRules Rules = new();
    public static void Run()
    {
        var cases = new Action[] { ExplorationAndSearch, RestAndArrivalDeadlines, ArrivalReplacements,
            TableBoundaries, PatrolChance, StrictCommandsAndQueueBounds, UpgradePreservesCurrentState, RosterPreservesExpedition,
            RejectCorruptExpeditionState, PreviewMatchesConfirmation };
        foreach (var test in cases) test();
        Console.WriteLine($"Ythryn expedition rules: {cases.Length} cases passed.");
    }
    private static GameSnapshot Initial()
    {
        GameCharacter[] party = [new(Guid.NewGuid(), "Preserved name")];
        return new(0, party, [], Rules.StateSchemaVersion, Rules.Initialize(party));
    }
    private static GameSnapshot Apply(GameSnapshot before, object command, long minutes = 0)
    {
        var proposed = before with { TimeMinutes = before.TimeMinutes + minutes };
        var result = Rules.Transition(before, proposed, JsonSerializer.SerializeToElement(command));
        Require(result.ErrorCode is null, $"Expected accepted expedition command, received {result.ErrorCode}.");
        var after = proposed with { ModuleState = result.State };
        Rules.Validate(after); return after;
    }
    private static JsonElement View(GameSnapshot snapshot) => Rules.Describe(snapshot).GetProperty("expedition");
    private static JsonElement Queue(GameSnapshot snapshot) => View(snapshot).GetProperty("pending");
    private static GameSnapshot Roll(GameSnapshot state, int roll) => Apply(state, new
    { kind = "resolveEncounter", checkId = Queue(state)[0].GetProperty("id").GetInt64(), roll });
    private static string? Outcome(GameSnapshot state) => View(state).GetProperty("lastResult").GetProperty("outcome").GetString();
    private static void ExplorationAndSearch()
    {
        var state = Apply(Initial(), new { kind = "explore" }, 29);
        Require(Queue(state).GetArrayLength() == 0, "Partial exploration must carry into later activities.");
        state = Apply(state, new { kind = "searchBuilding", unnumbered = true, newBuilding = true }, 30);
        Require(Queue(state).GetArrayLength() == 1 && Queue(state)[0].GetProperty("kind").GetString() == "building",
            "An unnumbered search must add its own check independently of the hourly interval.");
        state = Apply(state, new { kind = "explore" }, 121);
        Require(Queue(state).GetArrayLength() == 4 && Queue(state).EnumerateArray().Select(x => x.GetProperty("minute").GetInt64()).SequenceEqual([59L, 60L, 120L, 180L]),
            "Large exploration advances must retain every due occurrence at its original game minute.");
        state = Roll(state, 50);
        Require(Outcome(state) == "none" && Queue(state).GetArrayLength() == 3 && state.TimeMinutes == 180,
            "Resolving must remove only the oldest check without changing time.");
        state = Apply(Initial(), new { kind = "explore" }, 30);
        state = Apply(state, new { kind = "searchBuilding", unnumbered = true, newBuilding = false }, 30);
        Require(Queue(state).EnumerateArray().Select(x => x.GetProperty("kind").GetString()).SequenceEqual(["hourly", "building"]),
            "A search crossing an hour must create both checks in deterministic order.");
        var numbered = Apply(Initial(), new { kind = "searchBuilding", unnumbered = false, newBuilding = true }, 30);
        Require(Queue(numbered).GetArrayLength() == 0, "Numbered locations must not receive the unnumbered-building check.");
    }
    private static void RestAndArrivalDeadlines()
    {
        var state = Initial();
        Require(View(state).GetProperty("avarice").GetProperty("deadline").ValueKind == JsonValueKind.Null,
            "Avarice must wait for the first long rest, not for an invented time deadline.");
        state = state with { TimeMinutes = 479 };
        Require(!View(state).GetProperty("avarice").GetProperty("pending").GetBoolean(), "Clock advances cannot imply a long rest.");
        state = state with { TimeMinutes = 959, RestEnds = [959L] };
        Rules.Validate(state);
        Require(View(state).GetProperty("avarice").GetProperty("pending").GetBoolean() && Queue(state).GetArrayLength() == 0,
            "The first long rest must remind Avarice without generating exploration rolls or assuming arrival.");
        state = state with { TimeMinutes = 1439 };
        Require(!View(state).GetProperty("auril").GetProperty("pending").GetBoolean(), "Auril is not due at 23h59m.");
        state = state with { TimeMinutes = 1440, RestEnds = [959L, 1440L] };
        Require(View(state).GetProperty("auril").GetProperty("pending").GetBoolean() &&
            View(state).GetProperty("avarice").GetProperty("deadline").GetInt64() == 959,
            "Auril is due at exactly 24 hours; later rests must not move Avarice's first deadline.");
        state = Apply(state, new { kind = "configureExpedition", aurilEnabled = false });
        Require(!View(state).GetProperty("auril").GetProperty("pending").GetBoolean(), "Defeated Auril must be explicitly disableable.");
    }
    private static void ArrivalReplacements()
    {
        var state = Apply(Initial(), new { kind = "explore" }, 180);
        state = Apply(state, new { kind = "confirmArrival", faction = "avarice", minute = 120 });
        var first = Roll(state, 56);
        Require(Outcome(first) == "livingHands", "A later arrival must not affect an earlier overdue encounter.");
        var second = Roll(first, 60);
        Require(Outcome(second) == "cultFanatics", "Confirmed arrival at the check minute must activate replacement.");
        state = Apply(second, new { kind = "confirmArrival", faction = "auril", minute = 180 });
        state = Roll(state, 65);
        Require(Outcome(state) == "coldlightWalkers", "Auril confirmation must independently activate her replacements.");
        Reject(state, new { kind = "confirmArrival", faction = "auril", minute = 180 });
        Reject(state, new { kind = "configureExpedition", aurilEnabled = false });
    }
    private static void TableBoundaries()
    {
        var bands = new (int, string)[] { (1,"none"),(50,"none"),(51,"tombTapper"),(55,"tombTapper"),
            (56,"livingHands"),(60,"livingHands"),(61,"spittingMimics"),(65,"spittingMimics"),(66,"gargoyles"),(70,"gargoyles"),
            (71,"galvanPatrol"),(75,"galvanPatrol"),(76,"hypnosPatrol"),(80,"hypnosPatrol"),(81,"nothics"),(90,"nothics"),(91,"iriolarthas"),(100,"iriolarthas") };
        foreach (var (roll, expected) in bands)
            Require(Outcome(Roll(Apply(Initial(), new { kind = "explore" }, 60), roll)) == expected, "Every table band must include its correct endpoints.");
        var state = Apply(Initial(), new { kind = "confirmArrival", faction = "auril", minute = 0 });
        Require(Outcome(Roll(Apply(state, new { kind = "explore" }, 60), 66)) == "frostGiantPatrol", "Auril replaces the gargoyle band independently.");
    }
    private static void PatrolChance()
    {
        var state = Apply(Initial(), new { kind = "confirmArrival", faction = "avarice", minute = 0 });
        var searched = Apply(state, new { kind = "searchBuilding", unnumbered = false, newBuilding = true }, 30);
        Require(Queue(searched).GetArrayLength() == 1 && Outcome(Roll(searched, 20)) == "avaricePatrol" && Outcome(Roll(searched, 21)) == "none",
            "A first building search must apply the separate 20% chance after actual arrival, including numbered locations.");
        var repeat = Apply(state, new { kind = "searchBuilding", unnumbered = false, newBuilding = false }, 30);
        Require(Queue(repeat).GetArrayLength() == 0, "Repeat searches must not create a new-building patrol roll.");
    }
    private static void PreviewMatchesConfirmation()
    {
        Require(View(Initial()).GetProperty("pendingTable").ValueKind == JsonValueKind.Null,
            "An empty queue must not offer a preview for an invented check.");
        var ordinary = Apply(Initial(), new { kind = "explore" }, 180);
        var laterArrival = Apply(ordinary, new { kind = "confirmArrival", faction = "avarice", minute = 120 });
        var replacement = Roll(laterArrival, 50);
        var bothArrivals = Apply(replacement, new { kind = "confirmArrival", faction = "auril", minute = 120 });
        var avarice = Apply(Initial(), new { kind = "confirmArrival", faction = "avarice", minute = 0 });
        var patrol = Apply(avarice, new { kind = "searchBuilding", unnumbered = false, newBuilding = true }, 30);
        foreach (var state in new[] { ordinary, laterArrival, replacement, bothArrivals, patrol })
        {
            var before = state.ModuleState.GetRawText();
            var table = View(state).GetProperty("pendingTable").EnumerateArray().ToArray();
            Require(table[0].GetProperty("min").GetInt32() == 1 && table[^1].GetProperty("max").GetInt32() == 100,
                "The preview table must cover every d100 result.");
            for (var roll = 1; roll <= 100; roll++)
            {
                var band = table.Single(row => row.GetProperty("min").GetInt32() <= roll && row.GetProperty("max").GetInt32() >= roll);
                Require(band.GetProperty("outcome").GetString() == Outcome(Roll(state, roll)),
                    "Preview and confirmation must agree for every roll, arrival chronology and patrol chance.");
            }
            Require(state.ModuleState.GetRawText() == before, "Reading or trying preview results must preserve confirmed state.");
        }
        Require(View(laterArrival).GetProperty("pendingTable")[2].GetProperty("outcome").GetString() == "livingHands" &&
            View(replacement).GetProperty("pendingTable")[2].GetProperty("outcome").GetString() == "cultFanatics",
            "Avarice preview replacements start at actual arrival, including backdated queued checks.");
        Require(View(bothArrivals).GetProperty("pendingTable")[3].GetProperty("outcome").GetString() == "coldlightWalkers" &&
            View(bothArrivals).GetProperty("pendingTable")[4].GetProperty("outcome").GetString() == "frostGiantPatrol",
            "Both Auril replacements must appear in the preview after actual arrival.");
    }
    private static void StrictCommandsAndQueueBounds()
    {
        var state = Initial();
        Reject(state, new { kind = "explore" }); Reject(state, new { kind = "explore", extra = 1 }, 60);
        Reject(state, new { kind = "searchBuilding", unnumbered = true, newBuilding = true }, 29);
        Reject(state, new { kind = "confirmArrival", faction = "other", minute = 0 });
        Reject(state, new { kind = "confirmArrival", faction = "auril", minute = 1 });
        Reject(state, new { kind = "configureExpedition", aurilEnabled = "false" });
        state = Apply(state, new { kind = "explore" }, 60);
        Reject(state, new { kind = "resolveEncounter", checkId = 1, roll = 0 });
        Reject(state, new { kind = "resolveEncounter", checkId = 1, roll = 101 });
        Reject(state, new { kind = "resolveEncounter", checkId = 2, roll = 50 });
        Reject(state, new { kind = "resolveEncounter", checkId = 1, roll = 50 }, 1);
        state = Initial(); for (var index = 0; index < 10; index++) state = Apply(state, new { kind = "explore" }, 1440);
        Require(Queue(state).GetArrayLength() == 240, "The bounded queue must preserve every accepted occurrence.");
        Reject(state, new { kind = "explore" }, 60);
        state = Roll(state, 50);
        Require(Queue(Apply(state, new { kind = "explore" }, 60)).GetArrayLength() == 240, "Resolving a check must free capacity without dropping old checks.");
    }
    private static void UpgradePreservesCurrentState()
    {
        var current = Initial() with { TimeMinutes = 1440, RestEnds = [1080L] };
        current = Apply(current, new { kind = "resolveCheck", characterId = current.Party[0].Id, success = false });
        current = Apply(current, new { kind = "resolveCheck", characterId = current.Party[0].Id, success = true, d6 = 4 });
        var node = JsonNode.Parse(current.ModuleState.GetRawText())?.AsObject() ?? throw new InvalidOperationException("Missing test state.");
        node.Remove("adventure");
        var old = current with { ModuleSchemaVersion = 2, ModuleState = JsonSerializer.SerializeToElement(node) };
        Rules.Validate(old);
        var before = old.ModuleState.GetRawText(); var upgraded = Rules.Upgrade(old);
        Require(JsonElement.DeepEquals(old.ModuleState.GetProperty("characters"), upgraded.ModuleState.GetProperty("characters")) &&
            upgraded.TimeMinutes == old.TimeMinutes && upgraded.RestEnds.SequenceEqual(old.RestEnds) && upgraded.Party.SequenceEqual(old.Party) &&
            Queue(upgraded).GetArrayLength() == 0 && View(upgraded).GetProperty("avarice").GetProperty("pending").GetBoolean() && old.ModuleState.GetRawText() == before,
            "Schema-two upgrades must preserve recovery history, names, time and rests without inventing historical exploration.");
        Require(!Rules.Describe(old).TryGetProperty("expedition", out _), "Historical schema-two receipts must retain their exact original projection.");
        Require(JsonElement.DeepEquals(upgraded.ModuleState, Rules.Upgrade(upgraded).ModuleState), "Expedition upgrade must be idempotent.");
    }
    private static void RosterPreservesExpedition()
    {
        var state = Apply(Initial(), new { kind = "explore" }, 90);
        var proposed = state with { Party = [] };
        var result = Rules.ReconcileParty(state, proposed);
        var changed = proposed with { ModuleState = result.State }; Rules.Validate(changed);
        Require(JsonElement.DeepEquals(state.ModuleState.GetProperty("adventure"), changed.ModuleState.GetProperty("adventure")), "Roster removal must preserve campaign encounter state.");
    }
    private static void RejectCorruptExpeditionState()
    {
        var snapshot = Apply(Initial(), new { kind = "explore" }, 90);
        var mutations = new Action<JsonObject>[]
        {
            state => state["adventure"] = null,
            state => state["adventure"]?.AsObject().Remove("aurilEnabled"),
            state => state["adventure"]?.AsObject().Add("unknown", true),
            state => state["adventure"]?.AsObject()["pending"] = null,
            state => state["adventure"]?.AsObject()["explorationMinutes"] = 91,
            state => state["adventure"]?.AsObject()["avariceArrivedAt"] = 91,
            state => state["adventure"]?.AsObject()["nextId"] = 1,
            state => state["adventure"]?["pending"]?[0]?.AsObject()["kind"] = "unknown"
        };
        foreach (var mutate in mutations)
        {
            var state = JsonNode.Parse(snapshot.ModuleState.GetRawText())?.AsObject() ?? throw new InvalidOperationException("Missing corruption fixture.");
            mutate(state);
            var failed = false;
            try { Rules.Validate(snapshot with { ModuleState = JsonSerializer.SerializeToElement(state) }); }
            catch (InvalidOperationException) { failed = true; }
            Require(failed, "Corrupt or unsupported expedition state must fail explicitly instead of being repaired silently.");
        }
        using var duplicate = JsonDocument.Parse("{\"kind\":\"explore\",\"kind\":\"explore\"}");
        var rejection = Rules.Transition(snapshot, snapshot with { TimeMinutes = 150 }, duplicate.RootElement);
        Require(rejection.ErrorCode == "invalid_module_command", "Duplicate module command fields must be rejected.");
    }
    private static void Reject(GameSnapshot state, object command, long minutes = 0)
    {
        var result = Rules.Transition(state, state with { TimeMinutes = state.TimeMinutes + minutes }, JsonSerializer.SerializeToElement(command));
        Require(result.ErrorCode is not null && JsonElement.DeepEquals(result.State, state.ModuleState), "Rejected commands must preserve confirmed expedition state.");
    }
    private static void Require(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); }
}
