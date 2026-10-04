# Near-term improvements

3 October 2026 · recorded roadmap; delivery status updated 4 October 2026

The user requested the improvements below, then authorized search, URL navigation
and campaign material memory. Search and routing have been delivered; material
memory is implemented and verified. Folder management remains planned. See
[search delivery](20-Material-search.md), [routing delivery](22-Workspace-routing.md)
and [material memory](23-Campaign-material-memory.md) for current evidence.

Related: [execution plan](05-MVP-execution-plan.md),
[engine and module ownership](06-Module-architecture.md),
[folder organization story](02-User-stories.md#us-03-folder-organization).

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
