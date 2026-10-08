namespace MasterCompanion.Engine.Persistence;

public sealed class CampaignCharacter
{
    public Guid CampaignId { get; set; }
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string Kind { get; set; }
    public required string BackstoryMaterialId { get; set; }
    public required string NotesMaterialId { get; set; }
}
