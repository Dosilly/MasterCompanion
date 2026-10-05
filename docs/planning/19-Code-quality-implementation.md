# Code quality implementation

4 October 2026

## Delivered changes

This change implements the actionable quality findings in
[the source review](16-Code-quality-review.md), building on the completed
[test organization](18-Test-organization.md). It preserves campaign content,
gameplay atomicity and the engine/module dependency boundary.

- Frontend Node suites import actual TypeScript through one pinned `tsx` runtime
  and `tsconfig.tests.json`. Per-test transpilation, import rewriting, generated
  application modules and AST method extraction are removed. Contract imports
  resolve through the public entry point. Library packages declare ESM so Angular
  class and injection-token identities are shared across source imports.
- Autosave and workspace-session scenarios are TypeScript and use a typed
  `HttpBackend` under the real Angular `HttpClient`. Central `tests/tsconfig.json`
  checks those fixtures and their imported implementations. Other existing Node
  suites remain JavaScript: they exercise real source but are not evidence of
  semantic fixture type checking. Further conversion can be performed when those
  scenarios change; no production type checks are weakened.
- `WorkspaceMaterials` owns reads, concurrent-open deduplication, read-mode
  session creation and confirmation replay. Replayed creation cannot replace an
  editor's newer draft. Failed reads permit an explicit subsequent retry.
- `WorkspaceTab` is reused by party, gameplay, map and material tabs. Its typed
  inputs are the stable campaign key, label, accessible close label/hint, selected,
  dirty and closing states; its outputs request activation or closure. DOM IDs
  match the associated panel. It prevents middle-button scrolling and repeated
  closure while a save is pending. The workspace retains keyboard navigation,
  focus/scroll coordination and revision-confirmed close decisions.
- Public contracts and independently used gameplay records have focused files.
  Neutral transformations and request/snapshot/receipt validation are separate
  from the service that owns campaign locking, transactions and undo. Module
  Blight transitions and command/state decoding have separate owners. Necessary
  saved-state upgrades and original receipt projections remain intact.
- Substantial templates and styles are sibling HTML/SCSS files. Feature styling
  is scoped to components; generated reader markup keeps deliberate global
  document styles. Gameplay layout is shared by the two engine game views, and
  module tool controls share their module-owned rules.
- Map drag handling checks the event target at runtime rather than asserting an
  unchecked DOM type. Navigation construction uses an explicit map element type.
- Material saves validate supported rich-document grammar, marks, attributes,
  URL schemes, duplicate properties, strict request shape, positive revision and
  bounded bytes/depth/node count before mutation. Existing revision conflicts
  and save concurrency remain enforced. Rejections preserve content and revision.

The catalog-document integration scenario saves all 106 current module documents
and compares persisted JSON structurally after each confirmed revision, covering
tables, disclosure content, source anchors and material links. This validates the
current source catalog; it does not audit arbitrary previously authored live
documents. No live database, user notes or migrations are modified by this change.

## Style tooling and preparation

Install the pinned workspace dependencies with the repository's pnpm version:

```powershell
pnpm --dir src/mastercompanion-web install --frozen-lockfile
pnpm --dir src/mastercompanion-web check:quality
pnpm --dir src/mastercompanion-web test:unit
pnpm --dir src/mastercompanion-web test:integration
```

`.editorconfig` and `.gitattributes` define UTF-8, LF and conventional indentation.
Prettier formats frontend source, templates, styles, test scenarios and tools.
ESLint enforces explicit block control flow, separate statements and the absence
of explicit `any`, unchecked assertions and non-null assertions in TypeScript.
`check:quality` combines format, lint, typed tests, E2E types, localization and
dependency checks. Normal frontend builds run it before compiling the libraries
and host. Generated artifacts, authored module sources, visual baselines and
source fixtures are excluded from formatter rewrites.

C# uses the SDK formatter and analyzer policy on affected files. Select those
files with `dotnet format whitespace ... --include ... --verify-no-changes`;
do not reformat applied migrations or generated files. Formatting and functional
changes are separated for review.

## Verification

- Backend unit suite: 120 passed, none skipped.
- Gameplay integration suite: 23 passed, none skipped, with isolated PostgreSQL.
- Material integration suite: 40 passed, none skipped, including 29 new save cases
  and the 106-document catalog preservation scenario.
- Frontend Node suites: 71 unit and 37 integration cases passed, none skipped.
- Playwright: all 48 cases passed across Full HD and scaled viewports, both themes,
  existing visual baselines unchanged. Coverage includes tab keyboard/middle-click,
  mounted editor preservation, save-before-close and failed requests.
- Solution build: no warnings or errors. Frontend libraries and host compiled
  separately; strict template checks remain enabled.
- Formatter, lint, TypeScript fixture/E2E, language/localization and dependency
  checks passed individually and through `check:quality` in the normal build.

The first browser run exposed inherited engine styling in module controls.
Module-owned styles restored the original design; the final comparisons passed
without updating snapshots. The initial material rejection assertions were fixed
to compare JSON structure, since PostgreSQL JSONB normalizes textual formatting;
the stale-revision fixture now uses a schema-valid document. Assertions were not
weakened to accept a failed request or changed persisted data.

## Remaining product scope

[URL navigation](22-Workspace-routing.md) and the neutral UI library's
[context-menu foundation/catalog](17-Context-menu-catalog.md) were subsequently
delivered on 4 October. Dialog, feedback, theme and neutral tab extraction remain
in [the UI plan](17-Reusable-frontend-ui.md). This quality change introduced
reusable campaign controls; those later slices own their delivery evidence.
The workspace remains the composition owner for its navigation and mounted views;
further extraction should follow demonstrated responsibilities and behavior.
