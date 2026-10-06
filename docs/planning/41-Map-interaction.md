# Map interaction before authoring

6 October 2026 · slice G

The selected viewer keeps the image wide and adds a compact searchable location
choice above it. A permanent side list would reduce image width; a long list below
would consume height. The existing neutral SearchableChoice provides full names,
filtering and keyboard selection. Selection centers the location and shows a named
Open action; clicking an image marker still opens the same stable material ID.
Empty maps show a localized explanation and disable location selection.

Marker labels and minimum 32 px targets counter-scale independently of the image
at 50%, fitted scale and 400%. At minimum zoom some real Ythryn markers overlap
(including Y15/Y16 and Y11/Y12); the named choice makes each independently reachable,
and the selected target takes visual precedence. No general accessibility
conformance claim is implied by this product target.

The focusable viewport supports arrows, +/− and Home while native zoom/Fit controls
remain. Pointer capture ends safely on cancellation/loss. Mounted views retain
pan, zoom and location choice across material navigation. None of these operations
submits campaign writes. Actual source-map geometry/art is used in isolated browser
checks; destination IDs are mapped to disposable fixture documents.

Viewer and future authoring share the map surface but have different ownership:
viewer gestures only change presentation. Authoring must be entered explicitly,
show unsaved position/link changes and use a separate revisioned persistence
contract with stable marker identities. Creation, movement, relinking and deletion
remain the next feature, requiring its own concurrency and persistence plan.

Twenty focused map/routing/search cases pass across both themes/sizes after a test
zoom synchronization correction; the final map/control cases are verified again.
Full HD fitted/minimum layouts were reviewed in both themes, with maximum/scaled
geometry and named cluster access checked automatically. Frontend quality and
production compilation pass.
