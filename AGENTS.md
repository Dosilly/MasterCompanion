# Repository engineering rules

These instructions apply to all implementation work in this repository. Read the relevant source, specifications, and existing behavior before editing. Direct user instructions take precedence. Keep changes focused on the requested outcome and verify the affected behavior before reporting completion. Verification is scoped to the change, not a requirement to run every check.

## Feature delivery workflow

- Implement every new feature on its own `codex/` branch created from `trunk`.
- Use an isolated worktree when the current checkout contains unrelated work; preserve uncommitted changes.
- Complete scoped verification and review, commit the feature, then merge it into `trunk`.
- Build the production image from the merged `trunk`, back up the existing database, and update only the application container. Preserve the PostgreSQL container, volume, authored materials and game state; verify readiness and affected behavior.
- This workflow is standing user authorization for local feature merges and local application-container updates. It does not authorize remote pushes, publishing, external deployment or user-data replacement.

## Compatibility policy

- Backward compatibility is not required until the user explicitly enables it after release. A release alone does not enable this requirement.
- Prefer a clean current design. Do not retain obsolete APIs, contracts, schema variants, aliases, adapters, upgrade paths, or fallback branches solely to support earlier versions. Remove such compatibility code when changing the affected area.
- Breaking changes are allowed within the requested scope. Update affected producers, consumers, tests, and documentation together; do not build parallel legacy and current implementations.
- This policy does not authorize deleting or resetting user data. Preserve authored content and game state, use explicit data migrations where needed, and keep the existing concurrency, transaction, backup, and applied-migration safeguards. Data preservation does not require permanent runtime support for obsolete formats.

## Language and localization

- Write identifiers, comments, exception messages, logs, API errors, test names, assertion messages, and developer tooling output in English.
- Keep user-facing text in localization resources, with English keys. Do not embed Polish copy in TypeScript, C#, component templates, or scripts.
- The UI currently uses Polish resources. Polish campaign content, original reference files, translated resources, and source-specific test fixtures are data; preserve their language and spelling. Never translate user notes as a code cleanup.
- Maintain matching keys and placeholders across locale catalogs. Include accessible labels and error/recovery messages in localization.
- Do not display raw exception details or backend diagnostic text in the UI. Map stable error codes or HTTP outcomes to localized messages.
- Write all project documentation, product specifications, plans and repository instructions in English. Preserve source-specific names and campaign content in their original language. Technical diagnostics must also use English.

## Architecture and ownership

- MasterCompanion is a generic campaign engine. A module implements a neutral contract; Ythryn is the first concrete module. A campaign owns its instantiated materials and game state.
- Keep `MasterCompanion.Contracts` independent of ASP.NET Core, EF Core, and concrete modules. Keep frontend contracts independent of engine and module implementations.
- Within the .NET solution, the engine and each module depend only on contracts. Frontend engine and adventure-module libraries may depend on `@mastercompanion/contracts` and the neutral `@mastercompanion/ui` library. The UI library must not depend on contracts, engine, adventure modules, campaign APIs, or persistence. Modules must not import engine components, persistence models, `DbContext`, or another module. The API and Angular host are composition roots. Before introducing UI-library imports, update the dependency guard and library build configuration to enforce this boundary.
- Export and import library functionality through public entry points. Do not use aliases or relative paths into another library's private source. Libraries remain separately compiled.
- Put campaign navigation, tab/session ownership, editing, persistence, map rendering, theme preference, and time coordination in the engine. Neutral presentation controls, accessibility primitives, and design tokens belong in the shared frontend UI library. Put adventure content, defaults, assets, and adventure-specific rules and tools in their module.
- Never add module-specific identifiers, branch conditions, or game rules to the engine. Extend the explicit contract when cross-boundary behavior is needed.
- Organize backend use cases as vertical slices, with endpoint, input/output, validation, and persistence together. Shared code must have a demonstrated purpose. Do not add generic repositories, mediator frameworks, microservices, or Module Federation just to match a pattern.
- Cross-module operations must use explicit contracts and preserve ownership. Before implementing game operations, define atomic changes of engine time, module state, revision, and undo history.
- Document meaningful changes to contracts and ownership in `docs/planning/06-Module-architecture.md`. Keep plans and implementation status in `docs/planning/`; keep `README.md` in English with stable project information and no current implementation status. Preserve historical workshop decisions as history.

