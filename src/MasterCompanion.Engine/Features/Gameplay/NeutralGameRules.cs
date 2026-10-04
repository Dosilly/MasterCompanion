using System.Text.Json;
using MasterCompanion.Contracts;

namespace MasterCompanion.Engine.Features.Gameplay;

/// <summary>Supports engine party and time for registered modules without adventure gameplay rules.</summary>
internal sealed class NeutralGameRules(string moduleId) : ICampaignGameRules
{
    private static readonly JsonElement EmptyState = JsonSerializer.SerializeToElement(new Dictionary<string, object>());

    public string ModuleId => moduleId;
    public int StateSchemaVersion => 1;
    public JsonElement Initialize(IReadOnlyList<GameCharacter> party) => EmptyState;

    public void Validate(GameSnapshot snapshot)
    {
        // Never interpret missing adventure rules as permission to discard their saved state.
        if (snapshot.ModuleSchemaVersion != StateSchemaVersion || snapshot.ModuleState.ValueKind != JsonValueKind.Object ||
            snapshot.ModuleState.EnumerateObject().Any())
        {
            throw new InvalidOperationException("The registered module has no rules for its saved game state.");
        }
    }

    public ModuleTransition ReconcileParty(GameSnapshot before, GameSnapshot proposed)
    {
        Validate(before);
        Validate(proposed);
        return new ModuleTransition(before.ModuleState);
    }

    public ModuleTransition Transition(GameSnapshot before, GameSnapshot proposed, JsonElement? command)
    {
        Validate(before);
        Validate(proposed);
        return command is null ? new ModuleTransition(before.ModuleState)
            : new ModuleTransition(before.ModuleState, "game_module_command_unsupported");
    }

    public JsonElement Describe(GameSnapshot snapshot)
    {
        Validate(snapshot);
        return EmptyState;
    }
}
