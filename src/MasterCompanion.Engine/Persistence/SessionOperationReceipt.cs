namespace MasterCompanion.Engine.Persistence;

public sealed class SessionOperationReceipt
{
    public Guid CampaignId { get; set; }
    public Guid RequestId { get; set; }
    public long Revision { get; set; }
    public required string RequestJson { get; set; }
    public required string ResponseJson { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
