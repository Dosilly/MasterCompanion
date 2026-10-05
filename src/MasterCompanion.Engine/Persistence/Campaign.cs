namespace MasterCompanion.Engine.Persistence;

public sealed class Campaign
{
    public Guid Id { get; set; }
    public required string Title { get; set; }
    public required string ModuleId { get; set; }
    public required string ModuleVersion { get; set; }
    public long FoldersRevision { get; set; }
    public long SessionsRevision { get; set; }
}
