using MasterCompanion.Contracts;

namespace MasterCompanion.Engine.Features.Gameplay;

internal static class GameOperationRules
{
    private const int LongRestMinutes = 480;
    private const int ShortRestMinutes = 60;
    internal static GameTransition Apply(GameSnapshot before, GameOperationRequest request, ICampaignGameRules rules)
    {
        GameSnapshot after;
        if (request.Kind == "configureParty")
        {
            if (before.Party.Count != 0 || before.TimeMinutes != 0 || before.RestEnds.Count != 0)
            {
                return new GameTransition.Rejected(409, "game_party_already_configured");
            }

            var party = request.Party ?? throw new InvalidOperationException("Validated party is missing.");
            after = before with { Party = party };
            var reconciliation = rules.ReconcileParty(before, after);
            if (reconciliation.ErrorCode is not null)
            {
                return new GameTransition.Rejected(400, reconciliation.ErrorCode);
            }

            after = after with { ModuleState = reconciliation.State };
        }
        else if (request.Kind is "updateParty" or "updateCharacter")
        {
            var party = request.Kind == "updateCharacter"
                ? UpdatedParty(before, request)
                : request.Party ?? throw new InvalidOperationException("Validated party is missing.");
            if (!GameRequestValidator.IsValidParty(party))
            {
                return new GameTransition.Rejected(409, "game_party_limit");
            }
            after = before with { Party = party };
            var reconciliation = rules.ReconcileParty(before, after);
            if (reconciliation.ErrorCode is not null)
            {
                return new GameTransition.Rejected(400, reconciliation.ErrorCode);
            }

            after = after with { ModuleState = reconciliation.State };
        }
        else
        {
            if (before.Party.Count == 0)
            {
                return new GameTransition.Rejected(409, "game_party_required");
            }

            var minutes = request.Kind switch
            {
                "longRest" => LongRestMinutes,
                "shortRest" => ShortRestMinutes,
                _ => request.Minutes ?? 0
            };
            if (before.TimeMinutes > GameLimits.MaxTimeMinutes - minutes)
            {
                return new GameTransition.Rejected(400, "game_time_limit");
            }

            if (request.Kind == "longRest" && before.RestEnds.Count >= GameLimits.MaxRestCount)
            {
                return new GameTransition.Rejected(409, "game_rest_limit");
            }

            after = before with
            {
                TimeMinutes = before.TimeMinutes + minutes,
                RestEnds = request.Kind == "longRest" ? [.. before.RestEnds, before.TimeMinutes + minutes] : before.RestEnds
            };
            var transition = rules.Transition(before, after, request.Command);
            if (transition.ErrorCode is not null)
            {
                return new GameTransition.Rejected(400, transition.ErrorCode);
            }

            after = after with { ModuleState = transition.State };
        }
        GameSnapshotCodec.ValidateSnapshot(after, rules);
        return new GameTransition.Accepted(after);
    }

    private static GameCharacter[] UpdatedParty(GameSnapshot before, GameOperationRequest request)
    {
        var character = request.Character ?? throw new InvalidOperationException("Validated character is missing.");
        var party = before.Party.Where(member => member.Id != character.Id).ToList();
        if (character.InParty)
        {
            var index = before.Party.ToList().FindIndex(member => member.Id == character.Id);
            party.Insert(index < 0 ? party.Count : index, new(character.Id, character.Name));
        }
        return party.ToArray();
    }
}
