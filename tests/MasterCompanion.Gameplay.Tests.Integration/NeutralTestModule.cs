using MasterCompanion.Contracts;

namespace MasterCompanion.Gameplay.Tests.Integration;

internal sealed class NeutralTestModule : ICampaignModule
{
    public ModuleManifest Manifest => new("neutral-test-module", "Neutral test module", "1.0.0", 1, "test-start");
    public Task<IReadOnlyList<SeedFolder>> LoadFoldersAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<SeedFolder>>([]);
    public Task<IReadOnlyList<SeedMaterial>> LoadMaterialsAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<SeedMaterial>>([]);
    public Task<IReadOnlyList<SeedMap>> LoadMapsAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<SeedMap>>([]);
    public ModuleAsset? OpenAsset(string assetId) => null;
}
