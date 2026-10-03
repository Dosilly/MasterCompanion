using System.Text.Json;
using System.Text.Json.Nodes;
using MasterCompanion.Contracts;
using MasterCompanion.Modules.Ythryn.Gameplay;

namespace MasterCompanion.Gameplay.Tests.Unit;

public sealed class RulesTests
{
    private static readonly YthrynGameRules Rules = new();
    private static readonly Guid FirstId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid SecondId = Guid.Parse("10000000-0000-0000-0000-000000000002");

    [Fact]
    public void Initialize_EmptyParty_ProducesReadableEmptyProjection()
    {
        // Arrange
        var party = Array.Empty<GameCharacter>();

        // Act
        var empty = new GameSnapshot(0, party, [], Rules.StateSchemaVersion, Rules.Initialize(party));

        // Assert
        Rules.Validate(empty);
        Assert.Equal(0, Rules.Describe(empty).GetProperty("characters").GetArrayLength());
    }

    [Fact]
    public void Initialize_NewParty_StartsHealthyWithExposureAtTwelveHours()
    {
        // Arrange: the fixture supplies two stable character IDs.

        // Act
        var initial = Initial();

        // Assert
        Assert.Equal("healthy", Character(initial).GetProperty("status").GetString());
        Assert.Equal(15, Character(initial).GetProperty("dc").GetInt32());
        Assert.Equal(720, Check(initial).GetProperty("minute").GetInt64());
    }

    [Fact]
    public void Exposure_BeforeDeadline_IsNotPendingAndCannotResolve()
    {

        // Act
        var before = At(Initial(), 719);

        // Assert
        Assert.True(!Check(before).GetProperty("pending").GetBoolean(), "Exposure must not be pending before 12 hours.");
        AssertError(before, Resolve(true), "game_check_not_due");
    }

    [Fact]
    public void Exposure_AtDeadline_IsPending()
    {
        // Arrange
        var before = At(Initial(), 719);

        // Act
        var due = At(before, 720);

        // Assert
        Assert.True(Check(due).GetProperty("pending").GetBoolean(), "Exposure must be pending at exactly 12 hours.");
    }

    [Fact]
    public void ResolveExposure_Success_SchedulesNextTwelveHourInterval()
    {
        // Arrange
        var before = At(Initial(), 719);
        var due = At(before, 720);

        // Act
        var result = Apply(due, Resolve(true));

        // Assert
        Assert.Equal(1440, Check(result).GetProperty("minute").GetInt64());
    }

    [Theory]
    [InlineData(0, 720, true)]
    [InlineData(1, 1440, true)]
    [InlineData(2, 2160, true)]
    [InlineData(3, 2880, false)]
    public void ResolveExposure_SeveralOverdueChecks_PreservesChronologicalDeadlines(int resolved, long deadline, bool pending)
    {
        // Arrange
        var state = At(Initial(), 2160);
        for (var index = 0; index < resolved; index++) state = Apply(state, Resolve(true));

        // Act
        var check = Check(state);

        // Assert
        Assert.Equal(deadline, check.GetProperty("minute").GetInt64());
        Assert.Equal(pending, check.GetProperty("pending").GetBoolean());
        Assert.Equal(2160, state.TimeMinutes);
    }

    [Fact]
    public void ResolveExposure_Failure_RevealsRestWithoutCountingRecoveryFailure()
    {
        // Arrange
        var state = At(Initial(), 600);
        state = Rest(state, 1080);

        // Act
        state = Apply(state, Resolve(false));

        // Assert
        Assert.Equal(720, StoredCharacter(state).GetProperty("infectedAt").GetInt64());
        Assert.Equal(0, Character(state).GetProperty("failures").GetInt32());
        Assert.Equal("rest", Check(state).GetProperty("kind").GetString());
        Assert.Equal(1080, Check(state).GetProperty("minute").GetInt64());
    }

