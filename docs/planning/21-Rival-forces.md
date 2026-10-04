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

Every new feature now follows the standing workflow in `AGENTS.md`: dedicated branch, scoped verification and review, commit and local merge into `trunk`, then build the merged source and replace the local app container after a verified database backup. Unrelated working changes and the database volume are preserved. Remote pushes and external deployment still require explicit authorization.

Automatic encounter suppression after exhausted forces, creature quantity rolls, individual patrol identities, per-creature hit points and Auril's later pursuit remain outside this feature.

### Completed feature checks

- Backend: 148 gameplay unit cases passed; the final force-specific rerun covers 28 cases. Isolated PostgreSQL verifies four force persistence/upgrade cases plus existing expedition and historical-upgrade coverage. Two dedicated `WebApplicationFactory` HTTP cases verify conversion, replay, complete undo and rejection without writes.
- Frontend: 67 gameplay cases passed, with a final 12-case casualty-owner rerun. The production frontend build and all formatting, lint, typed fixture, E2E type, localization and dependency checks passed.
- Browser: 12 gameplay cases passed against reviewed Windows baselines in light/dark at 1920×1080 and 1536×864, including rendered force counts, actual form submission, exhausted controls and keyboard focus. Existing encounter and Arcane Blight cards remain readable.
