# Folder management and context menus

4 October 2026 · implemented, verified and delivered locally

## Authorized scope

The user requested folder management and application context menus, explicitly
including creating a note inside the folder clicked with the secondary pointer
button. Parallel implementation uses one feature branch from `trunk`:
`codex/folder-management-context-menus`.

Folders support renaming, sibling reordering, nesting with their complete subtree,
and moving back to an ancestor or the campaign root. Drag and drop has explicit
ordering/nesting destinations. Equivalent dialog controls support keyboard use.
Folder creation/deletion and moving individual materials are separate scope.

Context menus cover folder actions, opening/revealing materials and copying their
stable addresses, and closing tabs or other tabs through existing save-before-close
operations. The menu is also reachable through the keyboard context-menu key and
Shift+F10. Ordinary reader/editor selection retains the native browser menu.
Existing toolbar actions remain available.

## Ownership and operation contract

The engine owns campaign hierarchy, validation, operation recovery, navigation
and save policy. Folder operations never change module sources, material documents
or their revisions, game time, or gameplay undo history. Stable IDs preserve links
and map targets. Mounted editing sessions and map views remain independent of
hierarchy updates.

`GET /api/campaigns/{campaignId}/folders` returns `{ revision, folders }`.
`POST` to the same address accepts `{ requestId, expectedRevision, operation }`.
Operations are either `{ kind: 'rename', folderId, title }` or
`{ kind: 'move', folderId, parentId, beforeId }`. A null parent means the campaign
root; a null `beforeId` means append to that parent's folder order. A non-null
`beforeId` must name another folder directly under the requested parent.

The campaign has a hierarchy revision independent of material and gameplay
revisions. A campaign lock and one transaction own revision checks, validation,
dependent ordering/parent writes and immutable operation receipts. Exact retries
replay their original response; conflicting request identities and stale revisions
fail visibly. The frontend retains uncertain request identities in campaign-scoped
tab session storage and refreshes the current hierarchy after confirmed retries.
Delayed reads must not roll back a newer confirmed hierarchy.

The separately compiled `@mastercompanion/ui` library owns only neutral menu
presentation, keyboard interaction, focus lifecycle and viewport placement. It
depends on Angular, never campaign contracts, HTTP, engine or modules. The engine
supplies localized actions and interprets menu events. A small developer catalog
documents the primitive without adding a product navigation item.

## Scoped delivery evidence

Verification passed:

- Forty isolated PostgreSQL/HTTP cases cover strict JSON input, boundary names,
  ownership, subtree/root/order moves, cycles, concurrency, immutable retries,
  revision conflicts and complete rollback on a deferred commit failure.
- Forty frontend folder/workspace cases cover recovery identities, invalid or
  divergent confirmations, stale workspace reads, invalid hierarchies, cyclic
  moves, self-drop rejection and retained material sessions. Nine existing note
  creation cases remain successful evidence for its unchanged persistence owner.
- Twelve real-DOM menu cases cover keyboard actions, focus return, disabled
  actions, viewport placement, outside dismissal and listener cleanup. Nine
  isolated UI-server cases verify the build-cache boundary, including UI sources.
- Seventy-two affected browser cases pass across both themes at 1920x1080 and
  1536x864, using scoped reruns. Coverage includes folder ordering/nesting/root
  dragging, keyboard move and focus after reparenting, folder-context note
  placement with an existing draft, conflicts, lost responses/reload/retry,
  copying URLs, revealing materials, and failed saves during close-other-tabs.
  Existing note and reader behavior is covered by the same selected checks.
- Four new context-menu baselines were reviewed in both themes and sizes, then
  normal comparisons passed. Move-dialog screenshots and the separate developer
  catalog were reviewed at Full HD in both themes. Existing reader baselines
  passed without modification.
- Full solution build passed with zero warnings/errors. New migration and model
  snapshot agree with EF's pending-model check. Backend formatting and frontend
  quality checks (format, lint, typed fixtures/E2E, locales and dependencies) pass.
  All four frontend libraries and the production host compile separately; the
  new UI library and developer catalog also passed their own builds.

The first browser pass exposed the temporary root-drop area's layout shift; it
now overlays navigation while dragging and does not move the target rows. Focus
after tab-menu dismissal and folder reparenting, same-revision divergence, exact
operation confirmation and validation before publishing workspace folder data
were corrected during review. One initial browser request exhausted local Chromium
buffers; the affected rerun used two workers and passed. New screenshot creation
was followed by normal comparison; no missing/skipped checks count as passes.

## Local delivery

Feature commit `3dd7e91` was fast-forward merged into local `trunk` through its
existing clean worktree. The primary checkout's clean source matched that merged
revision. Runtime image `mastercompanion:folders-3dd7e91` was built from it; the
Linux build passed frontend quality/compilation and API publish. Its image digest
is `sha256:727f079d8caa96eb6d7133b655b82730974bd33a5ca8fc8c95c6217a50f6f54c`.

Compose replaced only the application container and waited for healthy readiness.
PostgreSQL remains running with its existing volume; the reviewed additive folder
migration applies through ordinary startup. Both services are healthy, with the
application served on loopback port 4200.

Five read-only deployed-container cases pass, including the new folder snapshot
and workspace revision contract. A fresh Full HD production browser check confirms
the folder menu, creating a note dialog with the clicked folder preselected, and
keyboard focus return. The check blocked any non-read API request and observed none;
it created no material or folder operation and logged no browser page errors.

No remote push or AWS deployment occurred. The current development data policy
requires no backup or preservation probes for this update.

## Folder interaction corrections — 4 October 2026

The move dialog previously assigned the select value before Angular rendered its
dynamic options. A nested folder consequently appeared to be at the root while
the draft still retained its existing parent; choosing that displayed option did
not trigger a change. Parent and sibling position now bind selection on the
rendered options. Browser regression tests cover the initial parent, moving back
to the root, reload persistence, current sibling position, changing parents and
reopening the dialog.

Folder rows have a stable minimum height of 56 pixels. Their upper/lower 35 percent
are ordering targets, leaving the middle for nesting. A five-pixel accent marker
on the soft background is visible in both themes. The root drop target is anchored
to the workspace outside the scrolling navigation, with temporary bottom padding
to keep the last rows reachable. Scrolled-navigation tests verify a complete root
drop. The menu contains Add document, Rename and Move; redundant expand/collapse
actions and their translations have been removed. Polish Add document is
“Dodaj dokument”.

The original nested-parent regression failed against the old implementation.
Twenty-four folder unit cases pass, as do sixty functional browser cases across
both themes and viewport sizes. Four intentionally changed menu baselines were
reviewed after a normal comparison, updated only for that exact visual test, and
checked again without baseline updates. Full frontend quality and compilation
pass. The before/after ordering indicators were reviewed at Full HD in both themes.
