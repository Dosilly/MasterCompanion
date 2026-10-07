# User stories — game master companion

Version 0.4 · 7 October 2026

Related: [concept](00-Product-concept.md) · [BRD](01-BRD.md)

All stories concern the game master and describe the wider product vision. Phase one was accepted by the user on 2 October 2026; [MVP acceptance](11-MVP-acceptance.md) distinguishes its delivered behavior from later scope. These criteria do not claim implementation or verification of every story. Full offline operation has been removed from current requirements.

## Campaign and materials

### US-01. Starting a campaign from a module

As a GM, I want to start a campaign from a prepared module so that I have a ready-made foundation for my game.

**BRD:** BR-01, BR-02.

**Acceptance criteria:**

- After choosing a module and naming the campaign, I can access its folders, content, maps, relationships and tools.
- A module can supply multiple maps; a campaign created from it includes every
  supplied map with its own image, markers and valid material targets.
- Tools have documented initial values and do not inherit another game's outcomes.
- Changing content or values in this campaign does not change the module or a second campaign created from it.
- I can return to each campaign with its independent state.

### US-02. Starting a custom campaign

As a GM, I want to start without a ready-made adventure so that I can build my own world using the same tools.

**BRD:** BR-01, BR-18.

**Acceptance criteria:**

- I can choose "Custom campaign" without selecting a ready-made module.
- I can create folders, notes, entities, maps, tools and sessions.
- The campaign receives no mandatory Ythryn chapters, characters, rules or names.

### US-03. Folder organization

As a GM, I want to organize materials in nested folders so that their layout fits my campaign.

**BRD:** BR-03.

**Acceptance criteria:**

- I can create a structure such as "Region → City → District → Locations" and a separate story-thread branch.
- I can rename and move a folder with its contents.
- Moving or renaming a note preserves links, markers and event relationships.
- Before deleting linked material, I see the effect on references and can cancel.
- I can delete a material from its context menu or the trash action beside Edit
  in the selected document. Both use destructive red text/icon treatment and an
  accessible name; confirmation identifies the document and protects unsaved work.

### US-04. Free-form text and entities

As a GM, I want to write freely and identify important elements as NPCs, locations or factions so that I preserve my own note-taking style and organized relationships.

**BRD:** BR-04.

**Acceptance criteria:**

- I can create an ordinary note or an entity with a name and short description.
- I can use headings, lists, tables, images and links.
- Extra fields and templates are optional; I can change a template's content layout.
- Campaign materials can be edited during preparation and play.
- In document edit mode, I can change the existing document's title independently
  of headings in its body.
- A confirmed title change appears in navigation, tab labels and search results
  and remains after reload, without changing IDs, links or map-marker targets.
- Invalid titles are rejected; save failures and conflicts keep both title and
  body drafts recoverable. Finishing editing or closing waits for confirmed saving.
- A party character has separate editable backstory and campaign notes in addition
  to its name; changing them preserves other characters and mechanical state.
- Narrative character content remains independent of gameplay undo, with
  recoverable drafts and confirmed saving. Optional profile proposals are recorded
  in [the profile plan](45-Character-profiles.md).

### US-05. Linking and quick previews

As a GM, I want to link materials in text and preview them quickly so that I can check information without losing the current scene.

**BRD:** BR-05.

**Acceptance criteria:**

- An inn description can reference its existing innkeeper and faction.
- A preview shows the referenced entity's current content rather than a separate copy.
- After previewing, I return to my previous position without losing notes.
- I can find the materials that refer to an entity.

### US-06. Campaign search

As a GM, I want to search for a name or text fragment so that I can find material regardless of its folder or session.

**BRD:** BR-06.

**Acceptance criteria:**

- Results include campaign materials, session notes and chronicle events.
- A result identifies the material's type and source, such as a preparation note or chronicle event.
- Opening a result does not change game state or lose current notes.

## Maps

### US-07. Preparing a map

As a GM, I want to add a map and place markers on it so that I can access notes spatially.

