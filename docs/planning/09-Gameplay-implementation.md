# Gameplay implementation plan

Delivery history: 1–2 October 2026

**Status:** phase one accepted by the user on 2 October 2026. Full offline
operation is no longer required; no additional application testing was requested
for closure. See [the acceptance record](11-MVP-acceptance.md) for the final scope,
evidence and later work. The sections below preserve the delivery sequence and
checks actually performed.

## Delivery order

1. Backend gameplay slice: neutral module contract, pure Ythryn rules, campaign-scoped state and operation journal, revision-protected API, idempotency and sequential undo. Rules/tests and engine persistence can proceed in parallel once the contract is defined.
2. Frontend slice: party setup, engine time controls and shared rest, module-owned Arcane Blight tool, outcome input and undo. Keep tools on demand and preserve reading width. Start after the backend wire contract is verified.
3. Editing completion: insert Markdown and select internal material links, with draft preservation and scoped editor tests. This can proceed independently of gameplay after the first slice.
4. Acceptance: representative PostgreSQL persistence and restart checks, Full HD in both themes, and user review. Existing implementation evidence and the user's successful test report close this step. The original internet-disconnected scenario was removed from the requirements on 2 October.

The existing content reorganization remains intact (106 materials, 10 folders, 29 map markers). Review its current diff separately; do not replace campaign materials as part of gameplay implementation. No publish, push or deployment is part of this work.

## First slice contract and ownership

`ICampaignGameRules` lives in backend contracts and has no persistence or HTTP dependency. The engine owns time in elapsed minutes, party identity, shared rest ends, revisions and history. A module initializes, validates, transforms and describes its versioned JSON state. Ythryn alone interprets Arcane Blight. No module receives a DbContext or imports engine code.

Each accepted operation stores the entire snapshot before and after, its request identity and confirmed response, in the same transaction as the current state. Undo restores the most recent active operation's before snapshot and advances the current revision; it never restores material documents. A campaign row lock serializes dependent operations, including the first state insertion. Expected revisions reject stale requests. Reusing an operation ID with the same request returns its original receipt; different input is a conflict. An undo also has its own idempotent receipt. No write is retried blindly.

Initialization is explicit party setup. Reading a campaign with no game state returns an unconfigured state without writing. Party setup is allowed only before gameplay, and can be undone in sequence. A shared rest advances time by 480 minutes and records its end; an ordinary time advance records no rest.

## Acceptance for the first slice

- Rule boundaries: exactly 12 hours, multiple overdue exposures, infection dated at the exposure deadline, overdue rest after infection, independent characters, successful rest d6 from 1 through 6, DC zero immunity, third rest failure transformation, healing without immunity.
- Input boundaries and stored state validation: unsupported schemas, malformed commands, identifiers, party limits and inconsistent states must be rejected rather than repaired silently.
- Real PostgreSQL: atomic state/history writes, stale revision rejection, duplicate request handling, concurrent requests, sequential undo and a fresh context reading the saved result. Test campaigns and databases must be isolated from the user's local campaign.
- Build affected backend consumers; inspect ownership and code/localization checks. No browser evidence is claimed for a backend-only slice.

## API and supported bounds

- `GET /api/campaigns/{campaignId}/game` returns `revision`, `snapshot`, the module's `moduleView`, and `lastOperation` for sequential undo. Unconfigured reads do not insert a row.
- `POST /api/campaigns/{campaignId}/game/operations` accepts `requestId`, `expectedRevision`, `kind` and only the payload appropriate to that kind. Kinds are `configureParty` (initial nonempty `party` of stable UUIDs and names), `updateParty` (editable `party`, including an empty roster), `advanceTime` (`minutes`), `shortRest`, `longRest`, `module` (`command`) and `undo`.
- Ythryn commands are `resolveCheck` with `characterId`, boolean `success`, and `d6` only for successful infected rest checks, or `healCharacter` with `characterId`. Its projection lists character status, DC, failures and the next check (`kind`, `minute`, `pending`) or null.
- JSON is limited to 64 KiB and depth 16. Unknown/duplicate properties, missing required fields and quoted numeric input are rejected. Initial party size is 1–20; roster updates allow 0–20. Names are trimmed and at most 100 characters without control characters. An advance is 1–525,600 minutes; total time is capped at 52,560,000 minutes and shared long-rest history at 10,000 entries. Limits fail explicitly without modifying state.
- Recovery rests must finish strictly after infection, so a rest ending at the exact infection minute is excluded. Exposure is always resolved at its original deadline; magic healing starts a new exposure interval at current engine time.
- A replay returns the original confirmed receipt, even after later operations or undo; a frontend recovering an uncertain request must then read current state. Reusing its ID with different input gives `game_request_conflict`. New requests with an old revision give `game_revision_conflict`. Neither conflict overwrites state.

