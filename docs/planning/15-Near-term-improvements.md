# Near-term improvements

3 October 2026 · recorded roadmap; delivery status updated 9 October 2026;
requirements updated 8 October 2026

The user requested the improvements below, then authorized search, URL navigation
and campaign material memory. Search and routing have been delivered; material
memory is delivered locally. Folder management and context menus are also
delivered locally; see [the scoped delivery plan](25-Folder-management-and-context-menus.md). See
[search delivery](20-Material-search.md), [routing delivery](22-Workspace-routing.md)
and [material memory](23-Campaign-material-memory.md) for current evidence.

Related: [execution plan](05-MVP-execution-plan.md),
[engine and module ownership](06-Module-architecture.md),
[folder organization story](02-User-stories.md#us-03-folder-organization).

All requests in the original near-term list below have been delivered. [Sessions
and pinned materials](26-Campaign-sessions.md) were delivered on 5 October.
The subsequent user-requested [UX/UI audit](27-UX-UI-audit.md) identified corrections
to navigation, reading/editing, recovery, gameplay, sessions and visual hierarchy.
[The corrective delivery plan](28-UX-UI-improvement-plan.md) now recommends those
slices before map authoring, followed by multiple campaigns. The first corrective
cycle A/H/I/J/B and remaining C–G corrections are implemented locally. Dialogs, feedback and theme/control foundations are coordinated with
[the reusable UI plan](17-Reusable-frontend-ui.md), not a separate competing rewrite.

The user's audit follow-up prioritizes searchable material/folder choices, session
deletion and note ordering within folders. Generic/scattered buttons and the growing
upper-right destination row also require correction. The first proposed cycle is
small control/icon foundations, searchable choices, session deletion, note ordering
and bounded navigation with persistent search/reader commands. This first cycle
is now implemented; the delivery records describe exact behavior and scoped evidence.

## Recommended development order

7 October 2026 · recommended sequence incorporating the user's future requirements;
no implementation authorization, dates or effort estimates assigned.

The previously delivered UX cycle remains complete. New session-view feedback
requires a fresh composition rather than treating its prior screenshots as final
usability acceptance. The following sequence supersedes the older map-first
recommendation for planning; it is a proposal for the user's next scope choice.

| Order | Slice | Reason and boundary |
|---|---|---|
| 1 | Editable document titles | Close a concrete editing gap with reusable metadata/save behavior before adding more editable documents. |
| 2 | [Material deletion](46-Material-deletion.md) | Complete document management with a red trash action in the context menu and beside Edit, plus explicit draft/reference handling. |
| 3 | [Session workspace redesign](44-Session-workspace-redesign.md) | Use the user-selected single workspace with the list beside the document; clarify actions and active-session context. |
| 4 | [Character catalog and profiles](45-Character-profiles.md) — delivered | Player characters and NPCs have independent backstory/notes; explicit membership selects the gameplay party. |
| 5 | Map authoring with multiple module maps | Add images and independent marker editing; verify at least two maps and their references throughout module/campaign handling. |
| 6 | Multiple campaigns | Add selection and independent campaign creation once the current workspace's main content flows are clear. Empty custom campaigns need their own bounded scope. |
| 7 | [User accounts and data isolation](47-User-accounts-and-data-isolation.md) | Implement and test authentication and server-enforced ownership/access locally as a separate product feature before hosted exposure. |
| 8 | [Module editor and deliberate campaign updates](37-Module-editor-and-campaign-updates.md) | Reuse the content/map controls after defining external source storage, version discovery and edited-element protection. |
| 9 | Chronicle and custom tools | Extend campaign history and generic mechanics after core authoring and organization. |
| 10 | AWS / production | Deploy the verified account/isolation boundary with hosted security, production backups and recovery. |

Title editing, material deletion and the session workspace redesign are delivered.
The character catalog/profile feature is delivered locally; map authoring is the next
planned product slice.

Document-title editing is a useful first delivery, not a strict prerequisite for
session layout or profile design. Profile identity/removal semantics, multi-map
authoring boundaries and module source storage must be designed before their
respective implementations. Deletion draft/reference semantics must be reviewed
before implementing material deletion. Shared UI extraction follows actual
consumers within these slices rather than a separate prerequisite rewrite.

User accounts and private data isolation are confirmed requirements. Define the
ownership model alongside multiple-campaign design, then implement and verify the
account/access boundary as its own locally testable feature. Accounts do not
depend on AWS and should not be deferred merely because hosting is later. The
verified boundary is a gate on hosted exposure regardless of which later product
features are complete. This plan does not add login during unrelated local tasks.

## Additional requirements: multiple module maps and document titles

7 October 2026 · user-confirmed requirements; no new delivery date assigned.

### Multiple maps per module

A module must support multiple maps, rather than a single map. Each map has its
own stable identity, image asset and markers; for example, a city map and separate
building or dungeon maps. Campaign creation must include all supplied maps and
their material references. Map authoring and the future module editor must let
the user select and manage individual maps without replacing the other maps.
Switching maps must retain each map's pan/zoom and existing document drafts.

The current `ICampaignModule.LoadMapsAsync` contract already returns a collection.
This requirement makes that capability explicit in the product scope; it does not
claim that multiple-map authoring has been implemented or verified.

### Editable document title

While editing an existing campaign document, the GM must be able to change its
title as well as its body. The title is material metadata, separate from headings
inside the document. The previous material view had no title-editing field and
`SaveMaterial` previously saved only the body. [Title editing](48-Material-title-editing.md)
is now implemented on its feature branch, with campaign metadata and body saved
under one revision.

Title changes must use validated, revision-protected saving and remain recoverable
with body drafts on errors or conflicts. Finishing editing or closing the tab must
wait for confirmed persistence. After confirmation, navigation, tab labels and
search results must reflect the new title; reloading must retain it. Renaming must
preserve the material ID, URLs, links and map-marker targets, and must not change
the module source. The future module-authoring mode must also support title
editing, with saves directed explicitly to the module.

Planned verification includes a module with at least two maps and independent
markers, map switching with retained view state, title-only and combined title/body
saves, validation, failed saves and revision conflicts. These are acceptance
criteria, not completed test evidence.

## Future ideas: module editor and campaign updates

6 October 2026 · recorded for later work; no delivery priority assigned.

The user requested an editor that saves the module itself outside the application
repository, and notifications offering an update to a newer module version.
Campaign updates should replace only unchanged elements, preserve edited notes
and report skipped elements. See [the future requirements and open design
decisions](37-Module-editor-and-campaign-updates.md).

## Improvement: preload campaign materials at startup

4 October 2026 · implemented and verified. See
[material memory delivery](23-Campaign-material-memory.md).

The original workspace fetched a material on opening and again after closing its
tab. Campaign startup now preloads persisted documents and keeps confirmed content
in browser memory independently of material sessions. The scope below preserves
the original request and acceptance criteria.

### Planned scope

- Fetch campaign-owned documents, metadata and save revisions in bulk at campaign
  startup. Read the persisted campaign copy, including user edits and newly
  created notes; module defaults remain initialization input only.
- Keep loaded material data independently of open tabs, so closing a tab does not
  discard its confirmed document. Create views and editor instances on demand.
- Keep durable saves through the existing API. Update the in-memory confirmed
  document and revision only after a successful save; retain newer pending drafts.
  Add successfully created notes to the same store without another document GET.
- Define explicit refresh and multiple-window behavior before implementation.
  Preserve revision conflicts and recoverable drafts; never silently replace
  unsaved work with a refreshed snapshot.
- Keep this functionality in the generic engine and scope the store to the
  current campaign/workspace. Map image preloading, persistent browser storage
  and full offline operation are outside this request.

### Acceptance and implementation evidence

- Opening, closing and reopening unchanged materials after successful startup
  sends no per-material document requests or database reads.
- Saved edits and new notes remain visible on reopening and after application
  reload; failed saves and revision conflicts preserve recoverable work.
- Bulk-load and refresh failures have localized, actionable recovery states.
- Verify affected loading/cache and autosave behavior, including overlapping
  saves and refreshes and stale revisions from another window.
- Measure actual campaign payload size, startup time and browser memory before
  committing to the final bulk-loading contract. Current source evidence is 106
  module documents and approximately 2 MB of generated package JSON; this is not
  a measurement of the live campaign response or a benchmark.

## Feature request: folder management with drag and drop

The GM should be able to reorganize the campaign folder tree directly in
navigation, with drag and drop as the preferred interaction.

### Requested behavior

- Rename an existing folder.
- Drag a folder before or after a sibling to change its order.
- Drag a folder into another folder to nest it, moving its complete subtree and
  retaining all contained materials.
- Move a nested folder out to an ancestor level or the campaign root, with a
  predictable destination order.
- Show clear drop targets for ordering versus nesting, reject invalid targets,
  and provide keyboard-operable controls for equivalent moves and renaming.

### Acceptance and implementation constraints

- Persist names, sibling order and parent relationships across reload/restart.
  Preserve stable folder/material IDs, document contents and save revisions,
  internal links, map targets and gameplay state.
- Validate campaign ownership, names, parent references and cycles on the server;
  a folder cannot become its own parent or a descendant's child.
- Commit dependent hierarchy/order changes atomically. Define optimistic
  concurrency and safe retry behavior before implementation, so simultaneous
  changes cannot silently overwrite a newer tree.
- Failed/conflicting operations retain the last confirmed hierarchy and offer
  localized recovery. Preserve mounted editors, drafts and active selection;
  reveal the active material's updated ancestor path after a confirmed move.
- Folder management belongs to the generic engine and edits only the campaign
  hierarchy. It must not rewrite module sources/defaults or enter gameplay undo.
- Verify persistence, subtree integrity, cycle rejection, conflicts and recovery;
  review drag/drop and keyboard behavior at Full HD in both themes using scoped
  navigation browser checks.

Folder creation/deletion and dragging individual materials are separate scope
decisions; they are not implicitly included in this request. Any required schema
change needs a new reviewed migration that preserves existing campaign data.

## Improvement: URL-based workspace navigation

4 October 2026 · implemented and verified; see [routing delivery](22-Workspace-routing.md).

The original workspace activated materials and tool tabs in memory while the
browser URL stayed unchanged. Angular Router navigation now lets users
bookmark and copy a specific location, use browser Back/Forward, and reload the
current view without returning to the module's start material. Navigation remains
inside the SPA without a full-page reload.

### Planned scope and address design

- Address materials as `/materials/:materialId`, optional stable sections as
  `/materials/:materialId#sectionId`, maps as `/maps/:mapId`, gameplay as `/game`,
  and party management as `/party`. These are proposed route patterns; finalize
  campaign scoping before implementation without expanding this slice into a
  multi-campaign management feature.
- Use stable IDs rather than display titles so renaming does not break links.
  Open a material addressed directly in read mode. A route identifies a location,
  not a request to edit content or perform a game operation.
- Reflect meaningful user navigation in browser history. Define replacement
  behavior for initialization, redirects, and closing the active tab so internal
  synchronization does not add duplicate or unusable history entries.
- Store the active view and explicitly addressed section in the URL. Draft
  contents, text selection, expanded folders, and the complete collection of
  open tabs remain workspace/session state; do not serialize them into URLs.

### Ownership and data preservation

- The Angular host configures routes; the engine owns campaign navigation and
  resolves route targets against the current campaign. Shared UI emits typed
  interaction events. Adventure modules continue requesting material navigation
  through the neutral `MaterialTarget` contract.
- Keep one navigation owner for clicks, map markers, module requests, direct
  links, and browser history. Translate existing semantic material/anchor
  references at this boundary; do not rewrite authored documents as part of
  routing or introduce module-specific route handling in the engine.
- Keep workspace sessions independent of route activation. Navigation activates
  or opens a tab without destroying other editors, replacing unsaved drafts,
  losing reading position, or resetting map pan/zoom. Preserve revision checks,
  save-before-close, and uncertain-operation recovery.
- Reloading a URL restores the addressed location from persisted data. Recovery
  of unsaved drafts across page reloads is a separate persistence concern; a
  route alone must never be described as providing it.
- Provide localized loading, unknown-target, missing-section, and recovery
  states. Define explicit handling of invalid routes and targets without silently
  replacing a requested material with the start material. A failed navigation
  must preserve existing work; navigation retries must not repeat game writes.

### Delivery and acceptance

- Coordinate routing with extraction of workspace tab/session ownership in
  [the reusable frontend plan](17-Reusable-frontend-ui.md). Keep routing out of
  neutral presentation components.
- Confirm bookmarked/direct links and reload work for each route in development
  and the local production host. Verify SPA deep-route fallback while unknown
  API routes retain appropriate HTTP failures.
- Cover Back/Forward, repeated navigation, active-tab closure, unknown IDs,
  anchors, loading failures, and rapid navigation with overlapping material
  loads. The newest intended destination must win over late responses.
- Verify navigation during editing, pending saves, save errors/conflicts, and
  gameplay recovery preserves drafts, revisions, mounted editor state, and map
  orientation. Browser Back changes location only; it does not undo game state.
- Verify keyboard/focus behavior and retained scroll at Full HD in both themes
  with scoped browser checks. Build the affected frontend integration and update
  navigation fixtures and documentation with the chosen route contract.

The scope above records the original request. The delivered address contract,
history behavior, ownership and verification are recorded in the routing plan.
