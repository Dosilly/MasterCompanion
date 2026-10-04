using System.Text.Json;
using MasterCompanion.Contracts;

namespace MasterCompanion.Engine.Features.Gameplay;

public sealed record GameStateResponse(long Revision, GameSnapshot Snapshot, JsonElement ModuleView,
    GameOperationSummary? LastOperation);
