# Campaign material deletion

7 October 2026 · user-requested future work; not implemented or scheduled

## Requested entry points

Provide Delete for campaign materials in their context menu, reachable by right
click in navigation and the equivalent keyboard/menu-button interaction. Render
the action with a trash icon and destructive red text/icon treatment. Also provide
a trash action beside Edit for the currently selected open document. Keep it
reachable in edit mode as well, without losing the current draft merely by opening
the confirmation. Both entry points invoke the same engine-owned deletion use case.

An icon-only document action needs a localized accessible name, hover/focus
explanation and visible keyboard focus. The menu uses a concise Delete label.
Color supplements the label and trash icon; it is not the only indication.

## Confirmation and draft behavior

Confirmation identifies the exact document by title and explains the consequences
before submitting a deletion. Cancel keeps the document, selection and draft and
returns focus to the trigger. Ordinary clean deletion needs this one confirmation,
not a second generic approval step.

If the document has an unsaved or saving draft, state that explicitly. Do not
silently discard it or delete while a save is unresolved. Define a deliberate
discard-and-delete choice or let the user return to save first. Preserve a
recoverable draft on failure, revision conflict or uncertain outcome; exact retry
must not become deletion of a different revision or document.

## Reference and persistence boundary

Campaign deletion must not modify module sources or defaults. Stable material
identity, expected revision and campaign ownership must be validated on the
server. Define the atomic deletion boundary and idempotent retry receipt before
implementation, including racing saves and repeated actions from two windows.

Inspect incoming document links, map-marker targets, session pins and session-owned
preparation/play relationships. Confirmation must explain affected references.
Choose explicit handling for each relationship before delivery: reject protected
deletions, deliberately unlink dependent references or retain a localized missing
target experience as appropriate. Do not silently delete linked materials,
entire maps or session records. A session's required documents need a deliberate
ownership rule rather than blindly applying generic deletion.

After confirmation, update navigation, material memory, search, tab overview and
open tabs consistently. Select a predictable remaining document or empty workspace;
direct URLs to a removed material show localized recovery. Remote deletion must
preserve another window's unsaved draft. Keep this operation independent of game
time, module mechanics and gameplay undo.

Hard deletion versus retained deletion records, and any user-facing restore
feature, remain design decisions; this request does not add a recycle-bin product
or local backup infrastructure.

## Planned acceptance

- Context-menu and document-toolbar actions target the same exact material and
  display the requested trash/destructive treatment.
- Pointer and keyboard routes, confirmation cancellation and focus return work
  in both themes; the active document is unambiguous.
- Clean, dirty, saving, failed and conflicting cases follow the chosen draft rule.
- Ownership/reference rules, atomic cleanup, concurrent saves and exact retries
  use isolated implementation tests, not the runtime campaign.
- Confirmed deletion updates tabs/navigation/search/pins/map targets according to
  the reviewed contract and survives reload without modifying module sources.

Related: [recommended sequence](15-Near-term-improvements.md#recommended-development-order),
[folder and context-menu ownership](25-Folder-management-and-context-menus.md).
These are planned criteria, not completed verification.
