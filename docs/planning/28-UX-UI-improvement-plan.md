# UX/UI improvement implementation plan

6 October 2026 · corrective cycle A–J implemented locally

This plan follows the [independent UX/UI audit](27-UX-UI-audit.md). Its purpose is
to make daily preparation and session play easier before adding more screens.
The A/H/I/J/B cycle and remaining C–G corrections authorized on 6 October are implemented.
Delivery records include [C recovery](35-Draft-recovery.md),
[D gameplay](36-Gameplay-hierarchy.md), [E sessions](38-Session-workflow.md),
[F navigation](39-Navigation-at-scale.md), [F retrieval](40-Document-retrieval.md)
and [G maps](41-Map-interaction.md). Earlier delivery records are
[controls](29-Control-foundation.md), [choices](31-Searchable-choices.md),
[deletion](30-Session-deletion.md), [ordering](32-Material-ordering.md), and
[navigation/reader commands](33-Workspace-navigation.md).
The [subsequent user-reported corrections](34-UX-follow-up-corrections.md) cover
pending-action navigation, simpler document menus, date-based session names and
cross-folder document movement.
It records delivery order and concrete acceptance criteria; estimates are relative
engineering effort, not dates or observed user-performance results.

Related: [near-term roadmap](15-Near-term-improvements.md),
[shared UI plan](17-Reusable-frontend-ui.md),
[module architecture](06-Module-architecture.md),
[session contract](26-Campaign-sessions.md), and
[browser verification](13-UI-tests.md).

## Product and design direction

Use a calm editorial workspace with clear operational controls. Preserve the
reader's emphasis on prose and read-aloud content. Give navigation, forms and
module tools a coherent hierarchy instead of making each new feature another
large vertical form. The redesign should help the GM answer three questions:
where am I, what needs attention, and what will this action change?

The following decisions guide implementation:

- Keep campaign search reachable, document controls available while scrolling,
  and session/game context compact. Tools must not permanently narrow the reader.
- Distinguish navigation from mutations and primary actions from secondary/quiet
  actions. Consequential actions show the affected target and immediate effect.
- Use familiar icons for compact utilities such as Refresh, with accessible names
  and hover/focus help. Keep descriptive text for domain actions. Group commands
  consistently at global, view and record/section levels.
- Replace the growing upper-right destination row with bounded primary navigation.
  Compare a group within the current sidebar and a collapsible rail; keep the
  header limited to campaign/current context and a stable utility area.
- Use a deliberate type scale: page title, section heading, normal interface text,
  numeric/status value and secondary help. Keep small text for supplemental
  information rather than essential actions or current state.
- Use consistent spacing, surfaces, focus and semantic status treatments. Give
  editable controls their own border token; decorative dividers can stay subtle.
- Use progressive disclosure for rules and rarely used forms while keeping current
  values, overdue matters and recoverable work discoverable.
- Keep the existing theme character initially. Do not add ornamental fantasy
  imagery, animations, a new font dependency or a third-party design framework.

Each slice starts with a reviewable layout/state sketch using real representative
content. For layout-heavy work, compare at least two arrangements against the
same tasks before selecting one. This is a short design step inside the feature,
not a new documentation framework or a requirement for a whole-app prototype.

## Ordered delivery

Implement one focused branch from `trunk` per delivered feature. Work within each
slice can be split into additional branches where it creates independently useful
behavior. The user authorized parallel implementation of the first corrective
cycle on 5 October and the remaining C–G corrections on 6 October.

