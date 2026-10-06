using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MasterCompanion.Engine.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FolderManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "FoldersRevision",
                schema: "engine",
                table: "Campaigns",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateTable(
                name: "FolderOperationReceipts",
                schema: "engine",
                columns: table => new
                {
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    Revision = table.Column<long>(type: "bigint", nullable: false),
                    RequestJson = table.Column<string>(type: "jsonb", nullable: false),
                    ResponseJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FolderOperationReceipts", x => new { x.CampaignId, x.RequestId });
                    table.ForeignKey(
                        name: "FK_FolderOperationReceipts_Campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "engine",
                        principalTable: "Campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FolderOperationReceipts_CampaignId_Revision",
                schema: "engine",
                table: "FolderOperationReceipts",
                columns: new[] { "CampaignId", "Revision" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FolderOperationReceipts",
                schema: "engine");

            migrationBuilder.DropColumn(
                name: "FoldersRevision",
                schema: "engine",
                table: "Campaigns");
        }
    }
}
