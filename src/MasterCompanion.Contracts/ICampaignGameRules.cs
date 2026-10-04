using System.Text.Json;

namespace MasterCompanion.Contracts;

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
