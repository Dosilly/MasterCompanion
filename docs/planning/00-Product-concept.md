# Game master companion — product concept

Version 0.3 · 4 October 2026

Product vision and terminology for MasterCompanion. Phase one was accepted by the user on 2 October 2026; its delivered scope and later work are recorded in [MVP acceptance](11-MVP-acceptance.md). The broader vision below includes features outside the accepted MVP. Full offline operation has been removed from the current requirements. These documents describe the product rather than choosing its implementation.

- [BRD — needs, requirements and scope](01-BRD.md)
- [User stories and acceptance criteria](02-User-stories.md)

## Idea

A personal workspace for game masters to prepare campaigns and run sessions. It brings together editable adventure materials, interactive maps, tools tracking game state and a chronicle. The GM can start a campaign from a ready-made module or an empty set and develop it using the same elements.

The core experience: **click a place on the map, see its related materials, run the scene, advance time and resolve reminders, then record new developments in that session's notes**.

The only product user is the game master. MasterCompanion is not a full VTT. Phase one runs locally without cloud hosting; full offline operation is not required. Future hosting, for example on AWS, remains a product direction that should preserve campaign content and the core product model.

## Decisions from the discussion

| Area | Agreed direction |
|---|---|
| User | Only the GM; focus on preparing materials and supporting play. |
| Ready-made modules | Initially prepared by the product owner. Other users creating and sharing modules is a future plan. |
| Custom campaign | An empty starter set is available, provisionally called "Custom campaign". |
| Editing | The GM can change material in their campaign without changing the module or other campaigns. |
| Organization | Arbitrary folders with multiple nesting levels. Chapters are one possible organization. |
| Materials | Free-form text and linked entities, particularly NPCs, locations and factions. |
| Tools | Ready-made module tools and a simple tool creator for the GM. |
| Workflow | Separate preparation and session-running views using shared materials. |
| Time | Days, hours and minutes; a complete world calendar is unnecessary in the first version. |
| Session record | Quick notes kept separately for each session. |
| Chronicle | Manually created events, including events based on note excerpts; their order can be changed. |
| Pilot module | Act 7 materials from the existing Icewind Dale campaign. |
| Persistence | Campaign data stays in the database. Campaign export/import is removed. Local development requires no backups and allows module updates to overwrite campaign notes; production backup and protection work belongs to the AWS stage. See [data policy](21-Development-data-and-AWS-protection.md). |

The detailed behavior and proposed first-version scope in the following documents develop these decisions for review. Not every detail was separately approved in the discussion.

## Product terminology

**Module** is a reusable set containing materials, folder organization, maps, relationships, prepared tools and their initial settings. It can describe an entire adventure or part of one. Chapters are not a required structural element.

**Campaign** is a self-contained GM workspace. It contains starter materials, personal changes and additions, the party, world time, sessions and a chronicle. Two campaigns based on the same module have independent content and state.

**Entity** is an identifiable campaign element, such as an NPC, location or faction. It has a name, type and free-form content; extra fields and templates assist writing rather than impose a mandatory form. An entity can be referenced in text, on a map, in a tool or in a chronicle event.

**Note** does not have to describe an entity. It can be an idea, scene, document, rules description or preparation material. A free-form document remains a first-class campaign element.

**Map** represents a space and contains editable markers leading to materials. The same location can appear on several maps. A location can have its own interior map.

**Tool** has a behavior description and its own state. Examples include a resource counter, discovery checklist, expedition arrival deadline and a curse's progress for each character. A tool template can be reused; current values belong to a specific use.

**Session** records one meeting at the table: preparation, quick notes and a summary. Closing a session does not reset the campaign, clock or tools.

**Chronicle event** describes a fact in the world's history. It can have a time, related entities and a link to the session or note from which it originated. It can also concern a period before play began. The GM's plan does not become a fact merely because time passes.

## Before a session

The GM reads and edits materials, develops the world and story threads, adds maps and markers, and prepares tools. They can review the chronicle and previous session, then pin materials useful for the next meeting.

Preparation should aid orientation rather than impose a scenario. Pinned locations and characters do not restrict access to the rest of the campaign. The first-version proposal is a simple collection of materials and matters to prepare for a session.

## During a session

The GM uses maps, material previews, search and active tools. They advance world time through an explicit action. The application shows due reminders, and the GM resolves rolls and consequences.

Quick notes go into the current session. Campaign material editing remains available: an improvised NPC can immediately receive a note. Switching views does not create material copies.

## After a session

The GM organizes notes, writes a summary and selects facts for the chronicle. They can create an event from a selected note excerpt, refine its description, link characters and locations, and place it on the timeline.

Not every note has to become an event. Counter change history remains separate from the chronicle. The next session receives a new record and inherits the campaign's continuous state.

## Original product vision beyond the accepted MVP

The first version should complete the entire cycle: create a campaign → prepare materials → play a session with maps and tools → organize notes → continue at the next meeting.

It includes module-based and empty campaigns, folders, free-form text, basic entities, links and previews, maps with markers, time, tools, separate session records and a manual chronicle. Simple tools created by the GM include counters, progress lists, deadlines and recurring reminders. More complex tools can be supplied by a module; the initial creator does not have to reproduce arbitrary RPG mechanics.

Outside the first version: player features, collaboration, VTT mechanics, a public module library, user-published modules, hosting, full calendars and universal automation of RPG rules.

## Pilot: act 7 in Ythryn

Existing campaign materials will help evaluate maps, nested notes, entities and time-dependent tools. The pilot will use Ythryn and spire locations, Fenes documents, Arcane Blight, ritual progress and faction arrival deadlines.

These are test materials for the product's generic capabilities. Names, party size, specific DCs and Ythryn rules are not fixed assumptions for other campaigns. Prepared scenes remain plans; the GM must deliberately establish the current state of the played campaign.

The existing HTML is a reference for the user experience. Act 6 remains completed material from the existing campaign and is outside the pilot. This documentation does not commission a rebuild of the previous application.

## Historical handover proposal

Transfer this entire folder to the new project. The concept explains the purpose and terminology, the BRD defines requirements and boundaries, and user stories describe behavior to verify.

The next product step is to review the first-version scope and the main screen flows. Technology, data storage, module mechanisms and future deployment require a separate technical design.
