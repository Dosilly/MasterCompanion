using System.Text.Json;
using MasterCompanion.Contracts;
using MasterCompanion.Engine.Features.Characters;

namespace MasterCompanion.Engine.Features.Gameplay;

public sealed record GameOperationRequest(Guid RequestId, long ExpectedRevision, string Kind,
    GameCharacter[]? Party = null, long? Minutes = null, JsonElement? Command = null,
    CharacterChange? Character = null);
