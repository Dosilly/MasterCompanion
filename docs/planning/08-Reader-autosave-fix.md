# Reader interactions and autosave

1 October 2026

Tiptap StarterKit's default `TrailingNode` plugin appended a paragraph to documents ending in a non-paragraph block on their first transaction, including selection or focus in read mode. The resulting content update marked the material dirty and triggered autosave. The existing API updates the same material and increments its revision; it does not create a separate material copy.

The shared editor configuration now disables that implicit insertion. Material editor updates reach the save session only when the session is explicitly editing and the editor is editable. Selection, focus, details expansion, and entering or leaving editing without a content change must preserve the document and avoid save requests. Actual content edits and undo continue to use the existing revision-protected autosave. No persistence contract, migration, or campaign-content repair is needed; existing campaign documents remain authoritative.

Verification:

- The new editor integration tests reproduced the unwanted paragraph insertion before the fix. All 14 tests in `pnpm --dir src/mastercompanion-web test:autosave` passed after the fix, covering document endings, selection, details, mode changes, actual edits, undo, in-flight changes, save failures, conflicts, and closing.
- `pnpm --dir src/mastercompanion-web check:code` passed.
- The affected engine library compiled with `node node_modules/@angular/cli/bin/ng.js build engine` from `src/mastercompanion-web`.
- The targeted `Every migrated document survives` test in `tools/content.test.mjs` passed, checking shared-schema round trips for maintained documents.
- Browser checks at 1920×1080 in both themes confirmed saved status during reader selection. Clicking, selecting, expanding details, and switching edit modes produced zero writes. An actual edit and undo produced two sequential writes to an isolated in-memory API. Read-only comparison of the live material before and after confirmed identical content and revision. No console errors occurred; Angular's existing oversized-map-image performance warning remains.

The browser probe does not establish new backend persistence evidence; it isolates frontend save requests while preserving the local database. Backend save behavior was unchanged and reviewed in source.
