# Gameplay implementation plan

1 October 2026

## Delivery order

1. Backend gameplay slice: neutral module contract, pure Ythryn rules, campaign-scoped state and operation journal, revision-protected API, idempotency and sequential undo. Rules/tests and engine persistence can proceed in parallel once the contract is defined.
2. Frontend slice: party setup, engine time controls and shared rest, module-owned Arcane Blight tool, outcome input and undo. Keep tools on demand and preserve reading width. Start after the backend wire contract is verified.
3. Editing completion: insert Markdown and select internal material links, with draft preservation and scoped editor tests. This can proceed independently of gameplay after the first slice.
4. Acceptance: representative PostgreSQL persistence and restart checks, Full HD in both themes, and the complete scenario with networking disconnected. Record actual evidence rather than treating the preparation cache as an offline test.

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
- `POST /api/campaigns/{campaignId}/game/operations` accepts `requestId`, `expectedRevision`, `kind` and only the payload appropriate to that kind. Kinds are `configureParty` (`party` of stable UUIDs and names), `advanceTime` (`minutes`), `longRest`, `module` (`command`) and `undo`.
- Ythryn commands are `resolveCheck` with `characterId`, boolean `success`, and `d6` only for successful infected rest checks, or `healCharacter` with `characterId`. Its projection lists character status, DC, failures and the next check (`kind`, `minute`, `pending`) or null.
- JSON is limited to 64 KiB and depth 16. Unknown/duplicate properties, missing required fields and quoted numeric input are rejected. Party size is 1–20, names are trimmed and at most 100 characters without control characters. An advance is 1–525,600 minutes; total time is capped at 52,560,000 minutes and shared rest history at 10,000 entries. Limits fail explicitly without modifying state.
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

The gameplay frontend, end-to-end browser acceptance, complete offline acceptance and editor completion remain subsequent slices. No frontend build or browser acceptance is claimed for these backend changes. Existing content checks were reused because maintained content/tooling was unchanged during this work.

## Repeat the scoped checks

```powershell
dotnet run --project tests/MasterCompanion.Gameplay.Tests -- --rules
# Set MC_GAMEPLAY_TEST_CONNECTION to an isolated PostgreSQL database named
# mastercompanion_gameplay_test using local environment configuration.
dotnet run --project tests/MasterCompanion.Gameplay.Tests -- --persistence
dotnet run --project tests/MasterCompanion.Gameplay.Tests -- --http
```

Persistence and HTTP runners apply migrations only to the named test database and create fresh test campaigns. Use a disposable database rather than the local campaign database. The next slice implements the engine time view and party setup plus the module-owned Arcane Blight tool using this verified API.
