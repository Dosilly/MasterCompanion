namespace MasterCompanion.Engine.Features.Sessions;

public sealed record UpdateSessionOperation(Guid SessionId, string Title,
    string Summary, string FollowUp) : SessionOperation(SessionId);
