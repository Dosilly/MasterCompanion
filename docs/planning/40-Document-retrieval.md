# Document retrieval

6 October 2026 · slice F, retrieval feature

Campaign search now displays each result's folder path, an exact returned count,
the existing limit/refinement hint, literal highlighted terms and a persistent
clear action. Metadata supplies paths; the search/API contract is unchanged.
Equal titles remain distinguishable. Text is interpolated, never injected as HTML.

An on-demand outline/find disclosure was selected over a permanent right sidebar:
it preserves the reader's useful width and keeps controls close to the document.
The supported ProseMirror model supplies heading positions and phrase matches,
including nested details, formatted text and table cells. Temporary decorations
do not serialize, enter undo history, change selection or save the document.
Targets open enclosing details and scroll the existing reader; Return restores
the reading position captured before the first jump. Navigation state remains
with the mounted material. Real edits reindex the projection without scrolling.

Fourteen focused unit/real-editor integration cases pass, with the edited fixture
case checked again after removing an invalid test selection. Eight new browser
cases pass across themes/sizes. Existing reader/search/editor and saved-version
flows provide scoped regression and visual evidence. Quality and production
compilation pass. Full HD retrieval layouts are reviewed in both themes.
No prose-width variant is introduced; the current wide-table reader remains.