## Clean code and file organization

These rules apply to production code, tests, and developer tools. Working behavior alone is not sufficient: the changed code must also have clear ownership, readable structure, and maintainable tests. Existing violations are not a style precedent. Improve violations directly affected by the task; record unrelated debt without expanding the task into a repository-wide rewrite.

- Organize code by feature and responsibility within the existing engine/module boundaries. Keep a feature's endpoint, validation, state, views, and tests easy to locate. Do not create catch-all `Helpers`, `Utils`, `Common`, or `Services` areas for unrelated code. Move functionality into shared code only when actual consumers share the same responsibility and semantics.
- Use one independently meaningful class, component, or public interface per file. Use filenames that identify the main type or responsibility and follow the owning project's naming convention. Independently reused public DTOs and domain types belong in their own files. A small endpoint-local request/response type, a private nested record, or a test-only helper may remain beside its sole owner when separating it would reduce clarity. These exceptions do not justify placing multiple unrelated types in one file.
- A class must have one cohesive responsibility and a clear reason to change. Separate domain rules, boundary decoding/validation, I/O orchestration, and presentation when they have different responsibilities. A component must not simultaneously own substantial HTTP coordination, session persistence, navigation rules, and DOM effects. Extract focused owners instead of moving a large class unchanged into another file.
- Keep functions at one level of abstraction. Prefer guard clauses and named steps to deeply nested branches and long mixed workflows. Extract a function when it names a meaningful operation or invariant; do not create wrappers that merely forward arguments or fragment a readable operation.
- Use pure functions for stateless calculations and transformations. Use classes for cohesive state, lifecycle, or orchestration. Introduce interfaces at meaningful boundaries or for genuinely interchangeable implementations; do not create an interface for every class or a generic framework for one use case.
- Keep transaction orchestration explicit. Extracting validation or domain transformations must not distribute campaign locks, revision checks, receipts, undo history, and related writes across independently committing services. The use case must retain one identifiable owner of atomicity.
- Keep mutable state private where possible and expose intentional operations or read-only projections. Do not allow callers to bypass invariants by mutating public collections or state fields. Make draft, pending, and confirmed state explicit, with a single authoritative owner for each.
- Prefer explicit result types and discriminated alternatives when they prevent invalid combinations. Avoid unrelated boolean flags, ambiguous tuples, magic sentinel values, or broad nullable result objects that make callers infer which outcome occurred. Keep transport shapes separate from internal state when their responsibilities differ.
- Name types and methods after their responsibility or domain operation. Avoid vague names such as `Manager`, `Processor`, `Data`, or `Handle` when a more precise name is available. Name constants for domain units and limits. Comments must explain constraints, ownership, or a non-obvious decision; do not narrate obvious statements or add decorative section banners.
- Keep imports and dependencies explicit. Production code must not depend on tests. Do not enlarge a library's public API, weaken access modifiers, or add test-only production branches to make tests convenient. Tests may access their owning library's internal source through the configured test tooling; imports into another library still use its public entry point.
- Remove obsolete code, unused exports, and superseded paths in the changed area. Isolate necessary data migration and historical receipt handling from current domain rules. Preserve existing content and game state before removing an old persisted schema; the compatibility policy does not permit discarding it.

## Readability, templates, and style enforcement