| Order | Slice | Audit coverage | Relative effort | Main dependency |
| --- | --- | --- | --- | --- |
| 1 | A · Visual and accessibility foundation | UX-14–17; theme part of UX-05 | M | Current UI library/catalog |
| 2 | H · Searchable material/folder choices | UX-09 picker, UX-20 | M | A; current hierarchy validation |
| 3 | I · Session deletion | UX-21 | M | Current session transaction/receipts |
| 4 | J · Note ordering within folders | UX-22 | M–L | Explicit organization revision contract |
| 5 | B · Bounded navigation, persistent search and reader commands | UX-01, UX-04, UX-23–24; editor part of UX-05 | M–L | A's control/feedback roles |
| 6 | C · Explicit draft recovery | UX-18 | M–L | B's visible recovery area |
| 7 | D · Gameplay intent and information hierarchy | UX-11–13, UX-24 | L | A; existing atomic operations |
| 8 | E · Session workflow and active context | UX-08–10, UX-24 | M–L | A/B/H; current session ownership |
| 9 | F · Navigation and retrieval at scale | UX-02–03, UX-06–07 | M–L | B/H |
| 10 | G · Map interaction corrections | UX-19 | M | A; viewer design before authoring |

Orders 1–5 form the first improvement cycle, including the user's confirmed
dropdown, deletion, ordering and navigation pain points. C–E follow with recovery
and session/gameplay restructuring. F contains useful P2 enhancements
and can be delivered as separate tree/tab and document-retrieval features. G is
the P1 prerequisite immediately before map authoring; bring it forward if maps
are the GM's primary session surface. Reassess after the first cycle rather than
starting all features concurrently.

Map authoring follows these corrections, then multiple campaigns. Chronicle,
custom tools and broader authoring remain separate product scope. The earlier
roadmap's “map authoring next” recommendation is superseded by this corrective
sequence; its delivered features and history remain unchanged.

## A · Visual and accessibility foundation

**Outcome:** inputs, actions, links and state messages belong to one recognizable
visual system in both themes.

- Establish neutral control-border, surface, text-role, spacing and action/status
  tokens in the UI foundation. Keep generated document layout in the engine.
- Add primary, secondary, quiet and consequential native-control treatments.
  Apply them first to actual reader, creation and session consumers; adapt the
  game/module compositions in D. Do not wrap every HTML element in a component.
- Use one neutral icon treatment for utilities, beginning with refresh in the
  existing page command areas. Keep explicit accessible names, hover/focus help,
  usable hit areas and a clear pending state. Do not turn all actions into glyphs.
- Replace the misleading wait cursor for idle-disabled controls. Use localized
  working/saved/error/conflict labels where state changes require feedback.
- Give the theme action matching visible/accessibility labels and intentional
  state semantics. Use theme link styling for module rules links.
- Extract neutral feedback presentation and the dialog shell only with their
  demonstrated consumers. Retry, close/discard policy and request orchestration
  remain feature-owned. Dialog extraction may be a follow-up feature if it would
  delay the small visual/accessibility corrections.

**Acceptance:** blank editable fields can be identified before focus; required
boundary cues meet 3:1 against actual adjacent surfaces; focus remains clear.
Each chosen primary action is immediately distinguishable from cancel/refresh.
Status is expressed in text, not color alone. Both themes and long labels work.
Disabled controls do not imply a running operation unless one is actually pending.

**Verification:** focused component/catalog examples and the affected browser
screens, including light/dark focus, disabled, pending and error states. Measure
selected control contrast. Public UI/style ownership changes require boundary
checks and a frontend integration build; ordinary consumer-only corrections use
the affected checks. Document actual exports and usage in the catalog.

## H · Searchable material/folder choices

**Outcome:** large dropdown lists provide deliberate filtering and identifiable
destinations, including the two difficult flows directly reported by the GM.

- Apply a visible query/filter interaction to session pins, move-folder parent
  and sibling position, note creation destination, and material-link insertion.
  Retain the already useful filtering in link insertion rather than replacing it
  with an unfiltered list. Leave short enumerations as ordinary selects.
- Match names and hierarchical paths; display path context to distinguish equal
  titles. Filtering changes the visible candidates, not the confirmed selection.
- Keep root, unfiled and end-of-list choices explicit, and exclude invalid
  descendants/self destinations according to the existing folder rules.
- Supply a neutral typed option/query/selection interaction in UI for the real
  material and folder consumers. Engine adapters own IDs, paths, candidate validity,
  pending policy and operations. Never put campaign fetching in the UI primitive.