    [Fact]
    public void ResolveRest_Success_ReducesDifficultyAndRestartsRecoveryTimer()
    {
        // Arrange
        var state = At(Initial(), 600);
        state = Rest(state, 1080);
        state = Apply(state, Resolve(false));

        // Act
        state = Apply(state, Resolve(true, 6));

        // Assert
        Assert.Equal(9, Character(state).GetProperty("dc").GetInt32());
        Assert.True(Check(state).GetProperty("kind").GetString() == "recovery" &&
            Check(state).GetProperty("minute").GetInt64() == 1800 && !Check(state).GetProperty("pending").GetBoolean(),
            "Resolving a rest must restart the recovery timer without processing the same rest twice.");
    }

    [Fact]
    public void ResolveExposure_FirstCharacterFailure_PreservesSecondCharacterExposure()
    {
        // Arrange
        var state = Rest(Initial(), 1080);

        // Act
        state = Apply(state, Resolve(false));

        // Assert
        Assert.Equal("healthy", Character(state, SecondId).GetProperty("status").GetString());
        Assert.Equal("exposure", Check(state, SecondId).GetProperty("kind").GetString());
    }

    [Fact]
    public void ResolveExposure_SecondCharacterSuccess_PreservesFirstCharacterRest()
    {
        // Arrange
        var state = Rest(Initial(), 1080);
        state = Apply(state, Resolve(false));

        // Act
        state = Apply(state, Resolve(true, null, SecondId));

        // Assert
        Assert.Equal("rest", Check(state, FirstId).GetProperty("kind").GetString());
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(5)]
    [InlineData(6)]
    public void ResolveRecovery_ValidDie_ReducesDifficultyByDieValue(int die)
    {
        // Arrange
        var infected = Apply(Rest(Initial(), 1080), Resolve(false));

        // Act
        var result = Apply(infected, Resolve(true, die));

        // Assert
        Assert.Equal(15 - die, Character(result).GetProperty("dc").GetInt32());
    }

    [Theory]
    [InlineData(3)]
    [InlineData(6)]
    public void ResolveRecovery_DifficultyReachesZero_GrantsImmunity(int finalDie)
    {
            // Arrange
            var state = Apply(Rest(Initial(), 1080), Resolve(false));
            state = Apply(state, Resolve(true, 6));
            state = Apply(Rest(state, 1560), Resolve(true, 6));

            // Act
            state = Apply(Rest(state, 2040), Resolve(true, finalDie));

            // Assert
            Assert.Equal("immune", Character(state).GetProperty("status").GetString());
            Assert.Equal(0, Character(state).GetProperty("dc").GetInt32());
            state = Rest(state, 2520);
            Assert.Equal(JsonValueKind.Null, Character(state).GetProperty("nextCheck").ValueKind);
            AssertError(state, Heal(), "game_character_not_infected");
    }

    [Theory]
    [InlineData(1, "infected")]
    [InlineData(2, "infected")]
    [InlineData(3, "transformed")]
    public void ResolveRecovery_AccumulatedFailures_TransformsOnlyOnThirdFailure(int failure, string expectedStatus)
    {
        // Arrange
        var state = Apply(Rest(Initial(), 1080), Resolve(false));
        for (var index = 1; index < failure; index++)
        {
            state = Apply(state, Resolve(false));
            state = Rest(state, state.TimeMinutes + 480);
        }

        // Act
        var result = Apply(state, Resolve(false));

        // Assert
        Assert.Equal(failure, Character(result).GetProperty("failures").GetInt32());
        Assert.Equal(expectedStatus, Character(result).GetProperty("status").GetString());
        if (failure == 3)
        {
            Assert.Equal(JsonValueKind.Null, Character(result).GetProperty("nextCheck").ValueKind);
            AssertError(result, Heal(), "game_character_not_infected");
        }
    }

    [Fact]
    public void ResolveRecovery_Success_PreservesEarlierFailureCount()
    {
        // Arrange
        var state = Apply(Rest(Initial(), 1080), Resolve(false));
        state = Apply(state, Resolve(false));

        // Act
        state = Apply(Rest(state, 1560), Resolve(true, 6));

        // Assert
        Assert.Equal(1, Character(state).GetProperty("failures").GetInt32());
    }

