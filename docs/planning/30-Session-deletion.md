# Session deletion

5 October 2026 · corrective slice I, addressing UX-21 from the
[UX/UI audit](27-UX-UI-audit.md) and
[corrective plan](28-UX-UI-improvement-plan.md).

## Behavior and ownership

The engine can delete a planned, active or completed meeting through the named
secondary Delete session action. A native modal identifies the session and explains
that its summary, follow-up and pin associations are removed. Ordinary preparation
and play-note documents, pinned source materials and already open document tabs
remain available. Active-meeting context clears without changing game time, party,
module state, gameplay revision or undo history. Another planned meeting can then
start.

Cancellation changes nothing and returns focus to the action. The initial focus is
on Keep session; Escape cancels when no request is pending. If record fields are
dirty, deletion requires explicit acknowledgement of their disposal. The draft is
discarded only after confirmed success, including an exact receipt retry. Conflict,
unknown outcome and ordinary failure retain the draft. Pending requests prevent
duplicate submission and cancellation during the write. Unknown outcomes expose
the existing exact-request retry inside the modal as well as the page feedback.

Confirmed deletion selects the active remaining meeting, otherwise the latest
remaining record, otherwise the empty list. Focus returns to the session heading.
Refresh of a remotely deleted selection offers localized recovery. Any unsaved
record draft remains in a labeled recovery section with read-only copyable text and
an explicit discard action; it continues blocking a save-before-close until resolved.
Record-specific addresses remain slice E; `/sessions` still addresses the workspace.

## Operation contract

The current explicit session operation adds `{ kind: 'delete', sessionId }`. It uses
the existing `POST /api/campaigns/{campaignId}/sessions` with immutable request
identity and expected session-collection revision. Campaign scoping, row lock,
tracked record removal, revision advancement and immutable receipt commit in one
transaction. Exact concurrent retries and later replay return the same receipt;
divergent identities conflict. A new request for a missing/foreign record returns
`session_not_found`. No schema change or migration is needed.

The confirmation captures the collection revision and refuses local drift while
open. The server remains authoritative for concurrent changes. Frontend validation
confirms deletion only when the response excludes its target; malformed success
retains an uncertain recovery request.

Integration with slice J makes `FoldersRevision` the shared organization revision.
Session creation inserts two ordinary materials, so it advances this revision in
the same transaction and rejects its supported limit before writing. Exact creation
replay never inserts again. Deletion does not change organization revision because
it leaves the materials and their order intact.

## Scoped verification

- Seven new real HTTP/PostgreSQL cases cover all lifecycle states, unchanged
  edited material contents/revisions, unchanged game state, reuse of active context,
  exact concurrent retry/later replay, divergent identity, stale revision, campaign
  ownership and complete rollback when receipt insertion fails. Cases use fresh
  Testcontainers databases, the actual API host and applied migrations.
- Targeted session-creation cases verify the shared organization revision, its
  limit, exact creation replay and rollback of record/documents/revisions/receipt.
- Twenty-six focused frontend cases pass for actual meeting HTTP/recovery and
  independent drafts, including malformed deletion confirmation and remotely
  deleted drafts.
- Twenty new browser cases pass across light/dark Full HD and 1536×864. They cover
  target/consequence confirmation, Escape/focus, draft acknowledgement/conflict,
  exact retry after lost response, retained open play-note documents/reload,
  deterministic record selection and explicit remotely deleted draft disposal.
  Full HD confirmation screenshots were reviewed in both themes.
- Frontend formatting, lint, typed tests/E2E, localization and dependency guards
  pass. All four frontend libraries and the host compile separately. C# whitespace
  is checked in affected files only; pre-existing dense initializers in the touched
  session use case were expanded by the repository formatter.

Verification uses isolated fixtures and databases; no runtime campaign mutation,
backup infrastructure, production probe, remote push or external deployment is
included. Local trunk integration and runtime delivery are owned by the first
corrective-cycle delivery record.
