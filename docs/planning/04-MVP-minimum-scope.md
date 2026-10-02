# MVP minimum scope — first week

Version 0.7 · 2 October 2026 · phase one accepted

**Goal:** a useful local view for running all Ythryn content available in the POC, with interactive map, readable notes, required editing, time and Arcane Blight. User budget: seven days at about 3 hours with the agent, around 21 hours total. Verify and document startup on Windows. Keep the chosen stack portable; separate acceptance on other systems is outside this week.

**Status:** phase one is complete. The user reported successful testing and accepted the MVP on 2 October 2026. Full offline operation was removed from the requirements and is no longer an acceptance gate. The [acceptance record](11-MVP-acceptance.md) separates delivered scope, existing evidence and later work. Delivery details remain in [implementation status](07-Implementation-status.md), [gameplay delivery](09-Gameplay-implementation.md) and [architecture](06-Module-architecture.md). The seven-day budget below is historical planning, not actual elapsed effort or a new schedule.

## 1. First-version boundary

Build the generic MasterCompanion engine and a module contract. Modules supply content, folder hierarchy, maps, configuration and their own mechanics. Ythryn is the first implementation; its name in scope and scenarios denotes pilot material rather than a restriction on generic engine features. Campaigns own their material copies and game state.

The first version opens one local Ythryn campaign prepared from the supplied reference. Original conversion accounting covers all 16 documents, 142 act 7 sections and the map's 29 markers. After navigation reorganization, maintained defaults contain 106 materials in 10 folders: navigation-only indexes were removed and sections of five Fenes documents consolidated without losing content or anchors. This includes spire rooms, encounters, factions and supplemental GM materials. Trial location Y4 verifies conversion/editor behavior rather than limits the final scope. Act 6 remains outside the pilot.

The GM reads, navigates, explicitly edits existing descriptions and operates time and Arcane Blight. Data and personal changes survive restart. The campaign begins on city entry at time zero with healthy characters. No new separate notes now; personal comments can be added to existing materials. Long rest is shared by the party, while each character's rolls are resolved separately.

One campaign is an interface limitation in this version. Data still identifies campaigns, materials and assets. Ythryn names and Arcane Blight rules belong to the prepared module rather than the generic reader.

Accounts, users, login, roles and permissions belong to a future stage. The current application runs locally on localhost for the GM. Design the hosted access model before cloud deployment.

Export/import and state transfer are explicitly deferred. Do not build their screens or archive format. Automatic POC-based campaign preparation is module delivery rather than a user import feature. Restart must not overwrite personal changes with starter data.

## 2. Main view

- Left navigation presents the module's nested material structure and simple search. Activating a tab opens its folders, focuses the visibly selected material and centers it within panel scroll limits. Organization follows transferred content; a folder-tree editor can follow later.
- Main space holds a wide document and open-material tabs. Ordinary text clicks are for reading. Internal links open or activate the target material's tab.
- Close tabs with × or middle click. Pending changes must be saved; errors keep the tab and text open. The header button reopens a closed map.
- Light/dark themes cover the reader and tools. The browser remembers the choice; without an explicit choice, follow system preference.
- The map opens on demand in the same area. It retains zoom/pan; prepared markers lead to descriptions. Returning to a tab preserves reading position.
- On-demand party and game tabs provide roster editing, elapsed time, advances and Arcane Blight. A single registered tool renders directly. Countdown values use confirmed engine time; the rules link opens the campaign material at its stable heading. These tools preserve the reader's useful width when inactive.
- "Edit" starts Tiptap for the whole material. The recommended small toolbar covers headings, bold, italic, lists and internal links. Existing tables/highlights are preserved; cell editing does not require a rich table creator. Autosave shows save status; "Finish editing" returns to reading after confirmed saving.

Design for Full HD on one monitor. Main-view appearance and ergonomics take priority over more administration screens.

## 3. Minimum and additions