    [Fact]
    public void ResolveRecovery_InterleavedSuccess_DoesNotResetTransformationThreshold()
    {
        // Arrange
        var state = Apply(Rest(Initial(), 1080), Resolve(false));
        state = Apply(state, Resolve(false));
        state = Apply(Rest(state, 1560), Resolve(true, 6));
        state = Apply(Rest(state, 2040), Resolve(false));

        // Act
        state = Apply(Rest(state, 2520), Resolve(false));

        // Assert
        Assert.Equal("transformed", Character(state).GetProperty("status").GetString());
    }

    [Fact]
    public void Heal_InfectedCharacter_ResetsFailuresAndRestartsExposure()
    {
        // Arrange
        var state = Apply(Rest(Initial(), 1080), Resolve(false));
        state = Apply(state, Resolve(false));

        // Act
        state = Apply(state, Heal());

        // Assert
        Assert.Equal("healthy", Character(state).GetProperty("status").GetString());
        Assert.Equal(0, Character(state).GetProperty("failures").GetInt32());
        Assert.Equal(1800, Check(state).GetProperty("minute").GetInt64());
        AssertError(state, Heal(), "game_character_not_infected");
    }

    [Fact]
    public void Heal_ReinfectedCharacter_UsesNewExposureDeadline()
    {
        // Arrange
        var state = Apply(Rest(Initial(), 1080), Resolve(false));
        state = Apply(state, Resolve(false));
        state = Apply(state, Heal());

        // Act
        state = Apply(At(state, 1800), Resolve(false));

        // Assert
        Assert.Equal(1800, StoredCharacter(state).GetProperty("infectedAt").GetInt64());
    }

    [Fact]
    public void Transition_MalformedCommand_RejectsWithoutChangingState()
    {
        // Arrange
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

        // Assert
        AssertError(state, Resolve(true, null, Guid.Parse("20000000-0000-0000-0000-000000000001")), "game_character_not_found");
    }

    [Fact]
    public void Transition_InappropriateDie_RejectsWithoutChangingState()
    {
        // Arrange
        var exposed = At(Initial(), 1080);

        // Assert
        AssertError(exposed, Resolve(true, 1), "invalid_module_command");
        AssertError(exposed, Resolve(false, 1), "invalid_module_command");

        // Act
        var infected = Apply(Rest(Initial(), 1080), Resolve(false));

        // Assert
        AssertError(infected, Resolve(true), "invalid_module_command");
        AssertError(infected, Resolve(false, 1), "invalid_module_command");
        foreach (var die in new[] { 0, 7, -1 }) AssertError(infected, Resolve(true, die), "invalid_module_command");
        AssertError(infected, Json($"{{\"kind\":\"resolveCheck\",\"characterId\":\"{FirstId}\",\"success\":true,\"d6\":1.5}}"), "invalid_module_command");
    }

    [Fact]
    public void ResolveRecovery_BeforeDeadline_RejectsWithoutChangingState()
    {

        // Act
        var infected = Apply(At(Initial(), 720), Resolve(false));

        // Assert
        AssertError(infected, Resolve(true, 1), "game_check_not_due");
    }

    [Fact]
    public void ResolveCheck_ImmuneCharacter_RejectsWithoutChangingState()
    {
        // Arrange
        var infected = Apply(At(Initial(), 720), Resolve(false));
        var immune = Apply(Rest(infected, 1200), Resolve(true, 6));
        immune = Apply(Rest(immune, 1680), Resolve(true, 6));

        // Act
        immune = Apply(Rest(immune, 2160), Resolve(true, 3));

        // Assert
        AssertError(immune, Resolve(false), "game_check_not_due");
    }

