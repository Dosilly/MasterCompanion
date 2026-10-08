using Microsoft.EntityFrameworkCore;

namespace MasterCompanion.Engine.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Material> Materials => Set<Material>();
    public DbSet<Campaign> Campaigns => Set<Campaign>();
    public DbSet<CampaignMap> Maps => Set<CampaignMap>();
    public DbSet<CampaignFolder> Folders => Set<CampaignFolder>();
    public DbSet<CampaignGameState> GameStates => Set<CampaignGameState>();
    public DbSet<GameOperation> GameOperations => Set<GameOperation>();
    public DbSet<FolderOperationReceipt> FolderOperationReceipts => Set<FolderOperationReceipt>();
    public DbSet<CampaignSession> Sessions => Set<CampaignSession>();
    public DbSet<CampaignCharacter> Characters => Set<CampaignCharacter>();
    public DbSet<SessionOperationReceipt> SessionOperationReceipts => Set<SessionOperationReceipt>();

    public DbSet<MaterialDeletionReceipt> MaterialDeletionReceipts => Set<MaterialDeletionReceipt>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("engine");
        var campaign = modelBuilder.Entity<Campaign>();
        campaign.HasKey(x => x.Id);
        campaign.Property(x => x.Title).HasMaxLength(300);
        campaign.Property(x => x.ModuleId).HasMaxLength(80);
        campaign.Property(x => x.ModuleVersion).HasMaxLength(40);
        campaign.Property(x => x.FoldersRevision).IsConcurrencyToken();
        campaign.Property(x => x.SessionsRevision).IsConcurrencyToken();
        var material = modelBuilder.Entity<Material>();
        material.HasKey(x => x.Id);
        material.Property(x => x.Id).HasMaxLength(80);
        material.Property(x => x.Title).HasMaxLength(300);
        material.Property(x => x.Group).HasMaxLength(300);
        material.Property(x => x.FolderId).HasMaxLength(80);
        material.Property(x => x.DocumentJson).HasColumnType("jsonb");
        material.Property(x => x.Revision).IsConcurrencyToken();
        material.HasOne<Campaign>().WithMany().HasForeignKey(x => x.CampaignId);
        var character = modelBuilder.Entity<CampaignCharacter>();
        character.HasKey(x => new { x.CampaignId, x.Id });
        character.Property(x => x.Name).HasMaxLength(100);
        character.Property(x => x.Kind).HasMaxLength(20);
        character.Property(x => x.BackstoryMaterialId).HasMaxLength(80);
        character.Property(x => x.NotesMaterialId).HasMaxLength(80);
        character.HasOne<Campaign>().WithMany().HasForeignKey(x => x.CampaignId);
        character.HasOne<Material>().WithMany().HasForeignKey(x => x.BackstoryMaterialId).OnDelete(DeleteBehavior.Restrict);
        character.HasOne<Material>().WithMany().HasForeignKey(x => x.NotesMaterialId).OnDelete(DeleteBehavior.Restrict);
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
        var gameState = modelBuilder.Entity<CampaignGameState>();
        gameState.HasKey(x => x.CampaignId);
        gameState.Property(x => x.Revision).IsConcurrencyToken();
        gameState.Property(x => x.SnapshotJson).HasColumnType("jsonb");
        gameState.HasOne<Campaign>().WithOne().HasForeignKey<CampaignGameState>(x => x.CampaignId);
        var operation = modelBuilder.Entity<GameOperation>();
        operation.HasKey(x => new { x.CampaignId, x.RequestId });
        operation.Property(x => x.Kind).HasMaxLength(40);
        operation.Property(x => x.RequestJson).HasColumnType("jsonb");
        operation.Property(x => x.BeforeJson).HasColumnType("jsonb");
        operation.Property(x => x.ResponseJson).HasColumnType("jsonb");
        operation.HasIndex(x => new { x.CampaignId, x.Revision }).IsUnique();
        operation.HasIndex(x => new { x.CampaignId, x.Undone, x.Revision });
        operation.HasOne<Campaign>().WithMany().HasForeignKey(x => x.CampaignId);
        var folderReceipt = modelBuilder.Entity<FolderOperationReceipt>();
        folderReceipt.HasKey(x => new { x.CampaignId, x.RequestId });
        folderReceipt.Property(x => x.RequestJson).HasColumnType("jsonb");
        folderReceipt.Property(x => x.ResponseJson).HasColumnType("jsonb");
        folderReceipt.HasIndex(x => new { x.CampaignId, x.Revision }).IsUnique();
        folderReceipt.HasOne<Campaign>().WithMany().HasForeignKey(x => x.CampaignId);
        var session = modelBuilder.Entity<CampaignSession>();
        session.HasKey(x => new { x.CampaignId, x.Id });
        session.Property(x => x.Title).HasMaxLength(300);
        session.Property(x => x.Status).HasMaxLength(20);
        session.Property(x => x.PreparationMaterialId).HasMaxLength(80);
        session.Property(x => x.NotesMaterialId).HasMaxLength(80);
        session.Property(x => x.Summary).HasMaxLength(20_000);
        session.Property(x => x.FollowUp).HasMaxLength(20_000);
        session.Property(x => x.PinnedMaterialIdsJson).HasColumnType("jsonb");
        session.HasIndex(x => new { x.CampaignId, x.Sequence }).IsUnique();
        session.HasIndex(x => x.CampaignId).IsUnique().HasFilter("\"Status\" = 'active'");
        session.HasOne<Campaign>().WithMany().HasForeignKey(x => x.CampaignId);
        session.HasOne<Material>().WithMany().HasForeignKey(x => x.PreparationMaterialId).OnDelete(DeleteBehavior.Restrict);
        session.HasOne<Material>().WithMany().HasForeignKey(x => x.NotesMaterialId).OnDelete(DeleteBehavior.Restrict);
        var deletionReceipt = modelBuilder.Entity<MaterialDeletionReceipt>();
        deletionReceipt.HasKey(x => new { x.CampaignId, x.RequestId });
        deletionReceipt.Property(x => x.MaterialId).HasMaxLength(80);
        deletionReceipt.Property(x => x.RequestJson).HasColumnType("jsonb");
        deletionReceipt.HasOne<Campaign>().WithMany().HasForeignKey(x => x.CampaignId);
        var sessionReceipt = modelBuilder.Entity<SessionOperationReceipt>();
        sessionReceipt.HasKey(x => new { x.CampaignId, x.RequestId });
        sessionReceipt.Property(x => x.RequestJson).HasColumnType("jsonb");
        sessionReceipt.Property(x => x.ResponseJson).HasColumnType("jsonb");
        sessionReceipt.HasIndex(x => new { x.CampaignId, x.Revision }).IsUnique();
        sessionReceipt.HasOne<Campaign>().WithMany().HasForeignKey(x => x.CampaignId);
    }
}