- Write source for human review. Put separate declarations and executable statements on separate lines; expand multi-step handlers and control flow into conventional blocks. Do not compress interfaces, classes, JSON configuration, or styles into dense single-line code. A short, clear expression or trivial accessor may remain on one line.
- Put substantial Angular templates in sibling `.html` files and substantial component styles in sibling `.scss` files. Inline templates/styles are reserved for small, readily readable components with no substantial branching, repeated layout, or complex forms. Keep UI expressions simple and place derived state and rules in appropriately named TypeScript owners.
- Extract repeated UI structures when they share behavior and accessibility requirements, such as tab controls. Give components explicit typed inputs and outputs. Do not introduce a generic configurable component when a small feature-specific component expresses the behavior more clearly.
- Before implementing a UI pattern, inspect the existing UI library and the owning feature for a suitable component, directive, or style token. Reuse it when its behavior matches; extend it coherently when appropriate. Extract a shared element from demonstrated consumers, normally at least two, rather than speculating about future screens. A theme foundation or accessibility primitive may justify a single initial consumer; explain that purpose in the relevant plan.
- Keep neutral presentation, interaction primitives, and design tokens in `@mastercompanion/ui`; keep campaign-aware reusable functionality in its engine feature and adventure-specific functionality in its module. UI elements accept typed presentation inputs, projected content, and explicit events. They must not fetch campaign data, interpret module state, choose retry behavior, or decide whether a draft may be discarded.
- Give each exported UI element documented inputs/outputs, actual usage examples, and appropriate behavior/accessibility verification. Keep a maintained component catalog with light/dark and loading, empty, error, disabled, and focus examples where those states apply. Use the catalog for reviewed visual evidence; do not introduce a documentation framework solely to satisfy this rule.
- Keep global styles limited to theme tokens, base rules, and genuinely shared layout/document styling. Put feature/component styling with its owner and avoid accidental coupling through broad selectors. Preserve document-reader styling that must reach editor-generated markup; choose the correct style scope rather than moving rules mechanically.
- Follow repository-owned formatter, lint, and analyzer configuration once established. Changes to that configuration require a task-relevant reason; do not disable or suppress checks to clear a failure. Missing tooling is a delivery gap to record or address in the authorized tooling scope, not permission to use inconsistent formatting.
- Keep formatting-only changes separate from behavioral refactoring in reviewable patches or commits. Do not reformat unrelated files, generated artifacts, applied migrations, or campaign content. Generated-file conventions are controlled by their generator.

## Test design and infrastructure

- Test observable behavior and contracts using the actual implementation. Do not parse source text or an AST to extract methods into synthetic classes, copy production method bodies into tests, rewrite imports with string replacements, or implement a per-test application compiler/loader. Source inspection is appropriate only when source structure is itself the subject, such as a dependency-policy or code-generation test.
- Use a supported test runner/compiler/resolver configured centrally for each stack. Type-check TypeScript tests and fixtures against the real interfaces they implement. Do not rely on isolated `transpileModule` calls as compilation evidence. Test files should contain scenarios and fixtures, not build-system plumbing.
- Keep unit, integration, and browser/end-to-end tests clearly separated. Unit tests exercise rules/state with controlled dependencies; integration tests exercise actual collaborating components or persistence; browser tests exercise rendered user behavior. Do not label a stubbed or source-extracted method test as full component integration.
- Group tests into focused files/classes named after the behavior under test. A test should establish one scenario and assert its coherent outcome. Multiple assertions are appropriate for an atomic operation; unrelated journeys must be separate tests. Keep multi-step journey tests only where the sequence itself is the requirement.
- Use descriptive test names that identify the trigger and expected result. Use Arrange/Act/Assert structure where it makes the scenario clearer; comments marking those sections are optional. Avoid long procedural scripts that mix fixture preparation, several unrelated operations, and scattered assertions.
- Use data-driven cases for independent inputs so each failing case is reported separately. Loops are appropriate for testing an ordered sequence or invariant across related events, not for hiding independent scenarios behind one test result.
- Use assertion APIs that describe the expected relationship and report useful expected/actual values. Prefer equality, collection, and exception assertions over compound `Assert.True` conditions, manually caught exception flags, or custom substitutes for the test framework's assertions. Use boolean assertions for actual boolean predicates.
- Keep fixtures and test doubles small, explicit, and typed where the language permits. Share setup only when it is genuinely repeated; keep scenario intent visible in the test. Avoid generic fixture frameworks, inheritance hierarchies, hidden assertions, and defaults that conceal the condition being tested.
- Control clocks, randomness, network responses, and asynchronous completion through appropriate test facilities or explicit dependency boundaries. Avoid arbitrary sleeps and dependence on test order. Release test-owned resources and restore mocks in teardown, including failure paths.
- Tests must run from a clean checkout with the documented preparation steps. Each test run must create or build what it needs explicitly; never depend on stale `.local` files or artifacts from another suite. Scope temporary files/resources to their owner, isolate parallel runs, and clean up only test-owned resources.
- A skipped test is not passing evidence. A module import or compilation failure means the affected behavior was not verified. Do not weaken assertions, skip failing cases, or update visual baselines solely to obtain a successful command.

## Production-ready implementation standard

