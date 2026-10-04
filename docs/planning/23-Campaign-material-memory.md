# Campaign material memory

4 October 2026 · implemented, verified and deployed locally

The third improvement loads the current campaign's persisted documents once and
retains confirmed content independently of open material tabs. It belongs to the
generic engine; module sources, game state and storage schemas are unchanged.

## Read contract and ownership

`GET /api/campaigns/{campaignId}/materials` returns an ordered array of the existing
material response contract, including metadata, supported rich document, schema
version and confirmed revision. Reads are campaign-scoped, no-tracking and
cancellable. A missing campaign returns HTTP 404 with `campaign_not_found`.

The frontend engine's `CampaignMaterialCache` owns confirmed document snapshots
and coalesces overlapping bulk requests. `WorkspaceMaterials` owns the cache's
campaign lifetime, workspace metadata and material sessions. Startup publishes the
workspace only after the complete snapshot loads and passes atomic validation.
The shared material-response decoder rejects unsupported schemas, malformed
metadata/documents and invalid revisions; creation confirmations use the same
supported-editor validation. Only opened tabs instantiate editors.

Closing a saved tab releases its view/session while retaining its confirmed
cached document. Opening or reopening a cached material sends no document GET.
A confirmed save updates the cache synchronously before close can finish; newer
queued drafts remain in their original session. Confirmed note creation joins the
same cache immediately. The ordinary save endpoint and revision checks remain
authoritative.

## Refresh and multiple windows

Each workspace has its own memory. The explicit Refresh materials action reloads
workspace metadata and the complete persisted snapshot. Closed documents use the
new content on their next opening. Mounted documents retain their current content,
editing state, draft, confirmed base revision and editor instance. Closing and
reopening a saved tab adopts its refreshed content. Editing an older mounted
revision continues to produce an ordinary server conflict rather than silently
overwriting another window's changes.

A fresh search result absent from memory triggers one coalesced bulk refresh before
opening. Initial or explicit-refresh failures have localized retry states and
retain previously loaded documents and open drafts. Missing-result refresh failures
use route recovery. Older read responses cannot roll back newer confirmed save
revisions, and a snapshot started before local creation cannot remove that newly
confirmed note. Refresh does not save, reload the page or perform game writes.

Persistent browser storage, automatic polling, map image preloading, full offline
operation and campaign switching are outside this slice. The complete snapshot
contract is intended for the measured current campaign; substantially larger
campaigns may justify a separately designed loading strategy.

## Measurement method

Read-only Node fetch and a fresh headless Chromium context measured the existing
local container before implementation: 106 documents, 711,527 serialized bytes,
1,412 ms for sequential document reads, 192 ms until the initial reader appeared,
and 5,115,352 bytes of used JavaScript heap after garbage collection. The old
startup fetched only the initial material, so its startup time is not a measurement
of loading the entire catalog. PowerShell request timings were excluded because
transport overhead dominated them.

The same method against the updated container measured a 711,634-byte bulk
response in 128 ms, 247 ms until the initial reader appeared, and 6,444,908 bytes
of used JavaScript heap. Startup issued one bulk read and zero individual material
reads. Loading the complete catalog now takes one request instead of 106; this
sample increased initial-reader time by 55 ms and whole-application used heap by
1,329,556 bytes (about 1.27 MiB).

These are single local samples, not performance guarantees. Heap values include
the whole rendered application, not only cached documents. The measured payload
is small enough to preload without creating all editors or requiring pagination
for the current campaign.

## Verification and delivery

Implementation uses `codex/material-memory-store`. Scoped verification passed:

- Five isolated HTTP/PostgreSQL integration cases verify campaign scope, stable
  ordering, authored document/revision fidelity, empty/missing campaigns and
  read-only behavior. Affected API dependencies compiled; scoped C# whitespace
  verification passed.
- Seventy frontend cases cover cache snapshots/validation (29), workspace sessions
  and creation integration (16), note creation (9), autosave (7) and real editor
  integration (9). Test typing, lint, formatting, localization and boundaries pass.
- The frontend contracts, engine, module and host compiled; engine/host were
  rebuilt after shared response validation changed.
- 184 distinct affected browser cases pass across both themes and Full HD/scaled
  viewports using scoped reruns. They cover preload/failure/retry, zero individual
  reads, confirmed revisions, stale responses, conflicts, navigation, search,
  actual editing and note recovery. Twenty intentional full-page baseline changes
  were reviewed before update; the new refresh control shifts navigation only.
- A read-only check confirms all 106 current persisted campaign documents pass
  the new supported-schema decoder.

Feature commit `07d5129` was fast-forward merged into local `trunk`. The runtime
image was built from that merged checkout, including final frontend quality/build
checks and Release API publication. The verified image was pinned as
`mastercompanion:material-memory-07d5129` before updating only the app service.
The running app image is
`sha256:cc11fd783ec151b369647f0a540b424a6ce11e0a876494e34fbd446899161d40`;
the application and PostgreSQL report healthy.

Eleven read-only deployed-container cases pass: application/assets/SPA behavior,
campaign/map/gameplay reads, five deep routes and two preload endpoint checks.
The measured real browser startup confirms one bulk read and zero individual
material reads. This feature adds no migration or campaign replacement.
Remote push and production deployment remain outside the request.
