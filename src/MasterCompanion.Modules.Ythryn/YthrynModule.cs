using System.Text.Json;
using MasterCompanion.Contracts;

namespace MasterCompanion.Modules.Ythryn;

public sealed class YthrynModule : ICampaignModule
{
    public ModuleManifest Manifest { get; } = new("ythryn", "Ythryn", "0.1.0", 1, "s210a67f4cc8e");

    public async Task<IReadOnlyList<SeedFolder>> LoadFoldersAsync(CancellationToken cancellationToken = default)
    {
        using var document = await LoadSeedAsync(cancellationToken);
        return document.RootElement.GetProperty("folders").EnumerateArray().Select(item => new SeedFolder(
            item.GetProperty("id").GetString()!, item.GetProperty("title").GetString()!,
            item.GetProperty("parentId").GetString(), item.GetProperty("sortOrder").GetInt32())).ToList();
    }

    public async Task<IReadOnlyList<SeedMaterial>> LoadMaterialsAsync(CancellationToken cancellationToken = default)
    {
        using var document = await LoadSeedAsync(cancellationToken);
        return document.RootElement.GetProperty("materials").EnumerateArray().Select(item => new SeedMaterial(
            item.GetProperty("id").GetString()!, item.GetProperty("title").GetString()!,
            item.GetProperty("group").GetString()!, item.GetProperty("document").Clone(),
            item.GetProperty("sortOrder").GetInt32(), item.GetProperty("folderId").GetString())).ToList();
    }

    public async Task<IReadOnlyList<SeedMap>> LoadMapsAsync(CancellationToken cancellationToken = default)
    {
        using var document = await LoadSeedAsync(cancellationToken);
        return document.RootElement.GetProperty("maps").EnumerateArray().Select(item =>
            new SeedMap(item.GetProperty("id").GetString()!, item.Clone())).ToList();
    }

    public ModuleAsset? OpenAsset(string assetId) => assetId == "ythryn-map-image"
        ? new ModuleAsset(typeof(YthrynModule).Assembly.GetManifestResourceStream(
            "MasterCompanion.Modules.Ythryn.Data.ythryn-map.webp")!, "image/webp")
        : null;

    private static async Task<JsonDocument> LoadSeedAsync(CancellationToken token)
    {
        await using var stream = typeof(YthrynModule).Assembly.GetManifestResourceStream(
            "MasterCompanion.Modules.Ythryn.Data.pilot.json")
            ?? throw new InvalidOperationException("Prepared content for module 'ythryn' is missing.");
        return await JsonDocument.ParseAsync(stream, cancellationToken: token);
    }
}
