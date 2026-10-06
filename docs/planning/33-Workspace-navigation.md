# Bounded navigation and persistent document commands

5 October 2026 · corrective cycle B

Two arrangements were compared against opening a session/map, finding a deep
material and returning to a long note: a separate collapsible destination rail,
and a fixed destination group inside the existing material sidebar. The rail
would add another permanent horizontal region or require an extra reveal action.
The sidebar group retains the existing reader width and gives destinations one
predictable home. New destinations add rows to that group, rather than header
buttons. Sidebar resizing/collapse and tab overflow remain cycle F work.

The header contains campaign identity, compact game time when loaded, and one
theme utility. Sessions, party, gameplay and maps use icon-and-text navigation in
the sidebar. Library creation/refresh actions are grouped below it. The search
field stays above independently scrolling tree/results regions. Selection reveal
and focus act on the relevant scroll region without moving the search field.

Document location, save status, edit/finish, recovery actions and formatting
commands sit outside the document scroll region. The command area wraps and has
a bounded overflow region for large error text. The prose surface retains its
1020px maximum width. Toolbar pressed state follows actual editor transactions;
undo/redo availability follows the real editor history. Read mode explicitly
announces a read-only text surface. These UI changes do not emit document saves.

Mounted documents, selection, map state and existing save-before-close ownership
remain in the engine. The editor releases its transaction listener on destruction.
The search view owns result scrolling; workspace navigation chooses which view
to reveal. Neutral UI components do not decide campaign routes or persistence.

Verification includes `@navigation` scenarios for deep selection, long results,
document-end controls and formatting/save behavior, alongside affected existing
reader/editor/search journeys. Visual evidence covers both themes and desktop
sizes. The full integration build verifies the newly combined A/H/I/J consumers.

Review corrected the read-mode surface role explicitly because the editor library
defaults to a textbox. Rendered tests now verify document → textbox → document.
The choice trigger also exposes the confirmed title/path through its accessible
description while keeping a stable field name.

Initial combined evidence: 84 behavior scenarios passed; 28 affected visual
scenarios passed after reviewing intentional layout/control changes and updating
baselines. Tests now locate primary destinations in their named navigation group.

Final integrated checks: frontend quality and full library/host build passed;
136 ordering, choice, deletion, navigation and route browser cases passed across
both themes/sizes. Existing unchanged reader/save/search behavior retains the
84-case evidence above. Catalog light/dark controls and expanded choices were
reviewed at Full HD; final field spacing uses the catalog owner styles.

A final session/organization integration correction has 52 scoped browser cases
passing (48 unchanged cases plus the four new creation/revision scenarios). The
normal 28-case visual run passes with snapshot updates disabled. C# whitespace
verification passed for the affected organization/material files.

## Local runtime delivery

The combined A/H/I/J/B implementation was merged into local `trunk` at
`e6a135c83fd10e95afe84cb8d6a4f30a166f2ac2`. The image
`mastercompanion:ux-e6a135c` was built from that clean merged checkout, with the
source revision recorded in its OCI label. The production frontend build and
backend restore/publish succeeded. The application container was updated using
the image; both application and PostgreSQL report healthy status.

Eight read-only runtime cases passed:

```powershell
node --test tests/e2e/container.test.mjs tests/e2e/folder-management-container.test.mjs tests/e2e/session-container.test.mjs
```

The organization probe additionally verifies unique material-order IDs, valid
folder references and the complete workspace material set at the same revision.
That extended probe passed against the updated container. Live Full HD review
covered light/dark reader layout without horizontal page overflow, the read-mode
document role, one header utility, sidebar destinations, session empty state,
Shift+F10 ordering access and filtering the ordering picker by document title.
No campaign write was submitted during live review. Local review screenshots
are stored under `.local/ux-cycle-review`; maintained visual baselines and the
isolated functional tests remain the repeatable evidence.
