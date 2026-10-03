# Priority slice: encounters and rival arrivals

Decision: 2–3 October 2026. The user moved these tools to the front of the queue
because they are needed to run the current campaign. This extends the accepted
phase-one product without reopening its acceptance.

## Campaign rules

The user simplified arrivals: **Avarice is due after the first shared long rest;
Auril is due at 24 hours from city entry.** This supersedes the glacier-opening
pursuit deadline for these tools. Authored campaign documents retain their
wording; the tool displays the active campaign rule.

| Tool | Trigger and behavior |
|---|---|
| Hourly encounters | One d100 check per accumulated 60 minutes of explicit city exploration. Partial hours carry forward. Ordinary time advances and rests do not add exploration. |
| Building encounters | A thorough search atomically adds 30 minutes of exploration. An unnumbered building adds a separate d100 check; a crossed exploration hour adds its own check. The GM identifies a first search. |
| Avarice arrival | The first engine-owned long-rest end creates a persistent reminder, including existing rest history. Later rests do not move it. The GM confirms actual arrival separately. |
| Auril arrival | The countdown uses confirmed engine time against minute 1440. Disable explicitly if Auril was defeated. Reaching the deadline does not record actual arrival. |

A separate 20% Avarice patrol check accompanies a first building search after
confirmed arrival, including numbered locations. Confirm arrival before recording
affected searches. The GM manages surviving patrols, casualties, creature counts
and narrative outcomes; the tool does not create extra surviving forces.

Checks retain increasing identities and original game minutes. Resolve them in
creation order with an explicit d100 result, 1–100 (100 represents 00). Coincident
hourly, building and patrol checks remain separate. Table replacements depend
on actual confirmed arrival at or before the check minute, not on deadlines.
Confirm a backdated arrival before resolving affected overdue rolls. Previously
confirmed outcomes remain unchanged. The latest result and stable material links
are visible; earlier results remain in the operation journal.

Exploration is bounded to 1–1440 minutes per action and pending checks to 240.
An action exceeding capacity is rejected completely, including its time advance;
resolve older checks and retry. Tools stay active while hidden or closed.

### Visibility and dice refinement — 3 October 2026

Pending encounters, rival arrivals and Arcane Blight checks show a warning icon,
explicit action text and a highlighted card. A summary above the module tools
links to each actionable section, including named character checks.

The oldest encounter check offers a d100 button, immediate outcome preview and a
stable encounter-material link. The GM can reroll repeatedly or adjust the number
manually before saving. Repeated identical outcomes remain rerollable; rolls keep
the table's original probabilities. Previewing never advances time, consumes a
check or writes history. Explicit saving uses the existing operation path;
unsuccessful writes retain the draft. Draft identity includes check ID, kind and
minute so recovery or undo cannot carry it into a different check.

The server projects the oldest check's active table from its confirmation rules.
Avarice replaces 56–60 with cult fanatics only after her actual confirmed arrival
at or before that check. Auril's two replacements and the independent 20% patrol
table follow the same chronology. Confirming an arrival refreshes an existing
preview without changing its selected number. Campaign documents, game schema,
transactions and undo behavior are unchanged.

Refinement evidence: 9 projection tests and 4 component behavior tests passed;
the backend rule run passed 24 Blight and 10 expedition cases, including preview
equivalence across all 100 rolls for ordinary, arrival-replacement and patrol
tables. The full frontend build and code/boundary checks passed. Browser tests
used the compiled module with an isolated in-memory context, exercised previews,
rerolls, material-navigation callbacks, input validation and explicit saving,
and inspected both themes at 1920×1080 without overflow or console errors.
Screenshots are retained in `.local/module-preview/`. Existing persistence rules
were unchanged, so the refinement did not repeat persistence-write probes.

At the user's subsequent request, implementation commit `d9b31f6` was merged
into local `trunk` and its Docker app image was rebuilt. Only the app container
was replaced; the existing PostgreSQL container and volume were retained.
A custom-format backup with a verified archive manifest was saved to
`.local/module-tools-before-20261003.dump`. All 195 database row fingerprints
matched before and after replacement, including documents, revisions and game
history. The app reached healthy status at `http://localhost:4200`; four read-only
container tests passed. A live GET confirmed the new `pendingTable` projection,
and the game view loaded without console errors or campaign writes. Its screenshot
is `.local/module-tools-live-20261003.png`. Remote branches were not pushed, and
uncommitted work in the primary checkout was preserved.

