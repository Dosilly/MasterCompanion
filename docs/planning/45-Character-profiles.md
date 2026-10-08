# Character catalog and profiles

9 October 2026 · implemented on `codex/character-profiles`; local runtime delivery follows verification

## Delivered behavior

The campaign now owns a catalog of player characters and NPCs. Both types have a
stable identity, name, independent rich backstory and campaign notes, and an
explicit In the party choice. New player characters default to membership; choosing
NPC defaults to outside the party. Either type can join deliberately. Only current
members appear in module gameplay tools; type alone does not determine membership.
An explicit membership choice, including the saved choice of an existing profile,
survives type changes. Type selection supplies defaults only for new profiles whose
membership has not been chosen explicitly.

The Characters workspace replaces the former roster-only screen at `/party`.
A compact searchable list offers All, Player characters, NPC and Party filters.
Selecting a character opens their readable profile alongside the list. Character
details edit name, type and membership; Backstory and Campaign notes use the existing
rich-document editor with explicit editing, autosave, failure/conflict recovery and
save-before-close. Switching profiles, sections or workspace views retains the same
mounted editor, draft, selection, undo history and reading position.

The current limits are 1,000 catalog entries and 20 party members. Narrative fields
are optional. The first slice does not add a separate player-account directory,
portraits, system-specific character sheets, custom fields or permanent profile
deletion. Optional player name, description, goals and relationship fields remain
future scope rather than required profile fields.

## Ownership and atomic changes

`CampaignCharacter` belongs to the generic engine and stores the character type,
last confirmed name and two campaign-owned material references. `GameCharacter`
remains the neutral ID/name projection supplied to module rules; NPC identity and
catalog storage do not enter concrete module implementations.

`updateCharacter` is an explicit engine operation using the existing game revision,
request receipt and campaign lock. One gameplay transaction creates or updates the
catalog entry, instantiates missing documents, reconciles the selected party,
updates module state and records the immutable receipt. Existing members retain
their IDs and mechanical state on rename or type changes. Catalog reads expose the
same game revision; editing requires a current catalog/game pair. Metadata errors,
conflicts and uncertain acknowledgements retain the draft and use deliberate
cancellation or exact request retry.

The game snapshot owns current membership and active roster names. The transaction
synchronizes catalog names from the confirmed roster, including after undo. Catalog
creation and type/inactive metadata are retained; gameplay undo restores the previous
roster, names and module state, without deleting profile documents or catalog entries.
An undone creation therefore leaves an outside-party profile available for reuse.

Leaving the party retains all authored narrative. Deliberately rejoining the same
catalog identity initializes module-owned state at the current game time, following
the existing party reconciliation rule. Undoing a removal restores its previous
mechanical state instead. Catalog identities can be reused after absence without
creating a second profile or new copies of their documents.

Narrative saves use ordinary material revisions independently of game time, game
revision and operation undo. Document titles remain independent material metadata;
embedded profile content omits the redundant title and deletion control. The same
material view can move into the standalone reader without making a second editor
or draft owner. Closing the catalog flushes every owned open document, including
edits made while another save is pending, and refuses unconfirmed closure.

The additive `CharacterCatalog` migration instantiates profiles/documents for the
existing active roster as player characters. Earlier removed identities can be
instantiated when gameplay undo restores them. Profile materials participate in
ordinary campaign navigation, search and links. Foreign keys and reference-aware
material deletion protect required backstory/notes even outside the profile view.

## Verification

- 13 isolated HTTP/PostgreSQL cases cover NPC exclusion, either type joining,
  removal/undo retention, independent narrative saving, rename identity, exact
  receipts, concurrent writers, invalid metadata, migration, capacity and campaign
  scoping. Three existing party persistence cases pass with catalog-aware cleanup.
- Eleven typed frontend cases cover defaults, explicit membership, validation,
  duplicate/unsupported catalog entries, delayed reads and refresh failures.
  Existing gameplay session, autosave, material editor and deletion cases verify the
  reused persistence/recovery owners.
- Scoped browser cases cover catalog creation, filters, module-tool exclusion,
  independent editors, failed saves, serialized parent closure and readable profiles
  in both themes at Full HD and the smaller desktop viewport. The shared standalone
  and session editor destinations are included in the affected checks.
- Full HD profile composition was reviewed in light/dark with representative prose.
  Visual references intentionally replace the sidebar label Party with Characters;
  reviewed differences contain that label on existing screens. Older folder/search
  references also now capture the existing document deletion action; it remains
  available outside the protected embedded profile destination.

The solution build, C# formatting verification, model/snapshot check, frontend
quality and production compilation pass. The final scoped browser run passes all
28 cases: 20 character checks and eight shared-editor checks. Thirty-six intentional
visual/title checks pass; the later normal snapshot comparison run passes all its
visual/title checks with updates disabled. Local-runtime results follow below after
delivery. No merge into `trunk`, remote push or hosted release is authorized by this
feature.

Related: [architecture](06-Module-architecture.md),
[roadmap](15-Near-term-improvements.md),
[local runtime](10-Docker-local-runtime.md).
