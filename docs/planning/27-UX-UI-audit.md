# UX/UI audit

5 October 2026 · assessment of the delivered application, before corrective implementation

Related: [corrective implementation plan](28-UX-UI-improvement-plan.md),
[product concept](00-Product-concept.md), [user stories](02-User-stories.md),
[implementation status](07-Implementation-status.md), and
[shared UI ownership](17-Reusable-frontend-ui.md).

## Assessment

The application supports the main campaign tasks, but its interaction design is
less developed than its persistence and feature coverage. Reading a document is
the strongest screen. Navigation, session management and gameplay increasingly
look like separate administrative forms rather than parts of one GM workspace.
The largest opportunities are faster information access, persistent context,
clearer action consequences and a stronger visual hierarchy.

Passing browser tests and recent delivery do not establish good usability. This
audit evaluates the session feature and recent folder changes by the same criteria
as older screens. No numerical satisfaction score or user-error rate is inferred
from source inspection or screenshots.

## Method and evidence limits

- Inspected the running local application at `http://localhost:4200/`, delivered
  from the sessions implementation, with repository baseline `038d373`.
- Reviewed reader, editor, search, folder navigation, overflowing tabs, map,
  gameplay, party, note-creation dialog and empty sessions. Inspected both themes
  at 1920 × 1080 and gameplay at 1536 × 864, the existing smaller desktop test size.
- Walked through map → location → another material → game, search → material,
  read → edit → scroll → read, and opening/cancelling note creation. No campaign
  content, session or gameplay operation was submitted during the audit.
- Measured selected DOM geometry and computed styles. Reviewed the actual owning
  templates, styles and state owners to distinguish a missing control from a
  control hidden by scrolling or an unavailable state.
- Reviewed existing Full HD session delivery screenshots with populated fixture
  data. These are previous test artifacts, not newly exercised live session flows.
  Conflict and uncertain-operation findings use implementation/resource review;
  those failures were not injected into the user's running campaign.
- This is an expert review, not observation of a GM running a real session, a
  performance benchmark, a full accessibility certification or mobile acceptance.
  Hypotheses about confusion and speed still require a short task-based review.
- The user's follow-up confirms practical difficulty with unsearchable material
  and folder dropdowns, inability to delete tested sessions, and inability to
  reorder notes inside a folder. These are direct product-owner reports, checked
  against the current templates/contracts, not assumed participant measurements.
- The user also reports generic button appearance, scattered action placement
  and a growing row of upper-right navigation buttons. Refresh is specifically
  suitable for a compact reload icon; the navigation concern is structural.

Evidence labels: **Observed** = live rendered interaction; **Measured** = DOM or
style measurement; **User-reported** = the GM's direct follow-up; **Code** = inspected
implementation; **Heuristic** = expected user impact not measured with participants.

Priority: **P1** = prioritize early because the issue affects
frequent work, recovery or accessibility; **P2** = meaningful friction or visual
inconsistency; **P3** = later polish. No P0 data-loss defect was demonstrated by
this read-only audit. Priorities describe this product's workflow, not test status.

## Task assessment

| GM task | Current outcome | Main friction |
| --- | --- | --- |
| Find a rule while a player waits | Search works on saved campaign content | Search scrolls out of reach; long snippets have no folder context or match emphasis |
| Open a location from the map | Marker opens the correct ordinary material | Small scaled targets; pointer-only panning; limited orientation by location name |
| Read and amend a long note | Explicit editing and rich content work | Edit/finish, formatting and save feedback leave the viewport |
| Record the current session | Preparation and play documents have separate ownership | Active meeting and its play notes are not immediately available from other screens |
| Advance exploration and resolve tools | Explicit operations and undo exist | Clock advance and exploration are visually disconnected; too many equally weighted forms |
| Return to a past meeting | Session records and text exist | Selection has no individual URL; picker and layout scale poorly with more records/materials |
| Choose a folder or pinned material in a large campaign | Native lists expose valid options | No explicit filtering; long destination/material lists are difficult to use |
| Remove a test or unwanted session | No deletion operation exists | The meeting remains in the collection |
| Arrange notes for preparation/play | Persisted source order is displayed | The GM cannot change the order within a folder |
| Recover a failed or conflicting save | Drafts are retained and failure is visible | Recovery copy/actions differ; material conflict asks for manual copying and page refresh |

