using System.Text.Json;

namespace MasterCompanion.Engine.Features.Materials;

public sealed record SaveMaterialRequest(JsonElement Document, long ExpectedRevision);
