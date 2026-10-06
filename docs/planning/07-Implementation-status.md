# Implementation status

## Session workflow — 6 October 2026

[Slice E](38-Session-workflow.md) adds record-specific routes, independently loaded
active-meeting context, one-action play notes, stage guidance and explicit creation
after first use. Per-record drafts retain their existing save/conflict ownership.
Thirty-three scoped unit cases and sixty session browser cases pass; twelve workflow
cases passed again after the final document-return correction. Quality and production
compilation pass; both Full HD themes were reviewed. C–E are merged locally;
Docker is available again and container delivery resumes. F/G follow.

## Gameplay hierarchy — 6 October 2026

[Slice D](36-Gameplay-hierarchy.md) makes clock activity selection explicit,
shows immediate effects and named arrival/transformation consequences, and groups
module tools into collapsible sections with visible attention links. Mounted inputs
and section state survive navigation. Twenty-six focused module cases, sixteen new
browser cases, existing reminder/casualty cases and eight visual cases pass in both
themes/sizes; frontend quality and production compilation pass.

C and D are merged locally; container delivery awaits Docker startup. The engine
failed while opening a stale inference socket before starting WSL; no database
volume or campaign data was changed. E–G remain in the authorized UI scope.

## Explicit draft recovery — 6 October 2026

[Slice C](35-Draft-recovery.md) adds scoped saved-version inspection, deliberate
adoption or reapplication against the inspected revision, and visible copy/manual
copy recovery for material and session drafts. Other open work remains independently
owned. Fifty-two focused unit/integration cases and twenty scoped browser cases
pass; frontend quality and isolated production compilation pass. Full HD material
recovery previews were reviewed in both themes. Local runtime delivery is pending.

The user authorized the remaining C–G UI corrections on 6 October. D (gameplay),
E (session workflow), F (navigation/retrieval) and G (map interaction) follow C.

## UX follow-up corrections — 5 October 2026

[The follow-up delivery](34-UX-follow-up-corrections.md) fixes gameplay reminder
navigation, simplifies document context menus, supplies an editable session name
with today's local date and implements cross-folder/unfiled document movement
through searchable choices and drag/drop. Confirmed organization membership
retains precedence over delayed cache reads while keeping mounted drafts intact.

Commit `44ee190` was merged into local `trunk`. Image
`mastercompanion:ux-followup-44ee190` was built from that merged checkout and the
application container updated. Both services are healthy. Eight read-only
container checks pass. A live Full HD check confirms the dated name, closing an
untouched session form, the three document menu commands and the searchable move
dialog without horizontal overflow or console errors. No live campaign write
was submitted; reminder focus/navigation and confirmed movement/recovery use
isolated functional tests. The gameplay visual baselines pass without updates.

## UX/UI audit and corrective plan — 5 October 2026

Reviewed the running reader/editor, search/navigation, maps, gameplay, party,
creation dialog and empty sessions in both themes at Full HD, plus gameplay at
the existing smaller desktop viewport. Populated session layouts use previous
isolated delivery screenshots; conflict/recovery findings use source review.
No campaign content or game/session operation was submitted for this audit.

[The audit](27-UX-UI-audit.md) records 24 prioritized findings, distinguishes
observed/measured issues from usability hypotheses, and includes selected visual
evidence. The user's follow-up specifically confirms unsearchable dropdowns,
missing session deletion, missing note ordering, generic/scattered actions and
unsustainable upper-right navigation. [The corrective plan](28-UX-UI-improvement-plan.md)
prioritizes these capabilities with the visual/accessibility foundation and
persistent search/reader commands, then draft recovery, gameplay hierarchy,
session workflow, retrieval and map interaction corrections.
The audit originally changed documentation only. The first corrective cycle
A/H/I/J/B has since been implemented: shared controls/icons, searchable choices,
session deletion, within-folder note ordering, and bounded navigation with
persistent search/document commands. See [the current delivery records](28-UX-UI-improvement-plan.md).
Later recovery, gameplay/session restructuring, retrieval and map corrections
remain planned before map authoring and multiple campaigns.

