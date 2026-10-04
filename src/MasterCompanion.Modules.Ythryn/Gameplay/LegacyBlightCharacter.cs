namespace MasterCompanion.Modules.Ythryn.Gameplay;

internal sealed record LegacyBlightCharacter(Guid Id, string Status, int Dc, int Failures,
        long? InfectedAt, long? NextExposure, long? LastResolvedRest);