    [Theory]
    [InlineData("schema")]
    [InlineData("negativeTime")]
    [InlineData("overflowTime")]
    [InlineData("nullState")]
    [InlineData("nullCharacters")]
    [InlineData("missingCharacters")]
    [InlineData("unknownField")]
    [InlineData("duplicatePartyId")]
    [InlineData("futureRest")]
    [InlineData("duplicateRest")]
    public void Validate_InvalidSnapshot_RejectsCorruption(string scenario)
    {
        // Arrange
        var initial = Initial();
        var corrupt = scenario switch
        {
            "schema" => initial with { ModuleSchemaVersion = 4 },
            "negativeTime" => initial with { TimeMinutes = -1 },
            "overflowTime" => initial with { TimeMinutes = GameLimits.MaxTimeMinutes + 1 },
            "nullState" => initial with { ModuleState = Json("null") },
            "nullCharacters" => initial with { ModuleState = Json("{\"characters\":null}") },
            "missingCharacters" => initial with { ModuleState = Json("{\"characters\":[]}") },
            "unknownField" => initial with { ModuleState = Json("{\"characters\":[],\"extra\":0}") },
            "duplicatePartyId" => initial with { Party = [new(FirstId, "A"), new(FirstId, "B")] },
            "futureRest" => initial with { RestEnds = [1] },
            "duplicateRest" => initial with { TimeMinutes = 10, RestEnds = [5, 5] },
            _ => throw new ArgumentException("Unknown corruption fixture.", nameof(scenario))
        };

        // Act
        Action validate = () => Rules.Validate(corrupt);

        // Assert
        Assert.Throws<InvalidOperationException>(validate);
    }

    [Theory]
    [InlineData(false, "id", "\"10000000-0000-0000-0000-000000000002\"")]
    [InlineData(false, "status", "\"unknown\"")]
    [InlineData(false, "dc", "14")]
    [InlineData(false, "failures", "1")]
    [InlineData(false, "nextExposure", "721")]
    [InlineData(false, "nextExposure", "null")]
    [InlineData(false, "infectedAt", "0")]
    [InlineData(false, "lastResolvedRest", "0")]
    [InlineData(false, "extra", "true")]
    [InlineData(true, "dc", "14")]
    [InlineData(true, "lastResolvedRest", "900")]
    [InlineData(true, "failures", "3")]
    [InlineData(true, "nextRecovery", "1441")]
    [InlineData(true, "recoveryStartedAt", "721")]
    [InlineData(true, "lastResolvedRecovery", "1080")]
    [InlineData(true, "recoveryChecks", "-1")]
    [InlineData(true, "recoveryChecks", "19")]
    public void Validate_InvalidCharacterHistory_RejectsCorruption(bool infected, string field, string json)
    {
        // Arrange
        var state = Initial();
        if (infected) state = Apply(Rest(state, 1080), Resolve(false));
        var corrupt = Mutate(state, field, JsonNode.Parse(json));

        // Act
        Action validate = () => Rules.Validate(corrupt);

        // Assert
        Assert.Throws<InvalidOperationException>(validate);
    }

    [Fact]
    public void Validate_MissingCharacterField_RejectsCorruption()
    {
        // Arrange
        var initial = Initial();
        var missingField = JsonNode.Parse(initial.ModuleState.GetRawText()) as JsonObject
            ?? throw new InvalidOperationException("Test state must be an object.");
        var missingCharacters = missingField["characters"] as JsonArray
            ?? throw new InvalidOperationException("Test characters must be an array.");
        var missingCharacter = missingCharacters[0] as JsonObject
            ?? throw new InvalidOperationException("Test character must be an object.");

        // Act
        missingCharacter.Remove("lastResolvedRest");

        // Assert
        AssertCorrupt(initial with { ModuleState = Json(missingField.ToJsonString()) });
    }

    [Fact]
    public void Rest_AtInfectionInstant_DoesNotReplacePeriodicRecovery()
    {

        // Act
        var state = Apply(Rest(Initial(), 720), Resolve(false));

        // Assert
        Assert.True(Check(state).GetProperty("kind").GetString() == "recovery" &&
            Check(state).GetProperty("minute").GetInt64() == 1440,
            "Rest at the infection instant must not count as recovery after infection or suppress the periodic timer.");
    }

    [Fact]
    public void Rest_AfterInfection_SchedulesRestRecovery()
    {
        // Arrange
        var state = Apply(Rest(Initial(), 720), Resolve(false));

        // Act
        state = Rest(state, 1200);

        // Assert
        Assert.Equal(1200, Check(state).GetProperty("minute").GetInt64());
    }