## Findings

### UX-01 · Search and creation controls disappear during navigation — P1

**Observed / Measured / Code.** Search, New note and Refresh share the folder tree's
scroll container. Initial material reveal moved the navigation scroll position to
about 106 px; opening Y19 moved it much further and hid these controls. Activating
a searched material also scrolled the result list away from the search field.
The GM must scroll a separate pane before starting the next lookup.

Keep the search/action area outside the scrolling tree/results. Reveal the active
row within the remaining pane, without displacing search or stealing typing focus.
Owner: engine workspace and material search.

### UX-02 · Navigation width and density do not adapt to the content — P2

**Observed / Code / Heuristic.** A fixed 260 px pane wraps long folder and material
names; folder rows are at least 56 px high. The expanded locations branch contains
the main locations and all Y19 rooms at the same level. This creates a long list
and makes the hierarchy harder to scan. A permanent pane also occupies map/tool
space even when the GM already has the required materials open.

Offer bounded resizing and a keyboard-operable collapse/reopen control. Separate
normal browsing density from the large, unambiguous drag targets already delivered.
Do not flatten authored nesting or undo the recent drag/drop corrections.
Owner: engine workspace; neutral control appearance in UI.

### UX-03 · Many open tabs have weak overview and overflow affordance — P2

**Observed / Measured / Code.** After opening tool tabs and eight locations, the tab
strip measured 2330 px of content in a 1660 px viewport. The selected tab is
automatically revealed, which works, but other open materials disappear behind
horizontal scrolling. Full titles vary substantially in width and every tab has
the same visible close treatment.

Add an open-tab overview with active/dirty state and an explicit overflow cue.
Keep keyboard tab navigation, context menus, middle-click and save-before-close.
Make permanent destinations versus opened documents visually understandable before
changing their placement. Owner: engine workspace/tab ownership.

### UX-04 · Editor commands and save state leave the viewport — P1

**Observed / Measured / Code.** Reading bar and editor toolbar are inside the
document scroll area. After scrolling the edited introduction, Finish editing was
at approximately y = −389 px and the save indicator and formatting controls were
also above the viewport. The document border remains, but it does not communicate
whether persistence is pending, successful or blocked.

Keep a compact reader/editing command bar and current save/recovery state visible
within the material panel. Reserve its space and account for it when jumping to
anchors. Do not widen the toolbar into a permanent side panel or emit document
updates for scrolling. Owner: engine materials.

### UX-05 · Formatting state and read-only semantics are incomplete — P2

**Observed / Code.** Bold has no `aria-pressed` state; the toolbar does not expose
which supported formatting is selected or whether undo/redo is available. In read
mode, the rendered document still has `role="textbox"`, `contenteditable="false"`
and no `aria-readonly`. The theme button's accessible name is always Dark mode
while its visible dark-theme label is Light mode.

Expose the actual editor selection/command state and unambiguous read/edit
semantics. Make the theme control's visible and accessible labels agree. These
are concrete semantics issues; a full screen-reader journey remains unverified.
Owner: engine materials/workspace; reusable semantics where demonstrated.

### UX-06 · Long documents lack a quick section/match navigation surface — P2

**Observed / Code / Heuristic.** Documents have headings, links and stable anchors,
but no document outline control. Search snippets may point to a passage deep in a
document; opening a result provides no visible match navigation. Browser Find is
a possible workaround, not a measured product workflow.

Prototype a compact, on-demand outline and temporary next/previous match controls.
Use existing supported document headings/anchors without rewriting content or
permanently reducing reader width. Assess a shorter prose measure separately from
full-width tables; the measured document body is about 934 px wide at Full HD.
Owner: engine materials. A global width reduction is not justified by this audit.

