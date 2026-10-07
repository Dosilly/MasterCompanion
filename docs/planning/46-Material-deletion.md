# Campaign material deletion

7 October 2026 · implemented on `codex/material-deletion`

## Interaction and draft ownership

Navigation material menus (right click, ContextMenu or Shift+F10), material tab
menus and the document toolbar invoke one engine-owned confirmation. Delete uses
a red trash icon; the icon-only toolbar control stays next to Edit in read and
edit mode, with a localized accessible name, title and visible focus. The shared
neutral context menu accepts optional `icon` and `destructive` presentation inputs.

Opening confirmation pauses queued autosave without discarding or unmounting the
editor. An existing request must settle before the reference preview captures the
confirmed revision. Drafts changed during that request stay queued. The dialog
names the exact material and lists incoming document links, map markers, session
pins and required session ownership. A dirty draft requires an explicit discard
acknowledgement. It is discarded only after server confirmation. Cancellation
returns focus and resumes a queued draft, while save errors and revision conflicts
retain their existing deliberate recovery flow. A remotely deleted document keeps
its dirty open draft available for copying, removes it from live navigation and
stops further autosaves. Clean removed sessions disappear on campaign refresh.

The dialog disables repeat submissions and cancellation during the destructive write.
Reference inspection remains cancellable, including while an ordinary save settles;
its cancelled asynchronous results cannot reopen or change the confirmation.
A rejected deletion keeps the draft and requires reopening/reviewing the preview;
a material revision conflict also activates ordinary saved-version inspection.
A network, server or malformed-response failure keeps the original request and
offers exact retry. Other deletions are blocked while that uncertain request needs
resolution. Back keeps the open draft and the retry request in this workspace;
reopening the same material retries without substituting a newer revision. A localized
workspace recovery banner stays reachable even if campaign refresh removes the
target from navigation. Pending and uncertain deletions participate in existing
before-unload protection. This
slice adds no cross-reload draft store or recycle bin. Existing before-unload draft
protection remains in force.

## Reference rules

- A session's preparation and notes documents cannot be deleted while the owning
  session exists. Delete the session first; existing session deletion preserves its
  documents, which then become independently deletable.
- Session pins are removed atomically with the material, and `SessionsRevision`
  advances once if pins changed. No session or other material is deleted.
- Incoming `#material/{id}` links, including `/{anchor}`, and map markers remain
  intact. Following their deleted target uses the existing localized missing-material
  recovery. Source documents and complete maps are not rewritten or removed.
- Module Markdown sources, defaults, assets, game time, mechanics and gameplay undo
  are outside this operation. The operation deletes only the campaign's copy.

## Persistence contract

`GET /api/campaigns/{campaignId}/materials/{id}/deletion` returns the exact material
revision and a reference preview token. The token binds incoming source document
identities/revisions, map definitions and the session collection revision to the
reviewed consequences. This is confirmation concurrency control, not a content
preservation or backup probe.

`POST` to the same route accepts `{ requestId, expectedRevision, referencesToken }`.
The use case validates a strict bounded JSON envelope, campaign ownership and the
exact material revision. A shared campaign row lock followed by the material row
lock owns reference revalidation, required-document rejection, pin cleanup,
organization revision, hard deletion and an immutable `MaterialDeletionReceipt` in
one transaction. Material saves now acquire the same campaign lock before updating
a material, so concurrent changes to incoming links cannot bypass confirmation.
Session and folder writers already use that lock. Cancellation reaches database I/O.

A repeated identical request replays success even though the material is gone.
Reusing its request ID for a different target, revision or reference token conflicts.
Another deletion request for the removed material returns not found. Receipts have
no material foreign key and survive the target's deletion. The new EF migration
adds only the receipt table; applied migrations and campaign content are untouched.

Confirmed deletion removes cache records (including stale in-flight reads), open
tabs and navigation, refreshes search, folder organization and session pins, and
selects the next then previous open tab or an empty workspace. Startup falls back
to the first remaining material if the module's default document was deleted.
A direct URL to a missing material shows localized recovery.

## Verification

Focused real API/PostgreSQL tests cover reference discovery and cleanup, required
session ownership, expected revision, changed incoming links, foreign campaigns,
exact retry, independent simultaneous deletions, racing saves and invalid envelopes.
Frontend tests exercise paused and saving drafts, deliberate discard, conflicts,
uncertain exact retry, stale cache reads and remote draft recovery. Browser tests
cover pointer/keyboard entry points, focus return, protected and saving documents,
failed-save draft cancellation, exact retry, navigation/tab removal and reload in
both themes and both supported viewports. The confirmation screenshots are reviewed
at Full HD; the UI catalog includes enabled/disabled destructive actions.

Related: [module architecture](06-Module-architecture.md),
[context-menu catalog](17-Context-menu-catalog.md),
[recommended sequence](15-Near-term-improvements.md#recommended-development-order).


Verified checks on this branch:

- 13 isolated API/PostgreSQL cases in `DeleteMaterialHttpTests`; pin cleanup also
  rejects a session draft based on the earlier collection revision.
- 31 scoped frontend unit cases across deletion, autosave and workspace material
  memory (successful unchanged workspace cases reused after later dialog changes).
- 28 `@deletion` browser cases across Full HD/scaled light/dark projects.
- Frontend production build, typed fixtures/E2E, repository quality and dependency
  guards; dedicated UI catalog build and browser checks for destructive, disabled,
  keyboard focus and focus-return states in both themes.
- Full HD dialog and catalog images reviewed in both themes. No existing visual
  baseline was replaced to clear a failure.

The local runtime image build/update and deployed readiness/feature probe are
coordinated by the parent task after this branch commit. No merge or remote push
is part of feature delivery.
