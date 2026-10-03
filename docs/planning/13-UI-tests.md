# Concurrent browser verification

3 October 2026

## Scope and isolation

The UI suite exercises the production Angular host and its separately compiled
libraries in Chromium. Each test gets a fresh browser context, campaign fixture
and material revision. Requests are intercepted before navigation; unmatched API
and external requests fail the test. A dedicated static server has no API proxy
and binds to `127.0.0.1:4310`. The user's runtime, notes and PostgreSQL volume are
not used. The in-memory save fixture verifies frontend behavior; it does not
establish backend persistence or database concurrency evidence.

The fixture contains nested folders, linked materials, a long rich document with
a table and expandable context, and a party with pending expedition and Arcane
Blight checks. It supplies a module-owned display projection through the current
public campaign contract. It does not duplicate module gameplay rules.

## Parallel execution and build reuse

`fullyParallel: true` allows independent cases within the same file and across
projects to run concurrently. `workers: 4` applies locally and in CI. Each case
owns its page, storage and mock state; tests have no shared campaign mutations or
serial dependencies. CLI `--workers` can change the resource limit deliberately.
Retries are disabled so failures are visible on the first attempt.

The four projects cover light/dark themes at 1920×1080 and 1536×864. The smaller
viewport models available CSS space at 125% scaling on a Full HD display, not
operating-system scaling, actual browser zoom or a mobile requirement.

The isolated server builds the libraries and host once when necessary and serves
one dedicated bundle to all workers. A SHA-256 fingerprint includes frontend
sources, localization, library manifests, lockfile, TypeScript/Angular build
configuration, build tooling, server implementation and Node version. An unchanged
bundle is reused for subsequent filtered runs. The normal frontend output is
not served, and an existing process on the test port is never reused.

## Checks and review policy

| Tag | Automated evidence |
|---|---|
| `@reader` | Read-only rich content, useful reader width, no horizontal overflow, expanded ancestors, selected material, linked navigation, scroll retention, keyboard tabs, theme persistence and campaign-load recovery. |
| `@editor` | Explicit edit mode, controls and dialog layout/focus, draft retention across tabs, confirmed-save requirement, reload after save, conflict preservation and prevented tab closure. |
| `@gameplay` | Clock and all expedition cards, queue and Arcane Blight layout, readable projections, recovery die gating and retained input across tabs. Game operations are not mocked or applied. |
| `@visual` | Screenshots of reader, editor, Markdown dialog, game tools, Auril arrival card, encounter queue and Arcane Blight in every project. |

Every case checks browser runtime errors, unexpected console errors and unmatched
requests. Only the exact fixture responses deliberately returning 409/503 permit
Chromium's associated resource-error message; application exceptions still fail.
Normal runs compare committed baselines and fail if an image is missing. Intentional
changes require inspection before baseline updates; never accept a new image
solely to turn a failure green. Baselines are platform-specific and use the pinned
Playwright Chromium. New designs and uncovered interactions still need a focused
manual review; unchanged covered behavior does not need a repeated walkthrough.

Run commands and setup are documented in [README](../../README.md#automated-browser-checks).
Examples from the repository root:

```powershell
pnpm --dir src/mastercompanion-web test:ui --grep @editor
pnpm --dir src/mastercompanion-web test:ui --project fullhd-dark --grep @gameplay
pnpm --dir src/mastercompanion-web test:ui:update reader.spec.ts
pnpm --dir src/mastercompanion-web test:ui:server
```

Reports, failure screenshots, traces and JSON timing metadata are written to
`src/mastercompanion-web/.local/`. Successful screenshots are maintained under
`src/mastercompanion-web/e2e/snapshots/`. No backend build, database migration,
container restart or API integration probe is required for this test tooling.

## Verification evidence

- The normal `test:ui` run passed all 32 cases on Windows with the pinned
  Playwright 1.63.0 Chromium, comparing 28 reviewed screenshot baselines.
  The runner reported four workers. JSON start times and durations confirmed
  four overlapping cases, including cases from the same spec file.
- The unchanged-bundle run took 11.64 seconds in Playwright, including its
  server startup and runner overhead; individual case durations totaled
  28.81 seconds. This is an observed local result, not a timing guarantee or
  a measured serial benchmark. Initial build-and-baseline generation took
  28.5 seconds before the two additional game-panel screenshots were added.
- `check:ui` passed with strict TypeScript and unchecked-index access checks.
  It resolves type-only campaign imports through the public contract entry
  point, so it also works before the first library build.
- `check:code` passed, including matching localization catalogs. The server's
  build path also passed the existing module-boundary guard and compiled all
  Angular libraries and the production host.
- Both `test:ui:server` cases passed: build-cache invalidation for sources,
  localization and dependencies; static serving, refused API writes, missing
  assets, malformed URLs and traversal protection.
- A frozen, offline lockfile install passed. Existing dependency resolutions
  were retained; only Playwright and an explicit reference to the already
  resolved Node types were added.
- All baseline images were inspected for the affected layout and controls.
  The test server released port 4310 after completion. Final diff and documented
  commands were reviewed; no application source, database or runtime was changed.

Selection, concurrency and visual comparison follow the official Playwright
[parallelism](https://playwright.dev/docs/test-parallel) and
[visual comparison](https://playwright.dev/docs/test-snapshots) behavior.

Map interaction, party editing, game-operation persistence, backend validation,
contrast measurement and operating systems other than Windows are outside this
initial suite. Existing targeted unit and API checks remain necessary when
changes affect those areas. New platform baselines require a deliberate review;
the suite never silently substitutes Windows images on another platform.
