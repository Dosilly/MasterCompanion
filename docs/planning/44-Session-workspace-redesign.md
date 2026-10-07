# Session workspace redesign

7 October 2026 · implemented on `codex/session-workspace`

## Selected design

On 7 October, the user selected the recommended single workspace with the session
list beside the selected document. Keep session switching and content in the same
view. The separate list/detail-page alternative is not selected. This decision
is implemented below with the existing persistence and lifecycle contracts.

## Problem and evidence

The user finds the session view visually blended and the purpose of lifecycle
actions unclear. Their screenshot shows New session isolated in the page header,
away from the list it changes. Guidance, lifecycle controls, document shortcuts,
pin selection, empty summary and empty follow-up compete in one continuous column.
This feedback reopens the composition after the delivered workflow corrections;
it does not invalidate their recorded functional verification.

## What lifecycle currently does

The actual `SessionChanges` implementation allows planned to active to completed,
with only one active meeting per campaign. Starting selects the active meeting for
the workspace header and its shortcut to the play-notes document. Completing
removes that active context. The current view also changes guidance and document
action emphasis by status. Both preparation and play documents remain accessible.

These operations do not advance game time, reset tools, alter party/module state
or enter gameplay undo. Completion does not require a summary and does not lock
the session's notes. There is no real-time timer or automatic recording. The
current contract has no reopen operation; a new UI must not imply that it exists.

Keep the lifecycle because active-note context is useful now, but explain its
consequence where the action is offered. Choosing a content section must remain
independent of changing lifecycle. Do not make clicking Play notes start a meeting.

## Selected composition: list and focused document

- Keep a compact session list on the left. Place New and Refresh beside its
  heading, not over the selected record. Creation uses a small localized dialog;
  cancel returns focus to New and preserves the current session.
- Show the selected session's title and status in the detail header. Put the one
  available lifecycle action beside them. Rename and Delete belong in a reachable
  record menu using the shared menu system; retain deletion confirmation.
- Use three content tabs: Preparation, Play notes and Summary. They are reading
  destinations, not workflow steps or status controls. Initial selection follows
  lifecycle only on first opening; later returns retain the user's selection.
- Preparation shows its existing rich document and pinned materials. Play notes
  shows its existing rich document and the same pinned shortcuts. Summary contains
  the summary and matters for the next meeting, with adjacent explicit editing
  and save controls. Avoid displaying all empty sections at once.
- Let the document occupy the useful width. Pinned materials use a compact
  disclosure below the document, with Add revealing the existing searchable
  material choice. Avoid a permanently open, wide selector or a third column.
- Default to read mode. Edit, save state and error/recovery controls belong beside
  the document or fields they affect. Keep first-use help brief and contextual;
  retain explicit actionable empty states rather than repeated instruction blocks.

For a planned record, Start is explained as making this meeting current and
enabling its workspace play-notes shortcut. For an active record, Finish is
explained as removing that shortcut while keeping the notes editable. If another
record is active, identify it and offer navigation to it rather than a vague
disabled action. Finishing may open Summary after confirmation, without requiring
text or inventing a game-time effect.

The reviewed separate list/detail-page alternative was not selected. Keep the
persistent list beside the document on desktop; at narrow widths, stack list and
detail within the same workspace rather than introducing separate pages.

## Ownership and implementation boundaries

Session routes, active context and record persistence stay in the engine. Reuse
ordinary material sessions for the two rich documents; do not create another
editor/save owner or copy their content into a session-specific store. Decide
mounted-editor reuse before embedding documents, so existing standalone tabs,
drafts and save-before-close keep one authoritative owner. Tab switching changes
presentation only. Record summary/follow-up keep their explicit save contract.

Preserve record IDs and routes, material IDs, pins, revision checks, transactions,
uncertain-operation receipts, independent drafts and deletion recovery. Closing
the parent view must account for every owned unsaved draft. The redesign does
not add new lifecycle states, chronicle events or automatic gameplay operations.