**Acceptance:** a fixture with at least 200 materials and 100 folders allows the
GM to find and select by a partial name or ancestor path. Duplicate titles are
distinguishable. Clearing or changing a query preserves the current selection;
no-results is explicit. Keyboard selection, Escape, focus return, pending/error
and long-path rendering work in both themes. Invalid folder moves remain rejected
at the backend; UI filtering is not validation evidence.

**Verification:** focused primitive/adapter cases and browser pin/move/create/link
scenarios. Reuse unchanged folder/session persistence checks. New UI exports need
catalog usage, dependency checks and a frontend integration build.

## I · Session deletion

**Outcome:** unwanted or test sessions can be removed through an explicit product
action, with clear consequences and consistent collection state.

- Add a named Delete session action in the record's secondary actions. Confirm
  the target and explain that summary/follow-up and pin associations are removed,
  while preparation/play-note documents and pinned source materials are retained.
  Ordinary document deletion is not part of this feature.
- Support planned, active and completed records. Deleting an active record clears
  active-meeting context; it never advances time, resets party/module state, or
  closes/deletes an already open ordinary document.
- Resolve unsaved record fields explicitly before deletion; do not silently
  discard them. Keep the draft if deletion fails or conflicts. Select a predictable
  remaining record/list state and handle deleted record URLs with localized recovery.
- Extend the explicit session operation contract and server-owned transaction.
  Expected collection revision, campaign ownership, request receipt and deletion
  commit together. Retry confirms the same deletion without recreating records.

**Acceptance:** cancellation changes nothing. Successful deletion removes only the
  identified record/associations and survives reload. Ordinary documents remain
  readable with the same IDs, contents and revisions. Concurrent change returns a
  conflict; failed/uncertain requests retain actionable recovery. Another active
  meeting can start after confirmed active-record deletion.

**Verification:** focused real HTTP/PostgreSQL deletion, conflict, ownership and
lost-response cases, plus session draft/navigation browser cases. Review the EF
model and add a new migration only if the final schema requires it; do not edit
applied migrations. No runtime campaign deletion is used as a test fixture.

## J · Note ordering within folders

**Outcome:** the GM can arrange ordinary notes in a chosen sequence inside their
current folder, including the unfiled group.

- Add before/after material drag targets and a keyboard-accessible Change position
  action with a searchable sibling picker. Preserve stable IDs and large folder
  drop zones; dragging a material must not invoke folder nesting semantics.
- Reorder only within the current folder in this slice. Show the intended drop
  position, reject cross-folder drops visibly, and retain confirmed order on failure.
- Define an organization snapshot/revision that includes material order. Prefer
  coherently extending campaign hierarchy revision/snapshot ownership rather than
  reusing document content revisions. Folder refresh/retry must then carry the
  corresponding order and prevent stale snapshots from rolling it back.
- The use case owns campaign locking, expected revision, bounded sibling updates
  and operation receipts in one transaction. Material saves and gameplay undo stay
  independent; only organization metadata changes.

**Acceptance:** before/after/first/last moves persist across reload; drag and
keyboard produce the same order. No-op moves are safe. Conflicts and uncertain
responses preserve a recoverable request and confirmed ordering. Rich documents,
save revisions, tabs, links and map targets remain intact. Filtering search results
does not silently become the editable persisted note sequence.

**Verification:** focused order/drag/keyboard unit and browser cases, and isolated
HTTP/PostgreSQL transaction, revision, receipt and same-folder validation cases.
Build affected contracts and consumers; document the organization boundary in
`06-Module-architecture.md`. Local update requires no backup/preservation probes.

## B · Bounded navigation, persistent search and reader commands

**Outcome:** a GM can start the next lookup or change a long document without
scrolling to recover the controls.

- Separate stationary search/actions from the independently scrolling folder tree
  or search results. Keep input focus stable during asynchronous results and saves.