## Ownership and data preservation

Neutral module operations accept an optional bounded `minutes` advance. The
engine validates time and owns transactions, revisions, receipts and undo.
Ythryn validates exact activity duration: `explore` requires 1–1440 minutes,
`searchBuilding` requires 30, and all other commands require zero. One transaction
commits time, module state, revision and history; rejection commits none. Exact
request replay prevents duplicate advances or rolls. Undo restores queues,
results, confirmed arrivals and rest triggers without restoring material content.

Schema 3 adds expedition state beside Arcane Blight. Pure conversion from schemas
1 and 2 preserves party, clock, rests, outcomes and recovery history. Earlier
exploration cannot be inferred from the total clock: tracking starts at zero.
Existing rests and elapsed time expose arrival reminders, without inventing actual
arrivals. GET converts in memory; accepted operations persist conversion.
Historical receipts retain their original projections and outcomes. Invalid state
fails explicitly. No EF table changes, migrations or authored-content replacement
are required.

Building search moves from the generic engine shortcut into the Ythryn tool so
its encounter consequences are explicit. All Ythryn tools share one mounted
component to preserve inputs during reader-tab switching.

## Delivery and verification

Backend rules and frontend controls are implemented. Completed checks:

- 24 existing Arcane Blight rule cases and 9 expedition cases: boundaries,
  coincident checks, table endpoints, arrival chronology, patrol probability,
  queue limits, roster preservation, corruption rejection and existing recovery-state conversion.
- 48 frontend gameplay tests, including expedition projection/action validation,
  bounded activity requests and existing uncertain-request recovery.
- Isolated real PostgreSQL: atomic activities, exact retries, rejection without
  writes, revision conflicts, arrival/roll/rest undo, read-only schema 1/2
  conversion and unchanged historical receipts.
- Loopback HTTP: strict input, ProblemDetails, activity time, retries, rejected
  activities with unchanged state and complete exploration undo.
- Full backend solution and frontend builds; code/localization and dependency
  boundaries are checked by the frontend build.

Browser verification against a separate test campaign covered partial exploration,
coincident hourly/building checks, first-rest and 24-hour reminders, explicit
arrival confirmation, historical table variants, Auril replacements, the separate
patrol chance, roll undo, material links and input retention during tab switching.
The affected tools were inspected at 1920×1080 in both themes, without horizontal
overflow or console errors; keyboard focus reached the exploration action.
Screenshots are retained under the ignored `.local` directory. The final build
was reloaded against the preserved test campaign after the last refinements.

Earlier source wording for Avarice remains in the campaign material; the tool
explains the user-confirmed first-rest schedule.

### Authorized local runtime update — 3 October 2026

At the user's request, the production Docker image was rebuilt and only the app
container was replaced. The existing PostgreSQL container and database volume
were retained. With the app stopped, a custom-format database backup was saved to
the ignored `.local/expedition-before-20261003.dump`; its archive manifest was
verified. All 179 before/after row fingerprints matched, including material
content and revisions, party, clock, module state and operation history.

The replacement container became healthy at `http://localhost:4200`. All four
read-only container integration tests passed. The live gameplay GET exposes
schema 3 while preserving the original revision, time, rests and character
outcomes. A browser check opened all four new tools alongside Arcane Blight with
no console errors. Its screenshot is retained at
`.local/expedition-live-20261003.png`. Verification made no gameplay or material
writes to the user's campaign.

Focused commands:

```powershell
dotnet run --project tests/MasterCompanion.Gameplay.Tests -- --rules
# Use an isolated database named mastercompanion_gameplay_test.
dotnet run --project tests/MasterCompanion.Gameplay.Tests -- --expedition-persistence
dotnet run --project tests/MasterCompanion.Gameplay.Tests -- --http
pnpm --dir src/mastercompanion-web test:gameplay
```

## Deferred scope

Auril's later hourly pursuit, automatic patrol casualty accounting, creature
quantity rolls, location visit records, historical exploration import, editable
encounter tables and a generic reminder creator remain outside this slice.
