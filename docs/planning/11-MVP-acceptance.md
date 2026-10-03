# Phase one — MVP acceptance

2 October 2026

## Decision and evidence

Phase one is complete and the MVP is accepted. The user reported that they tested
the application and everything works correctly, then explicitly requested closing
the phase and updating the documentation. This is user acceptance of the delivered
application, alongside the implementation evidence already recorded below; it is
not a new automated test report.

The user removed full offline operation from the current requirements and asked
for no further application testing for this closure. Internet-disconnected
acceptance was not performed and is no longer a pending gate. Local operation,
confirmed persistence, data protection and recovery after request failures remain
part of the accepted scope. Reintroducing an offline requirement needs a new user
decision; it is not scheduled as follow-up work.

This closure updates documentation and repository instructions only. It does not
publish a release or enable backward compatibility requirements. The current
[compatibility policy](../../AGENTS.md#compatibility-policy) remains in force until
the user explicitly changes it after release.

## Accepted scope

| Area | Delivered behavior | Existing evidence |
|---|---|---|
| Campaign materials | One local Ythryn campaign; maintained defaults contain 106 materials in 10 folders, including Y19 rooms and consolidated Fenes documents. Campaign edits remain authoritative. | [Content and persistence records](07-Implementation-status.md) |
| Reading and navigation | Wide reader, nested folders, name filtering, internal links, tabs and retained reading position; light and dark themes. | [Implementation records](07-Implementation-status.md) |
| Map | Local map with 29 markers opening their materials; retained pan and zoom. | [Content and browser records](07-Implementation-status.md) |
| Editing | Explicit edit mode, formatting, Markdown and material-link insertion, autosave with revision protection, preserved drafts on failures and conflicts. | [Editor delivery](09-Gameplay-implementation.md#frontend-and-editor-delivery--1-october-2026) |
| Party and time | Editable party with stable IDs, elapsed game time, building search (30 minutes), short rest (1 hour), long rest (8 hours) and custom advances. | [Party delivery](09-Gameplay-implementation.md#party-and-time-control-design-revision--1-october-2026) |
| Arcane Blight | Independent exposure and recovery outcomes, explicit d6, healing, immunity and transformation; countdowns and a rules link. Infected recovery occurs every 12 hours or after long rest, which resets the timer. | [Rules revision](09-Gameplay-implementation.md#arcane-blight-countdown-and-recovery-revision--2-october-2026) |
| Game persistence and undo | Atomic state/history writes, idempotent request receipts, optimistic concurrency and sequential undo independent of material saves. | [Gameplay verification](09-Gameplay-implementation.md) |
| Local runtime | Windows instructions, production frontend/API in Docker Compose, private PostgreSQL with a persistent volume and loopback application access; Aspire for development. | [Runtime delivery](10-Docker-local-runtime.md), [run instructions](../../README.md#run-with-docker) |

The linked records retain the checks actually run during implementation, including
isolated real PostgreSQL and HTTP tests, editor/gameplay tests, builds and browser
inspection at Full HD in both themes. Those results were reused for closure;
no application tests, builds, restarts or database writes were added.

## Later scope and known limitations

Subsequent priority decision: the user selected encounter and rival-arrival tools
as the next slice on 2–3 October. See [its plan](12-Encounters-and-arrivals.md).
This does not change the historical phase-one acceptance scope.

The following items remain outside phase one, without a newly assigned schedule:

- Multiple-campaign selection, empty campaign creation, new separate notes and
  folder editing.
- Full-text search, backlinks, richer editing and document version history.
- Map/marker authoring, uploads and asset management.
- Visual module authoring and deliberate application of module content updates
  to campaign copies with protection of authored changes.
- Campaign export/import, archives and portable restore.
- Session records, chronicle, additional module mechanics and a generic tool
  creator.
- Accounts, access control, cloud hosting and synchronization.

Known limits retained from delivery: the existing large-map-image performance
warning; pending game request recovery is scoped to browser-tab session storage;
the authored Arcane Blight material can retain the original rest-only wording,
while the tool explains the confirmed 12-hour/long-rest schedule. These are
recorded limits, not newly promised phase-one work. Existing campaign text is
not overwritten during closure.

There are no remaining phase-one tasks under the accepted scope. Future work
requires selection of the next scope rather than reopening historical delivery
steps or the removed offline gate.
