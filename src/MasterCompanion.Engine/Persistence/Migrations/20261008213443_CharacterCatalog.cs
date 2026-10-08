using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MasterCompanion.Engine.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CharacterCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Characters",
                schema: "engine",
                columns: table => new
                {
                    CampaignId = table.Column<Guid>(type: "uuid", nullable: false),
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    BackstoryMaterialId = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    NotesMaterialId = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Characters", x => new { x.CampaignId, x.Id });
                    table.ForeignKey(
                        name: "FK_Characters_Campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalSchema: "engine",
                        principalTable: "Campaigns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Characters_Materials_BackstoryMaterialId",
                        column: x => x.BackstoryMaterialId,
                        principalSchema: "engine",
                        principalTable: "Materials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Characters_Materials_NotesMaterialId",
                        column: x => x.NotesMaterialId,
                        principalSchema: "engine",
                        principalTable: "Materials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Characters_BackstoryMaterialId",
                schema: "engine",
                table: "Characters",
                column: "BackstoryMaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_Characters_NotesMaterialId",
                schema: "engine",
                table: "Characters",
                column: "NotesMaterialId");

            // Instantiates independent narrative documents for the existing active roster.
            migrationBuilder.Sql("""
                WITH roster AS (
                    SELECT game."CampaignId", (member->>'id')::uuid AS id, member->>'name' AS name,
                        row_number() OVER (PARTITION BY game."CampaignId" ORDER BY member->>'id') AS position
                    FROM engine."GameStates" game, jsonb_array_elements(game."SnapshotJson"->'party') member
                ), documents AS (
                    SELECT roster.*, 'c-' || replace("CampaignId"::text, '-', '') || '-' || replace(id::text, '-', '') || suffix AS material_id,
                        position * 2 + delta AS order_offset
                    FROM roster CROSS JOIN (VALUES ('-b', 0), ('-n', 1)) roles(suffix, delta)
                )
                INSERT INTO engine."Materials" ("Id", "CampaignId", "Title", "Group", "FolderId", "DocumentJson", "DocumentSchemaVersion", "Revision", "SortOrder")
                SELECT material_id, "CampaignId", name, '', NULL,
                    '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb, 1, 1,
                    (COALESCE((SELECT max(existing."SortOrder") FROM engine."Materials" existing WHERE existing."CampaignId" = documents."CampaignId"), -1) + order_offset)::integer
                FROM documents;
                INSERT INTO engine."Characters" ("CampaignId", "Id", "Name", "Kind", "BackstoryMaterialId", "NotesMaterialId")
                SELECT game."CampaignId", (member->>'id')::uuid, member->>'name', 'player',
                    'c-' || replace(game."CampaignId"::text, '-', '') || '-' || replace(member->>'id', '-', '') || '-b',
                    'c-' || replace(game."CampaignId"::text, '-', '') || '-' || replace(member->>'id', '-', '') || '-n'
                FROM engine."GameStates" game, jsonb_array_elements(game."SnapshotJson"->'party') member;
                UPDATE engine."Campaigns" campaign SET "FoldersRevision" = "FoldersRevision" + 1
                WHERE EXISTS (SELECT 1 FROM engine."Characters" character WHERE character."CampaignId" = campaign."Id");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Characters",
                schema: "engine");
        }
    }
}
