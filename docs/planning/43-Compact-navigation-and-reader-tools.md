# Compact navigation and reader tools

6 October 2026 · user-requested refinement

The user requested compact controls integrated with their owning surfaces, shorter
labels and a clear distinction between the document outline and document search.
The feature branch starts from current trunk and carries the previously delivered
F/G and gameplay-polish commits so the local runtime retains its existing features.
The user's module-editor planning and feature-branch delivery policy remain intact.

## Selected composition

A header toggle separates the action from the sidebar. An edge control in the
sidebar keeps the relationship visible and leaves a 48 px rail when collapsed;
the same button remains mounted and keyboard focused. The expanded tree keeps
its bounded resizing, draft state and scrolling. The library heading groups New
note and Refresh as quiet icon actions. Edit and Done retain text and the existing
explicit edit/save-before-finish behavior; the creation dialog uses Create.

A combined outline/find disclosure makes two different tasks compete in the same
panel. Independent Outline and Find buttons instead reveal their own panel, one
at a time. The outline contains headings only; Find contains its query, count,
previous/next arrows and clear icon. Switching panels retains the query and
temporary decorations. Return to reading remains a separately named icon action.
The selected layout avoids permanently narrowing the reader and does not introduce
automatic editing, campaign writes or persisted presentation settings.

Routine utilities use the neutral UI icon library. Native buttons retain localized
names, titles, keyboard focus and appropriate expanded/disabled state. Both locale
catalogs have matching keys. Repository instructions now require concise contextual
labels, controls grouped with their surface and separately recognizable tools.

## Ownership and verification

Navigation layout and tool visibility remain engine presentation state. The shared
UI library supplies decorative SVGs; it knows no campaign or persistence types.
Its catalog includes the new icons in both enabled and disabled utility examples.
DocumentNavigation still owns temporary search decorations and return position;
material sessions retain all save, revision, draft and undo responsibilities.

Selected verification covers navigation resize/collapse and retained focus, tab
overview recovery, outline/find separation and query retention, literal search,
keyboard match navigation and note-creation focus. Existing document navigation
and editor-decoration checks cover the unchanged content/selection/undo contract.
The first Previous action now selects the last match before normal wrapping;
the selected search path uses the result's text color in both themes. The native
search cancel glyph is suppressed beside the explicit, named clear control.

Verified results:

- Twenty-four navigation/retrieval/root-note browser cases pass across both themes
  at 1920×1080 and 1536×864. After the final search corrections, all sixteen scoped
  retrieval/search cases pass again. Unchanged navigation/note results are reused.
- Twenty normal visual browser cases pass against the reviewed references.
  Twenty-four full-page reader, editor, insertion-dialog, search, folder-menu and
  gameplay references changed intentionally for the shared sidebar/reader commands.
  Module-tool crop references remain unchanged. Expanded and collapsed navigation,
  separate outline/find panels and the icon catalog were also reviewed visually.
- Five distinct selected projection/real-editor cases pass across scoped runs,
  including match wrapping and unchanged document, selection, undo and save state.
  The new wrapping fixture compares actual editor snapshots to account for schema
  default attributes introduced during initialization.
- Frontend quality, production library/host compilation and catalog compilation
  pass. The final browser runner compiles the current production sources; catalog
  rendering in both themes reports no page errors. The last test-only formatting
  correction passes its scoped formatter check.

Local runtime delivery follows the feature commit. No API, persistence schema,
module source, data-replacement or backend rule changes are part of this refinement.
