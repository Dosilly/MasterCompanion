# Campaign material title editing

7 October 2026 · implemented on `codex/material-titles` from `trunk`.
Local container update and readiness verification are coordinated separately by
the parent task after the feature commit.

Related: [near-term requirements](15-Near-term-improvements.md),
[engine ownership](06-Module-architecture.md),
[material memory](23-Campaign-material-memory.md).

## Delivered behavior

Entering document editing replaces the read-mode title with a labeled title field
inside the existing reading paper. The field uses the theme controls and visible
keyboard focus; the title remains separate from body headings. Read mode stays the
default. Blank, overlong and control-character titles are rejected with localized
validation while retaining the draft.

`PUT /api/materials/{id}` now requires `title`, `document` and `expectedRevision`.
The server trims the title, validates 1–300 characters without control characters,
and saves metadata and body atomically in one material revision. Missing or null
titles fail the strict request envelope. There is no parallel legacy body-only
contract and no persistence migration: the material already owns its title column.

`MaterialSession` owns the private title draft and body draft together. Both use
the existing debounced save queue and immutable request snapshot; later edits wait
for the earlier confirmed revision and are retained if a later request fails.
Finishing editing and closing the tab wait for confirmed title/body persistence.
Conflicts retain the complete draft, permit inspection of the saved title/body,
and require explicit adoption or reapplication. Copying a draft includes its title
and body, including the manually selectable fallback when clipboard access fails.

Confirmed saves update the campaign cache, navigation summaries, open-tab labels
and active search results. Existing save-revision observation refreshes the search.
Reloading reads the persisted title. Identity, URLs, material links, map targets,
folder assignment and module sources remain unchanged. The field uses the existing
engine material view; no neutral UI primitive was added because it is an ordinary
labeled campaign edit field. Future module-authoring saves remain separate scope.

## Scoped evidence

- Forty frontend unit cases across `material-titles.test.ts`, `autosave.test.ts`,
  `material-recovery.test.ts` and `workspace-notes.test.ts` verify title-only saves,
  body/title queue snapshots, invalid-title closure, failure retention, conflict
  adoption/reapplication and confirmed navigation/cache reopening. Focused reruns
  after the title-state and fixture changes confirm the affected cases.
- Thirty-seven distinct PostgreSQL HTTP cases verify title-only and combined body/title saving,
  persistence, stable identity, title validation and stale-revision rejection.
  Existing document/envelope validation is retained; test-owned databases use real
  migrations. The all-document catalog loop is intentionally outside this scope.
- Thirty-six distinct focused Playwright cases pass across light/dark at
  1920×1080 and 1536×864: the three new title scenarios, existing editor scenarios,
  and three material recovery scenarios. The title scenario verifies retained
  drafts across tabs, pending finish, confirmed navigation/tab/search changes and
  persisted title/body after reload. Other cases cover invalid titles, blocked
  closure, explicit adoption, failed inspection and manual draft copying.
- New title-field images and intentional editor/Markdown-dialog background
  changes were reviewed in both themes. The title field remains beside the body,
  retains comfortable reading width and contrast, and causes no horizontal
  overflow. Reviewed baselines pass normal comparison.
- Frontend integration build (all separate libraries and host), source/localization
  policy, test types and browser types pass. Build invokes formatting, lint,
  boundaries and typed verification as configured by the repository.

Verification commands from the repository root:

```powershell
pnpm --dir src/mastercompanion-web exec tsx --tsconfig tsconfig.tests.json --test tests/unit/material-titles.test.ts tests/unit/autosave.test.ts tests/unit/material-recovery.test.ts tests/unit/workspace-notes.test.ts
dotnet test tests/MasterCompanion.Materials.Tests.Integration --filter "FullyQualifiedName~SaveMaterialHttpTests&FullyQualifiedName!~ModuleCatalogDocuments"
pnpm --dir src/mastercompanion-web build
pnpm --dir src/mastercompanion-web check:code
pnpm --dir src/mastercompanion-web check:tests
pnpm --dir src/mastercompanion-web check:ui
pnpm --dir src/mastercompanion-web exec playwright test e2e/material-titles.spec.ts e2e/editor.spec.ts e2e/draft-recovery.spec.ts --grep "Title|title|Editor controls|Finishing editing|Save conflict|Saved-version|Reapplying|Failed inspection"
```

Browser cases were run in focused groups while reviewing changed baselines; the
last command selects the same 36 cases. API-only restore and browser test fixture
corrections resolved initial setup failures; no failure was skipped or suppressed.
The parent task will record container image/update/readiness evidence. Remote push
and merge are reserved for the user.
