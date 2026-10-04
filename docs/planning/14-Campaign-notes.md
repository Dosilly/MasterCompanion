# Campaign notes: delivery and implementation plan

3 October 2026

## Status and delivery order

The user approved the development order and requested preparation of an isolated
worktree and subagent responsibilities. This document records the first slice;
ordinary note creation is implemented and verified as recorded below.

The worktree starts at commit `bdfcc9c` on the local branch
`codex/campaign-notes-current`. The original checkout remains unchanged. The worktree is
attached to the current chat; no separate user-owned chats are needed.

Delivery order: ordinary campaign notes, full-text search, session records and
pinned materials, campaign export/import, then map authoring and multiple
campaigns. Search starts after the note creation contract is implemented and
verified. Each later slice receives its own scope and verification plan.

Related records: [user stories](02-User-stories.md#us-04-free-form-text-and-entities),
[accepted MVP](11-MVP-acceptance.md), [architecture](06-Module-architecture.md).

## First slice

Create an ordinary campaign-owned material with a title and an existing folder,
or no folder. Reuse the current Material persistence model, supported rich-document
schema, reader, explicit edit action, internal links and revision-protected
autosave. Creating a note must not change module sources, other materials, maps,
party data, game time, module state or game operation history.

The UI offers New note in material navigation. A native modal dialog accepts the
title and a folder selected from the current campaign hierarchy. Default to the
active material's folder when available, otherwise unfiled. After confirmed
creation, add the summary once by stable ID, open the note in read mode, expand
its ancestors and reveal its selection. Editing remains a separate explicit
action. Preserve existing sessions, editors, drafts, scroll positions and map
pan/zoom; do not reload the entire workspace to add a note.

Folder creation/renaming/movement, material renaming/movement/deletion, templates,
entity fields, asset uploads, document version history, full-text search and
session records are outside this first slice.

## Agreed API and recovery contract

The preparation agents agreed the following contract; keep producers and consumers aligned:

- `POST /api/campaigns/{campaignId}/materials` accepts `id` (a nonempty UUID),
  `title` and nullable `folderId`. The UUID is generated once per confirmed
  creation attempt, independently of names, and retained for retries.
- The server derives a canonical `note-{UUID}` material ID and creates a
  schema-1 document containing an empty paragraph. Initial revision is 1.
  Arbitrary document JSON, group labels and sort order are not creation inputs.
- Validate the campaign, title (trimmed, nonempty, at most 300 characters;
  reject control characters), and folder identifier (at most 80 characters,
  existing in that campaign). Accept Polish titles as authored content.
  Limit the JSON body to 8 KiB for both declared-length and chunked requests;
  bound depth to 4 and reject unknown/duplicate fields.
- Derive Group from the chosen folder title, or use an empty value for unfiled
  notes. Translate the empty-group presentation in the frontend; do not persist
  UI labels as authored content.
- Return the current MaterialDto: 201 on initial creation, 200 for a matching
  replay. Replay compares campaign, immutable creation title and folder, never
  the current document. A conflicting identity returns 409 with a stable error
  code. Repeated and concurrent identical submissions must create exactly one
  row; a replay after editing returns the saved document and current revision.
- Title and folder remain immutable in this slice. Adding rename/move later
  requires an immutable creation receipt or another equally explicit design;
  comparing mutable metadata is not a permanent idempotency solution.
- Keep campaign/folder queries scoped and asynchronous, propagate cancellation,
  and handle only the expected unique-identity collision as a replay/conflict.
  Catch only the material primary-key unique violation, detach the failed insert,
  and reread to resolve concurrent identical requests. Unexpected database errors
  must propagate. Append within campaign ordering and sort workspace ties by ID.

The frontend stores the exact campaign-scoped request in tab session storage
before sending. If storage is unavailable, retain the draft and do not send.
While a request is pending or its outcome is uncertain, prevent a fresh identity
or modified payload from replacing it. A recovery action retries the original
identity and payload after connection loss or reload. Map errors to localized
messages and preserve the title and folder. Handle confirmed creation separately
from subsequent material-opening failures so recovery cannot create a duplicate.
Never overwrite an existing MaterialSession draft with a replay response.

This creation contract needs no persistence schema change if it uses the existing
Material row and the immutable metadata above. Any newly discovered schema
requirement needs an additive EF migration and updated snapshot; do not edit
applied migrations. Review the existing initialization behavior, but avoid
unrelated compatibility cleanup in this slice.

## Responsibilities and execution boundaries

| Owner | Implementation ownership |
|---|---|
| Primary agent | Freeze API/DTO contract; frontend contracts public entry point; API endpoint registration; solution/package test wiring; architecture/status documentation; integration and final checks. |
| Backend subagent | Engine Materials/CreateMaterial.cs; deterministic tie ordering in Workspace/GetWorkspace.cs; focused tests/MasterCompanion.Materials.Tests project; validation, scoped persistence and replay/concurrency. |
| Frontend subagent | Workspace integration; new material-creation state and dialog; matching locale keys; engine styles; focused creation/recovery/workspace tests; localized empty-group display where needed. |
| Review subagent | Independent review of contract, data preservation, replay/concurrency, accessibility and verification evidence; report findings before editing another owner's files. |

The initial preparation agents performed read-only analysis. Implementation
proceeded after contract freeze; the review agent added browser coverage and
independently reviewed source and screenshots. All agents must set the explicit worktree directory
for commands because their default working directory remains the original
checkout. Do not edit another owner's files without coordinating first. The
primary agent handles shared contract and composition files to prevent overlap.
Backend/frontend work can proceed in parallel after the contract is frozen;
integration, migrations, dependency installation and runtime control are serial.

## Acceptance and scoped verification

1. Create root and nested-folder notes; keep stable IDs, navigation visibility,
   links and correct read/edit behavior. Duplicate display titles are allowed.
2. Reject invalid titles, UUIDs, unknown fields, oversized inputs, missing
   campaigns and missing/foreign folders without inserting any row.
3. Verify exact and concurrent replay, changed-payload conflicts and replay after
   autosave. The saved document/revision must survive a lost creation response.
4. Simulate connection loss, malformed responses, tab reload and blocked storage.
   Preserve the draft and original request; never claim an unconfirmed save.
5. Creating/opening a note preserves an existing unsaved material draft, editor
   instance, selection, map position and independent gameplay state.
6. Confirm new note edits use the existing optimistic revision conflict behavior,
   save ordering, and tab-close/Finish editing persistence rules.
7. Compare representative existing documents and revisions, folders, maps,
   game state and journal before/after creation and application initialization.
   Use a separate PostgreSQL database and preserve every existing authored row.
8. Inspect the creation dialog, recovery flow and new material at 1920x1080 in
   both themes; keyboard focus, accessible labels, focus restoration, localized
   errors, console output and overflow are part of the affected-view check.

Add focused creation tests rather than use the live material-write probe.
`tools/verify-api.mjs` currently assumes exactly 142 materials despite current
module defaults containing 106; its fixed count is unsuitable for this feature.
Do not treat it as note-creation acceptance evidence.

Run the new backend tests against real isolated PostgreSQL. Run the new frontend
creation/workspace tests and the affected autosave tests. Build the backend
consumer(s) and frontend libraries/host because API integration and public
frontend contracts change. The frontend build includes localization and boundary
checks. Update [architecture](06-Module-architecture.md) and
[implementation status](07-Implementation-status.md) with actual outcomes.
The delivery record below lists the actual commands, outcomes and limitations.

## Worktree tooling and runtime

Git, Node.js, pnpm and dotnet commands are available. At initial preparation the checkout
had no frontend dependencies or restored .NET assets; installation and restoration
are now complete.
For a fresh checkout, prepare dependencies serially:

```powershell
pnpm --dir src/mastercompanion-web install --frozen-lockfile
dotnet restore MasterCompanion.slnx
```

Do not start a second unmodified AppHost from this worktree: it uses the live
`mastercompanion-postgres` volume and frontend port 4200. Configure an isolated
test database and different loopback ports for browser/HTTP checks. Never mount
the same database volume in two PostgreSQL processes, restart the user's runtime
for preparation, or apply test migrations to their campaign.

Initial preparation did not build or run the application. Implementation used
locked dependencies and a separate disposable PostgreSQL container; the live
application and user database were not used. No pushes or merges were performed.

## Delivered behavior and evidence

The first slice is implemented. Implementation used merged trunk `bdfcc9c` and
branch `codex/campaign-notes-current`. Local deployment is recorded below.

Commands actually run from the worktree:

```powershell
pnpm --dir src/mastercompanion-web install --frozen-lockfile --offline
dotnet restore MasterCompanion.slnx --ignore-failed-sources
dotnet restore tests/MasterCompanion.Materials.Tests.Integration/MasterCompanion.Materials.Tests.Integration.csproj --ignore-failed-sources
dotnet build src/MasterCompanion.Api/MasterCompanion.Api.csproj --no-restore
dotnet build tests/MasterCompanion.Materials.Tests.Integration/MasterCompanion.Materials.Tests.Integration.csproj --no-restore
dotnet build MasterCompanion.slnx --no-restore
# Start Docker; Testcontainers creates isolated PostgreSQL databases automatically.
dotnet test tests/MasterCompanion.Materials.Tests.Integration
pnpm --dir src/mastercompanion-web test:notes
pnpm --dir src/mastercompanion-web test:autosave
pnpm --dir src/mastercompanion-web check:ui
pnpm --dir src/mastercompanion-web test:ui notes.spec.ts
pnpm --dir src/mastercompanion-web test:ui notes.spec.ts --grep 'Root note creation'
pnpm --dir src/mastercompanion-web test:ui --grep '@visual' --update-snapshots=all
pnpm --dir src/mastercompanion-web test:ui --grep '@visual'
```

The focused .NET projects and final full solution build reported zero warnings/errors. Real PostgreSQL/HTTP tests passed
strict type/size/depth/media checks, campaign/folder scope, exact and concurrent
replay, changed-payload conflicts, revision-protected saves, replay after editing,
cancellation, injected unexpected persistence failure and retry, exact preservation
of authored campaign/game data, and existing-campaign reinitialization. No EF
migration was needed. The test runner refuses non-loopback hosts and any database
name except `mastercompanion_materials_test`.

All twelve new creation/workspace tests and fourteen affected autosave/editor
tests passed. The first UI run built all production Angular libraries and the
host, including code/localization and module-boundary guards, and passed twelve
of sixteen browser cases. The remaining case failed in all four projects because
it assumed the unfiled folder stayed expanded after reload. The test now expands
that folder explicitly; its four focused reruns passed. The unchanged successful
cases were reused. Both theme/viewport combinations are covered by the sixteen
cases, including exact response-loss recovery after another editor saved newer
content and subsequent autosave with the returned revision.

Eight new dialog/reader screenshots were manually reviewed. The new navigation
action intentionally changes sixteen existing full-page baselines. Pixel review
confirmed significant differences are confined to the 260px navigation panel;
a few header antialias differences affect at most 42 pixels with RGB deltas 1–2.
Twelve cropped baselines were unchanged. After review/update, a normal comparison
without snapshot updates passed twelve visual cases against twenty-eight images.
No horizontal overflow, unexpected console errors or lost editor drafts were seen.

These are scoped results, not a complete application acceptance rerun. Browser
API fixtures establish frontend behavior; isolated PostgreSQL tests separately
establish backend persistence/concurrency. Existing material PUT's top-level-only
rich-document validation was not redesigned or claimed as full arbitrary-document
security coverage. New creation accepts no arbitrary document input. Recovery is
scoped to the browser tab's session storage. Rename, move and delete are deferred.

The next implementation slice at this delivery was full-text search for campaign
materials. It was subsequently implemented and verified on 4 October 2026; see
[search delivery](20-Material-search.md) for its contract, scope and evidence.
Session records and pinned materials remain next in the originally approved
order, followed by campaign export/import, map authoring and multiple campaigns.
The separate URL, preloading and folder requests have no newly assigned order.

## Local deployment — 3 October 2026

The user authorized merging into trunk and updating the existing local container.
Both branches already pointed to `cbdff13` (`feat: add notes feature`);
`git merge --ff-only codex/campaign-notes-current` confirmed they were up to date.
The production image build passed frontend compilation, localization/boundary
guards and API publication. The previous image was retained under the local tag
`mastercompanion:before-notes-20261003` for application rollback.

After graceful application shutdown, a custom-format PostgreSQL backup was saved
to the ignored `.local/notes-before-start-20261003-cbdff13.dump` and its archive
contents were successfully inspected. Compose replaced only `app`, using
`up -d --no-deps --wait`; the PostgreSQL container identity and external volume
remained unchanged. The updated image digest is
`sha256:f29b9d192b9bf7a2be953dc8065be321b6704c637eb00cd670ae59b32a350134`.

Counts and deterministic complete-row fingerprints matched across all seven
database tables immediately before and after startup: one campaign, ten folders,
106 materials, one map, one game state, 88 operation receipts and three applied
migrations. Documents, revisions and gameplay were preserved; no migration or
campaign write was needed. The backup is local recovery evidence, not permission
to replace later edits.

`node --test tests/e2e/container.test.mjs` passed all four read-only integration tests.
The app and database were healthy, the app remained bound to `127.0.0.1:4200`,
and PostgreSQL had no published port. A fresh browser view showed the new note
action and no console errors. No live note or game operation was created for
verification. Existing functional test evidence above was reused because source
behavior did not change during deployment.
