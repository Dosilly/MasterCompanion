# UX follow-up corrections

5 October 2026 · reported after the first A/H/I/J/B delivery

This slice addresses the four user-reported follow-ups. It does not start the
remaining C–G redesign or map authoring.

## Resulting behavior

- Ythryn's pending-action reminders scroll to and focus the encounter queue,
  faction arrival or character check inside the mounted gameplay tool. They use
  local action buttons, so clicking them cannot replace the workspace route with
  an unknown fragment such as `#encounter-queue`. Keyboard activation uses the
  same behavior. Targets have programmatic focus without joining the tab order.
- Document context menus contain Move document to folder, Change document order
  and Copy material link. Open material and Show in navigation were removed from
  that menu. Tab menus retain Show in navigation because their target may be
  outside the visible navigation tree.
- The new-session field starts with a localized `Session {date}` suggestion using
  the browser's local calendar date in `YYYY-MM-DD` format. The name remains
  editable and resets after confirmed creation. An untouched suggestion does not
  block tab closure; changed names, record drafts and pending operations retain
  their existing protection. This date is separate from engine game time.
- Documents move to another folder or to Unfiled materials through a searchable
  folder dialog or drag/drop. A folder-header drop appends the document; a drop
  before/after another document inserts it at that position. The persistent drop
  target outside the navigation scroll area permits moving to Unfiled materials.
  Confirmed moves reveal the destination and keep the mounted reader/editor.

The previous ordering slice deliberately supported only same-folder placement.
Moving between folders is now implemented explicitly rather than removing that
ordering operation's ownership checks.

## Contract and persistence

`moveMaterial` extends the existing campaign organization operation boundary:
`materialId`, nullable destination `folderId`, nullable following `beforeId`,
request identity and expected organization revision. The API validates the
campaign-owned material, destination and following sibling before mutation.
Folder assignment, sibling ordering, organization revision and immutable receipt
commit in one transaction under the existing campaign lock. Both source and
destination sibling order remain coherent.

Material ID, title, original group, rich document and content revision do not
change. Gameplay state and undo remain independent. Stale requests fail visibly;
uncertain confirmations retry the exact saved request. No schema migration is
needed. The frontend projects confirmed organization folder membership as well
as order, so a delayed document-cache response cannot move the item back or
replace its mounted draft.

## Scoped verification

- Eighteen frontend unit cases cover local date formatting, placement validation,
  receipt confirmation, stale organization reads and mounted-draft retention.
- Nine new real HTTP/PostgreSQL move cases cover folder/unfiled placement, invalid
  and foreign references, content/revision isolation, stale writes and exact
  replay. Nine affected existing reorder cases also pass.
- Browser checks cover reminder navigation/focus, local timezone date naming,
  untouched-form closure, searchable movement, native drag targets, reload,
  conflict and lost-response recovery in both themes and desktop sizes. Affected
  context-menu, ordering, session/deletion and folder-drag scenarios pass.
- Frontend quality and consumer compilation verify the shared contract change.
  The new move-dialog screenshots and affected gameplay visual baselines are
  reviewed in both themes. All affected gameplay visual checks pass with snapshot
  updates disabled; the compact reminder buttons retain the existing layout.

## Local runtime delivery

Commit `44ee190` was merged into local `trunk`. Image
`mastercompanion:ux-followup-44ee190` was built from that checkout; the production
frontend build and backend Release publication passed. Compose updated only the
application service. Application and PostgreSQL report healthy status, with the
app still bound to `127.0.0.1:4200`.

Eight read-only container checks passed:

```powershell
node --test tests/e2e/container.test.mjs tests/e2e/folder-management-container.test.mjs tests/e2e/session-container.test.mjs
```

A live Full HD review confirms `Sesja 2026-10-05`, closure of the untouched form,
the three document context-menu commands and the move dialog with the actual
current folder selected. It reports no horizontal overflow or console errors.
No campaign write was submitted. The current live campaign has no pending checks;
reminder navigation and write/recovery behavior were verified in isolated tests.
The local runtime review image is `.local/ux-followup-review/live-move-dialog.jpg`.
See [implementation status](07-Implementation-status.md) for the current delivery.
