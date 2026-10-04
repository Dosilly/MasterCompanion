using System.Text.Json;
using System.Text.Json.Nodes;
using MasterCompanion.Contracts;
using MasterCompanion.Modules.Ythryn.Gameplay;

namespace MasterCompanion.Gameplay.Tests.Unit;

public sealed class ExpeditionTests
{
    private static readonly YthrynGameRules Rules = new();
    private static GameSnapshot Initial()
    {
        GameCharacter[] party = [new(Guid.NewGuid(), "Preserved name")];
        return new(0, party, [], Rules.StateSchemaVersion, Rules.Initialize(party));
    }
    private static GameSnapshot Apply(GameSnapshot before, object command, long minutes = 0)
    {
        var proposed = before with { TimeMinutes = before.TimeMinutes + minutes };
        var result = Rules.Transition(before, proposed, JsonSerializer.SerializeToElement(command));
        Assert.True(result.ErrorCode is null, $"Expected accepted expedition command, received {result.ErrorCode}.");
        var after = proposed with { ModuleState = result.State };
        Rules.Validate(after); return after;
    }
    private static JsonElement View(GameSnapshot snapshot) => Rules.Describe(snapshot).GetProperty("expedition");
    private static JsonElement Queue(GameSnapshot snapshot) => View(snapshot).GetProperty("pending");
    private static GameSnapshot Roll(GameSnapshot state, int roll) => Apply(state, new
    { kind = "resolveEncounter", checkId = Queue(state)[0].GetProperty("id").GetInt64(), roll });
    private static string? Outcome(GameSnapshot state) => View(state).GetProperty("lastResult").GetProperty("outcome").GetString();

    [Fact]
    public void Explore_PartialHour_RetainsMinutesWithoutQueuingCheck()
    {

        // Act
        var state = Apply(Initial(), new { kind = "explore" }, 29);

        // Assert
        Assert.Equal(0, Queue(state).GetArrayLength());
    }

    [Fact]
    public void Search_UnnumberedBuilding_QueuesIndependentBuildingCheck()
    {
        // Arrange
        var state = Apply(Initial(), new { kind = "explore" }, 29);

        // Act
        state = Apply(state, new { kind = "searchBuilding", unnumbered = true, newBuilding = true }, 30);

        // Assert
        Assert.True(Queue(state).GetArrayLength() == 1 && Queue(state)[0].GetProperty("kind").GetString() == "building",
            "An unnumbered search must add its own check independently of the hourly interval.");
    }

    [Fact]
    public void Explore_SeveralHours_QueuesEveryOriginalDeadline()
    {
        // Arrange
        var state = Apply(Initial(), new { kind = "explore" }, 29);
        state = Apply(state, new { kind = "searchBuilding", unnumbered = true, newBuilding = true }, 30);

        // Act
        state = Apply(state, new { kind = "explore" }, 121);

        // Assert
        Assert.True(Queue(state).GetArrayLength() == 4 && Queue(state).EnumerateArray().Select(x => x.GetProperty("minute").GetInt64()).SequenceEqual([59L, 60L, 120L, 180L]),
            "Large exploration advances must retain every due occurrence at its original game minute.");
    }

    [Fact]
    public void ResolveEncounter_QueuedChecks_RemovesOnlyOldestWithoutAdvancingTime()
    {
        // Arrange
        var state = Apply(Initial(), new { kind = "explore" }, 29);
        state = Apply(state, new { kind = "searchBuilding", unnumbered = true, newBuilding = true }, 30);
        state = Apply(state, new { kind = "explore" }, 121);

        // Act
        state = Roll(state, 50);

        // Assert
        Assert.True(Outcome(state) == "none" && Queue(state).GetArrayLength() == 3 && state.TimeMinutes == 180,
            "Resolving must remove only the oldest check without changing time.");
    }

    [Fact]
    public void Search_CrossingHour_OrdersHourlyBeforeBuildingCheck()
    {
        // Arrange
        var state = Apply(Initial(), new { kind = "explore" }, 30);

        // Act
        state = Apply(state, new { kind = "searchBuilding", unnumbered = true, newBuilding = false }, 30);

        // Assert
        Assert.True(Queue(state).EnumerateArray().Select(x => x.GetProperty("kind").GetString()).SequenceEqual(["hourly", "building"]),
            "A search crossing an hour must create both checks in deterministic order.");
    }

