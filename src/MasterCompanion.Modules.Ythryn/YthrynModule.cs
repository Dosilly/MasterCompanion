using System.Text.Json;
using MasterCompanion.Contracts;

namespace MasterCompanion.Modules.Ythryn;

public sealed class YthrynModule : ICampaignModule
{
    private readonly IReadOnlyDictionary<string, AssetSource> assets;

    public ModuleManifest Manifest { get; }

    public YthrynModule()
    {
        var assembly = typeof(YthrynModule).Assembly;
        using var stream = assembly.GetManifestResourceStream("MasterCompanion.Modules.Ythryn.Data.module.json")
            ?? throw new InvalidOperationException("Module manifest is missing.");
        using var document = JsonDocument.Parse(stream);
        Manifest = document.RootElement.Deserialize<ModuleManifest>(new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }) ?? throw new InvalidOperationException("Module manifest is invalid.");
        var resources = assembly.GetManifestResourceNames().ToDictionary(name => name.Replace('\\', '/'));
        assets = document.RootElement.GetProperty("assets").EnumerateArray().ToDictionary(
            asset => RequiredString(asset, "id"),
            asset =>
            {
                var file = RequiredString(asset, "file");
                if (!file.StartsWith("assets/", StringComparison.Ordinal))
                    throw new InvalidOperationException("Module assets must be under the assets directory.");
                var logicalName = "ModuleAssets/" + file["assets/".Length..];
                if (!resources.TryGetValue(logicalName, out var resource))
                    throw new InvalidOperationException($"Embedded module asset is missing: {file}");
                return new AssetSource(resource, RequiredString(asset, "contentType"));
            });
    }

    public async Task<IReadOnlyList<SeedFolder>> LoadFoldersAsync(CancellationToken cancellationToken = default)
    {
        using var document = await LoadSeedAsync(cancellationToken);
        return document.RootElement.GetProperty("folders").EnumerateArray().Select(item => new SeedFolder(
            RequiredString(item, "id"), RequiredString(item, "title"),
            item.GetProperty("parentId").GetString(), item.GetProperty("sortOrder").GetInt32())).ToList();
    }

    public async Task<IReadOnlyList<SeedMaterial>> LoadMaterialsAsync(CancellationToken cancellationToken = default)
    {
        using var document = await LoadSeedAsync(cancellationToken);
        return document.RootElement.GetProperty("materials").EnumerateArray().Select(item => new SeedMaterial(
            RequiredString(item, "id"), RequiredString(item, "title"),
            RequiredString(item, "group"), item.GetProperty("document").Clone(),
            item.GetProperty("sortOrder").GetInt32(), item.GetProperty("folderId").GetString())).ToList();
    }

    public async Task<IReadOnlyList<SeedMap>> LoadMapsAsync(CancellationToken cancellationToken = default)
    {
        using var document = await LoadSeedAsync(cancellationToken);
        return document.RootElement.GetProperty("maps").EnumerateArray().Select(item =>
            new SeedMap(RequiredString(item, "id"), item.Clone())).ToList();
    }

    public ModuleAsset? OpenAsset(string assetId)
    {
        if (!assets.TryGetValue(assetId, out var asset)) return null;
        var stream = typeof(YthrynModule).Assembly.GetManifestResourceStream(asset.ResourceName)
            ?? throw new InvalidOperationException($"Embedded module asset is missing: {assetId}");
        return new ModuleAsset(stream, asset.ContentType);
    }

    private static async Task<JsonDocument> LoadSeedAsync(CancellationToken token)
    {
        await using var stream = typeof(YthrynModule).Assembly.GetManifestResourceStream(
            "MasterCompanion.Modules.Ythryn.Data.pilot.json")
            ?? throw new InvalidOperationException("Prepared content for module 'ythryn' is missing.");
        return await JsonDocument.ParseAsync(stream, cancellationToken: token);
    }

    private static string RequiredString(JsonElement element, string property) =>
        element.GetProperty(property).GetString()
        ?? throw new InvalidOperationException($"Module content field is missing: {property}");

    private sealed record AssetSource(string ResourceName, string ContentType);
}
