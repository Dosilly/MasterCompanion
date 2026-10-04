using static MasterCompanion.Modules.Ythryn.Gameplay.BlightRules;
using static MasterCompanion.Modules.Ythryn.Gameplay.BlightStateCodec;
using static MasterCompanion.Modules.Ythryn.Gameplay.BlightCommandCodec;
using System.Text.Json;
using MasterCompanion.Contracts;

namespace MasterCompanion.Modules.Ythryn.Gameplay;

public sealed class YthrynGameRules : ICampaignGameRules
{
    public string ModuleId => "ythryn";
    public int StateSchemaVersion => 3;

    public JsonElement Initialize(IReadOnlyList<GameCharacter> party) => Serialize(
        new BlightState(party.Select(character => Healthy(character.Id, 0)).ToArray(), ExpeditionRules.Initialize()));

    public void Validate(GameSnapshot snapshot) => ReadState(snapshot);

    public GameSnapshot Upgrade(GameSnapshot snapshot)
    {
        var state = ReadState(snapshot);
        if (snapshot.ModuleSchemaVersion == StateSchemaVersion)
        {
            return snapshot;
        }

        var characters = state.Characters.Select(character =>
        {
            if (snapshot.ModuleSchemaVersion != 1)
            {
                return character;
            }

            if (character.Status == "healthy")
            {
                return character;
            }

            var start = character.LastResolvedRest ?? character.InfectedAt
                ?? throw Corrupt("Infected Arcane Blight state has no infection time.");
            return character with
            {
                RecoveryStartedAt = start,
                NextRecovery = character.Status == "infected" ? checked(start + ExposureInterval) : null
            };
        }).ToArray();
        var upgraded = snapshot with { ModuleSchemaVersion = StateSchemaVersion, ModuleState = Serialize(new BlightState(characters, state.Adventure ?? ExpeditionRules.Initialize())) };
        Validate(upgraded);
        return upgraded;
    }

    public ModuleTransition ReconcileParty(GameSnapshot before, GameSnapshot proposed)
    {
        var current = ReadState(before);
        var retained = current.Characters.ToDictionary(character => character.Id);
        var characters = proposed.Party.Select(character => retained.TryGetValue(character.Id, out var existing)
            ? existing : Healthy(character.Id, proposed.TimeMinutes)).ToArray();
        var state = Serialize(new BlightState(characters, current.Adventure));
        Validate(proposed with { ModuleState = state });
        return new ModuleTransition(state);
    }

    public ModuleTransition Transition(GameSnapshot before, GameSnapshot proposed, JsonElement? command)
    {
        var state = ReadState(before);
        if (command is null)
        {
            Validate(proposed with { ModuleState = before.ModuleState });
            return new ModuleTransition(before.ModuleState);
        }

        if (ExpeditionRules.Handles(command.Value))
        {
            var result = ExpeditionRules.Apply(state.Adventure ?? throw Corrupt("Expedition state is missing."), before, proposed, command.Value);
            if (result.ErrorCode is not null)
            {
                return Rejected(before, result.ErrorCode);
            }

            var next = Serialize(state with { Adventure = result.State });
            Validate(proposed with { ModuleState = next });
            return new ModuleTransition(next);
        }
        if (before.TimeMinutes != proposed.TimeMinutes)
        {
            return Rejected(before, "invalid_module_command");
        }

        if (!TryReadCommand(command.Value, out var input))
        {
            return Rejected(before, "invalid_module_command");
        }

        var index = Array.FindIndex(state.Characters, character => character.Id == input.CharacterId);
        if (index < 0)
        {
            return Rejected(before, "game_character_not_found");
        }

        var character = state.Characters[index];
        BlightCharacter changed;
        if (input.Kind == "healCharacter")
        {
            if (character.Status != "infected")
            {
                return Rejected(before, "game_character_not_infected");
            }

            changed = Healthy(character.Id, proposed.TimeMinutes);
        }
        else
        {
            var check = NextCheck(character, proposed);
            if (check is null || !check.Pending)
            {
                return Rejected(before, "game_check_not_due");
            }
            // A d6 belongs only to a successful recovery check, never to exposure or failure.
            if ((check.Kind != "exposure" && input.Success == true) != (input.D6 is not null))
            {
                return Rejected(before, "invalid_module_command");
            }

            changed = check.Kind == "exposure"
                ? ResolveExposure(character, check.Minute, input.Success == true)
                : ResolveRecovery(character, check, input.Success == true, input.D6);
        }

        var characters = state.Characters.ToArray();
        characters[index] = changed;
        var nextState = Serialize(new BlightState(characters, state.Adventure));
        Validate(proposed with { ModuleState = nextState });
        return new ModuleTransition(nextState);
    }

    public JsonElement Describe(GameSnapshot snapshot)
    {
        var state = ReadState(snapshot);
        var characters = state.Characters.Select(character =>
            new CharacterDescription(character.Id, character.Status, character.Dc, character.Failures,
                snapshot.ModuleSchemaVersion == 1 ? LegacyNextCheck(character, snapshot) : NextCheck(character, snapshot))).ToArray();
        // Historical receipts retain their original projection for idempotent replay.
        return snapshot.ModuleSchemaVersion < 3
            ? JsonSerializer.SerializeToElement(new BlightDescription(characters), JsonOptions)
            : JsonSerializer.SerializeToElement(new { characters, expedition = ExpeditionRules.Describe(state.Adventure ?? throw Corrupt("Expedition state is missing."), snapshot) }, JsonOptions);
    }

    private static JsonElement Serialize(BlightState state) => JsonSerializer.SerializeToElement(state, JsonOptions);
    private static ModuleTransition Rejected(GameSnapshot snapshot, string code) => new(snapshot.ModuleState, code);
    private static InvalidOperationException Corrupt(string message) => new(message);
}