## Acceptance criteria

- New is visibly owned by the list; record actions are beside the selected record.
- Preparation, play and summary are distinct and usable regardless of lifecycle.
- The user can explain Start/Finish consequences from the interface alone.
- Active context appears/disappears correctly; a competing active session is named.
- Reading/editing, pins, creation cancellation, record history, deletion, switching
  and save errors/conflicts preserve the existing persistence behavior and drafts.
- Review populated and empty states at Full HD in both themes and the existing
  smaller desktop viewport. Check keyboard navigation, focus return and reader
  width; screenshot success alone is not usability evidence.

The implementation and scoped verification are recorded below. See
[the recommended sequence](15-Near-term-improvements.md#recommended-development-order)
and [the delivered workflow](38-Session-workflow.md).

## Delivered implementation

The session list and New/Refresh actions remain beside the selected record. Three
keyboard-operable tabs separate Preparation, Play notes and Summary without changing
lifecycle. Per-record section selection survives subsequent visits. Compact pinned
materials sit in a disclosure below each rich document, with Add revealing the
existing searchable material choice. Creation and Finish use localized dialogs;
record Rename/Delete use the shared reachable menu. Start/Finish consequences and
navigation to a competing active record are explicit.

The engine owns one MaterialSession and one mounted MaterialView/editor per material.
MaterialViewRegistry moves retained Angular ViewRefs between stable workspace and
session hosts; it does not copy content or create another save owner. Loading an
embedded document does not create a standalone tab. Editor history, selection and
scroll survive section changes and standalone visits. MaterialView captures/restores
scroll around relocation and releases document-navigation listeners on destruction.

Closing the session parent serializes and flushes every historically embedded
document, including drafts whose session record was removed remotely. It rechecks outstanding drafts after each pass so documents edited while another save is pending also wait for confirmation. A failed save
keeps the parent open and offers navigation to the recoverable document. Existing
session summary drafts and operation receipts retain their persistence/recovery
boundary. Rename uses an independent dialog draft and directs unsaved summary or
follow-up work to its own Save/Discard flow instead of implicitly persisting it.
An unsaved rename participates in before-unload protection; cancellation leaves the
confirmed title and other drafts intact.

No backend schema or lifecycle operation changed. Engine time, module state and
gameplay undo remain independent of session presentation.

## Verification

Scoped frontend rules and state tests passed: 46 cases covering section selection,
material autosave, session drafts, routing and operation recovery. The frontend
build, quality checks, typed test fixtures and E2E type check passed.

The four session browser suites passed 92 distinct project cases across Full HD
and the smaller desktop viewport, each in light and dark themes. The initial
history scenario needed corrected fixture material IDs and independently seeded
saved text; the navigation selector was scoped to its owning navigation landmark.
Those cases passed after correction. The final parent-close change passed 16
focused cases, including a second document edited while the first save was held.
Successful unchanged cases were reused rather than repeated.

Twelve focused ordinary-reader/editor cases passed for scroll and keyboard tabs,
confirmed-save-before-close, retained drafts and save conflicts. Reviewed rendered
evidence covers populated Preparation, empty Play notes and empty Summary at
Full HD in both themes and at the smaller viewport. The reader remains wide,
section controls have visible keyboard focus and the checked views do not overflow
horizontally. This is scoped feature verification, not full application acceptance.

Commands used from the repository root:

- pnpm --dir src/mastercompanion-web check:quality
- pnpm --dir src/mastercompanion-web check:tests
- pnpm --dir src/mastercompanion-web check:ui
- pnpm --dir src/mastercompanion-web build
- pnpm --dir src/mastercompanion-web exec playwright test e2e/session-workspace.spec.ts e2e/sessions.spec.ts e2e/session-deletion.spec.ts e2e/session-workflow.spec.ts
- Focused Playwright reader/editor runs selected save, conflict, scroll and tab-navigation scenarios.
