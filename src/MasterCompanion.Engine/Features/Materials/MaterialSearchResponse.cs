namespace MasterCompanion.Engine.Features.Materials;

public sealed record MaterialSearchResponse(IReadOnlyList<MaterialSearchResult> Results, bool HasMore);