    [Fact]
    public void AdvanceTimeAndRest_NoOutcome_PreservesModuleState()
    {
        // Arrange
        var state = Apply(Rest(Initial(), 1080), Resolve(false));
        var before = state.ModuleState.GetRawText();

        // Act
        state = Rest(state, 1560);

        // Assert
        Assert.Equal(before, state.ModuleState.GetRawText());
    }

    [Fact]
    public void ResolveRest_SeveralOverdueRests_RevealsNextRest()
    {
        // Arrange
        var state = Apply(Rest(Initial(), 1080), Resolve(false));
        state = Rest(state, 1560);

        // Act
        state = Apply(state, Resolve(false));

        // Assert
        Assert.Equal(1560, Check(state).GetProperty("minute").GetInt64());
    }

    [Fact]
    public void ReconcileParty_RenameReorderAndRemove_PreservesRemainingCharacterState()
    {
        // Arrange
        var before = Apply(Rest(Initial(), 1080), Resolve(false));

        // Act
        before = Apply(before, Resolve(true, 6));
        var proposed = before with
        {
            Party = [new(SecondId, "Renamed second"), new(FirstId, "Renamed first")]
        };
        var transition = Rules.ReconcileParty(before, proposed);

        // Assert
        Assert.True(transition.ErrorCode is null, "A valid party edit must succeed.");
        var renamed = proposed with { ModuleState = transition.State };
        Rules.Validate(renamed);
        foreach (var id in new[] { FirstId, SecondId })
            Assert.True(JsonElement.DeepEquals(StoredCharacter(before, id), StoredCharacter(renamed, id)),
                "Renaming and reordering must retain every stored character field by stable identity.");
        Assert.Equal(9, Character(renamed).GetProperty("dc").GetInt32());

        var removed = renamed with { Party = [renamed.Party[0]] };

        // Act
        removed = removed with { ModuleState = Rules.ReconcileParty(renamed, removed).State };
        Rules.Validate(removed);

        // Assert
        Assert.True(removed.ModuleState.GetProperty("characters").GetArrayLength() == 1 &&
            JsonElement.DeepEquals(StoredCharacter(before, SecondId), StoredCharacter(removed, SecondId)),
            "Removing one member must remove only that member's module state.");
    }

    [Fact]
    public void ReconcileParty_NewMember_StartsExposureAtCurrentTime()
    {
        // Arrange
        var before = Rest(Initial(), 1560);
        var newId = Guid.Parse("10000000-0000-0000-0000-000000000003");
        var proposed = before with { Party = [.. before.Party, new(newId, "New arrival")] };

        // Act
        var added = proposed with { ModuleState = Rules.ReconcileParty(before, proposed).State };

        // Assert
        Rules.Validate(added);
        Assert.True(Check(added, newId).GetProperty("minute").GetInt64() == 2280 &&
            !Check(added, newId).GetProperty("pending").GetBoolean(),
            "A new party member's first exposure must be twelve hours after joining, without inherited overdue checks.");
        Assert.True(JsonElement.DeepEquals(StoredCharacter(before), StoredCharacter(added)),
            "Adding a member must preserve existing overdue checks.");
    }

    [Fact]
    public void ReconcileParty_EmptyRoster_PreservesClockAndRestHistory()
    {
        // Arrange
        var before = Rest(Initial(), 1560);
        var newId = Guid.Parse("10000000-0000-0000-0000-000000000003");
        var proposed = before with { Party = [.. before.Party, new(newId, "New arrival")] };
        var added = proposed with { ModuleState = Rules.ReconcileParty(before, proposed).State };
        var empty = added with { Party = [] };

        // Act
        empty = empty with { ModuleState = Rules.ReconcileParty(added, empty).State };

        // Assert
        Rules.Validate(empty);
        Assert.True(empty.TimeMinutes == 1560 && empty.RestEnds.SequenceEqual([1560L]) &&
            Rules.Describe(empty).GetProperty("characters").GetArrayLength() == 0,
            "An empty roster must remain valid without resetting its clock or rest history.");
    }

