namespace MasterCompanion.Modules.Ythryn.Gameplay;

internal sealed record ExpeditionState(bool AurilEnabled,
    long? AvariceArrivedAt, long? AurilArrivedAt, long ExplorationMinutes, long NextId,
    EncounterCheck[] Pending, EncounterResult? LastResult);