Production-ready is an evidence-based acceptance standard for the changed behavior, not a declaration that the entire MVP is complete. Apply these rules to every change without expanding the agreed feature scope.

- Favor clear, small, cohesive functions and explicit types. Use meaningful names, consistent formatting, and comments that explain a constraint or decision rather than restate the code.
- Keep nullable reference types and strict TypeScript/template checking enabled. Do not introduce `any`, `$any`, unchecked casts, non-null assertions, suppression directives, or disabled checks to bypass a design problem. Improve existing occurrences when directly relevant to a change.
- Validate untrusted input at the boundary: types, supported schema, size/depth limits, identifiers, references, allowed values, and domain invariants appropriate to the endpoint. Never rely solely on browser validation.
- Separate expected validation/not-found/conflict outcomes from unexpected exceptions. Use appropriate HTTP status codes and stable error identifiers. Keep technical diagnostics in English.
- Do not swallow unexpected failures or report success after a failed operation. Recoverable failures must preserve user work and offer an actionable recovery path.
- Propagate cancellation through async backend I/O. Avoid sync-over-async, blocking waits, uncontrolled fire-and-forget work, unbounded concurrency, and timers/listeners without cleanup.
- Use UTC for technical timestamps. Keep game time independent of wall-clock time, time zones, and the operating system clock.
- Avoid needless abstractions and duplicated business rules. Add a dependency only when its benefit exceeds its maintenance cost; pin compatible versions and update the lockfile deliberately.
- Do not add placeholders, dead code, silent fallback behavior that masks corruption, or speculative features to a completed slice. Record explicitly deferred work in the plan.

## Persistence, concurrency, and data safety

- User content is authoritative after campaign initialization. Never overwrite edited materials with module defaults on startup, rebuild, conversion, or upgrade.
- Maintain module defaults as individual Markdown sources with metadata and separate navigation/maps/assets. Generated distribution JSON is a build artifact, not an editable source. Reference import must refuse existing destinations; do not regenerate over authored files. Preserve stable IDs and rich HTML structures that Markdown cannot represent losslessly. Module authoring is distinct from editing a campaign copy.
- Use stable IDs for materials, folders, map links, and assets. Do not make relationships depend on display names. Validate hierarchy cycles and references.
- Keep material saves independent from game operations and undo. Closing a tab or finishing editing must wait for confirmed persistence; failures and revision conflicts keep the draft recoverable.
- Preserve optimistic concurrency. Never resolve a conflict by silently overwriting a newer revision. Serialize dependent saves and advance revisions only after confirmation.
- Use transactions for related writes that must succeed together. Define idempotency and retry behavior for operations that may be repeated; do not retry non-idempotent writes blindly.
- Keep EF Core queries explicit, scoped to the campaign, and bounded where needed. Use asynchronous APIs, projection/no-tracking for reads, parameterized access, and indexes justified by actual queries.
- Schema changes require a reviewed EF migration and updated snapshot. Do not edit migrations already applied to shared data; add a new migration.
- Data-changing migrations or backfills require evidence on representative existing data. Check document content and revisions before and after; document limitations and recovery requirements. Never remove the local database volume to make a test pass.
- Keep integration tests isolated where possible. Any probe that temporarily changes a live material must restore only its own confirmed revision and must never replace intervening user edits.

## Security and deployment boundaries

- Treat material documents, links, filenames, module packages, and assets as untrusted input. Render through the supported document schema; reject unsafe URL schemes and prevent path traversal. Do not introduce arbitrary HTML/script execution.
- Keep secrets out of source, logs, screenshots, fixtures, and committed configuration. Use environment/configuration providers; do not hardcode credentials or a developer's runtime paths.
- Keep local development endpoints bound to loopback. The agreed MVP has no accounts or login; do not add them incidentally. Before network/cloud exposure, explicitly design and implement authentication, authorization, transport security, origin protection, secret handling, and database access restrictions.
- Full offline operation is not a current requirement or an MVP acceptance gate. Do not schedule internet-disconnected acceptance unless the user reinstates this requirement. Local operation, durable persistence, data safety, and recovery from failed requests remain required.
- Keep .NET, Angular, Docker, and storage choices portable. Windows is the current acceptance platform; AWS is a future deployment target, not a dependency of normal local operation.
- Do not publish, push, merge, deploy, delete user data, or change external services unless authorized by the user. Use repository/project-scoped process control; do not terminate unrelated processes.

