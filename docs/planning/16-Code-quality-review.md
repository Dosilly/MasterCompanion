# Code quality review

3 October 2026 · review completed; recommendations not implemented

## Scope and conclusion

The user requested an assessment of code readability, organization, class and
abstraction boundaries, and test quality. This review examines the current
working tree, including pre-existing uncommitted test reorganization. It is not
a review of only the committed branch and does not attribute those changes to
this task. Application code, existing tests, and campaign content were not edited.

The application has a sound high-level engine/module boundary, but its
implementation does not yet consistently meet the requested maintainability
standard. The main problems are custom test compilation, tests coupled to source
structure, crowded responsibilities, compressed formatting, and missing automated
style enforcement. One material validation gap also needs functional work.

This was a source review with selected executable checks, not exhaustive release
acceptance, a security penetration test, or a visual assessment of the UI.

## Findings

### 1. High priority: expedition component tests fail during import

Evidence: `src/mastercompanion-web/tests/integration/expedition-tool.test.mjs:23`.

The test generates component modules in `.local/tests/expedition-tool`, but
rewrites their relative imports to `../../tools/$1.mjs`. Running this test fails
with `ERR_MODULE_NOT_FOUND` for `.local/tools/expedition-view.mjs`, before its
behavioral tests can run. This is a confirmed defect in the current working tree.

Fix the path defect first, then replace the per-file compilation and import
rewriting with a supported test compilation/resolution path. Test execution must
work from a clean checkout without unrelated generated files. Do not expose
private library implementation through production public APIs just to test it.

### 2. High priority: material saves do not validate the document schema

Evidence: `src/MasterCompanion.Engine/Features/Materials/SaveMaterial.cs:16`.

The endpoint checks that the root is an object, its type is `doc`, and `content`
is an array. It then persists the raw JSON. For example,
`{"type":"doc","content":[{"type":"unsupportedNode"}]}` passes these explicit
checks. Child node structure, supported marks and attributes, URLs, and
document-specific size/depth limits are not checked by this slice. Framework
request and JSON limits do not provide a supported rich-document schema.

This violates the repository's boundary validation requirement and allows
unsupported data into authoritative campaign content. Rendering behavior and an
actual script-execution exploit were not demonstrated; this finding is about
missing server validation and preservation of readable documents.

Introduce an engine-owned validator for the supported document schema. Add
rejected-request tests for malformed children, unsupported nodes/marks,
attributes, unsafe URLs, and limits, confirming that content and revision do not
change. Preserve valid rich structures and authored content. Keep validation
separate from persistence while keeping the endpoint in its material slice.

### 3. Medium priority: frontend tests build their own application loader

Evidence: `tests/unit/autosave.test.mjs:14`,
`tests/unit/gameplay-session.test.mjs:15`, and
`tests/integration/expedition-tool.test.mjs:20`, under
`src/mastercompanion-web`.

Several test files independently read TypeScript, call `transpileModule`, write
generated JavaScript, modify imports, and dynamically import the result. This
duplicates infrastructure and makes ordinary source moves affect test loading.
`transpileModule` does not perform semantic type checking, and these JavaScript
test fixtures do not verify their compatibility with the TypeScript constructors
and interfaces they imitate. A production build still checks production code;
passing these tests alone does not establish that the fixtures are well typed.

Use one test runtime/compiler configuration that resolves actual source modules
and type-checks TypeScript tests. Keep pure/session tests distinct from Angular
component integration tests. Select a runner based on the actual Angular and
Node requirements; adding a framework is not itself the acceptance criterion.
The outcome should remove string rewriting and generated application loaders
from individual test files, while retaining their valuable behavioral assertions.

### 4. Medium priority: a workspace test extracts a method into a synthetic class

Evidence: `src/mastercompanion-web/tests/unit/workspace-notes.test.mjs:20`.