The combined implementation was merged into local `trunk` at `e6a135c`. Image
`mastercompanion:ux-e6a135c` was built from that merged checkout and installed in
the local application container at `http://localhost:4200`. Both services are
healthy. Eight read-only container checks passed, including the organization
snapshot's material-order references. Live Full HD review confirmed the reader
in both themes, one header utility, sidebar navigation, session empty state,
keyboard access to note ordering and filtering the document picker. Functional
write and recovery coverage uses isolated tests; live review submitted no
campaign writes. [The combined delivery record](33-Workspace-navigation.md)
records the scoped browser, visual, build and runtime evidence.

## Campaign sessions and pinned materials — 5 October 2026

Named sessions progress from planned to active to completed, with one active
meeting per campaign. Preparation and play notes are separate ordinary rich
materials; pins open existing campaign documents without copying them. Explicitly
edited summaries and follow-up text retain per-record drafts across navigation
and conflicts. Session actions preserve game time, party/module state and undo.

Scoped evidence includes 26 isolated HTTP/PostgreSQL cases, session/recovery/draft
and routing unit checks, all 24 session browser cases across both themes and
viewports, reviewed Full HD screenshots, successful solution compilation and
frontend quality/library compilation. See [the session delivery plan](26-Campaign-sessions.md)
for the contract, exact limits and local delivery status. At delivery, map authoring
was the next product slice, followed by multiple campaigns. The subsequent UX/UI
plan above prioritizes corrections before these features. Chronicle remains
separate later scope; UI extractions follow the corrective plan's demonstrated
consumer needs.

Commit `2562798` was merged into local `trunk`. Image
`mastercompanion:sessions-2562798` was built from that checkout and the application
container updated. Both services are healthy; seven read-only container checks
and a live Full HD session-page check in both themes pass without API writes.

## Folder interaction corrections — 4 October 2026