| Area | Accepted phase-one scope | Later scope |
|---|---|---|
| Runtime | Docker Compose serves the production frontend and API with private PostgreSQL and a persistent volume; Aspire remains the development runtime. Windows instructions are in README. | Installer, packaging for nontechnical users, macOS/Linux acceptance. |
| Campaign | One automatically prepared Ythryn campaign. | Multiple-campaign list, empty campaign creator and module selection. |
| Materials | Complete Ythryn from the POC; currently 106 materials in 10 folders, map and relationships. Historical conversion covered 16 documents and 142 sections; prepared navigation, name filtering, wide reader, tabs and internal links. | Full-text search, richer filters, references panel, type/template management. |
| Editing | Tiptap, existing-document editing, autosave and a small toolbar. Tables, images, highlights and collapsible sections survive saves without content loss. | New separate notes, richer menus, custom block creation/configuration, advanced table toolbar, regular source editing and full document-version history. |
| Content insertion | Supported HTML paste, explicit bounded Markdown insertion and a searchable campaign-material link selector. | Whole-page/vault/file imports and arbitrary external attachments. |
| Images | Transferred local pilot assets rendered in the editor; the full map at original resolution. | Asset manager and richer image uploads. |
| Map | Prepared Ythryn map with 29 markers, zoom, pan and description opening. | Creating/moving markers, new map uploads and an interior-map editor. |
| Time | Building search (30 minutes), short rest (60 minutes), shared long rest (480 minutes), custom advance and retained due checks. | Selected-character rests, calendar, activity editor and location clocks. |
| Arcane Blight | Independent character states, explicit outcomes/d6, healing and sequential undo. Exposure every 12 hours; infected recovery every 12 hours or after long rest, which resets the timer. | Other mechanics, generic counter/reminder creator and rule-parameter editing UI. |
| Party | Setup plus renaming, adding and removing characters during play; stable IDs, retained module state and sequential undo. | Rich NPC/material associations. |
| State transfer | No export/import; ordinary local saving remains required. | Complete campaign export/import, archives, updates with pre-import backup, independent copies and branch merging. |
| Preview | Links switch tabs while preserving context. | A separate "Preview" action with a wide window. |
| Sessions and chronicle | Ordinary editable material can hold working notes. | Separate session records, pinned materials, chronicle and events from text. |
| Access and cloud | Local process for the GM, without accounts/login. | Accounts, access protection, AWS hosting and possible synchronization. |

The user explicitly deferred export/import and new notes and confirmed shared rest. Editing and Arcane Blight are required this week. Limiting extra editor menus, marker management and separate previews is the recommended way to fit the budget; keep those features in the product backlog.

## 4. Technical foundation with limited scope

Retain Angular, ASP.NET Core, Aspire, PostgreSQL / EF Core, Tiptap and vertical slices. Backend is one application; each module mechanic does not need a separate process.

