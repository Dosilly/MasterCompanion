using System.Text.Json;

namespace MasterCompanion.Contracts;

public interface ICampaignModule
{
    ModuleManifest Manifest { get; }
    Task<IReadOnlyList<SeedFolder>> LoadFoldersAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SeedMaterial>> LoadMaterialsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SeedMap>> LoadMapsAsync(CancellationToken cancellationToken = default);
    ModuleAsset? OpenAsset(string assetId);
}

public sealed record ModuleManifest(string Id, string Name, string Version, int ContentSchemaVersion,
    string StartMaterialId);
public sealed record SeedFolder(string Id, string Title, string? ParentId, int SortOrder);
public sealed record SeedMaterial(string Id, string Title, string Group, JsonElement Document, int SortOrder,
    string? FolderId);
public sealed record SeedMap(string Id, JsonElement Definition);
public sealed record ModuleAsset(Stream Content, string ContentType);
