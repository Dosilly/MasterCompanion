# MVP execution plan — MasterCompanion

Version 0.6 · 2 October 2026 · phase one accepted

**Status and scope:** phase one is complete and accepted by the user on 2 October 2026. Delivered scope includes Ythryn materials, map, reader, existing-material editing, autosave, party editing, game time, shared rests, Arcane Blight and sequential undo. Full offline operation is no longer required. The [acceptance record](11-MVP-acceptance.md) lists final scope, evidence and later work; [implementation status](07-Implementation-status.md) and [architecture](06-Module-architecture.md) retain delivery details. The original 21-hour budget is historical planning, not measured effort.

[The minimum plan](04-MVP-minimum-scope.md) separates first-version scope from backlog. [The workshop](03-Implementation-workshop.md) preserves decisions and context. Technical details below are the plan author's recommendations within the accepted stack rather than separate user answers.

Current roadmap update, 5 October 2026: campaign notes, full-text search, material
preloading, folder management/context menus and URL navigation have been delivered
locally. See [near-term improvements](15-Near-term-improvements.md) and
[implementation status](07-Implementation-status.md). [Sessions and pinned
materials](26-Campaign-sessions.md) were delivered on 5 October. The next product
slice is map authoring, followed by multiple campaigns. Neutral dialog/feedback
extraction remains separate technical scope in [the UI plan](17-Reusable-frontend-ui.md).

Navigation delivery, 4 October 2026: [URL-based workspace navigation](22-Workspace-routing.md)
supports direct links, browser history and restoring the addressed view on reload
while preserving mounted material sessions during in-app navigation. Routing does
not provide unsaved-draft recovery after reload.

Closure update, 2 October: the [gameplay delivery record](09-Gameplay-implementation.md) documents backend, frontend, party editing and the latest Arcane Blight schedule. Maintained module defaults contain 106 materials, 10 folders and 29 map markers. Earlier counts retain their historical meaning. User acceptance and existing verification close this plan; no additional application checks are scheduled for phase one.

This plan concerns the generic MasterCompanion engine and module contract. Ythryn is the concrete pilot implementation and acceptance material source. Reader, editing, folder hierarchy, maps and tabs operate on neutral contracts. Arcane Blight rules belong to the module. [Architecture](06-Module-architecture.md) defines engine, module and campaign.

## 1. Recommended versions and code organization

