# BRD — game master companion

Version 0.4 · 7 October 2026

Related: [product concept](00-Product-concept.md) · [user stories](02-User-stories.md)

## 1. Document purpose and status

This BRD describes the wider product vision, expected outcomes and business requirements, not a claim that every listed capability belongs to the MVP. Phase one was accepted by the user on 2 October 2026; [MVP acceptance](11-MVP-acceptance.md) defines its delivered scope and later work. Full offline operation has been removed from current requirements. On 4 October 2026, the user removed campaign export/import and archive-based state transfer from the product plan. Normal persistence and visible save failures remain required. Local development requires no database backups and allows module updates to overwrite campaign notes; production data protection belongs to the AWS stage. See [data policy](21-Development-data-and-AWS-protection.md).

## 2. Problem

The GM needs preparation materials and fast access to information during play. Extensive notes make orientation difficult. Maps are separate from location descriptions, tools from rules, and session notes from world history. Tracking time and effects across multiple sessions requires remembering many independent matters.

The existing Icewind Dale chapter HTML demonstrated the value of maps opening notes and tools reacting to time. The next product should let the GM add and change content, maps, markers and simple tools across different campaigns.

## 3. Goals and success assessment

| Goal | How to evaluate it in the pilot |
|---|---|
| Reduce information lookup at the table. | From the Ythryn map, the GM opens a location description and a related NPC, then returns to the same map position. |
| Allow adaptation of a ready-made adventure. | A location edit and a personal story thread are visible in that campaign; a new campaign from the same module retains the original. |
| Support building a custom campaign. | Without a ready-made module, the GM creates folders, entities, a map and a custom tool. |
| Reduce the GM's memory burden. | After several deadlines pass, the application shows every due matter, including unresolved ones from an earlier session. |
| Preserve a readable campaign record. | Two sessions have separate notes; selected facts enter the chronicle with source links. |
| Preserve continuity of campaign work. | Saved materials and game state remain available after closing and reopening the local application. |

These are qualitative criteria for the initial pilot. Quantitative usability and speed targets should follow an actual session-running trial rather than be assumed without observation.

## 4. User and responsibility

The only product actor is the **game master**. They prepare the campaign, run sessions, change materials and resolve events in the world.

The product owner initially supplies modules. This is a content preparation process, not an extra role requiring accounts, an administration panel or permissions in the first version.

## 5. Product principles

- The GM retains control over events, rolls and consequences.
- Preparation and play use the same materials and shared campaign state.
- Free-form text works on its own; structure and templates assist it.
- Modules, campaigns and current tool state have distinct meanings.
- Changing a folder or name should not break material relationships.
- World time is independent of real time and the number of sessions.
- Plans, working notes and established history are not automatically treated as the same thing.
- Saved campaign materials and game state remain durable across application restarts.

## 6. Functional requirements — wider product scope

### BR-01. Starting and isolating campaigns

The GM creates a campaign from an available module or an empty set. It receives its own name, materials and initial state. Changes do not modify the module or other campaigns. Multiple campaigns can be run and revisited with their preserved state.

### BR-02. A module as a reusable set

A module includes content, folders, maps, markers, relationships and prepared tools. It can organize materials into chapters, but the product does not impose that structure. A new campaign does not inherit session history or gameplay outcomes from another campaign. The product owner's module preparation process needs separate design.

A module must support multiple maps, each with its own stable ID, image and
markers. Campaign creation includes all maps supplied by the module. Module
authoring must manage these maps individually rather than replace a single map.

### BR-03. Folders

The GM creates, names and moves folders and materials in a multilevel hierarchy. Depth is not limited to chapters and subchapters. An entity can be referenced in several places without separate copies. Material deletion should show its effect on existing links and allow cancellation; the precise recovery process for deleted content remains undecided.

Material deletion must be available from the context menu and beside Edit for
the selected open document. Both actions use a trash icon and destructive red
treatment, with accessible labels and explicit confirmation. Unsaved drafts and
linked references require deliberate handling; see [the deletion plan](46-Material-deletion.md).

### BR-04. Free-form content and basic entities