### UX-07 · Search results are difficult to distinguish and scan — P2

**Observed / Code.** The Iriolarthas query returned rules, locations, editorial
notes and player-thread material. Results show title and a 12 px snippet, without
folder path, highlighted terms or a numerical result summary. The explanation for
returning to folders is below the results; a long list pushes it out of view.

Show concise path/context, matching-term emphasis and a visible clear-search
control near the field. Keep snippets bounded and useful. Derive context from
stable campaign IDs/metadata rather than title assumptions. Owner: engine search.

### UX-08 · Active session and play notes are too remote from ongoing play — P1

**Code / Heuristic; live campaign had no session records.** The header exposes
Sessions but no active meeting name or direct play-note action. Reaching play notes
from a material requires opening Sessions and then the notes document. The return
banner is derived from loaded meeting records; it is not guaranteed for a direct
document visit before those records are loaded.

Provide a compact active-meeting context and direct Open play notes action across
the workspace. Keep rich notes in their existing ordinary material editor; do not
introduce a second autosave implementation. Test the hypothesis with an actual
active meeting in isolated browser fixtures. Owner: engine sessions/workspace.

### UX-09 · Session pinning and record navigation will not scale well — P2

**User-reported / Code / previous fixture screenshots.** Pins use a native select with
all available titles and no filter or folder context. Duplicate titles would be
indistinguishable despite having correct stable IDs. Sessions have one collection
URL; the selected record cannot be linked or restored by browser history.

Use a searchable campaign-material picker with path context. Add a stable session
record address and predictable Back/Forward/reload behavior. Keep selection,
pinning and document opening distinct. Owner: engine sessions/routing; extend
explicit frontend contracts only where necessary.

### UX-10 · Session layout privileges administration over meeting work — P2

**Observed empty state / Code / previous fixture screenshots / Heuristic.** The
creation form always occupies the top of the page, even when reviewing a meeting.
Lifecycle, document opening, pinning and summary editing form one long stack.
Summary save actions are at the bottom; their explicit-save model differs from
the rich documents' autosave. Rename is reached through the lower details form.

Design distinct empty, planned, active and completed presentations. Prioritize
preparation when planned and play notes/pins when active. Move creation into an
intentional action after the first session exists. Make explicit-save boundaries
clear and keep their controls reachable; do not require a summary to end a meeting.
Owner: engine sessions.

### UX-11 · Time versus exploration requires too much interpretation — P1

**Observed / Code / Heuristic.** The top clock can advance 60 minutes, while a
separate exploration form defaults to 60 minutes and building search advances
30 minutes. Only explanatory prose establishes that ordinary clock advance and
rests do not generate exploration encounters. The similarity invites choosing
the wrong activity or applying both; no observed user error is claimed.

Label actions by intent and show a concise effect beside them: game-time delta,
exploration delta and applicable checks. Preserve the distinct domain operations.
The engine owns neutral time/rest controls; Ythryn owns exploration rules and
consequence interpretation. Cross-boundary presentation needs an explicit neutral
contract if introduced. Owner: engine gameplay and Ythryn tools.

### UX-12 · Gameplay is a long, uniformly dense form — P1

**Observed / Code / Heuristic.** At Full HD, four expedition cards with several
paragraphs precede the encounter queue, five character cards and two large rival
groups. At the smaller desktop size, expedition cards wrap to a further row.
The clock/undo controls leave view when reviewing disease or rival state. An
existing module-local pending-actions list is useful and should be retained.

Create a compact overview and task-oriented sections with concise current values,
on-demand rules and forms revealed for the chosen action. Keep overdue matters
visible when collapsing sections. Do not hide alerts inside an inactive tab or
remove access to rules. Owner: Ythryn presentation and engine game shell.

### UX-13 · Important game mutations do not stand apart from routine controls — P1

