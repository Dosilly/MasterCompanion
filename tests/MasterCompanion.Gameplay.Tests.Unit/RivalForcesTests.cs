using System.Text.Json;
using System.Text.Json.Nodes;
using MasterCompanion.Contracts;
using MasterCompanion.Modules.Ythryn.Gameplay;

namespace MasterCompanion.Gameplay.Tests.Unit;

public sealed class RivalForcesTests
{
    private static readonly YthrynGameRules Rules = new();
    private static GameSnapshot Initial()
    {
        GameCharacter[] party = [new(Guid.NewGuid(), "Authored name")];
        return new(0, party, [], Rules.StateSchemaVersion, Rules.Initialize(party));
    }

    private static GameSnapshot Apply(GameSnapshot before, object command)
    {
        var result = Rules.Transition(before, before, JsonSerializer.SerializeToElement(command));
        Assert.Null(result.ErrorCode);
        var after = before with { ModuleState = result.State };
        Rules.Validate(after);
        return after;
    }

    private static int Count(GameSnapshot state, string unit) => Rules.Describe(state).GetProperty("forces").GetProperty(unit).GetInt32();

    [Theory]
    [InlineData("cultFanatics", 20)]
    [InlineData("gargoyles", 2)]
    [InlineData("ravens", 1)]
    [InlineData("mountainGoats", 10)]
    [InlineData("frostGiantSkeletons", 3)]
    [InlineData("snowGolems", 6)]
    [InlineData("winterWolves", 6)]
    [InlineData("coldlightWalkers", 0)]
    public void Initialize_SourceComposition_ExposesExpectedResources(string unit, int expected)
    {
        var state = Initial();

        Assert.Equal(expected, Count(state, unit));
    }

    [Fact]
    public void ConfirmAuril_PreviousPatrolLosses_ConvertsOnlySurvivors()
    {
        var initial = Initial();
        var before = Apply(initial, new { kind = "recordForceLoss", unit = "cultFanatics", count = 5 });

        var after = Apply(before, new { kind = "confirmArrival", faction = "auril", minute = 0 });

        Assert.Equal(0, Count(after, "cultFanatics"));
        Assert.Equal(15, Count(after, "coldlightWalkers"));
        Assert.Equal(15, Count(after, "convertedCultists"));
        Assert.Equal(before.TimeMinutes, after.TimeMinutes);
        Assert.True(JsonElement.DeepEquals(before.ModuleState.GetProperty("characters"), after.ModuleState.GetProperty("characters")));
        var repeated = Rules.Transition(after, after, JsonSerializer.SerializeToElement(new { kind = "confirmArrival", faction = "auril", minute = 0 }));
        Assert.Equal("game_arrival_already_confirmed", repeated.ErrorCode);
        Assert.True(JsonElement.DeepEquals(after.ModuleState, repeated.State));
    }

    [Fact]
    public void RecordWalkerLoss_AfterConversion_DoesNotChangeConvertedTotal()
    {
        var before = Apply(Initial(), new { kind = "confirmArrival", faction = "auril", minute = 0 });

        var after = Apply(before, new { kind = "recordForceLoss", unit = "coldlightWalkers", count = 3 });

        Assert.Equal(17, Count(after, "coldlightWalkers"));
        Assert.Equal(20, Count(after, "convertedCultists"));
    }

    [Fact]
    public void ConfirmAuril_AllCultistsDead_DoesNotCreateWalkers()
    {
        var before = Apply(Initial(), new { kind = "recordForceLoss", unit = "cultFanatics", count = 20 });

        var after = Apply(before, new { kind = "confirmArrival", faction = "auril", minute = 0 });

        Assert.Equal(0, Count(after, "coldlightWalkers"));
    }

    [Fact]
    public void ConfirmAvarice_AfterAuril_DoesNotReplenishCultists()
    {
        var before = Apply(Initial(), new { kind = "confirmArrival", faction = "auril", minute = 0 });

        var after = Apply(before, new { kind = "confirmArrival", faction = "avarice", minute = 0 });

        Assert.Equal(0, Count(after, "cultFanatics"));
        Assert.Equal(20, Count(after, "coldlightWalkers"));
    }