## First slice delivered and verified

The backend slice is implemented, including API registration, pure module rules, bounded request parsing, corruption rejection, state/history persistence, revision protection, idempotent receipts and sequential undo. A new additive `CampaignGameplay` EF migration creates only `engine.GameStates` and `engine.GameOperations`; prior migrations remain unchanged. The snapshot matches the model. Engine EF Core Relational is explicitly pinned to 10.0.12 so consumers do not resolve the provider's older minimum through a private design-time dependency.

Verification on 1 October:

- All 16 pure-rule cases passed.
- Real PostgreSQL 18.6 in a disposable isolated test container passed state/history atomicity, concurrent first insertion and updates, simultaneous identical retries, original receipt replay, sequential undo, character/campaign isolation, rejected input with no writes, corrupt receipt/current revision rejection, cancellation while waiting on a campaign lock and same-request retry after cancellation. A deferred journal trigger failed commit and confirmed complete rollback.
- Real loopback HTTP endpoint tests passed strict JSON shape/required fields/duplicate fields/depth/numeric types, content type 415, both known-length and chunked oversized requests 413, stable ProblemDetails, valid configuration/time/read, stale revision 409 and missing campaign 404.
- PostgreSQL container restart preserved identical hashes of all test states, journal rows and authored test material contents/revisions.
- Full backend solution build passed without warnings or errors. The final affected backend and verification project also built without warnings or errors. Code/localization and dependency-boundary checks passed; EF reported no pending model changes.

Tests use fresh contexts and a database named `mastercompanion_gameplay_test`. The user's campaign, PostgreSQL volume and running application were not migrated, replaced or restarted during this slice. A cached image and existing package dependencies were used. Sandbox access to NuGet/Aspire settings required running restore/full solution build with elevated sandbox permissions; this was an environment restriction, not a code failure.

At backend delivery, frontend, browser acceptance and editor completion were still pending. The following frontend delivery records subsequent evidence. The then-planned offline acceptance was later removed from the requirements. Existing content checks were reused because maintained content/tooling was unchanged during this work.

## Repeat the scoped checks

```powershell
dotnet test tests/MasterCompanion.Gameplay.Tests.Unit
# Start Docker; Testcontainers creates isolated PostgreSQL databases automatically.
dotnet test tests/MasterCompanion.Gameplay.Tests.Integration --filter FullyQualifiedName~PersistenceTests
dotnet test tests/MasterCompanion.Gameplay.Tests.Integration --filter FullyQualifiedName~HttpTests
```

Persistence and HTTP tests apply migrations only to fresh Testcontainers databases.
HTTP tests use the actual API through WebApplicationFactory. See
[test organization](18-Test-organization.md) for the current infrastructure lifecycle.

## Frontend and editor delivery — 1 October 2026

The engine now offers a game tab with explicit party setup, a visible elapsed clock, bounded custom advances and shortcuts, shared long rest, refresh and confirmation before sequential undo. It mounts the game view and lazily loads registered tools when requested, preserving mounted view state across tab switching. Arrow keys, Home and End select and focus tabs; active tabs and panels have explicit accessible relationships. The reader retains its full main area when the game tab is inactive.

Ythryn registers its own Arcane Blight tool. It validates the module projection, displays named characters, statuses, DCs, failures and future or pending deadlines, and records explicit independent outcomes. Successful rest checks require a selected d6 result; failures and exposure checks omit d6. Magical healing is available only for infected characters. Die selections belong to a specific character and check deadline, so successful recovery retries cannot carry a previous die into the next check.