    [Fact]
    public void Search_NumberedBuilding_DoesNotQueueUnnumberedCheck()
    {

        // Act
        var numbered = Apply(Initial(), new { kind = "searchBuilding", unnumbered = false, newBuilding = true }, 30);

        // Assert
        Assert.Equal(0, Queue(numbered).GetArrayLength());
    }

    [Fact]
    public void Describe_NoRest_DoesNotInventAvariceDeadline()
    {

        // Act
        var state = Initial();

        // Assert
        Assert.Equal(JsonValueKind.Null, View(state).GetProperty("avarice").GetProperty("deadline").ValueKind);
    }

    [Fact]
    public void Describe_TimeAdvance_DoesNotImplyLongRest()
    {
        // Arrange
        var state = Initial();

        // Act
        state = state with { TimeMinutes = 479 };

        // Assert
        Assert.True(!View(state).GetProperty("avarice").GetProperty("pending").GetBoolean(), "Clock advances cannot imply a long rest.");
    }

    [Fact]
    public void Describe_FirstLongRest_ShowsAvariceReminderWithoutEncounterRoll()
    {
        // Arrange
        var state = Initial();
        state = state with { TimeMinutes = 479 };

        // Act
        state = state with { TimeMinutes = 959, RestEnds = [959L] };

        // Assert
        Rules.Validate(state);
        Assert.True(View(state).GetProperty("avarice").GetProperty("pending").GetBoolean() && Queue(state).GetArrayLength() == 0,
            "The first long rest must remind Avarice without generating exploration rolls or assuming arrival.");
    }

    [Fact]
    public void Describe_BeforeTwentyFourHours_DoesNotShowAurilReminder()
    {
        // Arrange
        var state = Initial();
        state = state with { TimeMinutes = 479 };
        state = state with { TimeMinutes = 959, RestEnds = [959L] };

        // Act
        state = state with { TimeMinutes = 1439 };

        // Assert
        Assert.True(!View(state).GetProperty("auril").GetProperty("pending").GetBoolean(), "Auril is not due at 23h59m.");
    }

    [Fact]
    public void Describe_TwentyFourHours_ShowsAurilAndPreservesFirstRestDeadline()
    {
        // Arrange
        var state = Initial();
        state = state with { TimeMinutes = 479 };
        state = state with { TimeMinutes = 959, RestEnds = [959L] };
        state = state with { TimeMinutes = 1439 };

        // Act
        state = state with { TimeMinutes = 1440, RestEnds = [959L, 1440L] };

        // Assert
        Assert.True(View(state).GetProperty("auril").GetProperty("pending").GetBoolean() &&
            View(state).GetProperty("avarice").GetProperty("deadline").GetInt64() == 959,
            "Auril is due at exactly 24 hours; later rests must not move Avarice's first deadline.");
    }

    [Fact]
    public void ConfigureExpedition_DisabledAuril_HidesReminder()
    {
        // Arrange
        var state = Initial();
        state = state with { TimeMinutes = 479 };
        state = state with { TimeMinutes = 959, RestEnds = [959L] };
        state = state with { TimeMinutes = 1439 };
        state = state with { TimeMinutes = 1440, RestEnds = [959L, 1440L] };

        // Act
        state = Apply(state, new { kind = "configureExpedition", aurilEnabled = false });

        // Assert
        Assert.True(!View(state).GetProperty("auril").GetProperty("pending").GetBoolean(), "Defeated Auril must be explicitly disableable.");
    }

    [Fact]
    public void ResolveEncounter_BeforeAvariceArrival_UsesOriginalOutcome()
    {
        // Arrange
        var state = Apply(Initial(), new { kind = "explore" }, 180);
        state = Apply(state, new { kind = "confirmArrival", faction = "avarice", minute = 120 });

        // Act
        var first = Roll(state, 56);

        // Assert
        Assert.Equal("livingHands", Outcome(first));
    }

