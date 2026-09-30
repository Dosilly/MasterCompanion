namespace MasterCompanion.Engine.Persistence;

public sealed class CampaignFolder
{
    public required string Id { get; set; }
    public Guid CampaignId { get; set; }
    public required string Title { get; set; }
    public string? ParentId { get; set; }
    public int SortOrder { get; set; }
}
