using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MasterCompanion.Engine.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialEngine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "engine");

            migrationBuilder.CreateTable(
                name: "Campaigns",
                schema: "engine",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ModuleId = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ModuleVersion = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Campaigns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Maps",
                schema: "engine",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: false),
                    DefinitionJson = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Maps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Maps_Campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "engine",
                        principalTable: "Campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Materials",
                schema: "engine",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Group = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    DocumentJson = table.Column<string>(type: "jsonb", nullable: false),
                    DocumentSchemaVersion = table.Column<int>(type: "integer", nullable: false),
                    Revision = table.Column<long>(type: "bigint", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Materials", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Materials_Campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "engine",
                        principalTable: "Campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Maps_CampaignId",
                schema: "engine",
                table: "Maps",
                column: "CampaignId");

            migrationBuilder.CreateIndex(
                name: "IX_Materials_CampaignId",
                schema: "engine",
                table: "Materials",
                column: "CampaignId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Maps",
                schema: "engine");

            migrationBuilder.DropTable(
                name: "Materials",
                schema: "engine");

            migrationBuilder.DropTable(
                name: "Campaigns",
                schema: "engine");
        }
    }
}