    [Fact]
    public void ReconcileParty_ReturningMember_StartsNewExposureHistory()
    {
        // Arrange
        var before = Rest(Initial(), 1560);
        var newId = Guid.Parse("10000000-0000-0000-0000-000000000003");
        var proposed = before with { Party = [.. before.Party, new(newId, "New arrival")] };
        var added = proposed with { ModuleState = Rules.ReconcileParty(before, proposed).State };
        var empty = added with { Party = [] };
        empty = empty with { ModuleState = Rules.ReconcileParty(added, empty).State };
        var rejoined = empty with { Party = [new(FirstId, "Returned member")] };

        // Act
        rejoined = rejoined with { ModuleState = Rules.ReconcileParty(empty, rejoined).State };

        // Assert
        Assert.Equal(2280, Check(rejoined).GetProperty("minute").GetInt64());
    }

    [Fact]
    public void ShortRest_InfectedCharacter_PreservesPeriodicRecoveryTimer()
    {
        // Arrange
        var infected = Apply(At(Initial(), 720), Resolve(false));

        // Act
        var afterShortRest = At(infected, 780);

        // Assert
        Assert.True(afterShortRest.RestEnds.Count == 0 &&
            Check(afterShortRest).GetProperty("kind").GetString() == "recovery" &&
            Check(afterShortRest).GetProperty("minute").GetInt64() == 1440 &&
            !Check(afterShortRest).GetProperty("pending").GetBoolean() &&
            JsonElement.DeepEquals(infected.ModuleState, afterShortRest.ModuleState),
            "An hour without a completed long rest must preserve the existing periodic recovery timer and infection.");
    }

    [Fact]
    public void LongRest_AfterShortRest_SchedulesRestRecovery()
    {
        // Arrange
        var infected = Apply(At(Initial(), 720), Resolve(false));
        var afterShortRest = At(infected, 780);

        // Act
        var longRest = Rest(afterShortRest, 1260);

        // Assert
        Assert.Equal(1260, Check(longRest).GetProperty("minute").GetInt64());
    }

    [Fact]
    public void PeriodicRecovery_RepeatedOutcomes_SharesRestFailureAndImmunityRules()
    {
        // Arrange
        var infected = Apply(At(Initial(), 720), Resolve(false));

        // Assert
        Assert.True(Check(infected).GetProperty("kind").GetString() == "recovery" &&
            Check(infected).GetProperty("minute").GetInt64() == 1440,
            "Infection must schedule its first recovery check twelve hours after the exposure deadline.");
        AssertError(At(infected, 1439), Resolve(true, 6), "game_check_not_due");

        // Act
        var recovered = Apply(At(infected, 1440), Resolve(true, 6));

        // Assert
        Assert.True(Character(recovered).GetProperty("dc").GetInt32() == 9 &&
            Check(recovered).GetProperty("minute").GetInt64() == 2160,
            "A periodic recovery success must reduce DC by d6 and start another twelve-hour interval.");

        // Act
        for (var failure = 1; failure <= 3; failure++)
        {

            // Act
            recovered = Apply(At(recovered, 1440 + failure * 720), Resolve(false));

            // Assert
            Assert.Equal(failure, Character(recovered).GetProperty("failures").GetInt32());
        }

        // Assert
        Assert.True(Character(recovered).GetProperty("status").GetString() == "transformed" &&
            Character(recovered).GetProperty("nextCheck").ValueKind == JsonValueKind.Null,
            "Three periodic failures must transform the character and stop further checks.");

        var immune = infected;

        // Act
        foreach (var die in new[] { 6, 6, 3 })
            immune = Apply(At(immune, Check(immune).GetProperty("minute").GetInt64()), Resolve(true, die));

        // Assert
        Assert.True(Character(immune).GetProperty("status").GetString() == "immune" &&
            Character(immune).GetProperty("nextCheck").ValueKind == JsonValueKind.Null,
            "Periodic successes that lower DC to zero must grant immunity and stop the timer.");
    }