    [Theory]
    [InlineData("cultFanatics", 0)]
    [InlineData("cultFanatics", -1)]
    [InlineData("cultFanatics", 21)]
    [InlineData("coldlightWalkers", 1)]
    [InlineData("unknown", 1)]
    public void RecordLoss_InvalidResources_RejectsWithoutMutation(string unit, int count)
    {
        var before = Initial();

        var result = Rules.Transition(before, before, JsonSerializer.SerializeToElement(new { kind = "recordForceLoss", unit, count }));

        Assert.Equal("invalid_module_command", result.ErrorCode);
        Assert.True(JsonElement.DeepEquals(before.ModuleState, result.State));
    }

    [Theory]
    [InlineData("{\"kind\":\"recordForceLoss\",\"unit\":\"cultFanatics\",\"count\":1.5}")]
    [InlineData("{\"kind\":\"recordForceLoss\",\"unit\":\"cultFanatics\",\"count\":1,\"extra\":true}")]
    [InlineData("{\"kind\":\"recordForceLoss\",\"unit\":\"cultFanatics\",\"count\":1,\"count\":2}")]
    [InlineData("{\"kind\":\"recordForceLoss\",\"count\":1}")]
    public void RecordLoss_MalformedCommand_Rejects(string json)
    {
        var before = Initial();

        var result = Rules.Transition(before, before, JsonSerializer.Deserialize<JsonElement>(json));

        Assert.Equal("invalid_module_command", result.ErrorCode);
    }

    [Fact]
    public void RecordLoss_TimeAdvance_RejectsAtomicOperation()
    {
        var before = Initial();

        var result = Rules.Transition(before, before with { TimeMinutes = 1 }, JsonSerializer.SerializeToElement(new { kind = "recordForceLoss", unit = "gargoyles", count = 1 }));

        Assert.Equal("invalid_module_command", result.ErrorCode);
    }

    [Theory]
    [InlineData(false, 20, 0)]
    [InlineData(true, 0, 20)]
    public void Upgrade_SchemaThree_PreservesAdventureAndInitializesForces(bool arrived, int cultists, int walkers)
    {
        var current = arrived ? Apply(Initial(), new { kind = "confirmArrival", faction = "auril", minute = 0 }) : Initial();
        var node = JsonNode.Parse(current.ModuleState.GetRawText())?.AsObject() ?? throw new InvalidOperationException("Missing state fixture.");
        node.Remove("forces");
        var historical = current with { ModuleSchemaVersion = 3, ModuleState = JsonSerializer.SerializeToElement(node) };

        var upgraded = Rules.Upgrade(historical);

        Assert.Equal(4, upgraded.ModuleSchemaVersion);
        Assert.True(JsonElement.DeepEquals(historical.ModuleState.GetProperty("adventure"), upgraded.ModuleState.GetProperty("adventure")));
        Assert.True(JsonElement.DeepEquals(historical.ModuleState.GetProperty("characters"), upgraded.ModuleState.GetProperty("characters")));
        Assert.Equal(cultists, Count(upgraded, "cultFanatics"));
        Assert.Equal(walkers, Count(upgraded, "coldlightWalkers"));
        Assert.False(Rules.Describe(historical).TryGetProperty("forces", out _));
    }

    [Theory]
    [InlineData("cultFanatics", -1)]
    [InlineData("gargoyles", 3)]
    [InlineData("coldlightWalkers", 1)]
    [InlineData("convertedCultists", 1)]
    public void Validate_CorruptedResources_Throws(string unit, int count)
    {
        var before = Initial();
        var node = JsonNode.Parse(before.ModuleState.GetRawText())?.AsObject() ?? throw new InvalidOperationException("Missing state fixture.");
        var forces = node["forces"]?.AsObject() ?? throw new InvalidOperationException("Missing forces fixture.");
        forces[unit] = count;
        var corrupted = before with { ModuleState = JsonSerializer.SerializeToElement(node) };

        Assert.Throws<InvalidOperationException>(() => Rules.Validate(corrupted));
    }
}