**Observed / Code / Heuristic.** Confirm arrival, record losses, search, open rules
and refresh share similar outlined styling. Arrival forms repeat the same visible
button text for different rivals; the Auril consequence is described in a long
paragraph away from the actual commit control. Undo is an isolated glyph at the
top and applies only to the latest operation.

Name the affected target in action/review copy and show the chosen operation's
effect immediately before submission. Use focused review for consequential
arrival/transformation actions; do not add confirmation dialogs to every routine
time advance or result. Retain atomicity, idempotent retry and last-operation undo.
Owner: module action presentation and engine undo presentation.

### UX-14 · Weak action hierarchy makes screens look unfinished — P1

**User-reported / Observed / Code / Heuristic.** Most controls use the same thin outline, surface,
radius and text treatment. Create, save, cancel, refresh and navigation compete
visually. Hover/focus/selection styling carries more emphasis than the normal
primary action. This is a design and scanability problem, not evidence that each
button fails accessibility requirements.

Define restrained primary, secondary, quiet and consequential action treatments.
Choose the primary action for the current task/state, not for every card. Give
page titles, section titles, labels, values and help text consistent roles.
Use compact icons for familiar utilities such as Refresh, with an accessible
name and visible hover/focus explanation. Keep meaningful labels for less obvious
domain actions; replacing every label with a symbol would not solve hierarchy.
Owner: neutral UI tokens/control styles, with feature-owned action importance.

### UX-15 · Field boundaries have insufficient visual contrast — P1

**Measured / Observed / Code.** Current `--line` versus `--paper` contrast is about
1.38:1 in light and 1.94:1 in dark; against `--page`, about 1.23:1 and 2.30:1.
Empty search/name fields rely on a thin border and a very similar background to
identify their editable area. Form boundary visibility is materially weaker than
the otherwise clear focus indicator.

Introduce a control-border token distinct from decorative dividers. Verify the
unfocused editable boundary against its actual adjacent surface; target at least
3:1 where it identifies the control. Do not darken all document/table separators
indiscriminately. Disabled components and text-labelled buttons have different
requirements; these ratios alone do not imply every border is a WCAG failure.
Owner: neutral theme foundation and actual field consumers.

### UX-16 · Visual language differs between reader and tool screens — P2

**Observed / Code.** Prose uses 17 px/1.7 text and prominent read-aloud blocks;
navigation/status often use 11–13 px and tool cards use dense 14 px paragraphs.
Document links use the theme accent, while the disease rules link uses browser
link styling (measured dark color `rgb(158, 158, 255)`). Session statuses, feedback,
cards and dialogs use differing treatments without a consistent meaning.

Keep the calm editorial reader but bring tool screens into the same visual system:
shared text roles, spacing rhythm, surfaces, links and semantic status styles.
Use the accent for meaningful action/selection rather than decoration. Avoid a
fantasy skin, ornamental imagery or a wholesale font change without task evidence.
Owner: UI tokens; generated document styling remains engine-owned.

### UX-17 · Pending, disabled and recovery presentation is inconsistent — P2

**Observed / Code.** Global disabled buttons use a wait cursor even when disabled
because a required name is empty; module buttons use a default cursor. Session
loading and saving share one message, and session failure panels use the ordinary
accent treatment while material/game failures use error tokens.

Distinguish idle-disabled, working, saved, attention, conflict and failed states
through text and consistent visual roles. Explain actionable blocked states close
to their controls. Preserve feature-owned retry/discard rules and appropriate live
regions. Owner: shared feedback presentation plus feature orchestration.

### UX-18 · Conflict recovery demands manual reconstruction — P1

**Code; failure not exercised live.** Material conflict copy asks the GM to copy
the draft and refresh the page. The visible actions offer copy, but no scoped
comparison/reload workflow. Session conflict copy also asks for a draft copy,
without a dedicated copy action in that form. Page refresh is disruptive to other
mounted work; the retained in-memory draft is an essential existing safeguard.

