namespace MasterCompanion.Modules.Ythryn.Gameplay;

internal sealed record BlightCommand(string Kind, Guid CharacterId, bool? Success, int? D6);