- Move Sessions, Party, Game and Maps into bounded primary navigation with a clear
  active destination. Compare sidebar grouping versus a collapsible rail before
  implementation; retain a way to focus/reopen it without a pointer. Reserve the
  top header for identity/context and compact utilities. Keep opened-document tabs
  and their persistent ownership separate from destination selection.
- Establish consistent view command placement. Keep page-level utilities together,
  and place actions belonging to a particular draft/record beside that context.
  Preserve direct links and current-route/Back behavior while changing appearance.
- Introduce a compact material command area outside the document's scrollable
  prose. Include read/edit mode, confirmed save status and applicable recovery.
  Formatting is visible only while editing, with active/available command states.
- Correct read-only document semantics. Preserve ordinary document links, tables,
  expandable context and explicit entry into editing.
- Account for the command area when revealing headings, anchors and active rows.
  Its height must not obscure a target or consume excessive reader space.

**Acceptance:** search remains on screen after opening a deep tree item or distant
search result. Edit/finish and persistence state remain on screen at a document's
end. Toolbar commands expose their current state. Switching tabs preserves draft,
selection and scroll; scrolling or collapsing UI causes no document write. Closing
or finishing editing still waits for confirmed persistence.
Core destinations remain visible/discoverable without a growing header row; adding
a representative future destination does not require another top-right button.
The chosen composition retains useful reader width and predictable command groups.

**Verification:** focused navigation/search and reader/editor browser scenarios,
including scroll/anchor reveal, keyboard navigation, pending save and conflict.
Run affected autosave cases only where the editor lifecycle changes. Review Full HD
and smaller desktop composition in both themes. Reuse existing map/session
persistence evidence unless this change actually affects those owners.

## C · Explicit draft recovery

**Outcome:** a conflict provides a clear path forward without asking the GM to
reload the entire workspace and reconstruct work manually.

- Define explicit retained-draft, saved-version, pending and adopted states.
- Supply a reliable copy action and a scoped saved-version inspection for rich
  materials and session fields. Distinguish what has been confirmed from a draft.
- Allow deliberate adoption/discard or reapplication against the inspected current
  revision. Do not offer silent overwrite or speculative automatic rich-text merge.
- Keep other mounted documents/session drafts intact throughout recovery. Do not
  introduce persistent browser draft storage as an incidental requirement.

**Acceptance:** a 409 preserves the complete draft and its recovery controls;
copy failure is actionable; inspecting the saved version does not destroy the
draft or other open work. Adoption is deliberate. A remote change occurring after
inspection causes another conflict rather than overwrite. Uncertain writes retry
the same request according to their existing contract.

**Verification:** focused material/session unit and browser conflict cases, including
concurrent remote change and failed copy/read. Use isolated HTTP/PostgreSQL tests
only if a backend contract changes. Never exercise these mutations on the runtime
campaign for the audit or for convenient test setup.

## D · Gameplay intent and information hierarchy

**Outcome:** the GM can choose the intended activity and locate matters requiring
attention without reading every tool's instructions.

- Prototype a compact time/operation overview followed by an attention summary and
  task sections. Compare section navigation with collapsible sections using the
  same five-character, encounter and rival fixture. Keep alerts discoverable.
- Keep neutral time/rest controls in the engine. The module labels and explains
  exploration/search effects; ordinary advance, exploration and rest must visibly
  differ without changing their rules.
- Show current values before detailed explanations. Reveal input/review controls
  for the chosen action. Keep rules links and recurrence behavior reachable.
- Apply concise consequence review to arrival/transformation: target, entered
  time and affected values immediately precede submission. Label repeated buttons
  by target. Routine advances and results do not need blanket confirmation dialogs.
- Make last-operation undo understandable and reachable while reviewing tools.
  Preserve existing pending-action links and module-local attention interpretation.

**Acceptance:** the selected activity states its time/exploration effect without
requiring a distant paragraph. Overdue checks remain visible when other sections
are closed. Every important mutation identifies its target and consequence before
submission. Failed/pending operations retain inputs and prevent repeated writes.
The five-character/rival view scans clearly at both desktop sizes.