The test parses `Workspace`, extracts `acceptCreatedMaterial`, inserts its source
text into a new `WorkspaceNotes` class, and manually supplies fields and methods.
It exercises that method's body, but omits the actual component's construction,
injection, rendering, and lifecycle. The test is tightly coupled to method names
and source structure, while providing narrower evidence than an ordinary test of
the real workspace behavior.

Move material/tab acceptance into a cohesive workspace state owner if that
responsibility merits extraction, and test that actual owner directly. Verify
component integration through Angular component tests or the existing note
browser checks. Do not create a production abstraction solely to accommodate a
source-extraction test.

### 5. Medium priority: responsibilities are concentrated in several classes

Evidence:

- `src/mastercompanion-web/projects/engine/src/lib/features/workspace/workspace.ts:107`
  combines workspace loading, material HTTP requests, session ownership,
  creation acceptance, tab state and keyboard behavior, navigation expansion,
  focus/scroll effects, and unload protection. Its substantial inline template
  repeats tab markup for party, gameplay, map, and materials.
- `src/MasterCompanion.Engine/Features/Gameplay/GameplayService.cs:47`
  combines request validation, transactional orchestration, receipt verification,
  undo selection, neutral operation transformation, schema upgrades, and writes
  in one long execution path.
- `src/MasterCompanion.Modules.Ythryn/Gameplay/YthrynGameRules.cs:185`
  combines schema decoding, old schema handling, character invariant validation,
  exposure/recovery rules, command decoding, and projection. Expedition rules
  already have a separate owner, which is a useful precedent.

Extract responsibilities with a clear reason to change: workspace session/tab
state and focused navigation/tab views; gameplay request/snapshot validation and
operation transformation; Ythryn state decoding/validation and blight rules.
Keep the gameplay transaction, campaign lock, revision, receipt, and undo writes
under one explicit orchestration owner. Do not scatter atomic writes across
independent services or introduce generic repositories or a mediator framework.

Old schema paths must not be removed blindly. Current code and tests explicitly
preserve persisted snapshots and original idempotent receipts. Isolate migration
and historical receipt handling, then decide whether runtime support can be
removed using a reviewed data-preserving migration. Backward compatibility is
not enabled, but preservation of existing game state remains required.

### 6. Medium priority: test scenarios and assertions need clearer organization

Evidence:

- `tests/MasterCompanion.Gameplay.Tests.Integration/PersistenceTests.cs:36`
  puts exploration, rejection, stale revisions, searches, rests, arrivals,
  retries, undo, rolls, and roster reconfiguration into one scenario.
- `tests/MasterCompanion.Gameplay.Tests.Unit/RulesTests.cs:8`
  groups initialization, exposure, infection, recovery, party changes,
  malformed inputs, and migration in one broadly named class.
- `RulesTests.cs:85` tests all dice faces in a loop, and
  `RulesTests.cs:524` manually catches exceptions instead of using the test
  framework's exception assertions.

Split tests by behavior and responsibility, with shared setup only where it is
actually repeated. Keep a small number of multi-step journey tests when the
sequence itself is the contract. Use theories/data-driven cases for independent
inputs so each case reports separately. Prefer `Assert.Equal`, `Assert.Empty`,
`Assert.Throws`/`ThrowsAsync`, and separate assertions to compound `Assert.True`
expressions; this gives useful expected/actual failures. Name tests around a
trigger and expected outcome.

The current working tree already separates unit and integration projects and
uses xUnit for backend discovery. Moving files and adopting a test framework
improve organization, but do not solve these scenario-level issues on their own.

### 7. Medium priority: compressed formatting has no consistent enforcement

Evidence: `src/mastercompanion-web/projects/contracts/src/public-api.ts:10`,
`projects/engine/src/lib/features/workspace/workspace.ts:20`, and
`projects/engine/src/styles/engine.scss:1`, under `src/mastercompanion-web`.

