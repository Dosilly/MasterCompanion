# Repository engineering rules

These instructions apply to all implementation work in this repository. Read the relevant source, specifications, and existing behavior before editing. Direct user instructions take precedence. Keep changes focused on the requested outcome and verify the affected behavior before reporting completion. Verification is scoped to the change, not a requirement to run every check.

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
- Existing Polish product specifications may remain in Polish. New code-facing instructions and technical diagnostics must use English.

## Architecture and ownership

- MasterCompanion is a generic campaign engine. A module implements a neutral contract; Ythryn is the first concrete module. A campaign owns its instantiated materials and game state.
- Keep `MasterCompanion.Contracts` independent of ASP.NET Core, EF Core, and concrete modules. Keep frontend contracts independent of engine and module implementations.
- Within the solution, the engine and each module depend only on contracts. Modules must not import engine components, persistence models, `DbContext`, or another module. The API and Angular host are composition roots.
- Export and import library functionality through public entry points. Do not use aliases or relative paths into another library's private source. Libraries remain separately compiled.
- Put generic navigation, tabs, editing, persistence, map rendering, theme, and time coordination in the engine. Put adventure content, defaults, assets, and adventure-specific rules and tools in their module.
- Never add module-specific identifiers, branch conditions, or game rules to the engine. Extend the explicit contract when cross-boundary behavior is needed.
- Organize backend use cases as vertical slices, with endpoint, input/output, validation, and persistence together. Shared code must have a demonstrated purpose. Do not add generic repositories, mediator frameworks, microservices, or Module Federation just to match a pattern.
- Cross-module operations must use explicit contracts and preserve ownership. Before implementing game operations, define atomic changes of engine time, module state, revision, and undo history.
- Document meaningful changes to contracts and ownership in `docs/planning/06-Architektura-modulow.md`. Keep plans and implementation status in `docs/planning/`; keep `README.md` in English with stable project information and no current implementation status. Preserve historical workshop decisions as history.

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
- Offline operation must not require CDNs, remote fonts, telemetry, third-party APIs, or runtime package downloads after environment preparation. Distinguish an offline package install from an acceptance test with networking disconnected.
- Keep .NET, Angular, Docker, and storage choices portable. Windows is the current acceptance platform; AWS is a future deployment target, not a dependency of normal local operation.
- Do not publish, push, merge, deploy, delete user data, or change external services unless authorized by the user. Use repository/project-scoped process control; do not terminate unrelated processes.

## Frontend and accessibility

- Readability of long notes is the primary UX requirement. Tools support the reader and must not permanently consume its useful width. Verify relevant changes at Full HD in both themes.
- Default to read mode; enter editing explicitly. Preserve editor state, scroll position, and map pan/zoom during tab switching. Do not emit document updates for changes that only affect UI state.
- Maintain folder nesting from module data. Active materials must have a visible selection, open ancestor folders, appropriate focus, and predictable scrolling without disturbing typing during ordinary autosave.
- Use semantic elements, meaningful accessible names, visible focus, keyboard-operable controls, sufficient contrast, and appropriate live regions. ARIA roles imply the corresponding keyboard behavior; do not use them as decoration.
- Provide loading, empty, save, error, and conflict states. Keep repeated actions safe while requests are pending. Release editor instances, observers, listeners, and scheduled callbacks when their owner is destroyed.

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

# Full backend build when integration is affected; otherwise build the affected project
dotnet build MasterCompanion.slnx --no-restore

# Full frontend build when integration is affected; otherwise build the affected library
pnpm --dir src/mastercompanion-web build

# Content suite when the change affects multiple content behaviors
pnpm --dir src/mastercompanion-web test:content

# Autosave suite when save behavior or editor/tab lifecycle is affected
pnpm --dir src/mastercompanion-web test:autosave

# Example: select an affected test instead of running an unrelated suite
pnpm --dir src/mastercompanion-web exec node --test --test-name-pattern="Markdown headings" tools/module-sources.test.mjs
```

- `check:code` is a guard against Polish source text and inconsistent translation catalogs; it cannot prove that every ASCII sentence is English or that the product is production-ready. Human review remains necessary.
- Use `test:api` against a running AppHost when changed persistence/API behavior needs integration evidence. This probe changes one material temporarily; prefer an isolated database and respect its revision-protected restore. For changes limited to rejected requests or error diagnostics, prefer `test:api-errors`, which checks ProblemDetails and confirms no persisted document or revision changes. Do not run either for unrelated frontend, documentation, or tooling changes. Folder backfill verification is a separate, explicit before/after probe in `tools/verify-folders.mjs`.
- Use real PostgreSQL when verifying changed database-specific behavior. Existing integration evidence remains valid until a relevant change affects it.
- For visible UI changes, inspect the affected view and interactions in the browser and check relevant console errors. Do not repeat the full navigation/editing/map walkthrough for an isolated visual fix. A successful build is not browser verification.
- Review the final diff for unrelated changes, source-language violations, missing localization keys, accidental secrets, broken ownership, and destructive migrations. Preserve module content and user data.
- Builds of Angular libraries happen before the host starts. Rebuild/restart the frontend as needed; do not validate stale library output. Do not interrupt pending user saves during a restart.

## Definition of done

A change is complete when it meets the requested behavior, preserves existing user data and module boundaries, handles relevant failure paths, has suitable tests for new behavior, passes the selected checks for affected areas, and has current documentation. Unrelated suites and full builds are not required by default. Report the concrete outcome, checks actually run, and any material limitation. Distinguish completed work, deferred scope, and unverified assumptions. These instructions guide every future change; they do not replace code review or test evidence.
