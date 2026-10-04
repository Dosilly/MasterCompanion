namespace MasterCompanion.Modules.Ythryn.Gameplay;

internal sealed record BlightCharacter(Guid Id, string Status, int Dc, int Failures,
        long? InfectedAt, long? NextExposure, long? LastResolvedRest, long? NextRecovery,
        long? RecoveryStartedAt, long? LastResolvedRecovery, int RecoveryChecks);
