# Development data and AWS protection scope

4 October 2026 · account/isolation requirements confirmed 7 October 2026

## Current decision

The user confirmed that the application remains in local development and has
not been released to production. The existing campaign has essentially no
personal changes relative to the module. Loss of local campaign data is
acceptable during this stage.

Local database backups, restore rehearsals and before/after preservation
fingerprints are not required for development updates or migrations. Do not add
local backup automation, retention jobs or recovery tooling as current work.
Existing backup files and historical verification records can remain; this
decision does not request their deletion.

Updating module content may overwrite local campaign materials, including
personal notes, without requiring another confirmation or a preceding backup
within the authorized update task. This is permission for development work,
not an implemented automatic refresh mechanism or a requirement to replace
campaign content on every startup.

Authored module sources and reference content remain maintained assets. Ordinary
saves, save-error handling, optimistic concurrency, atomic game operations and
idempotent retries remain application behavior. The development exception does
not remove those rules or justify using the runtime database as a test fixture.

## AWS production stage

Backup and data-protection work belongs to preparation for production on AWS.
Before production use, define and verify database and asset backup coverage,
frequency, retention, protected storage, failure monitoring and a restore
procedure. Establish acceptable data loss and recovery time and test recovery
on an isolated environment. Specific AWS services and settings remain undecided.

Production campaigns must protect authored changes when module content changes.
The local development permission to overwrite notes does not apply to production.
User accounts and isolation of private data are confirmed requirements for the
hosted product. Authentication must be paired with server-enforced campaign
ownership and authorization for reads, writes, search and asset delivery. Design,
implement and verify these boundaries before public or multi-user hosted access;
login alone does not establish isolation. See
[the accounts and isolation plan](47-User-accounts-and-data-isolation.md).
Accounts and isolation are a separate product feature that can be implemented
and verified locally before AWS deployment. The ownership design should accompany
multiple-campaign work. The current local workflow remains without accounts until
that feature is implemented; unrelated local tasks do not acquire a login gate.

Campaign export/import, portable archives and user-facing archive restore remain
removed from the product plan. Operational production backups are a separate
responsibility. Backward compatibility still requires explicit user activation;
production data protection does not enable legacy API or schema support.

This decision supersedes earlier requirements to back up every local update or
preserve all local campaign changes. Historical delivery records describe checks
already performed and do not impose those checks on subsequent development.

## Proportionate development verification

| Area | Current local development | AWS / production |
|---|---|---|
| Backups and recovery | No mandatory dumps, schedules, retention jobs or restore rehearsals. | Define coverage, retention, monitoring and verify restoration. |
| Existing campaign data | Local loss is acceptable; module updates may overwrite notes. No preservation fingerprints or production migration rehearsals per update. | Protect authored content and verify data-changing migrations on representative data. |
| Saves and game operations | Keep validation, visible errors, revisions, transactions and idempotency; use scoped tests. | Continue these correctness guarantees. |
| Developer machine and secrets | Keep loopback binding, safe rendering, secrets outside source/logs and task-scoped operations. | Extend with hosted security. |
| Accounts and hosting | No speculative login, permissions or infrastructure hardening for local tasks. | Required accounts, server-enforced private data isolation and authorization, transport and origin/database protection before public exposure. |
| Verification effort | Relevant tests and focused diff review; reuse passing evidence. No blanket audits or unrelated regressions. | Explicit production acceptance and recovery checks for the release scope. |

Keep working save, validation and rendering protections; removing them would add
work and defects. Review security within the feature being changed rather than
auditing the entire application for every task.

Related: [repository policy](../../AGENTS.md#current-development-data-policy),
[persistence requirement](01-BRD.md#br-17-durable-persistence-and-recovery),
[architecture](06-Module-architecture.md#campaign-persistence-scope-4-october-2026),
[MVP acceptance](11-MVP-acceptance.md).
