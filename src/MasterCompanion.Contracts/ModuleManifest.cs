namespace MasterCompanion.Contracts;

public sealed record ModuleManifest(string Id, string Name, string Version, int ContentSchemaVersion,
    string StartMaterialId);
