namespace MasterCompanion.Engine.Features.Gameplay;

public sealed record GameExecution(int StatusCode, string? Code = null, GameStateResponse? Response = null);