    [Fact]
    public void ResolveEncounter_AtAvariceArrival_UsesReplacementOutcome()
    {
        // Arrange
        var state = Apply(Initial(), new { kind = "explore" }, 180);
        state = Apply(state, new { kind = "confirmArrival", faction = "avarice", minute = 120 });
        var first = Roll(state, 56);

        // Act
        var second = Roll(first, 60);

        // Assert
        Assert.Equal("cultFanatics", Outcome(second));
    }

    [Fact]
    public void ResolveEncounter_AtAurilArrival_UsesReplacementAndRejectsRepeatedConfirmation()
    {
        // Arrange
        var state = Apply(Initial(), new { kind = "explore" }, 180);
        state = Apply(state, new { kind = "confirmArrival", faction = "avarice", minute = 120 });
        var first = Roll(state, 56);
        var second = Roll(first, 60);
        state = Apply(second, new { kind = "confirmArrival", faction = "auril", minute = 180 });

        // Act
        state = Roll(state, 65);

        // Assert
        Assert.Equal("coldlightWalkers", Outcome(state));
    }

    [Theory]
    [InlineData(1, "none")]
    [InlineData(50, "none")]
    [InlineData(51, "tombTapper")]
    [InlineData(55, "tombTapper")]
    [InlineData(56, "livingHands")]
    [InlineData(60, "livingHands")]
    [InlineData(61, "spittingMimics")]
    [InlineData(65, "spittingMimics")]
    [InlineData(66, "gargoyles")]
    [InlineData(70, "gargoyles")]
    [InlineData(71, "galvanPatrol")]
    [InlineData(75, "galvanPatrol")]
    [InlineData(76, "hypnosPatrol")]
    [InlineData(80, "hypnosPatrol")]
    [InlineData(81, "nothics")]
    [InlineData(90, "nothics")]
    [InlineData(91, "iriolarthas")]
    [InlineData(100, "iriolarthas")]
    public void ResolveEncounter_TableEndpoints_IncludeExpectedOutcome(int roll, string expected)
    {
        // Arrange
        var state = Apply(Initial(), new { kind = "explore" }, 60);

        // Act
        var result = Roll(state, roll);

        // Assert
        Assert.Equal(expected, Outcome(result));
    }

    [Fact]
    public void ResolveEncounter_AurilArrival_ReplacesGargoylesIndependently()
    {
        // Arrange
        var arrived = Apply(Initial(), new { kind = "confirmArrival", faction = "auril", minute = 0 });
        var state = Apply(arrived, new { kind = "explore" }, 60);

        // Act
        var result = Roll(state, 66);

        // Assert
        Assert.Equal("frostGiantPatrol", Outcome(result));
    }

    [Fact]
    public void Search_NewBuildingAfterAvariceArrival_AppliesSeparatePatrolChance()
    {
        // Arrange
        var state = Apply(Initial(), new { kind = "confirmArrival", faction = "avarice", minute = 0 });

        // Act
        var searched = Apply(state, new { kind = "searchBuilding", unnumbered = false, newBuilding = true }, 30);

        // Assert
        Assert.True(Queue(searched).GetArrayLength() == 1 && Outcome(Roll(searched, 20)) == "avaricePatrol" && Outcome(Roll(searched, 21)) == "none",
            "A first building search must apply the separate 20% chance after actual arrival, including numbered locations.");
    }