    [Fact]
    public void ResolveRest_Success_ReplacesPreviousPeriodicDeadline()
    {
        // Arrange
        var infected = Apply(At(Initial(), 720), Resolve(false));

        // Act
        var state = Apply(Rest(infected, 1200), Resolve(true, 4));

        // Assert
        Assert.True(Check(state).GetProperty("kind").GetString() == "recovery" &&
            Check(state).GetProperty("minute").GetInt64() == 1920,
            "A long-rest outcome must replace the old 1440-minute timer with twelve hours from the rest end.");
    }

    [Fact]
    public void ResolveRest_BeforeReplacedDeadline_PreservesIndependentHealthyExposure()
    {
        // Arrange
        var infected = Apply(At(Initial(), 720), Resolve(false));
        var state = Apply(Rest(infected, 1200), Resolve(true, 4));

        // Act
        state = At(state, 1440);

        // Assert
        Assert.True(!Check(state).GetProperty("pending").GetBoolean(),
            "The replaced timer must not cause a second check at its original deadline.");
        AssertError(state, Resolve(false), "game_check_not_due");
        Assert.True(Check(state, SecondId).GetProperty("kind").GetString() == "exposure" &&
            Check(state, SecondId).GetProperty("minute").GetInt64() == 720,
            "A long rest must not reset the healthy character's independent exposure timer.");
    }

    [Fact]
    public void PeriodicRecovery_AfterResolvedRest_PreservesDifficultyAndFailures()
    {
        // Arrange
        var infected = Apply(At(Initial(), 720), Resolve(false));
        var state = Apply(Rest(infected, 1200), Resolve(true, 4));
        state = At(state, 1440);

        // Act
        state = Apply(At(state, 1920), Resolve(false));

        // Assert
        Assert.True(Character(state).GetProperty("dc").GetInt32() == 11 &&
            Character(state).GetProperty("failures").GetInt32() == 1,
            "Periodic recovery after a rest must preserve the accumulated DC and failures.");
    }

    [Fact]
    public void ResolveRecovery_OverdueRestAndTimer_UsesChronologicalOrder()
    {
        // Arrange
        var infected = Apply(At(Initial(), 720), Resolve(false));

        // Act
        var overdue = Rest(At(infected, 1200), 1680);

        // Assert
        Assert.True(Check(overdue).GetProperty("kind").GetString() == "recovery" &&
            Check(overdue).GetProperty("minute").GetInt64() == 1440,
            "A periodic deadline before a later long rest must be resolved first, even if both are overdue.");

        // Act
        overdue = Apply(overdue, Resolve(false));

        // Assert
        Assert.True(Check(overdue).GetProperty("kind").GetString() == "rest" &&
            Check(overdue).GetProperty("minute").GetInt64() == 1680,
            "Resolving the periodic check must reveal the later unresolved rest.");

        // Act
        overdue = Apply(overdue, Resolve(true, 5));

        // Assert
        Assert.True(Check(overdue).GetProperty("minute").GetInt64() == 2400 &&
            Character(overdue).GetProperty("failures").GetInt32() == 1 &&
            Character(overdue).GetProperty("dc").GetInt32() == 10,
            "The later rest must reset the next deadline while retaining outcomes from the earlier periodic check.");

        // Act
        var distant = At(infected, 2880);
        foreach (var deadline in new long[] { 1440, 2160, 2880 })
        {

            // Assert
            Assert.Equal(deadline, Check(distant).GetProperty("minute").GetInt64());

            // Act
            distant = Apply(distant, Resolve(true, 1));
        }

        // Assert
        Assert.Equal(3600, Check(distant).GetProperty("minute").GetInt64());
    }

    [Fact]
    public void Describe_CoincidentRestAndRecovery_PrioritizesRest()
    {
        // Arrange
        var infected = Apply(At(Initial(), 720), Resolve(false));

        // Act
        var collision = Rest(infected, 1440);

        // Assert
        Assert.Equal("rest", Check(collision).GetProperty("kind").GetString());
    }

