namespace MasterCompanion.Engine.Features.Gameplay;

public sealed record GameOperationSummary(Guid RequestId, string Kind, long Revision);
