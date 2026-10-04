namespace MasterCompanion.Modules.Ythryn.Gameplay;

internal static class RivalForcesRules
{
    private const int InitialCultFanatics = 20;
    private const int InitialGargoyles = 2;
    private const int InitialRavens = 1;
    private const int InitialMountainGoats = 10;
    private const int InitialFrostGiantSkeletons = 3;
    private const int InitialSnowGolems = 6;
    private const int InitialWinterWolves = 6;

    internal static RivalForcesState Initialize() => new(
        InitialCultFanatics, InitialGargoyles, InitialRavens, InitialMountainGoats,
        InitialFrostGiantSkeletons, InitialSnowGolems, InitialWinterWolves, 0, 0);

    internal static RivalForcesState ConvertCultists(RivalForcesState state) => state with
    {
        CultFanatics = 0,
        ColdlightWalkers = state.ColdlightWalkers + state.CultFanatics,
        ConvertedCultists = state.ConvertedCultists + state.CultFanatics
    };

    internal static RivalForcesState Upgrade(ExpeditionState adventure) =>
        adventure.AurilArrivedAt is null ? Initialize() : ConvertCultists(Initialize());

    internal static RivalForcesState? RecordLoss(RivalForcesState forces, ForceLossCommand command)
    {
        var count = command.Count;
        if (count < 1)
        {
            return null;
        }
        var next = command.Unit switch
        {
            "cultFanatics" when count <= forces.CultFanatics => forces with { CultFanatics = forces.CultFanatics - count },
            "gargoyles" when count <= forces.Gargoyles => forces with { Gargoyles = forces.Gargoyles - count },
            "ravens" when count <= forces.Ravens => forces with { Ravens = forces.Ravens - count },
            "mountainGoats" when count <= forces.MountainGoats => forces with { MountainGoats = forces.MountainGoats - count },
            "frostGiantSkeletons" when count <= forces.FrostGiantSkeletons => forces with { FrostGiantSkeletons = forces.FrostGiantSkeletons - count },
            "snowGolems" when count <= forces.SnowGolems => forces with { SnowGolems = forces.SnowGolems - count },
            "winterWolves" when count <= forces.WinterWolves => forces with { WinterWolves = forces.WinterWolves - count },
            "coldlightWalkers" when count <= forces.ColdlightWalkers => forces with { ColdlightWalkers = forces.ColdlightWalkers - count },
            _ => null
        };
        return next;
    }

    internal static void Validate(RivalForcesState state, ExpeditionState adventure)
    {
        if (!Within(state.CultFanatics, InitialCultFanatics - state.ConvertedCultists) ||
            !Within(state.Gargoyles, InitialGargoyles) || !Within(state.Ravens, InitialRavens) ||
            !Within(state.MountainGoats, InitialMountainGoats) ||
            !Within(state.FrostGiantSkeletons, InitialFrostGiantSkeletons) ||
            !Within(state.SnowGolems, InitialSnowGolems) || !Within(state.WinterWolves, InitialWinterWolves) ||
            !Within(state.ConvertedCultists, InitialCultFanatics) || !Within(state.ColdlightWalkers, state.ConvertedCultists) ||
            (adventure.AurilArrivedAt is null ? state.ConvertedCultists != 0 : state.CultFanatics != 0))
        {
            throw new InvalidOperationException("Invalid Ythryn rival forces state.");
        }
    }

    private static bool Within(int value, int maximum) => value >= 0 && value <= maximum;
}
