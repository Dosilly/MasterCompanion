namespace MasterCompanion.Contracts;

public interface ICampaignModule
{
    ModuleManifest Manifest { get; }
    Task<IReadOnlyList<SeedFolder>> LoadFoldersAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SeedMaterial>> LoadMaterialsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SeedMap>> LoadMapsAsync(CancellationToken cancellationToken = default);
    ModuleAsset? OpenAsset(string assetId);
}
