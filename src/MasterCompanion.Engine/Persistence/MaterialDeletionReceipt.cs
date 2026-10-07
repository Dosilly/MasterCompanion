namespace MasterCompanion.Engine.Persistence;

public sealed class MaterialDeletionReceipt
{
    public Guid CampaignId { get; set; }
    public Guid RequestId { get; set; }
    public required string RequestJson { get; set; }
    public required string MaterialId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