    [Fact]
    public void ResolveRecovery_CoincidentRestAndTimer_AppliesOneOutcome()
    {
        // Arrange
        var infected = Apply(At(Initial(), 720), Resolve(false));
        var collision = Rest(infected, 1440);

        // Act
        collision = Apply(collision, Resolve(false));

        // Assert
        Assert.True(Character(collision).GetProperty("failures").GetInt32() == 1 &&
            Check(collision).GetProperty("kind").GetString() == "recovery" &&
            Check(collision).GetProperty("minute").GetInt64() == 2160 &&
            !Check(collision).GetProperty("pending").GetBoolean(),
            "Coincident events must produce one outcome and a single reset timer, without a duplicate failure.");
        AssertError(collision, Resolve(false), "game_check_not_due");
    }

    [Fact]
    public void Upgrade_LegacyHistory_PreservesOutcomesAndRejectsInconsistency()
    {
        // Arrange
        var legacy = new GameSnapshot(1800,
            [new(FirstId, "Authored name"), new(SecondId, "Second authored name")], [1080L, 1560L], 1,
            JsonSerializer.SerializeToElement(new { characters = new[]
            {
                new { id = FirstId, status = "infected", dc = 10, failures = 1,
                    infectedAt = (long?)720, nextExposure = (long?)null, lastResolvedRest = (long?)1560 },
                new { id = SecondId, status = "healthy", dc = 15, failures = 0,
                    infectedAt = (long?)null, nextExposure = (long?)2160, lastResolvedRest = (long?)null }
            } }));
        var original = legacy.ModuleState.GetRawText();
        Rules.Validate(legacy);

        // Assert
        Assert.Equal(JsonValueKind.Null, Character(legacy).GetProperty("nextCheck").ValueKind);

        // Act
        var upgraded = Rules.Upgrade(legacy);
        Rules.Validate(upgraded);

        // Assert
        Assert.True(upgraded.ModuleSchemaVersion == 3 && upgraded.TimeMinutes == legacy.TimeMinutes &&
            upgraded.Party.SequenceEqual(legacy.Party) && upgraded.RestEnds.SequenceEqual(legacy.RestEnds),
            "A pure upgrade must preserve party identities, names, time and historical rests.");
        Assert.True(Character(upgraded).GetProperty("dc").GetInt32() == 10 &&
            Character(upgraded).GetProperty("failures").GetInt32() == 1 &&
            Check(upgraded).GetProperty("minute").GetInt64() == 2280,
            "Legacy recovery outcomes must survive; periodic checks must begin after the last already resolved rest.");
        Assert.True(JsonElement.DeepEquals(upgraded.ModuleState, Rules.Upgrade(upgraded).ModuleState) &&
            legacy.ModuleState.GetRawText() == original,
            "Upgrade must be idempotent and must not mutate the legacy historical payload.");

        // Act
        var failed = Apply(At(upgraded, 2280), Resolve(false));

        // Assert
        Assert.True(Character(failed).GetProperty("failures").GetInt32() == 2 &&
            Character(failed).GetProperty("dc").GetInt32() == 10,
            "New periodic outcomes must accumulate with the legacy history rather than reset it.");

        // The only legacy success is d6=1..6, so a seven-point reduction is impossible.
        var corruptLegacy = Mutate(legacy, "dc", JsonValue.Create(8));
        AssertCorrupt(corruptLegacy);
        var rejected = false;

        // Act
        try { Rules.Upgrade(corruptLegacy); }
        catch (InvalidOperationException) { rejected = true; }

        // Assert
        Assert.True(rejected, "Upgrade must reject inconsistent legacy history instead of repairing it silently.");
    }

    private static GameSnapshot Initial()
    {
        GameCharacter[] party = [new(FirstId, "First"), new(SecondId, "Second")];
        return new GameSnapshot(0, party, [], Rules.StateSchemaVersion, Rules.Initialize(party));
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
        Assert.True(transition.ErrorCode is null, $"Expected accepted command, received {transition.ErrorCode}.");
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
        Assert.Equal(code, transition.ErrorCode);
        Assert.Equal(state.ModuleState.GetRawText(), transition.State.GetRawText());
    }

    private static void AssertCorrupt(GameSnapshot state)
    {
        Assert.Throws<InvalidOperationException>(() => Rules.Validate(state));
    }

}