The implementation stores campaign materials as versioned Tiptap/ProseMirror JSON in PostgreSQL, with folders, maps and asset references. Separate game state stores neutral time, party and rest history plus module-owned JSON; operation receipts and snapshots provide retry and undo. There are no user tables or placeholder permissions. The authoritative wire contract and limits are in [gameplay delivery](09-Gameplay-implementation.md#api-and-supported-bounds).

Each slice contains its endpoint, contract, validation and EF Core persistence. The following names preserve the original use-case outline; they are not literal route names:

```text
Materials/GetMaterial
Materials/SaveMaterial
Maps/GetMap
Assets/GetAsset
```

Navigation receives material names and IDs. Currently 106 materials are reachable in 10 folders. Y1–Y29 and Y19 rooms are directly in one locations folder; Fenes has five complete documents in her character folder. Former consolidated-material IDs remain heading anchors. Historical 142 sections do not mean 142 separate materials now. Markers open specific descriptions rather than scroll through one enormous location collection. Tabs open on demand rather than all at once. The execution plan describes the model and recommended endpoints.

Delivered gameplay covers the following original use cases, plus party updates and short rest:

```text
Party/ConfigureParty
Game/GetState
Time/AdvanceTime
Time/EndRest
Modules/Ythryn/ArcaneBlight/ResolveCheck
Modules/Ythryn/ArcaneBlight/HealCharacter
Operations/UndoLastOperation
```

Mechanic rules remain in C#. JS sources and existing tests assist transfer/verification without copying restrictions to five specific character names. Authoritative rules are not duplicated across backend/frontend.

Document autosave uses expected revision. Time/roll operations have identities for safe retries and persist with related effects transactionally. Undo covers game state and due matters without restoring prior document content.

Derive due rolls from character state, time and rests, as in the reference. Infection after overdue exposure can reveal an earlier completed rest to resolve. No separate real-time event process is needed. State/history persist; derived deadlines survive restart.

Initial module persistence applies only to unprepared campaigns. Never unconditionally update every material on startup. The database uses a durable volume; UI "Saved" means backend-confirmed persistence. Errors must not remove unsaved text from an open tab.

Assets use local IDs independent of physical paths; the API serves content. A concrete S3 adapter is future scope. Application code, fonts and required assets ship locally.

## 5. Using the reference

- A pilot preparation script extracts all content and the map. Do not manually retype 142 sections. Conversion accounts for 16 documents, 142 sections and 29 markers without dropping supplements after location transfer.
- Preserve readable organization/tables and map old IDs to new materials/sections. Verify marker-to-description navigation, especially the spire and rooms.
- Existing campaign supplements remain in appropriate groups. Tool defaults represent entry into Ythryn, without current-game results.
- Do not transfer Obsidian source buttons. Link available content internally; bibliographic references can stay as text. Account for needed rule gaps explicitly and fill them before declaring the pilot playable.
- Counter sources/tests reference approved Arcane Blight rules. Other trackers do not automatically enter minimum scope.

## 6. Seven days — proposed budget allocation

Historical budget only. The original day-seven offline scenario has been removed from the current requirements. The phase-one outcome is recorded in [MVP acceptance](11-MVP-acceptance.md).

These slots preserve the original 21-hour user/agent allocation, not a verified estimate or current schedule. Conversion's 16/142 counts are historical; current navigation has 106 materials in 10 folders. Days 1–4 cover the main view and limited editing, days 5–6 required tools, and day 7 acceptance, fixes and instructions. Editing and Arcane Blight belong to first-week acceptance. Rule tests and the risky conversion trial begin before final acceptance rather than all waiting until day 7. [Gameplay delivery](09-Gameplay-implementation.md) documents the delivery order.

| Day | Goal within a three-hour slot | Checkpoint |
|---|---|---|
| 1 | Start Aspire, Angular, API and database; small conversion/Tiptap trial with Y4 and a table fragment. | Does the stack work, and does content preserve formatting and JSON persistence? Adjust the plan before mass conversion if not. |
| 2 | Script transferring all Ythryn content, assets and IDs; wide reader and prepared navigation. | Does the report cover 16 documents and 142 sections, and are long descriptions readable? |
| 3 | Map with 29 markers, zoom/pan, tabs, internal links and retained position. | Do location selection, spire-room access and return preserve orientation? |
| 4 | Limited editor, autosave and basic paste; verify saves after restart. | Can a note be edited without losing tables/highlights, and does startup preserve changes? |
| 5 | C# time, shared rest and Arcane Blight with rule tests. | Are due checks independent per character and effects ordered correctly? |
| 6 | Complete mechanic view, simple undo and persistence. | Do large advances preserve overdue matters, retries avoid duplicates and undo restore coherent state? |
| 7 | Local acceptance, content/readability review, fixes and Windows instructions. | Closed by the user's acceptance on 2 October using existing delivery evidence; full offline operation is no longer required. |

Day 7 reserves 3 hours for review/fixes without guaranteeing enough contingency. Main uncertainties are lossless rich-content conversion, editor integration and dependent mechanic resolutions. Reassess after day 1. Address delay by limiting additions or agreeing a date; do not remove Ythryn content, lose material or silently defer previously required Arcane Blight.

## 7. Minimum acceptance

Accepted on 2 October 2026 based on the user's successful application testing and existing implementation evidence. The criteria below describe the accepted behavior; they do not request another test run.

1. Start locally on Windows. Historical migration accounts for 16 documents, 142 sections and 29 markers; maintained defaults now contain 106 materials in 10 folders. All available Ythryn text is reachable, including consolidated Fenes sections. No marker targets missing material. Review includes Y19 rooms, tables and supplements.
2. Open Y4 from the map, read a long description, switch materials and return to the previous position. Map zoom/pan is retained. Every source reference is accounted for; no apparently working links target absent content.
3. Enter editing, change content and confirm preservation after restart. Readability and existing document elements remain intact. Reader clicks do not open editing. Save failures are visible and preserve tab text.
4. Module defaults do not overwrite campaign edits on restart. Full offline operation and internet-disconnected acceptance are removed from this scope.

Required time and Arcane Blight acceptance:

5. Exposure and recovery remain independent for each character. Infected recovery is due every 12 hours or after long rest, which resets the timer; coincident deadlines create one check. Large advances retain overdue checks, and retries do not apply an outcome twice. Explicit d6, immunity, three-failure transformation and magical healing are included.
6. Sequential undo restores complete game operations and time without reverting notes. Persisted game state and history survive restart.

Export/import is outside this version's acceptance. Conversion/link tests protect content completeness; mechanic tests cover rules/dependencies. Verify readability, navigation, saving and failure handling in the real view rather than tests mirroring component layouts.

## 8. Latest answers and next step

30 September update: maintained module sources are separate Markdown files with metadata and separate manifests, hierarchy, maps and assets. Combined JSON is a build artifact. A better visual editor, including future module-source editing, stays outside the minimum; section 7 of [the execution plan](05-MVP-execution-plan.md) provides details. Campaign-copy editing and Arcane Blight remain required.

1. The user required Arcane Blight and editing in week one.
2. Editing existing materials is sufficient; new separate notes are later scope.
3. Shared party long rest is sufficient; mechanic results remain individual.

No reconfirmation of these decisions is needed. [The execution plan](05-MVP-execution-plan.md) preserves the full scope and original budget allocation.

Closure update, 2 October: frontend gameplay, party editing and the remaining Markdown/link insertion features are delivered. The final recovery schedule is recorded in [gameplay delivery](09-Gameplay-implementation.md). Full offline operation was removed, and the user accepted phase one. There are no remaining tasks in this phase; later scope is listed in [MVP acceptance](11-MVP-acceptance.md).
