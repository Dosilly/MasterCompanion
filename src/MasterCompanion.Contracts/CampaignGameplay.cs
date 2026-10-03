using System.Text.Json;

namespace MasterCompanion.Contracts;

public static class GameLimits
{
    public const long MaxTimeMinutes = 52_560_000;
    public const long MaxAdvanceMinutes = 525_600;
    public const int MaxPartySize = 20;
    public const int MaxCharacterNameLength = 100;
    public const int MaxRestCount = 10_000;
}

public sealed record GameCharacter(Guid Id, string Name);

public sealed record GameSnapshot(long TimeMinutes, IReadOnlyList<GameCharacter> Party,
    IReadOnlyList<long> RestEnds, int ModuleSchemaVersion, JsonElement ModuleState);

public sealed record ModuleTransition(JsonElement State, string? ErrorCode = null);

/// <summary>Pure module rules. The engine owns time, party, persistence and operation history.</summary>
public interface ICampaignGameRules
{
    string ModuleId { get; }
    int StateSchemaVersion { get; }
    JsonElement Initialize(IReadOnlyList<GameCharacter> party);
    void Validate(GameSnapshot snapshot);
    /// <summary>Convert supported persisted module data without changing engine-owned time, roster or rest history.</summary>
    GameSnapshot Upgrade(GameSnapshot snapshot) => snapshot;
    /// <summary>Preserve state for retained IDs, initialize additions at current time and remove deleted IDs.</summary>
    ModuleTransition ReconcileParty(GameSnapshot before, GameSnapshot proposed);
    ModuleTransition Transition(GameSnapshot before, GameSnapshot proposed, JsonElement? command);
    JsonElement Describe(GameSnapshot snapshot);
}