| Element | Recommendation | Basis |
|---|---|---|
| Backend | .NET 10 LTS, ASP.NET Core Minimal APIs. | [.NET 10 support through November 2028](https://dotnet.microsoft.com/en-us/platform/support/policy); [Minimal APIs](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/apis?view=aspnetcore-10.0) suit small use-case endpoints. |
| Database and ORM | PostgreSQL 18, EF Core 10, Npgsql EF provider 10. | [PostgreSQL 18 support](https://www.postgresql.org/support/versioning/); [Npgsql provider 10](https://www.npgsql.org/efcore/release-notes/10.0.html) supports EF 10 and PostgreSQL 18 features. |
| Frontend | Angular 22 SPA, standalone components, HttpClient and signal-based local view state. | [Angular 22 active support](https://angular.dev/reference/releases); [compatibility table](https://angular.dev/reference/versions) defines supported Node/TypeScript versions. |
| Startup | C# Aspire 13.6.0 AppHost; PostgreSQL in Docker, API/Angular as development processes. | AppHost, PostgreSQL and JavaScript packages pinned; joint Windows startup verified. |
| Editor | Accepted Tiptap 3; shared extensions for conversion, reader and editor. | Earlier D-27/D-28; day-one trial verifies integration and real-document preservation. |

Pinned versions: SDK 10.0.303, EF Core 10.0.12, Npgsql 10.0.3, Aspire 13.6.0, PostgreSQL 18.6, Angular 22.2.0, TypeScript 6.0.3 and Tiptap 3.31.4. npm dependencies are locked. Initial preparation downloads dependencies; subsequent runs use local packages/images. Styles and system fonts require no internet.

Docker pins its SDK independently (10.0.401); the packaged production runtime and Windows commands are documented in [the runtime record](10-Docker-local-runtime.md) and [README](../../README.md). Full offline operation is not an acceptance requirement.

Environment on 30 September: SDK 10.0.303 and Node 24.19.0 work. After Docker Desktop startup, engine 29.4.3 provided a PostgreSQL 18.6 container. Aspire started database migration, campaign preparation, API and Angular. Reads/writes were verified against this database, including after environment restart.

Implemented project structure (selected files):

```text
src/
  MasterCompanion.AppHost/
  MasterCompanion.ServiceDefaults/
  MasterCompanion.Api/
    Program.cs                      # Composition and DI
  MasterCompanion.Contracts/
    ICampaignModule.cs
    CampaignGameplay.cs
  MasterCompanion.Engine/
    Features/
      Workspace/GetWorkspace.cs
      Materials/GetMaterial.cs
      Materials/SaveMaterial.cs
      Assets/GetAsset.cs
      Gameplay/GameplayEndpoints.cs
      Gameplay/GameplayService.cs
    Persistence/
  MasterCompanion.Modules.Ythryn/
    YthrynModule.cs
    Gameplay/YthrynGameRules.cs
    Data/
  mastercompanion-web/
    projects/
      contracts/
      engine/src/lib/features/
        workspace/
        materials/
        maps/
        gameplay/
      ythryn/
    src/main.ts                     # Library composition and DI
    tools/
      prepare-module.mjs
      import-ythryn-poc.mjs
      check-boundaries.mjs
      content.test.mjs
      autosave.test.mjs
      verify-api.mjs
```

A slice contains its endpoint, input/output, validation and persistence. Arcane Blight rules/slices belong to Ythryn; neutral clock and operation history to the engine. They communicate through contracts without module access to the engine DbContext. Direct calls remain recommended without MediatR or generic repositories. Separate projects isolate modules rather than every technical layer.

## 2. Data needed for the first version

| Data | Main elements |
|---|---|
| `Campaign` | ID, name, module ID/version and initialization-complete marker. |
| `Material` | ID, campaign, title, type, JSON document, schema version, save revision; source section ID, document group and order. |
| `CampaignFolder` | Campaign, stable ID, title, optional parent and order. Material references a folder; navigation supports arbitrary depth. |
| `Map`, `Marker` | Image asset and source dimensions; marker code/image-relative percentage position and target material ID. |
| `Asset` | ID, content type and local file. Content/map references use IDs; the API serves the file. |
| `CampaignGameState` | Revision, neutral time and party plus versioned module JSON. Ythryn owns the disease schema and interpretation; the implemented operation contract is documented in gameplay delivery. |
| `GameOperation` | Campaign, sequence, request ID, operation type, before/after states and undo information. |

The first version uses one prepared campaign. Materials remain separate from game state, so clock undo does not change notes. World time is elapsed minutes since entry rather than Windows time zone or real date.

Original conversion accounted for 142 units from 16 POC documents. Maintained defaults now contain 106 materials in 10 folders. Navigation-only indexes were removed; five Fenes documents were consolidated preserving content, tables and anchors. Y1–Y29 and Y19 rooms sit directly in one folder; the player-thread branch for Fenes contains five documents. Editorial materials preserve nesting. Y4 and individual Y19 rooms remain specific materials. Tabs open on demand. Source references map to material IDs and section anchors; review also accounts for bibliographic references and missing targets. Counts 16/142/29 describe historical migration, not current material count or future limits.

Initialize campaigns once. Restart or module regeneration does not overwrite edited materials. Applying new module content to existing campaigns is future scope. Database/files have durable local storage.

## 3. Main-view workflow

1. Open prepared Ythryn materials. The user reads in a wide area with map access, tabs and name filtering.
2. A marker opens/activates its location description. Tab changes retain reading position; map return retains zoom/pan.
3. "Edit" enables the existing-material editor. A small toolbar formats text and inserts campaign links. Tables, images and highlights preserve content through loading, editing and saving.
4. Autosave serializes writes per document using expected revision. "Saved" requires backend confirmation. Errors/conflicts retain local text and offer recovery. Leaving editing waits for confirmed saving.
5. The party tab configures characters before gameplay and supports later renaming, additions and removals. Stable IDs preserve module state. Newly added characters start healthy at current engine time with DC 15 and an exposure deadline 12 hours later.
6. The game tab offers building search (30 minutes), short rest (1 hour), long rest (8 hours) and custom advances. Long rest also records its end as part of the same operation; an ordinary advance does not record a rest.
7. The tool shows character states and each earliest overdue check. The GM enters success/failure and, for infected-character success, a d6 result. The next due matter appears if applicable. The view does not permanently consume note space.
8. "Undo" identifies the latest operation and restores its previous state. Further operations can be undone sequentially. Persistent history supports undo after restart. The editor has independent Undo/Redo during current editing.

The basic map uses its source image and percentage positions. Zoom scales image and markers together. Zoom in/out, fit and mouse pan remain available; dragging should not accidentally open descriptions. Marker editing and new-map uploads stay in backlog.

## 4. Arcane Blight and operation persistence

The final user-confirmed rules retain healthy exposure every 12 hours. Exposure failure infects without adding a recovery failure. Infected characters resolve recovery every 12 hours or after long rest, whichever comes first; each recovery resets the interval. A rest coinciding with a timer produces one check. Success reduces DC by the supplied d6, DC zero gives immunity and the third recovery failure transforms the character. Magical healing restores health without immunity and starts a new 12-hour exposure interval. See [the final rules revision](09-Gameplay-implementation.md#arcane-blight-countdown-and-recovery-revision--2-october-2026).

The module computes the earliest due exposure or recovery independently for each character. Infected recovery orders timer deadlines and eligible rest ends chronologically. Countdown values use confirmed engine time and clamp overdue checks to zero. Game time remains independent of the operating system clock.

Acceptance example: the party is healthy at hour 10; the GM completes an 8-hour rest and the clock shows 18. Exposure from hour 12 remains due. Failure infects the character at hour 12, revealing a check for rest completed at hour 18. The clock remains 18. Another character's state is unaffected.

Each game operation carries request ID and expected state revision. State and operation record persist in one transaction; repeated identity returns the confirmed result. Undo restores prior game state, marks the operation undone and advances current revision. Two browser tabs cannot silently overwrite game state. Out-of-order undo and game Redo are later scope.

The implemented neutral `ICampaignGameRules` contract separates engine coordination from module rules. The engine persists module JSON without interpreting disease fields; Ythryn validates and transforms its own state. Real PostgreSQL evidence for atomic writes, retries, conflicts and undo is recorded in [gameplay delivery](09-Gameplay-implementation.md).

## 5. Tasks across seven days

Historical budget only; these delivery steps are closed. The current acceptance decision supersedes the original offline gate.

Each day budgets about 3 hours. The agent prepares code, conversion and checks; the user starts, reviews and evaluates within the same budget. This table preserves original allocation rather than measured delivery time or a current schedule. Conversion's 16/142 counts are historical; navigation now has 106 materials in 10 folders. [Gameplay delivery](09-Gameplay-implementation.md) records the delivery sequence.

| Day | Tasks | Completion condition |
|---|---|---|
| 1 | Verify Docker engine; select/pin versions; create AppHost, API, Angular and database schema. Check conversion/persistence of Y4 and a table fragment in Tiptap. | All processes start; the edited example survives save/load without text, table or highlight loss. Resolve unsupported elements before mass migration. |
| 2 | Extract/convert act 7, map and IDs; prepare campaign, reader and navigation. Account for Obsidian, SRD and two act 6 references. | Report covers 16 documents, 142 sections and 29 markers. No missing source text or active missing-material links; required rule gaps are recorded and filled before acceptance. |
| 3 | Tabs, name filtering, internal links; map controls, zoom/pan and description opening. | Every marker has a valid target. Y4, Y19 and rooms are reachable; return preserves context. Long descriptions are readable at Full HD. |
| 4 | Explicit editing, small toolbar, paste, Markdown insertion, revision-protected saving and failures. | Edits survive restart without replacement by module defaults. Reading does not start editing; tables/blocks survive saves. |
| 5 | Pure C# Arcane Blight rules, party setup, game state, time/rest and boundary/dependency tests. | Exposure, infection, d6, immunity, transformation, healing, time advance and independent outcomes under shared rest pass. |
| 6 | Tool view, outcome input, persistent operations/undo, transactions, revisions and retry. | UI scenario 10 h → rest → exposure → infection → rest check works. Retry/undo survive restart without note changes. |
| 7 | Local acceptance, readability/content review, fixes and Windows runtime/data instructions. | Accepted by the user on 2 October based on successful application testing and existing implementation evidence. Full offline operation was removed. The legacy POC is no longer a build dependency. |

Reassess the estimate after day one. Address delays first by reducing extra menus, animations and decoration; complete content, editing and Arcane Blight remain required. If the budget cannot cover them, agree a date based on concrete remaining work. A reader lacking editing or mechanics is not the completed MVP.

## 6. Checks protecting the outcome

- Conversion: account for every source ID; no truncated content; valid marker/link targets. Record formatting differences and missing references rather than hide them.
- Rules: exactly 12 hours, multiple overdue deadlines, infection dated at exposure, newly revealed rest checks, independent characters, d6 from 1 to 6, DC zero, third failure, healing without immunity and no further checks for immune/transformed characters.
- Persistence: note write/read, restart without overwrite, idempotent operation replay, revision conflicts and game undo without document undo. Rules need unit tests; transactions/persistence require real PostgreSQL.
- View: real map, long descriptions, editor tables/blocks, retained reading position and visible autosave failures. Full HD and both-theme evidence is recorded in delivery history. Full offline operation is no longer required. No further application checks were run for this documentation closure.

The first MVP excludes new separate notes, folder configurator, map editor, further trackers, saved-content version history, accounts and AWS. Retain them in backlog; the first-week target concerns the scope above. Campaign export/import remains removed from the plan and backlog. Normal persistence remains required; local backups and preservation probes do not. Production protection belongs to the AWS stage under [data policy](21-Development-data-and-AWS-protection.md).

## 7. Module sources and future editor

30 September agreement: document sources are maintained in Markdown; a better editor is future work. Each material has its own file, YAML metadata and stable IDs. Manifest, navigation, map and assets are separate. Compilation creates JSON required by the current module contract; the result is neither manually edited source nor Git-versioned content. Original POC remains a reference, and importing never overwrites authored sources. Migration tests compare all documents, folders and map with reference data.

The campaign editor stores Tiptap documents in the database. Changing Markdown or rebuilding a module alone does not replace its existing campaign copy. Applying module updates may overwrite local campaign notes during development. Production authored-change protection belongs to the AWS stage under [data policy](21-Development-data-and-AWS-protection.md).

After MVP, plan:

- Visual module-source editing: individual materials, reader-compatible preview, Markdown/metadata saving rather than combined JSON editing.
- Better table, collapsible-block, anchor, image and material-link selection support. Existing HTML and IDs must survive losslessly; arbitrary HTML is not assumed to convert losslessly to plain Markdown.
- Clear separation of module-source editing and campaign-copy editing, with authored-change protection before production use.
- Package validation/preview before release and deliberate application to campaigns. Local development permits overwriting notes; production must protect authored changes.

Future editor acceptance: opening, changing and resaving representative materials preserves content, structure, anchors and map targets; failures preserve local drafts. This stage is outside the current minimum and does not replace required Arcane Blight.

After repository reorganization, the POC is historical input rather than a current dependency. Builds/tests use maintained Markdown and material-reference fixtures. The optional importer requires an explicit external HTML copy and a new output directory. Do not recreate the removed reference directory. Documentation/status stay in `docs/planning`; README provides stable English project information.
