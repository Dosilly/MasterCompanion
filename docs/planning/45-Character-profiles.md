# Character profiles and party workspace

7 October 2026 · user-requested future work; not implemented or scheduled

## Confirmed requirements

Each party character must be more than a name. The user requested separately
editable backstory and campaign notes. The current neutral `GameCharacter` contract
contains only ID and name, and the party view lists names or edits roster membership.
Character profiles are therefore a new capability, not a delivered feature.

Backstory describes the character before and outside the campaign. Campaign notes
hold developments and the GM's observations during play. Both should support the
existing rich-document schema, material links, explicit edit mode and confirmed
saving with recoverable drafts. Neither field is mandatory to create a character.

## Optional field proposals

These suggestions are not yet user-confirmed requirements:

- Player name, kept distinct from the character name.
- A short description for appearance, personality or the character's role.
- Goals and open threads to support session preparation.
- Relationships with existing NPCs, factions, places or other characters, using
  stable references and shared documents rather than copied descriptions.
- A portrait as later asset work, after image/asset authoring is available.

Keep the initial profile small: name, optional player/description, backstory and
notes. Add goals/relationships deliberately if they improve actual preparation.
Avoid a system-specific character sheet, mandatory class/race/level/stat fields
or arbitrary field-builder infrastructure in this slice.

## Proposed workspace

Keep the roster as a compact list with Add beside its heading. Selecting a member
opens a readable profile in the main area, with name and optional player/description
followed by Backstory and Notes tabs. Edit belongs beside the selected content;
roster membership actions remain distinct from narrative editing.

Existing module mechanics may show a compact read-only status and a link to the
owning tool. The profile must not duplicate rule calculations or embed Ythryn
conditions in the engine. Missing narrative content uses small actionable empty
states rather than a long blank form.

## Ownership and unresolved decisions

The engine owns campaign character profiles and stable links to party member IDs.
Module rules continue owning their mechanical state through neutral contracts.
Narrative saves must not advance game time or gameplay revision, enter gameplay
undo or be reverted by undoing a roster operation.

Prefer reusing campaign-owned materials and their editor/save infrastructure for
backstory and notes; decide the profile metadata and material references before
implementation. Reuse must not create competing name or draft owners. Define how
character renaming updates the roster and gameplay presentation without changing
identity. Resolve that explicit boundary with the existing party operation first.

Define what happens to a profile when a member leaves the party, returns or is
removed through undo. Prefer retaining authored narrative content with deliberate
unlinking rather than deleting it with a roster change. Final archive/removal
semantics and concurrency need a reviewed contract before implementation.

## Planned acceptance

- Two characters have independent backstory and notes; editing one preserves the
  other's content and module state.
- Confirmed profile edits survive reload; errors/conflicts retain recoverable
  drafts and prevent unconfirmed close.
- Switching characters or views retains drafts and reading/editor state.
- Narrative saves and gameplay undo remain independent. Roster removal/return
  follows the chosen explicit profile-retention contract.
- Optional fields remain optional, and the view stays readable and keyboard usable
  at Full HD in both themes.

These are planned criteria, not test evidence. Related:
[architecture](06-Module-architecture.md),
[recommended sequence](15-Near-term-improvements.md#recommended-development-order).
