namespace MasterCompanion.Engine.Persistence;

public sealed class CampaignGameState
{
    public Guid CampaignId { get; set; }
    public long Revision { get; set; }
    public required string SnapshotJson { get; set; }
}
