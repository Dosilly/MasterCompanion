namespace MasterCompanion.Engine.Persistence;

public sealed class Material
{
    public required string Id { get; set; }
    public Guid CampaignId { get; set; }
    public required string Title { get; set; }
    public required string Group { get; set; }
    public string? FolderId { get; set; }
    public required string DocumentJson { get; set; }
    public int DocumentSchemaVersion { get; set; } = 1;
    public long Revision { get; set; } = 1;
    public int SortOrder { get; set; }
}
