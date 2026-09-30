using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Engine.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Material> Materials => Set<Material>();
    public DbSet<Campaign> Campaigns => Set<Campaign>();
    public DbSet<CampaignMap> Maps => Set<CampaignMap>();
    public DbSet<CampaignFolder> Folders => Set<CampaignFolder>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("engine");
        var campaign = modelBuilder.Entity<Campaign>();
        campaign.HasKey(x => x.Id);
        campaign.Property(x => x.Title).HasMaxLength(300);
        campaign.Property(x => x.ModuleId).HasMaxLength(80);
        campaign.Property(x => x.ModuleVersion).HasMaxLength(40);
        var material = modelBuilder.Entity<Material>();
        material.HasKey(x => x.Id);
        material.Property(x => x.Id).HasMaxLength(80);
        material.Property(x => x.Title).HasMaxLength(300);
        material.Property(x => x.Group).HasMaxLength(300);
        material.Property(x => x.FolderId).HasMaxLength(80);
        material.Property(x => x.DocumentJson).HasColumnType("jsonb");
        material.Property(x => x.Revision).IsConcurrencyToken();
        material.HasOne<Campaign>().WithMany().HasForeignKey(x => x.CampaignId);
        var folder = modelBuilder.Entity<CampaignFolder>();
        folder.HasKey(x => new { x.CampaignId, x.Id });
        folder.Property(x => x.Id).HasMaxLength(80);
        folder.Property(x => x.Title).HasMaxLength(300);
        folder.Property(x => x.ParentId).HasMaxLength(80);
        folder.HasOne<Campaign>().WithMany().HasForeignKey(x => x.CampaignId);
        folder.HasOne<CampaignFolder>().WithMany().HasForeignKey(x => new { x.CampaignId, x.ParentId })
            .OnDelete(DeleteBehavior.Restrict);
        material.HasOne<CampaignFolder>().WithMany().HasForeignKey(x => new { x.CampaignId, x.FolderId })
            .OnDelete(DeleteBehavior.Restrict);
        var map = modelBuilder.Entity<CampaignMap>();
        map.HasKey(x => x.Id);
        map.Property(x => x.Id).HasMaxLength(80);
        map.Property(x => x.DefinitionJson).HasColumnType("jsonb");
        map.HasOne<Campaign>().WithMany().HasForeignKey(x => x.CampaignId);
    }
}
