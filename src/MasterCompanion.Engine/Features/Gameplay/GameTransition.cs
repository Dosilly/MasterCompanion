using MasterCompanion.Contracts;

namespace MasterCompanion.Engine.Features.Gameplay;

internal abstract record GameTransition
{
    internal sealed record Accepted(GameSnapshot Snapshot) : GameTransition;
    internal sealed record Rejected(int StatusCode, string Code) : GameTransition;
}