The neutral frontend contract and engine session coordinate writes independently of notes. Exact request IDs and bodies are retained in tab session storage before POST and recovered across page reload. Pending or uncertain operations block other writes. Explicit retries replay the same request, then read current state after its original receipt. Conflicts require refresh; malformed or regressing responses never replace confirmed state. Storage failures preserve recovery, and component destruction cancels I/O without clearing a pending request. Session storage is scoped to a browser tab; it is not a backup after deleting browser data or closing the tab.

The material editor now provides Markdown insertion and a searchable material-link selector at the captured selection. Insertion requires explicit edit mode, retains cancelled or rejected Markdown, escapes raw HTML, rejects external links/images and unknown campaign references, and uses the existing schema and material save path. Runtime Markdown parsing uses pinned `markdown-it` 15.0.2; declarations are pinned separately. Existing rich content is preserved.

Verification:

- 30 gameplay frontend tests passed: 22 session/response tests and 8 module projection/command/check-input tests. They cover exact recovery payloads, caller mutation, original receipts followed by current reads, conflict blocking, storage failures, invalid input/responses and cancellation including response-before-destruction races.
- 6 editor insertion tests and 14 affected autosave/editor lifecycle tests passed. They cover selection replacement, preserved rich blocks, stable material links, safe rejection without mutation, explicit edit gating, revision serialization, save failures and undo.
- Full frontend build (contracts, engine, Ythryn and host), dependency-boundary and code/localization checks passed. Final scoped engine compilation also passed after response and localization refinements. Backend behavior was unchanged, so prior PostgreSQL/API evidence was reused.
- Browser verification against real loopback API and isolated PostgreSQL covered two-character setup, 10 hours followed by 8-hour rest, independent exposure results, infection with the overdue rest check, d6 reduction from DC 15 to 9, sequential undo, and material edits remaining saved through game undo and API restart. Markdown headings, bold text and a table persisted; the selected internal link navigated to its target. Unsafe Markdown was rejected, and cancelled text was retained.
- A second browser view produced a real revision conflict, disabled writes until explicit refresh and then displayed current time. Stopping the test API produced an uncertain operation; after page reload and API restart, explicit recovery advanced time once from 18 h 10 min to 18 h 20 min. No user campaign was used for these writes.
- The affected views were inspected at 1920×1080 in both themes, including game cards, keyboard tab switching and modal insertion. Game input survived closing and reopening its tab. No horizontal page overflow or console errors were observed in the final fresh view. The existing Angular warning for the large map image remains; deliberate conflict/disconnection probes produce their expected network errors.

Repeat the focused frontend checks:

```powershell
pnpm --dir src/mastercompanion-web test:gameplay
pnpm --dir src/mastercompanion-web test:editor
pnpm --dir src/mastercompanion-web test:autosave
pnpm --dir src/mastercompanion-web build
```

## Acceptance closure — 2 October 2026

The gameplay and editor slices are implemented and accepted by the user, who reported successful testing of the application. Full offline operation was removed from the current requirements, so the unperformed internet-disconnected scenario no longer blocks acceptance. No additional application tests were run for closure. General module authoring and recovery across deleted browser storage remain outside this slice. Party changes and the final Arcane Blight schedule are covered by the following delivery records. See [the phase-one acceptance record](11-MVP-acceptance.md).

## Party and time-control design revision — 1 October 2026

The campaign party is a generic engine resource, accessible in its own tab. An
explicit editor supports renaming, adding and removing characters after setup.
Stable retained IDs preserve all module state. Additions use current game time;
removals and their previous state remain recoverable through sequential undo.
The roster may become empty without resetting elapsed time or rest history.
Registered content modules also receive generic party/time behavior when they
provide no adventure gameplay rules; unfamiliar saved state remains an error.

The game controls are building search (30 minutes), short rest (60 minutes),
long rest (480 minutes), and a bounded custom advance. At this delivery stage,
only long rest created recovery checks; the following Arcane Blight revision adds
periodic recovery. Undo is an accessible arrow beside refresh and retains its
confirmation dialog. A single registered tool renders directly without a
redundant selector button; modules with multiple tools retain selection.

Party drafts stay mounted through tab changes and closing/reopening the tab.
Editing captures a revision; a changed revision blocks submission until explicit
confirmation against refreshed state. Failed requests preserve the draft and
use the existing exact-request recovery path. Draft cancellation is explicit,
and leaving the page with unsaved edits triggers the browser guard.

Verification for this revision:

