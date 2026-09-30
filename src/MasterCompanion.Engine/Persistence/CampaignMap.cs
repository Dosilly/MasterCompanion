namespace MasterCompanion.Engine.Persistence;

public sealed class CampaignMap
{
    public string Id { get; set; } = "";
    public Guid CampaignId { get; set; }
    public string DefinitionJson { get; set; } = "{}";
}