## Frontend and accessibility

- Readability of long notes is the primary UX requirement. Tools support the reader and must not permanently consume its useful width. Verify relevant changes at Full HD in both themes. Automated browser assertions and reviewed visual baselines can provide this evidence; repeating the same manual checks is unnecessary.
- Default to read mode; enter editing explicitly. Preserve editor state, scroll position, and map pan/zoom during tab switching. Do not emit document updates for changes that only affect UI state.
- Maintain folder nesting from module data. Active materials must have a visible selection, open ancestor folders, appropriate focus, and predictable scrolling without disturbing typing during ordinary autosave.
- Use semantic elements, meaningful accessible names, visible focus, keyboard-operable controls, sufficient contrast, and appropriate live regions. ARIA roles imply the corresponding keyboard behavior; do not use them as decoration.
- Provide loading, empty, save, error, and conflict states. Keep repeated actions safe while requests are pending. Release editor instances, observers, listeners, and scheduled callbacks when their owner is destroyed.

## Test design and organization

- Name .NET projects `<Area>.Tests.Unit` or `<Area>.Tests.Integration`. Run them through `dotnet test`; do not add console runners or handwritten lists of test methods.
- Keep pure rules and transformations in unit tests. Use integration tests for composed services, HTTP, database behavior, real editors and import/build pipelines. Keep browser and deployed-container scenarios in E2E suites. Frontend Node tests belong in `tests/unit` or `tests/integration`, grouped with `describe`.
- Use names that identify the operation, condition and expected result. Keep one behavior per unit test; use theories or named data cases for boundaries so failures identify their input. Several assertions about one result are appropriate.
- Separate Arrange, Act and Assert with visible blocks. Setup creates the precondition; Act performs the behavior under test; Assert checks the result and relevant side effects. Stateful integration/E2E protocols can contain explicitly separated action/assertion steps when intermediate states are part of the behavior. Do not hide unrelated scenarios in a single method or add empty phases solely to match a template.
- Test HTTP through `WebApplicationFactory<Program>` when exercising API composition and middleware. Start PostgreSQL with `Testcontainers.PostgreSql`, use a fresh test-owned database per case and apply real migrations. Do not require manually configured database credentials or reuse the user's runtime database or volume. A missing or failed Docker runtime is a test setup failure, not a passing test.
- Keep fixtures specific to their demonstrated purpose, isolate mutations, and dispose hosts, clients, editors and containers even after failure. Assertion helpers should report expected and actual values; use framework assertions instead of handwritten pass/fail exceptions.

## Verification scoped to the change

- Add meaningful tests when implementing new functional behavior or fixing a defect. Cover the relevant rules, data integrity, concurrency, security, or failure paths. Do not create tests just for documentation, formatting, or markup that has no behavioral consequence.
- Select the smallest set of tests that covers the changed behavior and its affected dependencies. Use a specific test file or `--test-name-pattern` when a suite contains unrelated or expensive cases. An importer change does not automatically require autosave, API, browser, or every-document migration tests.
- Run the selected tests after the implementation is ready for review. Rerun them only after a relevant code, data, dependency, configuration, or test change, or while investigating a failure. Reuse successful results for unchanged areas within the task and across follow-up turns; a commit, push, or merge request is not by itself a reason to repeat them.
- Documentation-only and instruction-only changes require reviewing the diff and affected links or commands, not application tests or builds. File moves and conflict resolutions require checks only where the resulting behavior or references changed.
- Build the affected project or library when compilation needs verification. Build dependent consumers if a public interface changed. Use a full solution or frontend build for changes that affect integration, shared contracts, build configuration, or dependency compatibility; do not rebuild both stacks for an isolated change in one.
- Reserve broad regression runs and full acceptance checks for changes with broad impact, integration concerns, an explicit user request, or release acceptance. Expand a targeted check only when a failure or a concrete unresolved risk justifies it. Do not routinely test unrelated areas after each edit.
- Inspect failures and fix their causes. Report the checks actually run and any relevant limitation. Never invent successful results or imply that a targeted check verified the entire application.

The following commands are available checks, not a checklist to run for every task. Select only those relevant to the change. Run from the repository root unless stated otherwise:

```powershell
# For source/localization changes and dependency boundary changes, respectively
pnpm --dir src/mastercompanion-web check:code
pnpm --dir src/mastercompanion-web check:boundaries

# Frontend formatting, lint, typed fixtures, E2E types, localization and boundaries
pnpm --dir src/mastercompanion-web check:quality
# Individual checks can be selected for narrower changes
pnpm --dir src/mastercompanion-web check:format
pnpm --dir src/mastercompanion-web check:lint
pnpm --dir src/mastercompanion-web check:tests

# C# formatting in affected files; omit applied migrations and generated artifacts
dotnet format whitespace MasterCompanion.slnx --no-restore --include src/MasterCompanion.Engine/Features/Materials/SaveMaterial.cs --verify-no-changes

# Scoped browser checks; choose the tag or spec affected by a UI change
pnpm --dir src/mastercompanion-web test:ui --grep '@reader'
pnpm --dir src/mastercompanion-web test:ui --grep '@editor'
pnpm --dir src/mastercompanion-web test:ui --grep '@gameplay'

# Full backend build when integration is affected; otherwise build the affected project
dotnet build MasterCompanion.slnx --no-restore

# Full frontend build when integration is affected; otherwise build the affected library
pnpm --dir src/mastercompanion-web build

# Content suite when the change affects multiple content behaviors
pnpm --dir src/mastercompanion-web test:content

# Autosave suite when save behavior or editor/tab lifecycle is affected
pnpm --dir src/mastercompanion-web test:autosave

# Example: select an affected test instead of running an unrelated suite
pnpm --dir src/mastercompanion-web exec node --test --test-name-pattern="Markdown headings" tests/integration/module-sources.test.mjs
```

- `check:code` is a guard against Polish source text and inconsistent translation catalogs; it cannot prove that every ASCII sentence is English or that the product is production-ready. Human review remains necessary.
- Frontend builds run `check:quality` before compilation. Node tests use the centrally configured `tsx` runtime and public contract entry point; TypeScript tests and fixtures are checked by `tests/tsconfig.json`. Keep test scenarios free of custom transpilers and generated application modules. Remaining JavaScript suites run the same actual source implementation but are not semantic fixture type-checking evidence.
- Use `test:api` against a running AppHost when changed persistence/API behavior needs integration evidence. This probe changes one material temporarily; prefer an isolated database and respect its revision-protected restore. For changes limited to rejected requests or error diagnostics, prefer `test:api-errors`, which checks ProblemDetails and confirms no persisted document or revision changes. Do not run either for unrelated frontend, documentation, or tooling changes. Folder backfill verification is a separate, explicit before/after probe in `tools/verify-folders.mjs`.
- Use real PostgreSQL when verifying changed database-specific behavior. Existing integration evidence remains valid until a relevant change affects it.
- For visible UI changes, prefer the affected Playwright spec or tag (`@reader`, `@editor`, `@gameplay`). The suite runs independent browser contexts with four workers across both themes and two viewport sizes, checks console errors, and compares visual baselines. Inspect new designs, intentional screenshot differences and behavior not covered by the suite manually. Do not repeat covered manual walkthroughs after a successful relevant automated check. Never update visual baselines just to clear a failure; review the actual image and intended change first. See [UI test instructions](docs/planning/13-UI-tests.md). A successful build is not browser verification.
- Review the final diff for unrelated changes, source-language violations, missing localization keys, accidental secrets, broken ownership, and destructive migrations. Preserve module content and user data.
- Review changed code against the clean-code rules as well as test results: cohesive responsibilities, justified abstractions, discoverable files, conventional formatting, real implementation under test, and useful assertions. Explain material design exceptions in the relevant plan or change description; routine choices do not require a separate approval step. Passing builds, `check:code`, and `check:boundaries` do not substitute for this review.
- Builds of Angular libraries happen before the host starts. Rebuild/restart the frontend as needed; do not validate stale library output. Do not interrupt pending user saves during a restart.

## Definition of done

A change is complete when it meets the requested behavior, preserves existing user data and module boundaries, handles relevant failure paths, follows the clean-code and test-design rules above, has suitable tests for new behavior, passes the selected checks for affected areas, and has current documentation. Unrelated suites and full builds are not required by default. Report the concrete outcome, checks actually run, and any material limitation. Distinguish completed work, deferred scope, and unverified assumptions. These instructions guide every future change; they do not replace code review or test evidence.
