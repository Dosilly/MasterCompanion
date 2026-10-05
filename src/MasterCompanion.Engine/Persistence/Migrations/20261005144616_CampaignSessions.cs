using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MasterCompanion.Engine.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CampaignSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "SessionsRevision",
                schema: "engine",
                table: "Campaigns",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.CreateTable(
                name: "SessionOperationReceipts",
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
                    table.PrimaryKey("PK_SessionOperationReceipts", x => new { x.CampaignId, x.RequestId });
                    table.ForeignKey(
                        name: "FK_SessionOperationReceipts_Campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "engine",
                        principalTable: "Campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Sessions",
                schema: "engine",
                columns: table => new
                {
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: false),
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PreparationMaterialId = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    NotesMaterialId = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Summary = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: false),
                    FollowUp = table.Column<string>(type: "character varying(20000)", maxLength: 20000, nullable: false),
                    PinnedMaterialIdsJson = table.Column<string>(type: "jsonb", nullable: false),
                    Sequence = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sessions", x => new { x.CampaignId, x.Id });
                    table.ForeignKey(
                        name: "FK_Sessions_Campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "engine",
                        principalTable: "Campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Sessions_Materials_NotesMaterialId",
                        column: x => x.NotesMaterialId,
                        principalSchema: "engine",
                        principalTable: "Materials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sessions_Materials_PreparationMaterialId",
                        column: x => x.PreparationMaterialId,
                        principalSchema: "engine",
                        principalTable: "Materials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SessionOperationReceipts_CampaignId_Revision",
                schema: "engine",
                table: "SessionOperationReceipts",
                columns: new[] { "CampaignId", "Revision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_CampaignId",
                schema: "engine",
                table: "Sessions",
                column: "CampaignId",
                unique: true,
                filter: "\"Status\" = 'active'");

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_CampaignId_Sequence",
                schema: "engine",
                table: "Sessions",
                columns: new[] { "CampaignId", "Sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_NotesMaterialId",
                schema: "engine",
                table: "Sessions",
                column: "NotesMaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_Sessions_PreparationMaterialId",
                schema: "engine",
                table: "Sessions",
                column: "PreparationMaterialId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SessionOperationReceipts",
                schema: "engine");

            migrationBuilder.DropTable(
                name: "Sessions",
                schema: "engine");

            migrationBuilder.DropColumn(
                name: "SessionsRevision",
                schema: "engine",
                table: "Campaigns");
        }
    }
}