- 19 pure-rule cases and isolated real PostgreSQL/HTTP tests passed. New cases
  cover infected-character rename/reorder, join-time deadlines, last-member
  removal with retained clock/rest history, complete sequential undo, original
  edit receipts, strict invalid payload rejection, edit/time revision races,
  commit-failure rollback and neutral module state-corruption refusal.
- 36 focused frontend tests passed, including party draft identity/isolation,
  validation and stale revision handling, empty-roster decoding, exact party
  request recovery after reload and short-rest receipts.
- Affected backend/API, test-project and final full solution builds passed
  without warnings or errors. Full frontend and Docker image builds passed, including code and
  localization policy and dependency-boundary checks.
- Browser checks used a separate UI database: party setup/edit, preserved drafts
  through closing/reopening the tab, search then short rest (0 → 30 → 90 minutes),
  infection retained on rename, new exposure scheduled at join time +720,
  top undo restoring the prior roster, and a real two-window conflict retaining
  the draft until explicit refresh/confirmation/save. Game and party views were
  inspected at 1920×1080 in both themes; keyboard tab selection/focus worked,
  without horizontal overflow or observed console errors.
- The updated application container is healthy at `http://localhost:4200`.
  Its four read-only runtime checks passed. A private backup was captured before
  replacement; before/after hashes confirm unchanged campaign metadata, all
  material contents/revisions, folders, maps, game snapshot and journal. The
  existing five-character party and time were retained. No migration was needed.

The PostgreSQL service and its existing volume were not replaced. Runtime
verification made no game or material writes to the user's campaign.

## Arcane Blight countdown and recovery revision — 2 October 2026

The user confirmed a new recovery schedule: healthy characters continue exposure
checks every 720 minutes; infected characters recover every 720 minutes or at
the end of a long rest, whichever comes first. Each recovery starts the next
720-minute interval. A rest at the exact timer deadline creates one rest check,
not two results. An earlier overdue timer is resolved before a later rest.
Successful recovery reduces DC by the supplied d6; failures accumulate toward
the existing three-failure transformation. Terminal statuses remain inactive.

Character cards display minutes remaining against confirmed engine time rather
than an absolute elapsed deadline. Pending checks clamp to zero. Absolute
deadlines remain the identity used for result and die recovery, so changing only
the countdown does not reuse a die for a different check.

The localized rules link opens the campaign copy of `Efekty magiczne` at the
stable `Tajemna zaraza` heading through the neutral navigation contract. A tool
hint explains the newly confirmed schedule. Existing authored campaign text is
not overwritten; its original rest-only wording predates this rule change.

Module state version 2 adds the explicit recovery timeline. The module validates
and upgrades supported version 1 snapshots without replacing IDs, statuses,
DCs, failures or confirmed outcomes. Reads upgrade in memory; the next accepted
operation persists the supported state together with revision and history.
Original version 1 receipts retain their original projection and remain
replayable. Undo and roster edits preserve the supported timeline. Unknown or
inconsistent state still fails explicitly.

Verification:

- 24 pure-rule cases passed, including 12-hour boundaries, rest reset, overdue
  chronology, coincident event deduplication, terminal outcomes and pure legacy
  conversion. Real PostgreSQL and HTTP tests passed for periodic receipts,
  revision/idempotency, undo, unchanged historical receipts, read-only upgrades
  and rejection of upgrades that alter engine-owned data (including mutation).
- 12 focused frontend tests passed for countdowns, projection schemas, recovery
  outcomes and die identity. Full frontend, backend solution, final affected API
  and Docker builds passed; localization and dependency-boundary checks passed.
- Browser checks against a separate UI database at 1920×1080 in both themes
  confirmed 12 h → 11 h, the rules link selecting its material and scrolling to
  the heading, independent healthy exposure, infected long-rest recovery, reset
  to 12 h, no result at the replaced deadline, periodic outcomes and undo.
  No console errors or horizontal overflow were observed.
- The refreshed production app is healthy at localhost:4200. Its four read-only
  runtime checks passed after startup readiness. A private backup and all-row
  fingerprints confirmed unchanged persisted campaign/material/folder/map data,
  game snapshot and journal across replacement. Current reads expose schema 2
  without changing the user's stored version 1 snapshot or its revision. No game
  outcomes or authored materials were written during live verification.
