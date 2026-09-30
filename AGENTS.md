# Repository engineering rules

These instructions apply to all implementation work in this repository. Read the relevant source, specifications, and existing behavior before editing. Direct user instructions take precedence. Keep changes focused on the requested outcome and complete the applicable checks before reporting completion.

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

## Required verification

Run checks appropriate to the change, inspect failures, and fix causes. Do not rerun broad checks without a new change or unresolved concern. Never invent successful test results.

Run from the repository root unless stated otherwise:

```powershell
# Code language/localization policy and module boundaries
pnpm --dir src/mastercompanion-web check:code
pnpm --dir src/mastercompanion-web check:boundaries

# For backend, project reference, or shared contract changes
dotnet build MasterCompanion.slnx --no-restore

# For frontend, localization, styles, or shared contract changes
pnpm --dir src/mastercompanion-web build

# For content/schema/navigation changes
pnpm --dir src/mastercompanion-web test:content

# For autosave, editor lifecycle, conflict handling, or tab closing changes
pnpm --dir src/mastercompanion-web test:autosave
```

- `check:code` is a guard against Polish source text and inconsistent translation catalogs; it cannot prove that every ASCII sentence is English or that the product is production-ready. Human review remains necessary.
- Run `test:api` against a running AppHost when persistence/API behavior changes. This probe changes one material temporarily; prefer an isolated database and respect its revision-protected restore. For changes limited to rejected requests or error diagnostics, `test:api-errors` checks ProblemDetails and confirms no persisted document or revision changes. Folder backfill verification is a separate, explicit before/after probe in `tools/verify-folders.mjs`.
- Add meaningful regression tests for changed rules, data integrity, concurrency, security, or failure behavior. Avoid tests that merely mirror markup or implementation details. Use real PostgreSQL for database-specific behavior when applicable.
- For visible UI changes, inspect the running app in the browser, exercise the affected interactions, and check relevant console errors. A successful build is not browser verification.
- Review the final diff for unrelated changes, source-language violations, missing localization keys, accidental secrets, broken ownership, and destructive migrations. Preserve module content and user data.
- Builds of Angular libraries happen before the host starts. Rebuild/restart the frontend as needed; do not validate stale library output. Do not interrupt pending user saves during a restart.

## Definition of done

A change is complete when it meets the requested behavior, preserves existing user data and module boundaries, handles relevant failure paths, passes applicable checks, and has current documentation. Report the concrete outcome, checks actually run, and any material limitation. Distinguish completed work, deferred scope, and unverified assumptions. These instructions guide every future change; they do not replace code review or test evidence.
