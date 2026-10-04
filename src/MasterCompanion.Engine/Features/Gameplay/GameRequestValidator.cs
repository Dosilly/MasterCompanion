using System.Text.Json;
using MasterCompanion.Contracts;

namespace MasterCompanion.Engine.Features.Gameplay;

internal static class GameRequestValidator
{
    internal static bool IsValidParty(IReadOnlyList<GameCharacter> party) => party.Count <= GameLimits.MaxPartySize &&
        party.All(x => x is not null && x.Id != Guid.Empty && !string.IsNullOrWhiteSpace(x.Name) &&
            x.Name.Length <= GameLimits.MaxCharacterNameLength && x.Name == x.Name.Trim() && !x.Name.Any(char.IsControl)) &&
        party.Select(x => x.Id).Distinct().Count() == party.Count;

    internal static bool IsValidRequest(GameOperationRequest request)
    {
        if (request.RequestId == Guid.Empty || request.ExpectedRevision < 0)
        {
            return false;
        }

        return request.Kind switch
        {
            "configureParty" => request.Party is { Length: > 0 } && IsValidParty(request.Party) && request.Minutes is null && request.Command is null,
            "updateParty" => request.Party is not null && IsValidParty(request.Party) && request.Minutes is null && request.Command is null,
            "advanceTime" => request.Party is null && request.Minutes is > 0 and <= GameLimits.MaxAdvanceMinutes && request.Command is null,
            "shortRest" or "longRest" or "undo" => request.Party is null && request.Minutes is null && request.Command is null,
            "module" => request.Party is null && (request.Minutes is null or > 0 and <= GameLimits.MaxAdvanceMinutes) && request.Command is { ValueKind: JsonValueKind.Object },
            _ => false
        };
    }

}