**BRD:** BR-07.

**Acceptance criteria:**

- I can add my own map image and use it in the campaign when map authoring is delivered.
- I can manage multiple maps independently; adding or editing one does not
  replace the other maps. The future module editor provides the same capability
  for module sources.
- I can create, name, move and delete a marker and change its relationship.
- A marker can point to an existing location or other material.
- A location can have markers on two maps; removing one does not remove the location or the other marker.

### US-08. Running play from a map

As a GM, I want to open materials from maps and navigate to interior maps so that I can run exploration without repeatedly searching for documents.

**BRD:** BR-07, BR-09.

**Acceptance criteria:**

- I can zoom and pan the map.
- Clicking a marker opens its material; returning preserves map position and zoom.
- Switching between maps retains each map's own position and zoom and preserves
  document drafts.
- A location can lead to its own map with further markers.
- Visiting an interior map and returning does not change time, tools or the current session.

## Session preparation and records

### US-09. Preparing the next meeting

As a GM, I want to prepare a separate future-session record and pin materials so that relevant information is close at hand.

**BRD:** BR-08.

**Acceptance criteria:**

- I can name a session, add preparations and pin existing materials.
- Pinning does not copy the note.
- I can access previous sessions, the chronicle and unresolved reminders.
- During play, I can go beyond the pinned set and change the plan.

### US-10. Quick notes during play

As a GM, I want to record developments in the current session so that I do not interrupt play or mix notes from different meetings.

**BRD:** BR-09, BR-10.

**Acceptance criteria:**

- I can see which session receives a note and link entities in it.
- Quick notes are distinguished from that session's preparation.
- I can add an NPC or change a location during play.
- Opening maps and materials does not remove entered content.

### US-11. Closing and continuing

As a GM, I want to end a session and later start another so that notes stay separate while campaign state remains continuous.

**BRD:** BR-10, BR-17.

**Acceptance criteria:**

- I can add a summary of a completed session and matters for the next meeting.
- A new session has its own notes and does not overwrite the previous one.
- Time, tool states and unresolved reminders carry into further play without resetting.
- Closing and reopening the application preserves this information.

## Time and tools

### US-12. Deliberately advancing time

As a GM, I want to advance world time in days, hours and minutes so that I can represent party activities independently of real time.

**BRD:** BR-11.

**Acceptance criteria:**

- I can add a specified amount of time and see its new value.
- A real hour passing or a new session starting does not advance the game clock.
- I can track elapsed time from a separate event, such as entering Ythryn.
- If a tool distinguishes exploration from rest, I see the activity type and its effect on time.

### US-13. Deadlines to resolve

As a GM, I want to see due reminders with their rules so that I do not overlook time-dependent events.

**BRD:** BR-12.

**Acceptance criteria:**

- At a deadline, I see the matter's name, time, tracking target and behavior description.
- Advancing several periods preserves every due occurrence with a clear overdue count.
- I enter a result or deliberately resolve the matter; the application does not assume a roll outcome or that a scene was played.
- A saved result is not applied again when I reopen the panel.
- Changing the open folder, map or session does not disable an active tool.

### US-14. Independent state for each character

As a GM, I want to assign the same tool to several characters so that I can track their independent results.

**BRD:** BR-04, BR-13.

**Acceptance criteria:**

- I can add characters with custom names and assign a tool to them.
- One character's result does not change the others' results.
- I see each character's current values, status and due matters.
- In the pilot, Arcane Blight tracks infection, results and current DC independently, using the prepared module rules.

### US-15. Creating a simple tool

As a GM, I want to create a counter, checklist, deadline or recurring reminder so that I can track matters not anticipated by the module.

**BRD:** BR-14.

**Acceptance criteria:**

- I select the tool type and define its name, description, scope and appropriate values or deadlines.
- I can add a threshold or link the tool to a rules note.
- Before use, I understand what triggers a change or reminder and what effect follows.
- The tool works in an empty campaign and does not require writing code.

### US-16. Reusing a tool template

