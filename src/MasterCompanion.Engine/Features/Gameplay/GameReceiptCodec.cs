using System.Text.Json;
using MasterCompanion.Contracts;

using MasterCompanion.Engine.Persistence;
using static MasterCompanion.Engine.Features.Gameplay.GameSnapshotCodec;

namespace MasterCompanion.Engine.Features.Gameplay;

internal static class GameReceiptCodec
{
    internal static GameStateResponse Decode(GameOperation receipt, ICampaignGameRules rules)
    {
        var confirmed = JsonSerializer.Deserialize<GameStateResponse>(receipt.ResponseJson, JsonOptions)
                ?? throw new InvalidOperationException("The saved game receipt is invalid.");
        ValidateSnapshot(confirmed.Snapshot, rules);
        if (confirmed.Revision < 1 || confirmed.Revision != receipt.Revision ||
            !JsonElement.DeepEquals(confirmed.ModuleView, rules.Describe(confirmed.Snapshot)) ||
            (receipt.Kind != "undo" && confirmed.LastOperation != new GameOperationSummary(receipt.RequestId, receipt.Kind, receipt.Revision)) ||
            (confirmed.LastOperation is { } operation && (operation.RequestId == Guid.Empty ||
                operation.Revision < 1 || operation.Revision > confirmed.Revision ||
                operation.Kind is not ("configureParty" or "updateParty" or "updateCharacter" or "advanceTime" or "shortRest" or "longRest" or "module"))))
        {
            throw new InvalidOperationException("The saved game receipt is inconsistent.");
        }

        return confirmed;
    }
}
