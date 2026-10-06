namespace MasterCompanion.Engine.Persistence;

public sealed class CampaignSession
{
    public Guid CampaignId { get; set; }
    public Guid Id { get; set; }
    public required string Title { get; set; }
    public string Status { get; set; } = "planned";
    public required string PreparationMaterialId { get; set; }
    public required string NotesMaterialId { get; set; }
    public string Summary { get; set; } = string.Empty;
    public string FollowUp { get; set; } = string.Empty;
    public string PinnedMaterialIdsJson { get; set; } = "[]";
    public long Sequence { get; set; }
}
