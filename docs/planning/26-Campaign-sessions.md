# Campaign sessions and pinned materials

5 October 2026 · implemented, verified, merged into local `trunk` and delivered

## Scope

Deliver the next product slice from the campaign-notes roadmap: named meetings,
preparation, pinned existing materials, separate play notes, summaries and matters
for the next meeting. Sessions progress from planned to active to completed; only
one session can be active in a campaign. Previous records remain accessible.

Preparation and play notes are ordinary campaign-owned rich documents, created
atomically with the session. They reuse explicit editing, internal links,
revision-protected autosave and save-before-close. The session view opens these
documents with an explicit session/role label. Pins reference stable material IDs
and never copy content. Summary and follow-up text use an explicit save form with
recoverable drafts. Session selection and navigation preserve mounted views.

Chronicle events, a generic reminder creator, map authoring and multiple campaigns
remain subsequent scope. Existing module reminders remain in their tools and carry
across meetings because sessions do not reset or advance gameplay.

## Ownership and operation contract

The engine owns meeting records, their material relationships and pins. Module
sources and defaults are unchanged. Session operations do not change game time,
party/module state, gameplay revision or undo history. Ordinary document saves
remain independent of session-record revisions.

`GET /api/campaigns/{campaignId}/sessions` returns the session collection and its
revision. `POST` accepts an immutable request identity, expected collection
revision and one explicit create/update/start/complete/pin/unpin operation. A
campaign row lock and transaction own changes, creation of the two documents and
receipt persistence. Exact retries replay the original result; divergent request
identities and stale revisions fail visibly. The browser retains uncertain
requests in campaign-scoped tab storage and retries the same identity.

The persistent workspace has a `/sessions` view. This route addresses the meeting
workspace; selected record and unsaved form remain mounted workspace state.

`create` carries a stable session ID, title and localized titles for its two new
documents. `update` changes the title, summary and follow-up; `start` and `complete`
change lifecycle only. `pin` and `unpin` carry one stable material ID. The collection
is limited to 1,000 records, each record to 200 pins, titles to 300 characters and
summary/follow-up to 20,000 characters each. JSON requests are bounded to 256 KiB.
The normal creation UI limits the base title to 240 characters to leave room for
localized document-role labels. Renaming a record leaves its document IDs and
authored document titles intact; the session view shows the current record title.

An additive EF migration adds records, receipts and the independent revision,
document foreign keys and a partial unique index for one active meeting. Pins are
validated against the campaign at the operation boundary and stored as JSON IDs.
There is currently no material/session deletion feature.

`MeetingRecords` owns HTTP, confirmed records and uncertain requests.
`SessionDrafts` owns per-record title/summary/follow-up drafts and their original
text. A refresh cannot silently rebase a draft over changed remote text; an explicit
discard loads the saved version. Unrelated pin/lifecycle changes can advance the
collection revision without blocking a text draft whose original fields still
match. Closing the sessions tab saves outstanding record drafts first; conflicts
keep the tab and drafts available. Read mode is default, with explicit editing.

Unsent text drafts survive workspace navigation, not browser reload. Ordinary
before-unload protection covers those drafts. Exact uncertain writes survive
reload in session storage. Summary and follow-up are plain text; preparation and
play notes support the rich editor and material links. Session selection is not
encoded in the route. No browser offline database or chronicle is introduced.

## Verification and delivery

Scoped verification passed:

- 26 isolated HTTP/PostgreSQL cases through `WebApplicationFactory` and
  Testcontainers cover document creation, lifecycle continuity, campaign ownership,
  pins, invalid inputs, exact concurrent retries, divergent identities, concurrent
  revision conflicts, replay after document editing and complete rollback when
  document insertion fails. All tests use fresh test-owned databases and real migrations.
- 23 focused frontend cases and 23 routing cases exercise the actual TypeScript/Angular HTTP implementation,
  request storage, exact retry after reload, malformed confirmations, cancellation,
  stale/divergent snapshots, independent drafts and remote-text conflicts. Route
  checks include `/sessions` serialization and existing history/cancellation behavior.
- All 24 session browser cases pass across light/dark themes at 1920×1080 and
  1536×864. They cover preparation versus play documents, existing editor autosave,
  pinned material navigation, lifecycle/reload continuity, draft preservation,
  save-before-close, conflicts, unknown outcomes and visible loading recovery.
  Full HD preparation and completed-session screenshots were reviewed in both themes.
- Solution build passes with no warnings/errors. EF reports no pending model
  changes; scoped C# formatting passes. Frontend libraries and the test host compile
  separately. Formatting, lint, typed tests/E2E, locale and dependency guards pass.

Initial failures exposed too small a receipt JSON depth for non-empty pin arrays
and a test using the wrong existing save contract; both were corrected. Browser
test refinements use textbox selectors rather than read-only sections, retain
the mounted form's edit state on reopening and wait for confirmed completion
before reload. Failures were inspected and relevant scenarios rerun; no assertions
were weakened and no existing visual baselines were changed.

## Local delivery

Feature commit `2562798` was fast-forward merged into the existing clean local
`trunk` worktree. The runtime image was built directly from that merged checkout
as `mastercompanion:sessions-2562798`; its digest is
`sha256:29b34116b327f764ba25d37e825d5495f727db8e0e90535d65277805301ef8a2`.
The Docker build passed the normal frontend quality/build pipeline, all four
separately compiled libraries, production Angular host and Release API publication.
The standard `mastercompanion:local` tag also points to this verified image.

Compose updated only the application container and waited for healthy readiness.
The additive migration applies through ordinary startup. The existing PostgreSQL
service/volume remains in use, and both services are healthy on the local setup.
Seven read-only container checks pass, including the session collection, `/sessions`
deep route and appropriate unknown-campaign response. A fresh production browser
check at Full HD in both themes confirms loading, empty-state/create controls,
keyboard focus and no horizontal overflow or browser errors. All API writes were
blocked during that check; verification created no live session or document.

No remote push or external deployment occurred. Local backup/preservation probes
are outside this development update under the current data policy. At delivery,
map authoring was the next product slice, followed by multiple campaigns. The
subsequent [UX/UI audit](27-UX-UI-audit.md) and
[corrective plan](28-UX-UI-improvement-plan.md) recommend corrections first;
chronicle remains separate scope and neutral UI extraction follows actual consumers.

## Subsequent corrective delivery — 5 October 2026

[Session deletion](30-Session-deletion.md) adds confirmed deletion with retained
materials and recoverable drafts. [Searchable choices](31-Searchable-choices.md)
replace the pin dropdown with title/path filtering. Session creation now advances
the shared organization revision when adding its two ordinary documents. Record-level
URLs and broader session workflow restructuring remain cycle E scope.

The [follow-up corrections](34-UX-follow-up-corrections.md) add an editable,
localized new-session name with today's local calendar date. An untouched
suggestion can be closed without creating a record; changed names and pending
operations retain their close protection. Confirmed creation refreshes the
suggestion for the next meeting.
