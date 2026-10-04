namespace MasterCompanion.Modules.Ythryn.Gameplay;

internal sealed record CharacterDescription(Guid Id, string Status, int Dc, int Failures, CheckDescription? NextCheck);
