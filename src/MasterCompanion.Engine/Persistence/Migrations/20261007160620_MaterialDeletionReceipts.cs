using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MasterCompanion.Engine.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MaterialDeletionReceipts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MaterialDeletionReceipts",
                schema: "engine",
                columns: table => new
                {
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestJson = table.Column<string>(type: "jsonb", nullable: false),
                    MaterialId = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaterialDeletionReceipts", x => new { x.CampaignId, x.RequestId });
                    table.ForeignKey(
                        name: "FK_MaterialDeletionReceipts_Campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "engine",
                        principalTable: "Campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MaterialDeletionReceipts",
                schema: "engine");
        }
    }
}