The GM creates ordinary notes and NPC, location and faction entities. Content supports at least headings, paragraphs, lists, tables, images and links. Templates and extra fields are optional. A new entity can begin with just a name and short description. Party character data allows tools to be assigned to characters; it is not a full character sheet for a particular RPG system.

Editing an existing document must allow changing its title as well as its body.
The title is separate metadata, not a heading in the body. Confirmed title changes
appear in navigation, tabs and search, and persist after reload. Renaming preserves
stable IDs, links and map targets. Validation, revision conflicts and recoverable
drafts apply to title changes as they do to body changes. Campaign editing changes
only the campaign copy; module authoring saves to the module explicitly.

Party characters must have editable backstory and campaign notes in addition to
their names. These narrative fields are independent of module mechanics and game
undo. Player name, description, goals, relationships and portraits are optional
proposals pending scope selection; see [character profiles](45-Character-profiles.md).

### BR-05. Links and previews

The GM links entities and notes in free-form text. They can preview related material and return to their work without losing unsaved notes. Renaming or moving materials preserves relationships. A list of materials referencing an entity is a proposed addition.

### BR-06. Search

The GM searches campaign materials by name and content, including previous session notes and chronicle events. Results identify material type and location to distinguish a scene plan from a played-event record.

### BR-07. Maps and markers

The GM adds a map image, creates, moves, describes and deletes markers, and links them to materials. Clicking a marker shows related content while allowing continued map access. The map supports zooming and panning. Returning from a note or interior map preserves orientation on the parent map. One location can appear on several maps without duplicated descriptions. Deleting a marker does not delete the location.

### BR-08. Session preparation

The GM creates a future session record, adds preparation notes and pins relevant materials. They can access the chronicle, previous sessions and unresolved matters. The pinned set is a shortcut rather than a mandatory scene list. Its use is optional.

### BR-09. Running a session

The GM starts or resumes a session. The play view provides maps, materials, search, time, tools and quick notes. Editing and material creation remain available. Changing views or the open location does not reset game state.

### BR-10. Separate session records

Each session has its own name and notes. Quick notes are separate from preparations and the later summary but belong to the same session record. Creating another session does not overwrite the previous one. Ending a session preserves active tools, time and due reminders.

### BR-11. World time

The main campaign clock uses days, hours and minutes. The GM deliberately advances it; opening the application, writing notes or taking a break between meetings does not cause time to pass. Separate counters can track elapsed time from a specified event, such as entering Ythryn.

Tools can react to total elapsed time or a specified activity, such as exploration or the end of a rest. The activity type must be visible to the GM. How to add these activity types needs clarification when designing tool interaction.

### BR-12. Reminders and resolutions

Crossing a deadline or threshold shows a matter to resolve with a description and rules link. Large time advances do not lose earlier or recurring deadlines. The GM sees how many matters remain due. Each resolution is saved only once.

The application does not assume a roll outcome or that a scene was played. Simple, explicitly configured value changes can be automatic; actions affecting the story require the GM's decision. Hiding a panel or changing chapters does not disable an active tool. Stopping it is a separate action.

### BR-13. Tool state and scope

A tool can concern the campaign, a location, a faction or a particular character. Character tools store independent results for each party member. A behavior description is available beside the values. The GM can correct state and undo the latest mistake with its related effects. Undoing time must not leave a hidden contradiction between the clock, values and resolved reminders.

### BR-14. Simple tool creator

The GM creates a counter, progress list, deadline or recurring reminder. They set its name, description, tracking target, initial values and appropriate thresholds or times. They can link it to rules material. The creator explains which events the tool reacts to and what effects follow.

Configuration can be reused as a template. A new use has independent values; changing a template does not silently modify active tools. Complex module mechanics such as Arcane Blight do not define the required flexibility of the initial creator.

### BR-15. Chronicle

The GM manually creates events, including from note excerpts. An event contains a title, free-form description, optional world time, entity links and an optional source session or note reference. The original note remains available.

Events can precede the first session or have no known date. The GM can correct their order. Where exact times are supplied, their relationship to manual ordering must be clear; moving an event into a conflicting position should require deliberate time correction or removal of exact dating. Grouping undated events needs further design.

### BR-16. Plans, tool history and facts

A scene plan does not automatically appear as a played event. Tool operation history is available separately from the chronicle. The GM deliberately chooses what to preserve as campaign history. Editing a chronicle event does not automatically reverse time or previous tool resolutions.