**Verification:** focused `@gameplay` scenarios for activity choice, attention,
section retention and consequence review in both themes. Reuse unchanged backend
rule/transaction evidence. If an operation or projection contract changes, add
targeted real rule/HTTP cases and build its consumers. Do not implement module IDs,
disease rules or arrival branches in the engine to simplify presentation.

## E · Session workflow and active context

**Outcome:** preparation, live notes and past-session review feel like stages of
one meeting workflow, with direct access during play.

- Show compact active-meeting context and Open play notes from other workspace
  views. Load/resolve meeting context consistently for direct material visits.
- Design first-use, planned, active and completed layouts. After first use, create
  through an explicit action rather than a permanent page-wide form. Highlight the
  useful document/action for the current stage; keep other materials accessible.
- Make summary/follow-up explicit saving unmistakable and keep save/discard close
  to the edited fields. Do not silently convert them to rich-material autosave.
- Introduce a filtered campaign-material picker with folder context. Use stable
  IDs and distinguish equal titles. Share campaign-aware picker responsibility
  with link insertion when their interaction actually matches.
- Add record-level session addresses and integrate selection into history/reload.
  The session list remains a useful destination; obsolete compatibility aliases
  are not needed. Preserve independently owned per-record drafts.

**Acceptance:** from a location or game tool, one visible action opens the active
play notes; returning restores the prior view. Planned sessions emphasize prep,
active ones live notes/pins, completed ones review. A many-material fixture with
duplicate titles has unambiguous filtering/selection. A session link, Back/Forward
and reload restore the addressed record. Ending a meeting changes no game time,
module state or materials and does not require a filled summary.

**Verification:** affected `@sessions` and routing cases across both themes/sizes;
direct-visit context, multiple session drafts, blocked close, explicit save and
picker keyboard/focus scenarios. If the backend contract is unchanged, reuse the
successful session transaction/idempotency evidence. Document new routes and
ownership alongside the current session contract.

## F · Navigation and retrieval at scale

**Outcome:** large trees, many tabs and long documents remain easy to orient within.
Deliver the following as separate features if needed.

**Tree/tab feature:** bounded sidebar resizing and collapse with keyboard
equivalents; visible active context when closed; open-tab overview and overflow
cues with dirty/closing state. Keep stable folder IDs, nested ownership and existing
large drag/drop target behavior. Do not reorganize campaign content as a UI fix.

**Retrieval feature:** concise search path, count/limit, highlighted terms and a
persistent clear action; on-demand document outline and temporary match navigation.
Use supported document data rather than arbitrary HTML injection. Highlighting
and outline interaction must not modify the stored document. A prose-width variant
needs review with long paragraphs and full-width tables before changing defaults.

**Acceptance:** keyboard users can reopen navigation, choose any open tab and reach
outline/match targets. Duplicate titles have distinguishable context. Returning
from a match preserves the GM's ability to continue reading/editing. Large tables
retain useful width. Drag targets remain predictable and autosave does not scroll
or focus navigation.

**Verification:** affected tree/tab/search/reader cases and real rich-document
fixtures. Add neutral primitive tests only for actual shared interaction. Changes
to search output must build/check affected contracts and consumers; presentation
from existing campaign metadata needs no speculative backend redesign.

## G · Map interaction corrections before authoring

**Outcome:** zoomed maps remain navigable by pointer and keyboard, with stable
readable targets and clear location context.

- Decouple marker label/hit-area scale from image zoom. Start with a 32 px minimum
  hit-area design target, then review overlaps in real dense clusters; this target
  is a product choice, not a blanket WCAG conformance claim.
- Offer a searchable/named location list or equivalent visible selection surface.
  Full destination names must not depend solely on mouse hover.
- Add keyboard panning or an equally effective path to offscreen markers. Retain
  plus/minus, Fit, focus visibility and stable map-to-material navigation.
- Design viewer versus marker-authoring modes together before adding creation,
  move, relink and deletion controls. Mode changes must be explicit and must not
  make ordinary browsing alter marker positions.

