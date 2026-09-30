using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MasterCompanion.Engine.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MaterialFolders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Materials_CampaignId",
                schema: "engine",
                table: "Materials");

            migrationBuilder.AddColumn<string>(
                name: "FolderId",
                schema: "engine",
                table: "Materials",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Folders",
                schema: "engine",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ParentId = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Folders", x => new { x.CampaignId, x.Id });
                    table.ForeignKey(
                        name: "FK_Folders_Campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "engine",
                        principalTable: "Campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Folders_Folders_CampaignId_ParentId",
                        columns: x => new { x.CampaignId, x.ParentId },
                        principalSchema: "engine",
                        principalTable: "Folders",
                        principalColumns: new[] { "CampaignId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Materials_CampaignId_FolderId",
                schema: "engine",
                table: "Materials",
                columns: new[] { "CampaignId", "FolderId" });

            migrationBuilder.CreateIndex(
                name: "IX_Folders_CampaignId_ParentId",
                schema: "engine",
                table: "Folders",
                columns: new[] { "CampaignId", "ParentId" });

            migrationBuilder.AddForeignKey(
                name: "FK_Materials_Folders_CampaignId_FolderId",
                schema: "engine",
                table: "Materials",
                columns: new[] { "CampaignId", "FolderId" },
                principalSchema: "engine",
                principalTable: "Folders",
                principalColumns: new[] { "CampaignId", "Id" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Materials_Folders_CampaignId_FolderId",
                schema: "engine",
                table: "Materials");

            migrationBuilder.DropTable(
                name: "Folders",
                schema: "engine");

            migrationBuilder.DropIndex(
                name: "IX_Materials_CampaignId_FolderId",
                schema: "engine",
                table: "Materials");

            migrationBuilder.DropColumn(
                name: "FolderId",
                schema: "engine",
                table: "Materials");

            migrationBuilder.CreateIndex(
                name: "IX_Materials_CampaignId",
                schema: "engine",
                table: "Materials",
                column: "CampaignId");
        }
    }
}