The move dialog reflects the actual parent and sibling position, including moves
back to the root. Wider folder rows and ordering zones, contrasting drag markers,
and a root target outside the scrolling navigation address difficult drag/drop.
Folder menus now offer Add document, Rename and Move without redundant expansion
actions. See [the correction and scoped evidence](25-Folder-management-and-context-menus.md#folder-interaction-corrections--4-october-2026).

Fix `b76fea9` was merged into local `trunk` and the application container updated
to `mastercompanion:folder-fix-b76fea9`. Twenty-four folder unit tests, sixty-four
scoped browser cases, frontend quality/build, five container checks and a live
browser check pass. The live check blocked API writes and confirmed root selection.

## Folder management and context menus — 4 October 2026

Folders support rename, sibling order, subtree nesting and moves to ancestors or
the campaign root, with drag/drop and equivalent keyboard dialogs. Folder menus
create notes directly in the clicked folder while retaining unsent titles and
uncertain creation recovery. Material and tab menus open/reveal/copy addresses
and close tabs through existing save-before-close operations. A visible folder
action button, ContextMenu and Shift+F10 make the actions reachable without PPM.

Hierarchy revision checks, campaign locking, atomic order/parent writes and
immutable receipts keep folder persistence independent of materials and gameplay.
The new separately compiled neutral UI library owns only menu interaction and
presentation, with a developer catalog and enforced dependency boundaries.

Forty PostgreSQL/HTTP cases, forty frontend folder/workspace cases, twelve menu
cases, nine server/cache cases and seventy-two affected browser cases pass.
Nine unchanged note-creation unit cases remain valid. Both themes and viewport
sizes were verified; four new visual baselines and Full HD dialog/catalog views
were reviewed. Builds, model/migration consistency and quality checks pass.
See [scope, contract and delivery evidence](25-Folder-management-and-context-menus.md).
Commit `3dd7e91` was merged into local `trunk`; image
`mastercompanion:folders-3dd7e91` was built and the app container updated. Both
services are healthy. Five read-only container cases and a live browser menu,
note-destination and keyboard-focus check passed without API writes.

## Campaign material memory — 4 October 2026

Campaign startup preloads persisted documents and retains confirmed content after
closing tabs. Opening and reopening cached materials needs no document GET; saves
and note creation update the same campaign-owned memory. Explicit refresh loads
remote changes for closed documents while preserving mounted drafts, editor state
and ordinary revision conflicts. Delayed reads cannot roll back confirmed saves.
See [delivery, measurements and verification](23-Campaign-material-memory.md).

Commit `07d5129` was merged into local `trunk` and the app container rebuilt and
updated. Five HTTP/PostgreSQL cases, 70 frontend cases, 184 affected browser cases
and 11 read-only container cases pass. The deployed campaign loads all 106
documents in one request; a local sample measured 128 ms for the bulk response
and about 1.27 MiB additional whole-application used heap. Both services are healthy.

## Workspace URL navigation — 4 October 2026

Angular Router now addresses materials, stable sections, specific maps, gameplay
and party views. The persistent workspace preserves mounted editors, drafts and
map state across history navigation. Initialization and active-tab closure replace
history entries; missing targets have localized recovery instead of a silent
redirect. The affected frontend/API builds, quality checks, 39 unit/server cases
and 148 browser cases passed. See [routing delivery](22-Workspace-routing.md)
for the address contract, precise evidence and local deployment status.

## Campaign material search — 4 October 2026

Implemented on `codex/material-full-text-search` with parallel backend, frontend
and independent browser/review ownership. Search covers persisted campaign
titles and rich-document text, including user notes, with bounded plain-text
snippets and title-first results. It replaces the local title filter and preserves
mounted editors, drafts, reading positions and map orientation. Confirmed saves
refresh active results; failed saves and unsaved drafts are not searchable content.

Verification passed 33 isolated PostgreSQL/HTTP cases, 31 frontend cases, three
selected navigation/content cases and all 72 selected browser cases across themes
and viewports using scoped reruns. Sixteen existing and four new baselines were
reviewed; normal comparisons passed. Full solution and frontend builds, final API
compilation, formatting, lint, typed fixtures, locale and boundary checks passed.
No persistence migration or module-content change was needed. Literal phrase
matching and per-request campaign scans are deliberate current limits.

See [search delivery and deployment evidence](20-Material-search.md).

Commit `ee196ce` was fast-forward merged into local `trunk` and the app container
was rebuilt and replaced at the user's request. A verified custom-format backup
is retained at `.local/mastercompanion-before-search-20261004-ee196ce.dump`.
All seven table counts and complete-row fingerprints matched before/after startup;
PostgreSQL and its existing volume were retained. Six read-only deployed-container
checks passed, including the new search endpoint; the application is healthy.

## Campaign read-aloud update — 4 October 2026

At the user's request, applied the revised read-aloud prose to all 47 affected
documents in the running campaign: the city introduction and 46 numbered locations.
The update replaced 68 inspected fragment ranges rather than replacing complete
documents. Y14 retains the campaign's clarification that the flames are illusory.
Other campaign additions and unchanged document nodes were preserved.

A verified custom-format backup is retained at
`.local/mastercompanion-before-read-aloud-20261004-113737.dump`.
The transaction was rehearsed with rollback, then committed after checking every
original document and revision. Each affected revision advanced exactly once.
In-transaction comparisons confirmed preservation of all other material fields,
unaffected documents, campaigns, folders, maps, game state, operation history and
migration history. Read-only HTTP verification confirmed all 47 resulting documents
and revisions; all four deployed-container checks passed. PostgreSQL, its volume,
module sources and application code were unchanged. Future campaign edits must be
considered before restoring this backup.

## Location read-aloud prose — 3 October 2026

Revised the Polish player-facing descriptions across all 46 numbered Ythryn
locations and the city introduction, including later room scenes and three inline
environmental details. The prose uses connected sentences, varied rhythm and brief
atmospheric comparisons grounded in the existing scene. Y19 now also has an exterior
read-aloud passage. Dialogue, inscriptions, GM rules, reveal conditions, metadata,
stable anchors, navigation and maps are preserved. The source authoring guide records
the style convention.

Verification passed five targeted content/source tests covering schema round trips,
internal links, numbered-location order, consolidated section preservation and rich
Markdown export. Module package preparation succeeded with 106 materials, 10 folders
and one map. A separate comparison confirmed that edits outside the read-aloud prose
are limited to its added Y19 label and exterior-view condition. Changes affect module
defaults only; the running campaign, database and application were not updated.

During final verification, a concurrent test-file reorganization left the relocated
content test with unresolved imports. Its four selected checks passed using a
temporary copy of the unchanged pre-move test definitions; that copy was removed.
The rich Markdown export test also passed from its relocated file. The test-file
reorganization is outside this content change.

## Campaign-owned notes — 3 October 2026

Delivered to `trunk` in `cbdff13`, following implementation on
`codex/campaign-notes-current` based on `bdfcc9c`.
New note creates an ordinary material in an existing folder or unfiled,
opens it in read mode, and reuses explicit editing and revision-protected autosave.
Exact pending creation requests survive browser-tab reload; uncertain responses
retry the same identity without duplicating or resetting a note. Existing drafts,
materials and gameplay state remain independent.

Verification passed the affected API/test builds and final full solution build (zero warnings/errors), isolated real PostgreSQL/HTTP validation, concurrent retries/conflicts,
replay after editing, cancellation, failed-write recovery, unchanged authored
data and repeated initialization. Twelve new frontend tests and fourteen affected
autosave/editor tests passed. Production Angular libraries and host compiled via
the isolated UI runner, including localization and dependency-boundary checks.
Browser test types passed.

All sixteen note UI cases passed across both themes at 1920x1080 and 1536x864;
one test's incorrect folder-expansion assumption was corrected and only that
case was rerun in all four projects. Eight new screenshots were reviewed.
Sixteen existing baselines were deliberately updated for the navigation action;
pixel review confirmed significant changes stayed inside navigation. The normal
visual comparison then passed twelve cases against all twenty-eight baselines.
These browser fixtures establish frontend evidence; PostgreSQL evidence is separate.

No migrations, module source edits or user-campaign writes were needed. On
3 October, the user authorized merging and updating the local container. The
branch was already integrated into `trunk`; the fast-forward merge confirmed
it was up to date. The production image was rebuilt and only the app container
was replaced. A verified custom-format backup preceded startup; all seven table
counts and content fingerprints matched afterward, including material revisions,
game state/history and migration history. PostgreSQL and its existing volume
remained running. Four read-only container tests passed, and a fresh browser view
confirmed the new note action with no console errors.
Full-text search is the next slice; folder authoring, rename/move/delete and
session records remain deferred. Details: [campaign notes](14-Campaign-notes.md).

## Priority encounter and arrival tools — 2–3 October 2026

The user prioritized hourly exploration checks, building-search checks and rival
arrival tracking. The user-confirmed campaign schedule is Avarice after the first
long rest and Auril after 24 hours. Module schema 3, atomic module activities with
time, explicit arrival confirmation, retained overdue rolls, encounter material
links and complete undo are implemented and verified. Existing game state and authored
materials are preserved. Automated and browser evidence are tracked in
[the priority slice](12-Encounters-and-arrivals.md). On 3 October, the user
authorized rebuilding and replacing the local app container. A verified database
backup and 179 unchanged row fingerprints establish data preservation. The
container is healthy; four read-only integration tests and a live browser check
passed. The existing PostgreSQL container and volume were retained.

The 3 October refinement adds warning icons and a linked pending-action summary,
plus d100 previews with material navigation, repeatable rerolls and manual input.
The server supplies the active table for the oldest check using the same arrival
chronology as confirmation. Verification passed 13 focused frontend tests, 24
existing Blight and 10 expedition rule cases, the frontend build, and code and
boundary checks. Browser inspection used the compiled module with an isolated
in-memory context: manual/dice previews, rerolls, arrival replacements, material
navigation callbacks, invalid-input prevention and explicit confirmation passed.
Both themes were inspected at 1920×1080 without horizontal overflow or console
errors. Screenshots are under `.local/module-preview/`. This refinement changes
no persistence operation or database schema. At the user's subsequent request,
the changes were merged into local `trunk` and the app container was rebuilt and
replaced. A verified backup is saved at `.local/module-tools-before-20261003.dump`;
all 195 database row fingerprints matched before and after replacement. The
existing PostgreSQL container and volume were retained. Four read-only container
tests, the new live preview projection and a browser game-view check passed.
The live screenshot is `.local/module-tools-live-20261003.png`. Remote branches
were not pushed; unrelated changes in the primary checkout were preserved.

## Observatory receiver description — 2 October 2026

The fixed voice receiver in Y15 is now described as a copper speaking horn on a
waist-height stone lectern, to the right of the upper-floor stairs. A palm plate
and a vibrating silver disc make its operation visible and easy to describe.
Y15, the Fenes GM guide, the observatory correspondence and the recovery report
use the same appearance, location and activation instructions. Preparation time,
word limits, daily use and the separate portable device retain their existing rules.
Four Markdown sources changed; stable IDs, navigation, maps and other materials
were preserved. Five intentionally revised section hashes were updated.

The four campaign documents were updated in one PostgreSQL transaction after
a custom-format backup to `.local/receiver-before-20261002.dump`. Writes required
the inspected document and revision to match, then advanced each revision once.
Before/after checks confirmed exact preservation of unrelated materials, party
data, game state and operation history. No rows were deleted.

Verification passed four targeted content/source tests, module package preparation
and read-only HTTP checks of all four documents and revisions. Full HD browser
inspection covered Y15 in both themes and its correspondence link, with no console
errors or horizontal overflow. Evidence is retained under `.local`. Module defaults
will be embedded on the next image build; the running campaign already has the
updated content. Restoring the backup must account for later campaign edits.

## Location summaries — 2 October 2026

All 46 numbered Ythryn location materials (Y1–Y29 and Y19a–Y19q) now start
with a single-sentence GM summary describing their purpose and main threat,
discovery, reward, or progression clue. Summaries precede read-aloud text and
include existing campaign additions where relevant. The source authoring guide
records this convention. No application implementation or content contract changed.

At the user's request, the same summary paragraphs were added to the existing
local campaign in one transaction after a custom-format PostgreSQL backup to
`.local/location-briefs-before-20261002.dump`. Each write checked the inspected
campaign ID, material revision and document, then advanced the revision once.
The transaction verified every resulting document and exact preservation of all
other material fields and rows, campaigns, folders, maps, game state and operation
history. Two location documents had additional empty paragraphs compared with
module defaults; these were retained. No rows or database volumes were deleted.

Verification passed all 16 content/source-tool tests and module package preparation.
A before/after comparison confirmed that source changes only prepend one paragraph
and preserve all prior document nodes, metadata, folders and maps. Read-only HTTP
checks confirmed all 46 campaign documents, their revisions and unchanged workspace.
Full HD browser inspection covered Y4 in both themes and the Y19q summary, with no
console errors or horizontal page overflow. Screenshots and transaction evidence
are retained under the ignored `.local` directory. The running image did not need
a restart; updated module defaults will be embedded on its next build. Backup
restoration is a separate operation that must account for subsequent campaign edits.

## Phase one accepted — 2 October 2026

The user tested the delivered application, reported that everything works
correctly, and accepted closing phase one. The [MVP acceptance record](11-MVP-acceptance.md)
lists the delivered scope, existing verification evidence, known limits and later
work. Full offline operation has been removed from the current requirements;
internet-disconnected acceptance is no longer pending. No additional application
tests were run for this documentation closure, as explicitly requested.

Current execution evidence for gameplay is in [the gameplay implementation plan](09-Gameplay-implementation.md). The entries below preserve earlier verification history.

Arcane Blight now displays remaining time and links to its campaign rules
heading. The user-confirmed infected recovery schedule is every 12 hours or
after long rest, which resets the timer. Module schema 2 preserves supported
schema 1 saves, receipts and undo. Scoped rule, PostgreSQL, HTTP and browser
evidence is recorded in [the gameplay implementation plan](09-Gameplay-implementation.md).

The latest design revision adds a generic editable party tab, stable character
resources shared with module tools, building search (30 minutes), short rest
(1 hour), a single long-rest shortcut and undo beside refresh. A one-tool module
renders its tool directly. Draft/conflict recovery and atomic roster undo are
verified. The updated Docker application is running at localhost:4200 with the
existing campaign preserved; exact implementation checks are
recorded in [the gameplay implementation plan](09-Gameplay-implementation.md).

30 September 2026 · historical record moved from README

The description below preserves the status and verification results reported before the repository was reorganized. It does not confirm that those checks were repeated. The original POC directory has been removed; the module's prepared data and map remain in `src/MasterCompanion.Modules.Ythryn/Data`.

## Foundation status

Foundation implementation had started. Navigation through 142 materials from 16 source documents, tabs, the reader, visual editing of existing descriptions, PostgreSQL autosave and a map with 29 markers were working. Editing required clicking the edit-note control. The map occupied the main area on demand. The original POC was still retained at that point.

The contents tree preserved the source folder nesting, including player threads and the Fenes folder. Activating a tab expanded its path, set focus and scrolled the tree to the clearly selected material. Tabs closed through the × button or middle mouse button after persistence was confirmed. The header switched between light and dark themes, and the browser remembered the choice.

At this historical foundation stage, gameplay, Markdown/link insertion and offline acceptance were still pending. Gameplay and insertion were subsequently delivered; the offline requirement was removed on 2 October. The phase-one decision above supersedes this historical task list. At the time, a material-save conflict retained text in the tab for copying before refresh.

## Reported verification

Checks covered compilation of all projects, conversion and reloading of all content, dependency boundaries, autosave ordering, error and conflict handling, and API reads/writes against real PostgreSQL. Full HD browser verification covered Y4, tables, a collapsible block, Polish characters, explicit edit mode, the map, markers and zoom preservation. A trial save survived a controlled Aspire restart, after which the test text was removed.

After the reader fixes, 10 content, hierarchy and autosave tests passed. They also checked waiting for persistence during tab closure and refusing to close after an error or conflict. The migration against the running database added 18 folders and assignments for all 142 materials; before/after document hashes and revisions confirmed that notes were unchanged. Full HD browser checks confirmed × and middle-button closure, closing the last tab, reopening the map with its zoom preserved, focus and centering of the active material, expanding the Fenes path, revealing a material hidden by filtering, and persistence of both themes after refresh. No console errors or horizontal view overflow were observed.

Aspire 13.6 logs on this Windows machine showed a recurring DCP message about subscribing to notifications through a local socket. It did not block resource startup or the checks above; separate diagnosis is needed if it affects the dashboard or environment operation.

## Markdown sources and change integration

A subsequent change moved the 142 materials into individual Markdown sources with YAML metadata in `src/MasterCompanion.Modules.Ythryn/Data/Source`. The manifest, folders, map definition and assets are separate. The JSON package is generated during the .NET build in the Git-ignored `Data/Generated` directory. Application editing still affects the campaign copy; rebuilding does not update its notes.

Before merging, all documents, folders and the map were compared with the original package, and identical image bytes were confirmed. Verification covered .NET and Angular compilation and isolated loading of the embedded manifest, 142 documents, 18 folders and map. The application was not restarted, and campaign data was not changed. An expanded visual editor remains future work described in [the execution plan](05-MVP-execution-plan.md).

While resolving PR #2 conflicts, removal of the POC directory and the documentation organization from `trunk` were preserved. Content tests use maintained sources and fixed reference data, while the Markdown export test recompiles all materials. The optional importer accepts an explicitly supplied external HTML file; its test uses a small independent example. This change removes the tests' and builds' dependency on the deleted reference directory.

After merging, 13 content and module-tooling tests passed, including after the POC directory was physically removed. The .NET build completed without warnings or errors; the Angular build and boundary and code-language checks passed. An isolated .NET check confirmed the manifest, 142 documents matching the original package, 18 folders, map definition and identical image bytes. The database was not changed, and the application was not restarted.

## Module content organization — 1 October 2026

The maintained Ythryn sources now contain 106 materials in 10 folders. All 46 numbered location materials (Y1–Y29 and the Y19 rooms) share one location folder in adventure order. The Y19 overview includes its shared features. Nine navigation-only materials were removed, and links now target substantive documents. Fenes contains five complete documents directly under the character folder; the GM guide and four player handouts keep their original sections, tables, and stable anchors. The original 29 map targets and asset remain unchanged.

The user explicitly authorized replacing all materials in the existing local campaign. A local SQL backup was saved under `.local/campaign-before-reorganization.sql`, then a campaign-scoped transaction replaced the material contents and folder hierarchy. Retained materials advanced their revisions; obsolete materials were removed. The final duplicate player-thread index was removed with a separate revision-protected transaction. This was a one-time, user-requested replacement, not an automatic module upgrade or a change to startup initialization. Future rebuilds still preserve campaign-owned edits. The backup is local and ignored by Git; restoring it requires a separately authorized operation that accounts for any subsequent edits.

All 16 content and source-tool tests passed, including exact preservation of consolidated section content, schema round trips, navigation order, internal links, map targets, and portable export of colon-containing IDs on Windows. The code/localization check and the affected .NET module build passed; the build reported no warnings or errors. API evidence from the running PostgreSQL-backed campaign confirmed exact source content at replacement, the final 106 materials and 10 folders, unchanged maps, and increasing revisions. A stale save returned a revision conflict without changing the document. During the final read, the tomb-tapper encounter had a subsequent campaign save at revision 3; that later save was preserved, while the remaining 105 documents still matched the source package.

Browser checks at 1920×1080 covered map navigation to Y19, search, the single-page recovery report and observatory correspondence, and both themes without horizontal page overflow. No console errors were observed. Angular's existing oversized-map-image performance warning remains. No frontend implementation changed; no frontend rebuild, application restart, or database-volume removal was needed. General module upgrades and visual module authoring remain deferred.

## Gameplay backend — 1 October 2026

The first gameplay backend slice now implements party setup, elapsed time, shared rest, module-owned Arcane Blight outcomes and healing, idempotent operation receipts, revision conflicts and sequential undo. State and operation history are separate from material documents and committed atomically. A neutral `ICampaignGameRules` contract keeps module rules independent of engine persistence. The new additive EF migration and API registration are prepared; the local user's campaign has not been migrated or initialized with game state during this work.

Verification passed 16 pure-rule cases, real PostgreSQL integration tests (concurrency, receipts, undo, material isolation, rollback at commit, corrupt data rejection and cancellation), and real HTTP boundary tests. Test database restart preserved state, journal and authored material hashes. The full backend solution and final affected backend/test project compiled without warnings or errors. Code/localization, dependency boundaries and EF model/migration consistency checks passed. All database probes used an isolated disposable test container; no user database volume was removed or changed.

The frontend delivery below follows this backend slice. See [the delivery plan](09-Gameplay-implementation.md) for the API contract, bounds and repeatable checks.

## Gameplay frontend and editor completion — 1 October 2026

Implemented the on-demand game tab, party setup, elapsed clock, time advances, shared rest, Ythryn's Arcane Blight tool with independent outcomes and d6, magical healing, and confirmed sequential undo. Exact pending requests survive page reload in tab session storage; retries use their original identity and read the current state after confirmation. Revision conflicts block writes until refresh. Module tools depend only on frontend contracts. The material editor now inserts bounded Markdown and selected campaign links while preserving existing rich content and cancelled drafts. Keyboard tab navigation and panel relationships are included.

All 30 gameplay frontend, 6 insertion and 14 affected autosave/editor tests passed. Full frontend compilation and code/localization/dependency checks passed, followed by final scoped engine compilation. Browser checks at 1920×1080 in both themes used an isolated real PostgreSQL database and loopback API: setup, 10 h → 8 h rest → exposure → infection → recovery d6, undo, persisted Markdown/table/link, independent note saves, real two-window conflict and recovery after connection loss/page reload/API restart. The existing oversized-map-image warning remains. The user's campaign and database volume were not changed.

At frontend delivery, internet-disconnected acceptance had not been performed. That requirement was removed on 2 October; phase one is now accepted as recorded above. Exact implementation evidence remains in [the gameplay delivery plan](09-Gameplay-implementation.md).

## Local Docker runtime — 1 October 2026

The root multi-stage Dockerfile and Compose configuration now run the production
frontend and API together at `http://localhost:4200`, with separate private
PostgreSQL. The user's existing volume and credentials are reused. A backup was
saved before the additive gameplay migration; before/after hashes confirmed all
106 materials, their revisions and the remaining campaign data were preserved.
The image build and four read-only container integration tests passed. Details and
limits are in [the Docker runtime record](10-Docker-local-runtime.md).