    [Fact]
    public void Search_RepeatedBuilding_DoesNotQueuePatrolCheck()
    {
        // Arrange
        var state = Apply(Initial(), new { kind = "confirmArrival", faction = "avarice", minute = 0 });

        // Act
        var repeat = Apply(state, new { kind = "searchBuilding", unnumbered = false, newBuilding = false }, 30);

        // Assert
        Assert.Equal(0, Queue(repeat).GetArrayLength());
    }
    [Fact]
    public void Preview_AllRollsAndArrivalStates_MatchesConfirmationWithoutMutation()
    {

        // Assert
        Assert.Equal(JsonValueKind.Null, View(Initial()).GetProperty("pendingTable").ValueKind);

        // Act
        var ordinary = Apply(Initial(), new { kind = "explore" }, 180);
        var laterArrival = Apply(ordinary, new { kind = "confirmArrival", faction = "avarice", minute = 120 });
        var replacement = Roll(laterArrival, 50);
        var bothArrivals = Apply(replacement, new { kind = "confirmArrival", faction = "auril", minute = 120 });
        var avarice = Apply(Initial(), new { kind = "confirmArrival", faction = "avarice", minute = 0 });
        var patrol = Apply(avarice, new { kind = "searchBuilding", unnumbered = false, newBuilding = true }, 30);
        foreach (var state in new[] { ordinary, laterArrival, replacement, bothArrivals, patrol })
        {
            // Arrange
            var before = state.ModuleState.GetRawText();
            var table = View(state).GetProperty("pendingTable").EnumerateArray().ToArray();

            // Assert
            Assert.True(table[0].GetProperty("min").GetInt32() == 1 && table[^1].GetProperty("max").GetInt32() == 100,
                "The preview table must cover every d100 result.");
            for (var roll = 1; roll <= 100; roll++)
            {
                // Arrange
                var band = table.Single(row => row.GetProperty("min").GetInt32() <= roll && row.GetProperty("max").GetInt32() >= roll);

                // Assert
                Assert.Equal(Outcome(Roll(state, roll)), band.GetProperty("outcome").GetString());
            }
            Assert.Equal(before, state.ModuleState.GetRawText());
        }

        // Assert
        Assert.True(View(laterArrival).GetProperty("pendingTable")[2].GetProperty("outcome").GetString() == "livingHands" &&
            View(replacement).GetProperty("pendingTable")[2].GetProperty("outcome").GetString() == "cultFanatics",
            "Avarice preview replacements start at actual arrival, including backdated queued checks.");
        Assert.True(View(bothArrivals).GetProperty("pendingTable")[3].GetProperty("outcome").GetString() == "coldlightWalkers" &&
            View(bothArrivals).GetProperty("pendingTable")[4].GetProperty("outcome").GetString() == "frostGiantPatrol",
            "Both Auril replacements must appear in the preview after actual arrival.");
    }
    [Fact]
    public void Transition_InvalidCommandsAndFullQueue_RejectsWithoutDroppingChecks()
    {
        // Arrange
        var state = Initial();
        Reject(state, new { kind = "explore" }); Reject(state, new { kind = "explore", extra = 1 }, 60);
        Reject(state, new { kind = "searchBuilding", unnumbered = true, newBuilding = true }, 29);
        Reject(state, new { kind = "confirmArrival", faction = "other", minute = 0 });
        Reject(state, new { kind = "confirmArrival", faction = "auril", minute = 1 });
        Reject(state, new { kind = "configureExpedition", aurilEnabled = "false" });

        // Act
        state = Apply(state, new { kind = "explore" }, 60);
        Reject(state, new { kind = "resolveEncounter", checkId = 1, roll = 0 });
        Reject(state, new { kind = "resolveEncounter", checkId = 1, roll = 101 });
        Reject(state, new { kind = "resolveEncounter", checkId = 2, roll = 50 });
        Reject(state, new { kind = "resolveEncounter", checkId = 1, roll = 50 }, 1);
        state = Initial(); for (var index = 0; index < 10; index++) state = Apply(state, new { kind = "explore" }, 1440);

        // Assert
        Assert.Equal(240, Queue(state).GetArrayLength());
        Reject(state, new { kind = "explore" }, 60);
        state = Roll(state, 50);
        Assert.Equal(240, Queue(Apply(state, new { kind = "explore" }, 60)).GetArrayLength());
    }

    [Fact]
    public void Validate_SchemaTwo_AcceptsExistingCharacterHistory()
    {
        // Arrange
        var current = Initial() with { TimeMinutes = 1440, RestEnds = [1080L] };
        current = Apply(current, new { kind = "resolveCheck", characterId = current.Party[0].Id, success = false });
        current = Apply(current, new { kind = "resolveCheck", characterId = current.Party[0].Id, success = true, d6 = 4 });
        var node = JsonNode.Parse(current.ModuleState.GetRawText())?.AsObject() ?? throw new InvalidOperationException("Missing test state.");
        node.Remove("adventure");
        node.Remove("forces");

        // Act
        var old = current with { ModuleSchemaVersion = 2, ModuleState = JsonSerializer.SerializeToElement(node) };

        // Assert
        Rules.Validate(old);
    }

