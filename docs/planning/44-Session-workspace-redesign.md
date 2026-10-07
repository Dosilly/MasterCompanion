# Session workspace redesign

7 October 2026 · user-requested future work; composition selected, not implemented

## Selected design

On 7 October, the user selected the recommended single workspace with the session
list beside the selected document. Keep session switching and content in the same
view. The separate list/detail-page alternative is not selected. This decision
chooses the future composition; implementation remains in the roadmap sequence.

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

## Planned acceptance

- New is visibly owned by the list; record actions are beside the selected record.
- Preparation, play and summary are distinct and usable regardless of lifecycle.
- The user can explain Start/Finish consequences from the interface alone.
- Active context appears/disappears correctly; a competing active session is named.
- Reading/editing, pins, creation cancellation, record history, deletion, switching
  and save errors/conflicts preserve the existing persistence behavior and drafts.
- Review populated and empty states at Full HD in both themes and the existing
  smaller desktop viewport. Check keyboard navigation, focus return and reader
  width; screenshot success alone is not usability evidence.

No application changes or tests have been delivered for this proposal. See
[the recommended sequence](15-Near-term-improvements.md#recommended-development-order)
and [the delivered workflow](38-Session-workflow.md).
