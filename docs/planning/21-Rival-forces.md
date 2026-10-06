# Rival force tracking

## Scope and ownership

Ythryn owns the starting forces, confirmed casualty rules, and conversion of surviving cult fanatics to coldlight walkers. Engine time, revision, transaction locking, retry receipts and undo remain owned by the existing gameplay use case. No neutral contract or relational schema change is required.

Starting resources follow the authored sources: Avarice has 20 cult fanatics, two gargoyles, one raven familiar and ten mountain goats; Auril has three frost giant skeletons, six snow golems and six winter wolves. Coldlight walkers start at zero. Counts are available before arrival so the GM can record losses from the caves. Arrival never replenishes troops.

A `recordForceLoss` module command names one unit and a positive integer count. It takes no game time, rejects counts above the remaining force and participates in revision checks, idempotent retries and undo. Unrecognized, extra, duplicate, missing and fractional fields fail validation. Encounter rolls never assume casualties or create reinforcements. The UI displays remaining forces, deaths, and the number of converted cultists separately; failed requests preserve casualty inputs. Controls follow the campaign's pending/conflict restrictions.

Confirming Auril's actual arrival converts every remaining cult fanatic exactly once, zeroes that resource, and adds that number to coldlight walkers and the conversion total in the same snapshot, revision and journal entry as the arrival. This is the user's explicit campaign adaptation: the source's later capture sequence is treated as immediate conversion on confirmation. Previous deaths cannot become walkers. Undo restores the entire prior snapshot, including unconfirmed arrival, original cultists and walker count. Avarice arriving later does not restore cultists.

## Existing state and history

Ythryn module state schema 4 adds the required `forces` object. Historical schema 1/2/3 decoding remains confined to snapshot upgrades and original receipt descriptions. An upgrade preserves characters, party, game time, rest ends, expedition deadlines, queue identities, previous results and actual arrivals. A schema-three campaign receives source counts, with conversion applied if Auril is already confirmed. Earlier unrecorded casualties cannot be inferred and must be entered by the GM; the interface explains this limitation.

GET projects the upgrade without rewriting saved snapshots or advancing revisions. The next accepted operation persists the current schema under the existing campaign lock and transaction. Historical receipts retain their original projection and replay exactly; undo upgrades old snapshots without resetting authored data. No EF migration, database backfill, material overwrite or volume reset is used.

## Verification and delivery

Scoped checks cover source composition, exhausted resources, strict command validation, losses before arrival, conversion after losses, repeat confirmations, walker casualties, snapshot upgrades, persistence, retry, revision conflicts and complete undo. Frontend tests exercise decoding, death calculations and failed/blocked/confirmed saves. The Playwright gameplay spec checks the actual rendered counters, disabled exhausted resources, accessible numeric inputs, focus, overflow and reviewed screenshots in both themes and viewport sizes.

At the time of this feature's delivery, the workflow required a dedicated branch, scoped verification and review, a commit and local merge into `trunk`, then a build from the merged source and local container replacement after a verified database backup. This is a historical delivery record. The current [feature delivery workflow](../../AGENTS.md#feature-delivery-workflow) leaves verified changes on their feature branch and updates the local container from that branch; the user owns merges and remote pushes. Local backups are no longer required under the [development data policy](21-Development-data-and-AWS-protection.md).

Automatic encounter suppression after exhausted forces, creature quantity rolls, individual patrol identities, per-creature hit points and Auril's later pursuit remain outside this feature.

### Completed feature checks

- Backend: 148 gameplay unit cases passed; the final force-specific rerun covers 28 cases. Isolated PostgreSQL verifies four force persistence/upgrade cases plus existing expedition and historical-upgrade coverage. Two dedicated `WebApplicationFactory` HTTP cases verify conversion, replay, complete undo and rejection without writes.
- Frontend: 67 gameplay cases passed, with a final 12-case casualty-owner rerun. The production frontend build and all formatting, lint, typed fixture, E2E type, localization and dependency checks passed.
- Browser: 12 gameplay cases passed against reviewed Windows baselines in light/dark at 1920×1080 and 1536×864, including rendered force counts, actual form submission, exhausted controls and keyboard focus. Existing encounter and Arcane Blight cards remain readable.

### Local delivery — 4 October 2026

Feature commit `997e4c4` was merged from `codex/rival-forces` into `trunk` with merge commit `32c6911`. The merged source produced image `sha256:f0c2294269523052ba405598e4887cbe616e52706f06869c67bc621b71e7c123`; frontend production quality checks, separate library/host compilation and API publication passed. The exact image was pinned as `mastercompanion:rival-forces-32c6911` for application replacement.

The app was stopped with a 30-second graceful shutdown allowance. A custom-format PostgreSQL backup is retained at `.local/rival-forces-before-20261004-32c6911.dump` (154,910 bytes). `pg_restore --file /dev/null` read the complete archive successfully without restoring or modifying the database. Only the application container was recreated; the existing PostgreSQL container and external volume remained unchanged. The application returned to healthy status on the loopback endpoint.

Before/after repeatable-read fingerprints matched across all seven tables: one campaign, ten folders, 106 materials, one map, one game state, 92 operations and three applied migrations. The live game snapshot and revision 92 remained unchanged; the schema-four force projection matched the snapshot's resources. All four read-only deployed-container checks passed. No live material or gameplay write was performed for verification.

Evidence is retained in the ignored `.local/rival-forces-before-fingerprints-20261004.txt`, `.local/rival-forces-after-fingerprints-20261004.txt`, and live before/after projections. The backup is recovery evidence; restoring it would require accounting for subsequent user edits. The original checkout remained on its unrelated navigation branch; feature work and delivery used the isolated worktree.