    [Fact]
    public void Upgrade_SchemaTwo_PreservesHistoryAndIsIdempotent()
    {
        // Arrange
        var current = Initial() with { TimeMinutes = 1440, RestEnds = [1080L] };
        current = Apply(current, new { kind = "resolveCheck", characterId = current.Party[0].Id, success = false });
        current = Apply(current, new { kind = "resolveCheck", characterId = current.Party[0].Id, success = true, d6 = 4 });
        var node = JsonNode.Parse(current.ModuleState.GetRawText())?.AsObject() ?? throw new InvalidOperationException("Missing test state.");
        node.Remove("adventure");
        node.Remove("forces");
        var old = current with { ModuleSchemaVersion = 2, ModuleState = JsonSerializer.SerializeToElement(node) };
        var before = old.ModuleState.GetRawText();

        // Act
        var upgraded = Rules.Upgrade(old);

        // Assert
        Assert.True(JsonElement.DeepEquals(old.ModuleState.GetProperty("characters"), upgraded.ModuleState.GetProperty("characters")) &&
            upgraded.TimeMinutes == old.TimeMinutes && upgraded.RestEnds.SequenceEqual(old.RestEnds) && upgraded.Party.SequenceEqual(old.Party) &&
            Queue(upgraded).GetArrayLength() == 0 && View(upgraded).GetProperty("avarice").GetProperty("pending").GetBoolean() && old.ModuleState.GetRawText() == before,
            "Schema-two upgrades must preserve recovery history, names, time and rests without inventing historical exploration.");
        Assert.True(!Rules.Describe(old).TryGetProperty("expedition", out _), "Historical schema-two receipts must retain their exact original projection.");
        Assert.True(JsonElement.DeepEquals(upgraded.ModuleState, Rules.Upgrade(upgraded).ModuleState), "Expedition upgrade must be idempotent.");
    }

    [Fact]
    public void ReconcileParty_EmptyRoster_PreservesExpeditionState()
    {
        // Arrange
        var state = Apply(Initial(), new { kind = "explore" }, 90);
        var proposed = state with { Party = [] };
        var result = Rules.ReconcileParty(state, proposed);

        // Act
        var changed = proposed with { ModuleState = result.State };

        // Assert
        Rules.Validate(changed);
        Assert.True(JsonElement.DeepEquals(state.ModuleState.GetProperty("adventure"), changed.ModuleState.GetProperty("adventure")), "Roster removal must preserve campaign encounter state.");
    }
    [Fact]
    public void Validate_InvalidExpeditionState_RejectsCorruptionAndDuplicateCommands()
    {
        // Arrange
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
            // Arrange
            var state = JsonNode.Parse(snapshot.ModuleState.GetRawText())?.AsObject() ?? throw new InvalidOperationException("Missing corruption fixture.");
            mutate(state);
            var failed = false;
            try { Rules.Validate(snapshot with { ModuleState = JsonSerializer.SerializeToElement(state) }); }
            catch (InvalidOperationException) { failed = true; }

            // Assert
            Assert.True(failed, "Corrupt or unsupported expedition state must fail explicitly instead of being repaired silently.");
        }
        using var duplicate = JsonDocument.Parse("{\"kind\":\"explore\",\"kind\":\"explore\"}");

        // Act
        var rejection = Rules.Transition(snapshot, snapshot with { TimeMinutes = 150 }, duplicate.RootElement);

        // Assert
        Assert.Equal("invalid_module_command", rejection.ErrorCode);
    }
    private static void Reject(GameSnapshot state, object command, long minutes = 0)
    {
        var result = Rules.Transition(state, state with { TimeMinutes = state.TimeMinutes + minutes }, JsonSerializer.SerializeToElement(command));
        Assert.True(result.ErrorCode is not null && JsonElement.DeepEquals(result.State, state.ModuleState), "Rejected commands must preserve confirmed expedition state.");
    }
}