**Acceptance:** markers remain usable at 50%, fitted scale and maximum zoom;
dense clusters do not conceal destinations. Every destination can be selected
without a pointer. Tab return retains pan/zoom. The named list and image targets
resolve to the same material IDs. No campaign write occurs while panning or opening.

**Verification:** focused map/reader browser cases in both themes/sizes, including
cluster geometry, pointer/keyboard access and retained state. This viewer correction
does not need database tests or migrations. The subsequent authoring feature will
need its own persistence/concurrency plan and isolated checks.

## Review tasks and success measures

Use the same representative content before and after each relevant slice. Record
observed completion, extra navigation, hesitation and mistaken activity choice.
Elapsed task time is useful only when collected under comparable conditions; the
audit supplies no participant baseline. Proposed acceptance targets are:

| Task | Target after correction | Relevant slices |
| --- | --- | --- |
| Open a deeply nested location, then search for a rule | Search needs no navigation-pane scroll | B |
| Edit the end of a long note and inspect its save state | Commands and state stay visible without returning to the top | B/C |
| Distinguish advance-only from exploration | Effect is evident at the chosen control; no corrective explanation from reviewer | D |
| Find a due check while rival details are collapsed | Attention remains visible and reaches the relevant action | D |
| From a location, begin active-session notes | One visible opening action; editing remains an explicit choice | E |
| Pin one of two identically named materials | Path context identifies the intended target | E/F |
| Move a folder in a large hierarchy | Filter by name/path; selected parent and root/end remain clear | H |
| Remove an unwanted session | Named confirmation and retained ordinary documents; clean record/context state | I |
| Put a note first or before another note | Drag and keyboard persist the same within-folder order | J |
| Find a page command or switch a core destination | Predictable action zones; no scanning a growing top-right row | A/B |
| Return to one of at least twelve open tabs | Overview reveals target and draft state without title guessing | F |
| Reach a location on an odd zoom/pan | Pointer and keyboard have usable routes | G |
| Resolve a conflict with another draft open | Both drafts remain intact; adoption does not overwrite a newer revision | C |

A short walkthrough with the product owner/GM validates the heuristic findings.
If an arrangement worsens reading, hides attention or introduces unnecessary clicks,
revise it before accepting its screenshots. Do not claim task-speed improvement
solely because a visual baseline passes.

## Delivery and documentation rules

- Follow the repository workflow: focused `codex/` branch from `trunk`, scoped
  review/checks, commit, runtime build/update from the feature branch,
  then readiness and affected behavior. No remote push or external deployment is
  included. Documentation-only planning needs no application rebuild.
- Maintain localization keys/placeholders and accessible recovery labels together.
  Update `06-Module-architecture.md` only for meaningful ownership/contracts,
  feature plans for route/behavior changes, and `07-Implementation-status.md` with
  actual delivery evidence. Keep README free of current implementation status.
- Review intentional screenshot changes; do not regenerate unrelated baselines.
  Add catalog examples for actual exported UI elements. Select the relevant browser
  file/tag instead of routinely running all suites.
- Preserve ordinary save correctness, revisions, transactions, receipt retries,
  source content and mounted state. No local backup infrastructure or preservation
  probes are added by this UX plan; AWS production protections stay separate.

## Next implementation boundary

The user-requested [compact navigation and reader-tool refinement](43-Compact-navigation-and-reader-tools.md)
shortens contextual actions and separates outline from document find. Feature
branches remain available for user-controlled merging and remote pushing.

The corrective cycle A–J is implemented locally with scoped delivery records.
On 7 October, the user requested a [new session composition](44-Session-workspace-redesign.md)
and [character profiles](45-Character-profiles.md) as future work. The
[recommended development order](15-Near-term-improvements.md#recommended-development-order)
now puts editable document titles, material deletion, session redesign and profiles
before map authoring and multiple campaigns. This is a planning recommendation, not a new
delivery or implementation authorization. Keep actual verification separate from
the original planned acceptance criteria.
