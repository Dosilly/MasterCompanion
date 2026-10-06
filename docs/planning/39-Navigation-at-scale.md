# Navigation at scale

6 October 2026 · slice F, tree/tab feature

The selected layout keeps a bounded resizable sidebar (228–420 px), an explicit
header toggle and a persistent tab overview. A second docked navigation strip
would consume reading width; a permanent second tab row would consume height.
The overview instead opens on demand with scrollable entries and folder paths.
Collapsed navigation retains a compact current destination/path.

The focusable separator supports Left/Right and Home/End in addition to pointer
capture. Sidebar state does not change campaign organization or trigger saves.
NavigationLayout owns resizing; OpenTabs owns overview disclosure/focus, while
Workspace retains tab activation and confirmed-close policy. The horizontal strip
keeps its roving keyboard behavior and a visible overflow edge; the overview shows
dirty and saving-before-close states. Escape closes it and returns focus.

Twenty navigation browser cases pass across both themes/sizes. Four overview cases
also verify pending close, confirmed removal and Escape after the final change.
Full HD collapsed layouts were reviewed in both themes. Frontend quality and
isolated production compilation pass. Common-header visual references are updated
only for the deliberate toggle/overview layout change.