Provide an explicit recoverable draft view/copy action, a scoped way to inspect
the saved version and deliberate adoption/reapplication. Keep the base revision
and never turn retry into overwrite. Define rich-document recovery separately
from plain session-field recovery; no speculative automatic merge.
Owner: engine material/session recovery.

### UX-19 · Map targets shrink with the image; panning lacks a keyboard path — P1

**Observed / Measured / Code.** At 50% of fitted scale, Y1–Y3 button bounds measured
roughly 12 × 12 px. Marker codes remain the only always-visible identification;
full names depend on pointer title or accessible label. Pan uses pointer handlers
only; the map viewport has no keyboard pan interaction. Plus/minus and Fit are
keyboard-operable, and marker labels correctly identify destinations.

Keep marker hit areas/text independent of image zoom and provide a named location
list or equivalent visible selection surface. Add keyboard panning or an equally
effective route to offscreen markers. Preserve image-relative coordinates, saved
pan/zoom and correct destination opening. Test dense clusters before enlarging
targets. Owner: engine maps; align the later map-authoring design with this viewer.

### UX-20 · Folder destination and ordering lists need explicit search — P1

**User-reported / Code.** The folder move dialog exposes native parent and sibling
position selects without search. Native type-ahead does not provide visible
filtering, path search or a usable result list for a large hierarchy. The same
problem occurs in session pinning (UX-09) and note destination selection.

Provide an explicit filtered choice surface for large material/folder lists.
Show full paths, current selection, root/end choices and no-results feedback.
Keep invalid destinations excluded and preserve the current parent/position while
filtering. Use one neutral interaction pattern with engine-owned material/folder
adapters. Small enumerations such as lifecycle/status do not need searchable UI.
Owner: engine folders/materials/sessions and the neutral UI primitive.

### UX-21 · Sessions cannot be removed — P1

**User-reported / Code.** The GM tested sessions and found no deletion action.
The frontend operation contract contains create/update/start/complete/pin/unpin
only, and the session page has no delete control. Unwanted test or abandoned
records cannot be cleaned up through the product.

Add an explicit session deletion workflow with the session name, affected record
fields and document policy visible before confirmation. Proposed scope: remove the
meeting record and its pin associations, retain the ordinary preparation/play-note
materials and all pinned source materials. Ending/deleting a meeting must not reset
gameplay. Treat unsaved record drafts explicitly rather than silently losing them.
This is a newly requested capability, not a regression in the delivered session
contract. Owner: engine session use case, contracts and presentation.

### UX-22 · Notes cannot be reordered inside their folder — P1

**User-reported / Code.** Materials have persisted `SortOrder`, but navigation
provides no material drag/drop or equivalent ordering action. Material menus only
open, reveal and copy a link. Folder ordering does not solve the GM's need to
arrange notes for preparation or a running scene.

Add before/after ordering of materials within their current folder, with drag/drop
and a keyboard-accessible position action. Include unfiled materials. Preserve
document contents/revisions, stable IDs, links, open tabs and module sources.
Coordinate order changes atomically with an explicit revision/receipt boundary.
Moving notes between folders is separate scope; do not infer it from this request.
Owner: engine campaign organization and navigation.

### UX-23 · Global navigation cannot keep growing across the upper-right header — P1

**User-reported / Observed / Code / Heuristic.** Sessions, Party, Game with time,
Map and theme currently form one button row. The same destinations also occupy
the workspace tab strip after opening. More campaign capabilities would enlarge
the row and blur the distinction between navigation, context and preferences.
The current visual arrangement already feels crowded to the product owner.

Move primary destinations into a bounded navigation area with a clear active
state. Prototype a destination group within the existing sidebar versus a compact
collapsible rail, using the same reader width and task set. Keep the header for
campaign/current context and a small stable set of utilities. Do not add another
header button for each feature or simply hide core destinations in a generic menu.
Owner: engine workspace navigation; neutral presentation in UI.

### UX-24 · Actions lack predictable placement and grouping — P1

