# Searchable material and folder choices

Implemented on 5 October 2026 as slice H of the [UX improvement plan](28-UX-UI-improvement-plan.md), addressing the large-list usability findings in [the audit](27-UX-UI-audit.md).

## Behavior and ownership

Session pinning, folder move parent/position, note creation destination and material link insertion now share a searchable choice interaction. Enter a title, path, or both; each whitespace-separated term must match the option's title/path presentation. Filtering does not change the selected ID. Clearing the query restores all available options in their original order. No results is explicit. Root, unfiled and end choices remain ordinary searchable options with an empty ID understood by the engine owner.

The engine supplies current folder paths from stable IDs rather than relying on cached display groups. Equal titles show their path; equal titles in the same path additionally show their stable identities. Folder move keeps descendant/cycle exclusion in its existing engine rules and backend validation. Choosing an option never submits or saves a document. Existing feature owners keep validation, pending state, requests, errors and recovery.

`@mastercompanion/ui` owns the neutral `SearchableChoiceComponent`, its option presentation and query filtering. It imports no campaign contracts, persistence, routes or engine implementation. The engine's `features/choices/campaign-choices.ts` owns folder/material adaptation. Existing dependency guards already permit engine-to-UI public imports and forbid UI-to-engine/contracts dependencies; no boundary exception or new package is needed.

## Public component API

| Input/output | Contract |
| --- | --- |
| `options` | Required readonly `ChoiceOption[]`; each option has a unique `id`, `label` and optional `detail`. The empty ID is allowed. |
| `value` | Selected stable ID, default empty string; filtering never modifies it. |
| `controlId` | Required unique DOM identifier for each mounted instance. |
| `label` | Required visible label and trigger accessible name. |
| `searchLabel`, `noResultsLabel`, `loadingLabel` | Required presentation strings owned/localized by the consumer. |
| `disabled`, `loading` | Disable choosing and opening; loading additionally exposes a status message. |
| `selectionChanged` | Emits the chosen ID once. The owner decides whether to accept/store it. |
| `focus()` | Focuses the trigger, including when the owning dialog opens. |

The trigger opens a bounded inline panel, so choices are not clipped by a native modal dialog's scroll boundary. The query field is a combobox controlling a listbox; active-descendant navigation keeps focus in the query while arrows move through results. Enter selects without submitting the enclosing form. Escape closes only the choice and returns focus to its trigger. Outside pointer/focus navigation closes without stealing focus. Angular owns listener/effect cleanup.

## Actual usage and catalog

The session pin form demonstrates campaign material adaptation and retained selected IDs. The folder management dialog demonstrates filtered parent choices plus explicit root/end options. Note creation demonstrates a pending owner disabling destination changes. Material insertion demonstrates selection in a modal while preserving the rich editor's insertion range.

Run `pnpm --dir src/mastercompanion-web catalog` from the repository root. The existing neutral developer catalog now includes searchable choices, duplicate labels, long paths, no choices, loading, disabled selection, keyboard focus and an owner-provided error/recovery explanation. Toggle light/dark in the catalog; it is not a production workspace destination.

## Scoped verification

- Four unit cases exercise real filtering/adaptation with 200 material summaries and 100 folders, nested paths, duplicate identities, unfiled choices and empty/no-match queries.
- Browser cases exercise actual Angular consumers: title/path search, selected ID retention while filtering, clearing, keyboard Enter/Escape and focus, root/end/position selection, pending creation and rich-editor insertion. Fixtures supply complete documents to the actual preload path; these are browser interaction tests, not backend persistence evidence.
- Both Full HD and smaller desktop layouts run in light/dark. Reviewed material-choice screenshots show distinct paths and retained selection; the pin action keeps its normal height when the list opens.
- The full frontend integration build, code/localization guard, dependency guard, formatter, lint, typed fixtures and catalog compilation verify the new public UI export and its consumers. Existing unchanged backend validation, transactions, session receipts and save behavior remain the applicable evidence for persistence.

No backend contract, migration, campaign content or game operation changes in this slice. Session deletion, note ordering, navigation composition and other audit slices are tracked separately. Searchable choices filter currently loaded presentation metadata; they do not introduce remote search, virtualization or a persisted browser draft store.
