using System.Text.Json;
using MasterCompanion.Engine.Persistence;

namespace MasterCompanion.Engine.Features.Sessions;

internal static class SessionChanges
{
    internal static string? Apply(List<CampaignSession> sessions, Guid campaignId,
        long nextRevision, SessionOperation operation)
    {
        if (operation is CreateSessionOperation create)
        {
            if (sessions.Any(item => item.Id == create.SessionId))
            {
                return "session_already_exists";
            }
            if (sessions.Count >= 1_000)
            {
                return "session_limit";
            }
            sessions.Add(new CampaignSession
            {
                CampaignId = campaignId,
                Id = create.SessionId,
                Title = create.Title.Trim(),
                PreparationMaterialId = $"session-{create.SessionId:D}-prep",
                NotesMaterialId = $"session-{create.SessionId:D}-notes",
                Sequence = nextRevision
            });
            return null;
        }
        var session = sessions.SingleOrDefault(item => item.Id == operation.SessionId);
        if (session is null)
        {
            return "session_not_found";
        }
        switch (operation)
        {
            case DeleteSessionOperation:
                sessions.Remove(session);
                return null;
            case UpdateSessionOperation update:
                session.Title = update.Title.Trim();
                session.Summary = update.Summary;
                session.FollowUp = update.FollowUp;
                return null;
            case StartSessionOperation:
                if (session.Status != "planned" || sessions.Any(item => item.Status == "active"))
                {
                    return "session_transition_conflict";
                }
                session.Status = "active";
                return null;
            case CompleteSessionOperation:
                if (session.Status != "active")
                {
                    return "session_transition_conflict";
                }
                session.Status = "completed";
                return null;
            case PinSessionMaterialOperation pin:
                return ChangePin(session, pin.MaterialId, true);
            case UnpinSessionMaterialOperation unpin:
                return ChangePin(session, unpin.MaterialId, false);
            default:
                throw new InvalidOperationException("The session operation is unsupported.");
        }
    }

    private static string? ChangePin(CampaignSession session, string materialId, bool add)
    {
        var pins = JsonSerializer.Deserialize<List<string>>(session.PinnedMaterialIdsJson)
            ?? throw new InvalidOperationException("The saved session pins are invalid.");
        if (add)
        {
            if (pins.Contains(materialId))
            {
                return "session_pin_exists";
            }
            if (pins.Count >= 200)
            {
                return "session_pin_limit";
            }
            pins.Add(materialId);
        }
        else if (!pins.Remove(materialId))
        {
            return "session_pin_not_found";
        }
        session.PinnedMaterialIdsJson = JsonSerializer.Serialize(pins);
        return null;
    }
}