### BR-17. Durable persistence and recovery

Normal saves persist in the database across application restarts, and save failures remain visible with recoverable drafts. During current local development, backups and restore verification are not required, local data loss is acceptable, and module updates may overwrite campaign notes. Backup coverage, retention, recovery and protection of authored production data belong to the AWS production stage and must be designed and verified before production use. Campaign export/import, portable archives and user-facing archive restore remain removed from the product plan. Full offline operation is not a current requirement. User accounts and private data isolation are required for hosted use and need separate design before deployment. See [data policy](21-Development-data-and-AWS-protection.md).

### BR-18. Independence from Ythryn and future hosting

Folders, material types, maps and simple tools are useful in an empty campaign without Icewind Dale rules. The pilot supplies specific content. A future hosted version should preserve migrated campaign content, relationships, state and the GM's core workflow. This requirement does not determine the current technology, cloud or synchronization model.

### BR-19. User accounts and private data isolation

The product must support user accounts with explicit campaign ownership. Each
account can access only its authorized campaigns and their documents, maps/assets,
party profiles, sessions, search results and game state. The server must enforce
access for every read and write, including direct resource URLs and referenced
IDs. Authentication alone and UI filtering are insufficient.

Design ownership alongside multiple campaigns. Implement and test accounts and
isolation locally as a separate feature before hosted access; AWS is not a
technical dependency. Sharing and collaborative roles require separate decisions.
See [the account/isolation plan](47-User-accounts-and-data-isolation.md).

## 7. Pilot scope and acceptance scenario

The pilot draws on existing act 7 materials, the current map and HTML tool behavior. Available rules and campaign decisions take precedence over inventing new ones. Source materials remain preserved; pilot preparation does not change act 6.

1. Create two campaigns from the act 7 module and check that their materials and tools remain independent.
2. Edit a location in the first campaign, add an NPC and link it from text and a map marker.
3. Prepare a session, then open Y4 from the map and navigate to related materials.
4. Advance time, trigger due checks and resolve the curse independently for several characters. Large advances preserve checks.
5. Record a development in a quick note, create a chronicle event from it after the session and correct its position.
6. Close and reopen the application, begin the next session and confirm preserved state and separate session notes when those later-scope features are delivered.
7. Create an empty campaign with a custom map and tool; confirm independence from Ythryn names and rules.
8. For AWS production readiness, verify operational recovery on an isolated database copy, preserving materials, images, relationships, time, tools and history supported by the delivered scope. This is not a current local-development acceptance gate.

This is a future product validation plan, not a report of tests already performed.

## 8. Outside the first version and development opportunities

- Player accounts, player view, co-GM support and collaborative editing.
- A tactical VTT board, token control and combat automation.
- A public library, sales and user sharing of modules.
- A universal arbitrary-rule creator and full character sheets for multiple systems.
- Hosting, device synchronization and collaborative edit-conflict resolution.
- Full world calendars, astronomical dates and automatic real-time tracking.
- AI-generated chronicles, world development or scene resolutions.
- Automatic merging of module updates into edited campaign materials.
- Universal Obsidian vault import and external note synchronization. Using selected act 7 materials does not promise support for every vault.

## 9. Product risks and decisions for later refinement

| Risk | Mitigation direction |
|---|---|
| Forms impede quickly recording an idea. | A name and free-form content suffice; templates and extra fields are optional. |
| The tool creator becomes a separate programming language. | Start with four simple types; modules prepare complex cases. |
| A large time advance overwhelms the GM with notifications. | Clearly group overdue matters while preserving occurrence counts and times; evaluate interaction in the pilot. |
| Pilot materials become a rigid structure for the whole product. | Validate an empty campaign and tools with different names and values. |
| The chronicle confuses plans with history. | Manual event recording, source notes and separate tool history. |
| A module update overwrites authored production changes. | Protect authored campaign changes before production use. Current local development explicitly permits module updates to overwrite notes; production update handling belongs to the AWS stage. |

Experience design still needs detailed entity fields, map-adjacent material previews, undated event handling, exact creator capabilities, multiple sequential undo, deleted-content recovery and the product owner's module delivery process.