**User-reported / Observed / Code / Heuristic.** Refresh is at page headings,
creation at the top of sessions, lifecycle and document controls below the record
heading, editing/save near the bottom, and tool operations inside multiple cards.
Some local actions are appropriately contextual, but their hierarchy and alignment
do not explain where to look first. Adding icons alone would leave this problem.

Define three intentional zones: global navigation/utilities, view-level commands,
and actions belonging to one record/section. Use consistent alignment and spacing;
keep save/recovery with the draft and consequential actions with their target.
Use an overflow menu for genuinely secondary actions, with visible frequent actions.
Owner: workspace/page compositions and module presentations, using shared styles.

## What should be retained

- Read mode by default, explicit edit entry, supported rich document rendering,
  legible prose and visually distinct read-aloud passages.
- Clear material selection, ancestor reveal, keyboard tabs and visible focus;
  correct map-to-material navigation and mounted reading/map state.
- Stable IDs, localized labels, separate ordinary session documents and explicit
  game operations. Session transitions do not reset the clock or campaign state.
- Native modal focus and return focus: cancelling New note returned focus to its
  opener in the live walkthrough. Existing menu keyboard alternatives should stay.
- Confirmed-save boundaries, retained drafts, revision conflicts, receipts and
  atomic undo. Visual simplification must not weaken these behaviors.

These strengths are constraints for redesign, not reasons to retain weak layouts.

## Selected visual evidence

Screenshots are evidence of the current UI, not designs or newly accepted baselines.
They were captured at Full HD except the explicitly named smaller desktop view.
Unselected walkthrough images remain in the ignored `.local/ux-ui-audit` directory.

| Evidence | Origin | Findings illustrated |
| --- | --- | --- |
| [Reader, dark](assets/ux-ui-audit/reader-dark.jpg) | Live, 5 October | UX-01, UX-02, UX-16; strong prose/read-aloud treatment |
| [Editor after scrolling, light](assets/ux-ui-audit/editor-scrolled-light.jpg) | Live, 5 October | UX-04; commands and save state above viewport |
| [Game overview, dark](assets/ux-ui-audit/game-dark.jpg) | Live, 5 October | UX-11–15; competing forms and action weights |
| [Game overview, smaller desktop, light](assets/ux-ui-audit/game-scaled-light.jpg) | Live, 5 October, 1536 × 864 | UX-12, UX-15; wrapping and density |
| [Completed session details, light](assets/ux-ui-audit/session-completed-light.png) | Existing isolated session delivery fixture | UX-09–10; always-visible creation/pinning and lower save area |

## Accessibility references and interpretation

Use these W3C explanations to guide the scoped corrections; this audit does not
claim whole-application WCAG conformance.

- Meaningful component/state cues need adequate adjacent-color contrast; borders
  are not mandatory when another sufficient indicator identifies the control.
  See [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- Accessible names should include visible control labels. The theme mismatch
  deserves correction independently of a larger design change.
  See [Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html).
- Small pointer targets require considering size, spacing and exceptions; a small
  measured marker does not alone establish failure of the complete criterion.
  See [Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## Scope boundaries

Missing map authoring, multiple campaigns, chronicle, link previews and custom
tools are product backlog, not defects in an accepted feature merely because the
broader vision mentions them. This audit does not add accounts, cloud deployment,
backups, campaign export/import, offline acceptance or a mobile redesign.

Proceed with the [ordered corrective slices](28-UX-UI-improvement-plan.md).
Implementation and participant validation are still pending.

## Corrective implementation follow-up — 5 October 2026

The first A/H/I/J/B cycle is implemented; see the [current delivery plan](28-UX-UI-improvement-plan.md).
The observations above remain the original audit evidence. Persistent search and
document commands, bounded primary destinations, control contrast/utility labels,
searchable choices, session deletion and material ordering have delivery records.
Gameplay/session hierarchy, explicit conflict recovery, advanced tree/tab retrieval
and map interactions remain subsequent work. Partial visual foundation delivery
does not claim that all typography or module-tool hierarchy findings are closed.
