using System.Text.Json;

namespace MasterCompanion.Engine.Features.Materials;

public sealed record SaveMaterialRequest(string Title, JsonElement Document, long ExpectedRevision);
