using System.Text.Json;
using MasterCompanion.Contracts;

namespace MasterCompanion.Engine.Features.Gameplay;

public sealed record GameOperationRequest(Guid RequestId, long ExpectedRevision, string Kind,
    GameCharacter[]? Party = null, long? Minutes = null, JsonElement? Command = null);
