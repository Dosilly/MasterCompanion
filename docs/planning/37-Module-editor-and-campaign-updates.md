# Module editor and campaign updates

6 October 2026 · future ideas recorded; not scheduled or implemented

## Module editor

Provide an explicit module-authoring mode with a workflow similar to opening a
campaign. Reuse suitable reading, editing and navigation controls, but save changes
to the module itself rather than an instantiated campaign copy. The active mode
and save destination must be clear to the user.

The authoritative editable module should live outside the application repository.
A copy in the repository may serve as a backup, rather than the primary authoring
location. Storage format, location, packaging and version publication remain design
decisions. Moving the existing sources is future implementation work.

Keep authored sources distinct from generated distribution artifacts. Preserve
stable identities, references and supported rich document structures. Reusing the
campaign UI does not make campaign persistence the owner of module source writes;
the authoring workflow needs an explicit save boundary.

The user expects substantial reuse of the existing campaign workflow. Actual
implementation effort should be assessed after the source-storage and save
boundaries are designed.

## Updating a campaign to a newer module version

When a newer version of the campaign's module is available, notify the user and
ask whether to update that campaign. Apply the update only after their explicit
choice; discovering a version does not automatically replace campaign content.

Update only elements that have not been modified in the campaign. An edited note
keeps its campaign version, even when the new module contains a newer source
version of that note. Do not merge the newer module text into the edited note.
Communicate which elements were updated and which were left unchanged because
of campaign edits, identifying the skipped elements clearly.

Implementation needs a reliable way to distinguish unchanged module-derived
elements from campaign edits and campaign-created content. A possible direction
is to retain each element's source identity and the module baseline from which it
was instantiated or last updated. The exact representation and comparison rules
remain undecided; the campaign's overall module version alone is insufficient
when some elements retain older content.

Before implementation, define handling for new and removed elements, renamed or
moved folders, maps/assets and their references, and module gameplay state or
rules. The edited-note requirement is confirmed; those other update semantics
remain open. Discovery and delivery of new versions also need a design and do
not imply loading arbitrary new module code at runtime.

Keep ordinary save revisions, recoverable drafts, transactions and safe retries.
Recheck update eligibility when applying an update so a concurrent edit cannot
be overwritten based on an earlier comparison.

## Scope and relation to current policy

These are future product requirements, not authorization to implement the editor,
move module sources, publish versions or update the current campaign now. They
add no local backup infrastructure or backward-compatibility requirement.

The current local-development permission to overwrite campaign materials during
authorized development updates remains in effect. The future user-facing update
workflow described here must deliberately preserve edited elements.

Related: [engine and module ownership](06-Module-architecture.md),
[development data policy](21-Development-data-and-AWS-protection.md), and
[roadmap](15-Near-term-improvements.md).
