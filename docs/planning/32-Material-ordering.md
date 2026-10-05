# Material ordering within a folder

5 October 2026 · corrective cycle J

Notes and module materials can be ordered before/after a sibling by drag/drop or
through the keyboard context menu and position dialog. First/last positions are
explicit. The sibling picker searches titles and folder paths using the neutral
shared control. Unfiled materials have the same ordering behavior. Cross-folder
material moves remain outside this feature.

The existing folder operation boundary now owns a coherent organization snapshot:
folders, ordered material identities and folder membership. `FoldersRevision` is
the stored organization revision. Folder mutations, reorder operations and material
creation share the campaign lock. Session creation advances this revision when it
adds preparation/play documents. Content-save revisions stay independent. No
schema migration or compatibility adapter is introduced.

An operation supplies stable material/folder identity and an optional following
sibling. Validation rejects self, foreign/missing sibling and changed folder
membership. Order, organization revision and exact request receipt commit together.
Stale requests fail visibly; uncertain requests retain their original identity for
retry. Refresh applies newer organization snapshots without replacing mounted
editors or reverting confirmed order to the document-cache load order.

Scoped evidence: 54 isolated HTTP/PostgreSQL folder/ordering cases, including 14
new ordering cases; 10 ordering unit cases and 40 affected folder/cache cases;
frontend quality/type checks and Full HD ordering browser scenarios in both themes.
Material-creation regression verification covers the changed campaign lock and
global identity-conflict response. Final combined consumer compilation and browser
checks are recorded in the workspace delivery and implementation status.

Integration also refreshes organization after confirmed session creation and exact
creation replay, preventing a guaranteed stale ordering request in the same window.
The browser fixture advances the revision once for the two-document atomic creation;
a focused composed scenario verifies the next ordering request uses that revision.