As a GM, I want to save a tool's settings as a template so that I can reuse it without copying earlier gameplay results.

**BRD:** BR-14.

**Acceptance criteria:**

- I can create a new tool with independent state from a saved template.
- A new use does not inherit resolved reminders or the old tool's history.
- Editing a template does not silently change an active tool.
- A template I prepared is available in another campaign of mine.

### US-17. Correcting a mistake

As a GM, I want to correct an entry or undo the latest operation so that I do not have to reconstruct game state manually.

**BRD:** BR-13, BR-16.

**Acceptance criteria:**

- I can correct an accidentally entered value and see a record of the correction.
- Undoing the latest time advance removes new reminders caused only by it and restores related values.
- If later resolutions followed a time advance, the application shows dependencies and does not perform a partial undo that leaves contradictory state.
- Operation history remains separate from the narrative chronicle.

## Chronicle and persistence

### US-18. Creating an event from a note or from scratch

As a GM, I want to create chronicle events manually so that I preserve significant facts rather than every working note.

**BRD:** BR-15, BR-16.

**Acceptance criteria:**

- I can create an event from scratch or from a selected note excerpt.
- I can change its title and content, add related entities and optional world time.
- An event created from a note references the source session; the original note remains preserved.
- No scene plan or counter result enters the chronicle without my choice.

### US-19. Organizing world history

As a GM, I want to correct event order and content so that the chronicle reflects established history even when some dates are unknown.

**BRD:** BR-15, BR-16.

**Acceptance criteria:**

- I can add an event before the first session or without an exact time.
- I can change event order; exact times are not silently left inconsistent with the new order.
- An event shows related characters, locations and any source session.
- Correcting chronicle descriptions or order does not advance the game clock or change tool state.

### US-20. Durable campaign persistence

As a game master, I want saved materials and game state to remain available when I return to the campaign. Persistence is delivered in phase one. Campaign export/import and user-facing archive restore were removed from the product plan on 4 October 2026. Full offline operation is not required.

**BRD:** BR-17, BR-18.

**Acceptance criteria:**

- Reopening the application restores saved materials and state; any save problem is visible.
- Failed or conflicting saves preserve my draft and offer an explicit recovery action.
- In production, module and application updates protect my authored campaign content and game state. Current local development permits module updates to overwrite campaign notes and accepts local data loss.

Operational backups and safe recovery belong to the AWS production stage. Local development requires no database backups or restore rehearsals. See [data policy](21-Development-data-and-AWS-protection.md); this work is separate from a campaign archive feature in the GM interface.

### US-21. User accounts and private campaigns

As a GM, I want my own account and private campaigns so that another user's
account cannot read or change my campaign data.

**BRD:** BR-01, BR-19.

**Acceptance criteria:**

- Signed-in accounts see only their authorized campaigns and related resources.
- Another account's direct document/map URLs, search and write requests do not
  disclose private content or change it, even with known IDs.
- Account switching does not reveal earlier cached content or replay pending
  writes under the new identity.
- Access is enforced by the server and verified with separate identities. The
  feature can be developed and tested locally before AWS hosting.

These requirements do not introduce player roles, collaboration or sharing. See
[the future account/isolation plan](47-User-accounts-and-data-isolation.md).

## Proposed product verification order

1. **Materials and map:** US-01–08 — are preparation and information access more convenient than in the existing notes?
2. **Session and time continuity:** US-09–14, US-17 — can the GM run two sessions without losing state or due matters?
3. **Custom components and chronicle:** US-15–16, US-18–19 — are custom campaigns and manual history building useful beyond Ythryn?
4. **Durable persistence:** US-20 — verify normal saves across restarts and recoverable drafts after failed or conflicting saves. Backup and operational recovery verification belongs to AWS production readiness, not current local development. No internet-disconnected scenario is required.
5. **Account isolation:** US-21 — verify separate identities and authorized
   campaign ownership locally before hosted exposure.

This is an order for evaluating product assumptions, not an implementation schedule or estimate.