Many interfaces, handlers, template elements, and CSS declarations are packed
onto single lines. This obscures control flow and produces noisy diffs. The
review found no repository `.editorconfig`, ESLint configuration, or formatter
configuration. `check:code` checks source-language conventions and matching
localization catalogs; `check:boundaries` checks dependency constraints. Neither
is a general formatting or maintainability check. .NET's `AnalysisLevel=latest`
is useful but does not define or enforce the requested complete style policy.

Add a project-owned formatting policy, appropriate TS/template lint rules, and
.NET style/analyzer settings. Provide check commands suitable for automated
verification. Put substantial Angular templates in their own HTML files and
format styles conventionally. Keep format-only changes separate from behavioral
refactoring so reviewers can assess each change.

### 8. Low priority: one unchecked event-target assertion bypasses narrowing

Evidence: `src/mastercompanion-web/projects/engine/src/lib/features/maps/map-view.ts:51`.

`(event.target as HTMLElement).closest('button')` assumes a non-null element.
Use an `instanceof Element` check before accessing `closest`, consistent with
the other event handlers in this application and the repository's type-safety
rules. This is a small concrete fix, not a reason to redesign map rendering.

## Class and file policy

Most implementation classes already have their own files. The issue is often
what a class owns, rather than how many files exist. Separate independently used
public types, such as gameplay transport records currently declared at the top
of `GameplayService.cs`, from the service implementation. A small request DTO
used only by one vertical slice can reasonably remain beside its endpoint;
private nested records and test-only helpers can remain local when that makes
their ownership clearer. Do not mechanically put every record into a new file.

Likewise, a function is appropriate for pure navigation or editor construction.
Introduce a class/interface when it owns state, coordinates a lifecycle, or
represents a useful boundary. More abstractions alone do not improve quality.

## Strengths to preserve

- Separate engine, contracts, and Ythryn projects/libraries; composition roots
  register concrete implementations. The dependency guard passed.
- Strict TypeScript/templates and nullable C# reference types remain enabled.
- Gameplay operations use campaign locking, transactional writes, revision
  checks, durable receipts, and explicit undo snapshots.
- Existing tests cover meaningful failure and data-integrity cases, including
  queued saves, stale revisions, ambiguous write recovery, and module-owned data.
- Persistence entities and several state owners already have focused files.
- Localization resources, semantic controls, and lifecycle cleanup for editors
  and map observers are present in the inspected source.

## Suggested delivery order

1. Repair the failing expedition test and replace custom frontend test loading.
2. Define formatting/lint policy and make a separate formatting-only change.
3. Split broad test scenarios and replace synthetic workspace method extraction.
4. Refactor the named responsibility concentrations one slice at a time, using
   existing behavioral coverage and scoped component/browser checks.
5. Deliver document validation as an explicit functional fix with rejection and
   unchanged-content/revision evidence; prioritize it before treating material
   persistence as production-ready.

All items are recommendations. This review does not implement them or authorize
publishing, deployment, or changes to user data.

## Executed checks

| Check | Result |
| --- | --- |
| `pnpm --dir src/mastercompanion-web check:code` | Passed: English-source guard and four matching localization catalogs. |
| `pnpm --dir src/mastercompanion-web check:boundaries` | Passed: configured engine/module dependency checks. |
| `pnpm --dir src/mastercompanion-web exec node --test tests/unit/autosave.test.mjs tests/unit/gameplay-session.test.mjs` | Passed: 34 tests, zero skipped. |
| `dotnet test tests/MasterCompanion.Gameplay.Tests.Unit/MasterCompanion.Gameplay.Tests.Unit.csproj --no-restore --verbosity minimal` | Passed: 34 tests, zero skipped. This also compiled the referenced contracts/module projects. |
| `pnpm --dir src/mastercompanion-web exec node --test tests/integration/expedition-tool.test.mjs` | Failed during import: missing generated module; no component behavior validated. |

PostgreSQL integration, API probes, full application builds, and Playwright UI
acceptance were not run for this review. Selected passing tests do not establish
complete application correctness. No live campaign material was changed.
