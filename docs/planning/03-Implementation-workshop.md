# Implementation plan — design workshop

Historical workshop, version 0.20 · closure note: 2 October 2026

**Current status:** phase one is complete and was accepted by the user on 2 October 2026 after their successful application testing. The [MVP acceptance record](11-MVP-acceptance.md) defines the final scope, existing evidence and later work. Full offline operation was removed from current requirements. Backward compatibility remains unnecessary until the user explicitly enables it after release, as defined in [repository instructions](../../AGENTS.md#compatibility-policy).

The workshop below preserves earlier questions, answers, proposals and decisions as history. Its offline commitments (including D-02 and the earlier acceptance proposal), unfinished-task language and initial budgets are not current requirements or pending work. Use [the minimum scope](04-MVP-minimum-scope.md), [implementation status](07-Implementation-status.md), [gameplay delivery](09-Gameplay-implementation.md) and [MVP acceptance](11-MVP-acceptance.md) for the current state. The broader BRD and stories include later product scope.

**Scope update, 4 October 2026:** the user removed campaign export/import,
portable archives and archive-based state transfer from the product plan and
backlog. Earlier transfer decisions, proposed export/import slices and delivery
stage 5 below are superseded historical records, not future work. Campaign data
remains in the database. Local development requires no backups or preservation
probes, and module updates may overwrite campaign notes under [data policy](21-Development-data-and-AWS-protection.md).
Production backups and authored-data protection belong to the AWS stage.
Possible future user accounts and hosted access need
separate design. Module source preparation and bounded editor content insertion
are separate capabilities and are unaffected by this decision.

Sources: [product concept](00-Product-concept.md), [BRD](01-BRD.md), [user stories](02-User-stories.md).

## 1. Starting point

The documents establish this product direction:

- A personal GM workspace for preparing, running and organizing sessions.
- Full offline operation in the first version; hosting is a future direction.
- Shared materials and campaign state in preparation and play views.
- Independent campaigns created from a module or from scratch.
- Free-form text, entities, folders and links; maps as an access point to materials.
- Note readability is the main interface criterion; tracking tools are secondary. Content and configuration default to read mode.
- GM-controlled time advances, persistent tools and deliberately resolved reminders.
- Separate session notes, tool operation history and a manually maintained chronicle.
- An act 7 Ythryn pilot without making generic features depend on that content.

The BRD and user stories propose detailed scope. Their presence in the documents does not mean that every solution was separately approved.

## 2. Main consequences for technical design

These points interpret requirements rather than select technology:

| Area | Problem to solve | Source |
|---|---|---|
| Material identity | Relationships must survive renaming and moving folders. | BR-03, BR-05; US-03, US-05 |
| Editor | Free-form text, tables, images, entity links and previews without losing entered content. | BR-04, BR-05; US-04, US-05 |
| Modules and campaigns | Separate starter materials, personal changes and game state; isolate subsequent campaigns. | BR-01, BR-02; US-01, US-02 |
| Map and navigation | Preserve map position and material context when navigating. | BR-07; US-07, US-08 |
| Time and tools | Preserve every due occurrence and prevent resolutions being applied twice. | BR-11–14; US-12–17 |
| Operation undo | Coherently restore clock, reminders and values, including later resolutions. | BR-13; US-17 |
| Persistence | Save content and files, show save failures, create complete backups and restore safely. | BR-17; US-20 |
| Future hosting | Preserve portability of content, relationships and state; code-sharing scope remains open. | BR-18 |

## 3. Round one — user answers

1. **Platform:** a browser interface is preferred, available locally and suitable for future cloud migration. The local backend was accepted after round two. Supported systems and browsers still need to be agreed.
2. **Development and maintenance:** the user is responsible. Familiar technologies are .NET, Angular, Python to a lesser extent, Docker and AWS. This informs recommendations rather than automatically approving every technology for the product.
3. **Hosting:** the current priority is offline development without hosting costs. The architecture should accommodate future AWS, but this stage does not include cloud deployment.

## 4. Proposed order of further discussions

This is a design agenda rather than an implementation sequence.

1. Platforms, constraints, selection criteria and comparison of suitable options.
2. The first useful stage: what must work to run a real session, available time and priorities.
3. Main views and workflow: map, material, preview, quick notes and tools.
4. Content model: documents and entities, editor format, fields, folders, links, search and deletion.
5. Local data: saving, images, backups, restore, application updates and data migrations.
6. Modules: product-owner preparation, delivery format and campaign initialization.
7. Time and tools: activities, deadlines, overdue matters, character tools, corrections and undo.
8. Sessions and chronicle: session states, event sources, unknown dates and manual order.
9. Verifiable implementation stages, dependencies and acceptance criteria linked to user stories.

## 5. Materials for refining the pilot

The user supplied the folder `Inspiracja - obecna aplikacja` (removed from the repository; preserved in Git history), containing standalone HTML and readable JS, CSS and test sources. Navigation, maps, tools and content embedded in the HTML were reviewed. All 17 existing tests passed. The files `app.js`, `tracker-core.js` and `tracker-ui.js` matched the code embedded in the HTML.

The snapshot includes 224 content sections, 25 documents and two embedded maps; the Ythryn map has 29 markers. Act 7 remains the pilot material. The spire code links to rooms; this does not imply that the existing application has a generic nested-interior-map model.

Review used file reads and tests. Interactive preview was not verified: the tool browser blocked the `file://` protocol.

The snapshot provides inspiration and scenarios. The BRD and stories define the new product's direction. The HTML does not contain the GM's current counter state. Round five established that the pilot starts at entry into Ythryn without migrating the existing game's state. Section 15's Arcane Blight rules were accepted; other rules and custom module changes still need review.

## 6. Decision register

| ID | Accepted direction | Rationale and boundaries |
|---|---|---|
| D-01 | Browser interface. | User preference; the local backend was also accepted after round two. |
| D-02 | The first stage runs locally and offline, without hosting. | The user wants to focus on product development without cloud costs. |
| D-03 | AWS as a future deployment direction. | Design should support this direction; services and deployment timing remain open. |
| D-04 | Local .NET backend and local database. | The user accepted operation through localhost; D-08 selects the database engine. |
| D-05 | Use Aspire. | The user proposed it to simplify starting everything; the AppHost model and end-user package still need design. |
| D-06 | Manual export/import between computers — superseded. | Originally accepted for working on different computers and deferred in round fifteen. Removed from the product plan on 4 October 2026. |
| D-07 | Initial users: the owner and a few GM friends. | The owner can assist installation. Technical configuration on first launch is acceptable. |
| D-08 | PostgreSQL + EF Core. | The user accepted this proposal in round three. |
| D-09 | Visual content editor. | The user chose rich-text writing. The library, storage format and linking details still need selection. |
| D-10 | First useful stage: map and time-tracking tools. | User priority; D-12 refines Arcane Blight. Other BRD requirements remain planned. |
| D-11 | Backend vertical slices. | Explicit user request. Detailed use-case and shared-code organization below is a proposal. |
| D-12 | Arcane Blight is the minimum required module mechanic in stage one. | Round sixteen reconfirmed its first-week requirement. It belongs to the Ythryn module, not a mandatory empty-campaign tool or generic creator feature. Hunger curse was not identified as required minimum scope. |
| D-13 | Time advances immediately by the full requested duration. | The application preserves due matters and shows them after the advance. It does not stop the clock automatically at the first deadline. |
| D-14 | Shared workspace during play, preserving context. | The initial dominant-map/narrow-side-description idea was rejected in round six. D-20 defines the current priority and layout; one screen does not require every panel to be permanently visible. |
| D-15 | Preserve the HTML's Arcane Blight rules in the pilot. | Repeated healthy-character exposure every 12 hours was also confirmed; the source identifies it as the GM's custom proposal. |
| D-16 | Pilot starts on entry into Ythryn with module initial state. | No requirement to migrate the existing campaign's current save. Previous gameplay results are not transferred. |
| D-17 | Target screen: at least Full HD, usually a 26-inch monitor. | Layout targets one monitor. Effective application space still depends on system and browser scaling. |
| D-18 | Complex module mechanics developed in code and released with the application. | C# rules and Angular views were accepted. A new mechanic type may require an application update; content and parameters of existing types can be supplied in module packages. |
| D-19 | Selected mechanic parameters editable in the campaign after explicitly entering edit mode. | The user accepted a limited set, such as interval and initial DC. Ordinary value clicks do not open forms. Applying parameter changes to existing state requires design. |
| D-20 | Note readability is paramount; tracking tools are supplementary. | Location descriptions can be long. Main content needs wide space and comfortable scrolling. Round seven selected option B: map on demand. |
| D-21 | Option B: wide document and on-demand map. | The map opens in the main area; selecting a location leads to its material. Simplifying the sketch's map evaluated layout, not removal of markers or map controls from scope. |
| D-22 | Material tabs inside the application. | The user accepted keeping several materials open with each tab's reading position preserved. D-23 sets linking and preview behavior. |
| D-23 | A link opens or activates a tab; preview is a separate action. | Reopening material reuses its tab. An explicit "Preview" action opens a wide preview without automatic hover opening. |
| D-24 | Automatic content saving during explicit editing. | Visible save status; ending editing returns to reading after confirmed saving. Tab changes preserve editing. Recovery and undo details still need design. |
| D-25 | The first version includes read-aloud blocks, GM information blocks and collapsible sections. | Optional free-form document elements without a mandatory template. |
| D-26 | Main content inputs: Markdown and web pages. | Priority for Markdown conversion and HTML paste. This does not approve Markdown source editing, file synchronization or whole-page importing. |
| D-27 | Tiptap 3 with custom Angular integration. | Direction accepted, with a technical conversion/save/custom-block trial before full editor implementation. Exact package versions and trial results remain to be established. |
| D-28 | Tiptap/ProseMirror JSON documents in PostgreSQL. | Accepted content storage format with schema versioning and migrations. The detailed table model remains a proposal. |
| D-29 | Markdown as input, followed by visual editing. | The user chose the first option. Editing a whole note as Markdown source is unnecessary in stage one. |
| D-30 | Simple shared material model: name, type and free-form content. | The user left the choice to the plan author. The accepted recommendation uses one editor for notes, NPCs, locations and factions; optional templates help writing. Stage one does not require an extra-field configurator or filtering by those fields. |
| D-31 | Pilot uses existing Ythryn text, maps and assets. | The user requested transferring existing materials. Reconstruct relationships and review the result; act 7 scope remains accepted. Content outside the embedded HTML needs separate agreement. |
| D-32 | Materials needed for play are inside the application; the pilot does not require external references. | The user rejected external links as the way to access content. Conversion links available materials internally; missing content cannot be reconstructed from a URL alone. Section 35 covers bibliographic references and gaps. |
| D-33 | Import of the same campaign allows a deliberate update — superseded. | The earlier workflow included a pre-import backup and was deferred in round fifteen. Campaign export/import was removed from the product plan on 4 October 2026. |
| D-34 | Note version history deferred. | The user excluded it from the first version to limit implementation scope. Current editor Undo/Redo and autosave remain planned; full campaign archives were deferred in round fifteen. Conflict-protection revisions do not imply storage of prior content. |
| D-35 | Undo time and tool operations sequentially from the latest. | The user chose the simpler option. Undo the full operation and its effects; document editing is independent. Selecting an older operation and automatically undoing dependent operations is outside stage one. |
| D-36 | Initial acceptance and instructions for Windows with a portable stack. | The user wants to focus on Windows. Avoid unnecessary OS dependencies; other platforms are not separately accepted at this stage. |
| D-37 | Target: one week at about 3 hours daily with the agent. | Round fifteen replaced the earlier 1–2 hours. About 21 hours is a work/review budget, not a verified estimate; assess allocation after the technical trial. |
| D-38 | Accounts, users and login only later. | Explicit user request. The local minimum implements no such screens, tables or flows; design access before hosting. |
| D-39 | Export/import and state transfer outside the current version — superseded by removal. | Round fifteen deferred this scope. On 4 October 2026, the user removed it from the product plan and backlog. Local saving and preservation after restart remain required. |
| D-40 | Complete Ythryn from the POC; map and notes before richer editing. | Includes all 16 documents, 142 act 7 sections and the map's 29 markers, including the spire and supplemental materials. Scope is not limited to a trial location or 29 descriptions. D-41 requires editing and mechanics; D-42 limits editing to existing materials. |
| D-41 | Arcane Blight and editing must be included in week one. | Explicit user answer, translated: "Arcane Blight and editing must be included." They are not optional reader additions. Retain the proposed simple whole-description editor consistent with the earlier direction. |
| D-42 | Editing existing materials is sufficient. | The user selected the first option. Personal comments can be added to descriptions; new separate notes are outside the minimum. |
| D-43 | Shared long rest for the whole party is sufficient. | The user selected the first option. No participant selection; each character still has independent Arcane Blight state and results. |
| D-44 | Strong boundary between modules and engine. | User requirement. Separate .NET projects and Angular libraries, shared contracts and host composition. Independent module-code installation and microfrontends remain open questions; recommend a shared MVP release consistent with D-18. |
| D-45 | Module is a generic abstraction; Ythryn is its first implementation. | Engine uses neutral folder, material, map and tool contracts. Adventure names and mechanics stay in module implementations. |
| D-46 | Current reader improvements. | Close tabs with × or middle click after saving; focus, visible selection and centering of active material; persistent light/dark preference; nested navigation matching the POC source. |

## 7. Technical direction and open proposals

**Status:** local .NET backend, Angular, Aspire, PostgreSQL, EF Core, vertical slices and Tiptap 3 JSON documents are accepted. File storage, helper libraries and distribution details remain recommendations.

### 7.1. Two meanings of browser offline operation

| Option | Operation without internet | Consequences |
|---|---|---|
| Angular and local .NET backend | The browser connects to a service on the same computer. The service saves data in a local database and file store. | Requires a running backend. Allows the same backend core to be used for future hosting. |
| Standalone browser application, such as a PWA | After preparation, application code, data and files are available in the browser. | Requires local persistence and offline logic. Later use with a cloud backend requires separate data-transfer or synchronization design. |

Round two selected the first option. It matches the user's experience and supports coherent time, tool and undo logic in .NET. The second option remains as a record of an alternative considered.

Angular Service Worker provides basic caching, but not complete campaign persistence or synchronization. Browser storage is subject to the environment's quota and durability policies. These are extra design concerns for the second option. Sources: [Angular — Service Workers](https://angular.dev/ecosystem/service-workers), [MDN — storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

### 7.2. Proposed components

| Element | Proposal | Reason |
|---|---|---|
| Interface | Angular and TypeScript. | Matches the maintainer's experience and browser-operation requirement. |
| Backend | ASP.NET Core; vertical slices grouped by functional area. Proposed as one application. | Use cases handle complete GM actions; shared time/tool rules maintain consistency. |
| Data access | EF Core with the Npgsql provider for PostgreSQL. | Fits the .NET stack. The detailed data model and transaction boundaries need further design. |
| Database | PostgreSQL — accepted. | Keeps the same engine for future AWS deployment, at the cost of a separate database process locally. |
| Editor | Tiptap 3, custom Angular integration and JSON documents — accepted. | Tables, images, custom blocks and internal links need a short technical prototype. Markdown is an input format. |
| Maps and images | Local file storage with asset IDs independent of physical paths. | Simplifies later S3 storage and complete campaign export. |
| Development startup | Aspire AppHost with Angular, API and PostgreSQL resources; Docker runs the database container. | User selected Aspire for simpler startup. Frontend and API can run as local processes. |
| GM package | Prepared images and Docker Compose configuration, potentially generated from the Aspire model; ASP.NET Core can serve built Angular. | Proposed distribution without requiring the GM to compile code. Exact configuration needs prototype verification. |

PostgreSQL's EF Core provider is officially documented by [Npgsql](https://www.npgsql.org/efcore/). ASP.NET Core container operation is described in [Microsoft Learn](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/docker/building-net-docker-images?view=aspnetcore-10.0). Select specific component versions before implementation after checking support and compatibility.

SQLite was considered to simplify installation. Round three selected PostgreSQL; maintaining two database engines is outside this proposal.

Proposed offline acceptance: after installing the environment and preparing images, the application restarts without internet and supports the entire campaign cycle. Code, fonts, icons, maps and other required play assets must be local. Database data and files must have durable locations outside the container's writable layer.

### 7.3. AWS direction and boundaries

Possible future infrastructure equivalents are an application container in [Amazon ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html), PostgreSQL in [Amazon RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html) and files in [Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html). This is an example of a compatible development path, not a chosen deployment architecture or cost estimate.

Changing hosting still requires design for user access, campaign protection, infrastructure configuration, data migration and operations. Moving the backend to AWS alone does not let the browser work after losing that backend connection. The current proposal supports offline work through a local service. Offline scope and synchronization in a future hosted version remain separate decisions.

## 8. Round two — user answers

1. A local backend and database are acceptable. The user proposes Aspire to simplify startup.
2. Preparation and play happen on different computers. Manual campaign export/import is sufficient.
3. The first version is used by the owner and a few GM friends. The owner can help them install it.

## 9. Consequences of round two — detailed proposals

### 9.1. Aspire's role

AppHost should describe the dependencies needed for product development: frontend, backend and database. Docker remains the container runtime. The proposed backend is one application divided into functional areas; Aspire does not determine the number of services.

Consider generating a Docker Compose package from the Aspire model and supplying prepared images to the GM. Aspire supports publishing Docker Compose artifacts. This separates product development tools from ready-made application requirements. Sources: [Aspire — prerequisites](https://aspire.dev/get-started/prerequisites/), [Aspire — Docker Compose deployment](https://aspire.dev/deployment/docker-compose/).

PostgreSQL persistence requires a data volume; leaving a container running between AppHost starts is a separate option and does not replace durable storage. Environments with real campaigns need explicit image versions and a database upgrade process. Source: [Aspire — resource lifetimes](https://aspire.dev/app-host/resource-lifetimes/).

### 9.2. Campaign transfer as an ordinary user action

**Superseded on 4 October 2026:** this workflow was first deferred in round fifteen, then removed from the product plan and backlog. The proposal below is preserved only as history.

The eventual export/import feature should be available in the interface. The proposal is one campaign archive containing a versioned manifest, content, files, relationships, sessions, chronicle, time, tools and their history. Campaigns should be portable without copying Docker volumes or the whole installation.

Proposed scenario: prepare on computer A → export → import on computer B → run a session → export → import on computer A.

Import design proposals for further review:

- Preserve identity when transferring the same campaign, and distinguish it from deliberately creating an independent copy.
- Recognize revisions and export origin; file dates alone cannot establish which copy has the correct state.
- After recognizing the same campaign, explicitly choose an update with a pre-import backup or an independent copy. Update is the accepted usual return path between computers (round twelve, section 33).
- Validate archive completeness and compatibility before replacing data.
- Show a clear message for divergent changes on both computers; automatic merging is outside the proposed first-version scope.

Revision design, import atomicity and archive format will be refined after choosing the data model. Campaign backups and whole-installation backups are separate concerns.

## 10. Round three — user answers

1. PostgreSQL + EF Core: yes.
2. Visual editor.
3. First stage used during sessions: map and time-tracking tools.
4. Additional requirement: backend vertical slices.

## 11. Lessons from the existing application

These observations describe reference sources. Ythryn parameters are module content rather than generic product constants.

| Area | Reference behavior | Design implication |
|---|---|---|
| Map | A marker opens a description below the map. Code remembers map zoom and pan during the page lifetime. | Preserving orientation matters. The final position of descriptions and tools needs a decision. |
| Location description | Y4 separates read-aloud text, GM information, a checks table and collapsible background. | The editor should support this layout without a mandatory location form. |
| Time | Total city time and exploration minutes are separate. Shortcuts add 5, 30 or 60 minutes, with custom advances available. | Campaign clock, time from a reference point and activity time have different meanings. |
| Activities | Building search adds 30 minutes and separate checks; rest completion is an event, including without a time advance. | Minutes alone do not describe every tool trigger. Explicit GM activities are also needed. |
| Overdue matters | Advancing several periods leaves each due occurrence to resolve. | Immediate full advances were accepted. Preserve due times and resolution dependencies. |
| Factions | Crossing a deadline shows a reminder; the GM sets actual arrival. | Deadline and narrative fact stay separate. |
| Character tools | Arcane Blight reacts to exposure and rest completion and retains independent character state. | Accepted as a required pilot module mechanic in stage one. |
| Unknown state | Meal time and exhaustion may be unspecified. | Do not replace unknown values with zero or an invented event. |
| Undo | The reference stores up to 20 previous complete tool states; undo restores a prior state. | A coherent operation unit is needed. The reference's limit and snapshot mechanism are not requirements for the new application. |
| Saving | LocalStorage and JSON export cover tools; text and maps are separately embedded in HTML. | New export must cover the whole campaign, including editable materials and files. |

Reference tests cover the 12-hour boundary, overdue rolls, exposure during rest, character independence, recurring reminders and undo. Passing establishes those cases in reference sources, not acceptance of the new application or complete validation of reference behavior.

## 12. Proposed vertical slice organization

Status: vertical slices accepted; exact structure and mechanisms below need refinement.

A use case keeps its input/output contract, endpoint, validation, handler and EF Core queries together. Example grouping:

```text
Features/
  Campaigns/CreateCampaign/
  Campaigns/ExportCampaign/
  Campaigns/ImportCampaign/
  Materials/SaveMaterial/
  Maps/GetMap/
  Maps/PlaceMarker/
  Time/AdvanceTime/
  Time/EndRest/
  Tools/CreateReminder/
  Tools/ResolveReminder/
  Operations/UndoLastOperation/
```

This is a directory sketch, not an implemented structure. Endpoint mechanisms and any request-handling library remain separate decisions.

Proposed implementation principles:

- Shared time/tool rules have one place in domain code. A slice coordinates an action rather than duplicates rules used by other actions.
- EF Core can be used directly in use-case handling. Separate contracts are useful for file storage and other external dependencies.
- `AdvanceTime` should persist the clock, resulting state changes, newly due matters and operation history in one coherent database transaction. GM resolutions remain separate operations.
- `EndRest` is a separate action. The proposed "rest +8 h" shortcut combines time advance and rest completion into one operation; duration comes from configuration rather than a rule hardcoded for every campaign.
- Repeating the same request must not add time or resolution effects again. Design includes operation identity and changed-state version control, including two browser tabs.
- Undoing time includes related effects and must not delete independent later material edits. Scope and dependencies will be agreed through user scenarios.
- World clocks respond to GM actions. Real-time passage is unnecessary to trigger in-game reminders.

## 13. First useful stage — scope sketch

Accepted original goal: **map and time-tracking tools**. After the interface correction, material readability is the primary criterion; section 38 describes the current proposed delivery order.

Proposed minimum supporting this goal:

1. A persistent campaign with map, location descriptions and markers.
2. Opening materials from the map and basic visual editing.
3. World clock and time from a chosen event; distinguish exploration and rest.
4. One-time deadlines, recurring reminders and a due-matters panel.
5. Ythryn's Arcane Blight: independent character state, exposures, post-rest checks and explicitly entered results.
6. Coherent correction of the latest time operation, persistence after restart and export/import between computers.

Arcane Blight is approved minimum module scope. Hunger curse, other module mechanics and detailed activity shortcuts still need scope selection. Other BRD features, including the full creator, richer material organization, sessions and chronicle, remain planned; their order will follow closure of stage one.

## 14. Round four — answers after reviewing the inspiration

1. Arcane Blight is required minimum scope. The user emphasized that it belongs to a ready-made module rather than a generic tool.
2. Time can advance immediately by the full requested period, with overdue reminders shown afterward.
3. This round accepted a shared screen with map, side description, clock and expandable tools. **The side-description decision was superseded in round six:** a wide reading area takes priority; section 18 describes the current options.

## 15. Round five — pilot rules and screen

1. The user confirmed these pilot module Arcane Blight rules:
   - healthy characters resolve exposure every 12 hours;
   - exposure failure infects without increasing post-rest failures;
   - infected characters resolve checks after long rest;
   - post-rest success reduces DC by the GM-entered d6;
   - the third post-rest failure causes transformation.
2. The pilot begins on entry into Ythryn with the module's initial state.
3. Typical screen: a 26-inch monitor, at least Full HD.

The reference starts at DC 15; reaching DC zero gives recovery and immunity, while magical healing restores health without immunity. These behaviors come from the accepted reference and should be explicit in the mechanic specification. The pilot does not automatically transfer curses or values from the old game. Party names and size remain party data.

## 16. Proposed application/module mechanic boundary

**Accepted:** Arcane Blight belongs to the module; initial complex mechanics are developed in code and shipped with the application. The GM can change selected parameters in explicit edit mode. The exact parameters and effects need design.

| Element | Responsibility |
|---|---|
| Generic application capabilities | Campaigns, party, world time, activities, state persistence, operation history, shared due-matters list and generic tool types. |
| Module implementation | Folders, materials, maps, default configuration and custom rules/tools. The pilot implementation is Ythryn with Arcane Blight. Each module defines its values and resolutions through shared contracts. |
| Specific campaign | Its own configuration copy, character mechanic assignments, results, deadlines and history. Campaign changes do not modify the module. |

Initial modules implement complex mechanics in project code: C# rules/handling and a dedicated Angular view. Mechanic code has an explicit owner, such as `Modules/Ythryn/ArcaneBlight`, and ships with the application. Generic time slices invoke registered mechanics active in the campaign. Empty campaigns do not run Arcane Blight.

Example module slices: `StartTracking`, `ResolveExposure`, `ResolveRestCheck`, `CorrectCharacterState`. Exact division follows API contracts; rules remain shared among the mechanic's use cases. Shared tool contracts do not require identical forms for every tool.

A completely new complex mechanic type will initially ship in an application update. Content and parameters for supported mechanics can belong to a module package. Independent code supplied by external modules remains a separate decision, consistent with future user-published modules.

Campaign export must retain required mechanic identity and state version. Import checks support compatibility and must not silently discard unknown tools. Code or template changes should not automatically change an ongoing campaign's rules.

## 17. Large time advances and dependent resolutions

The main clock advances immediately by the full requested period. Due matters retain their own occurrence time, distinct from the time at which the GM handles them.

Example: the clock advances to hour 24. A character has unresolved exposure from hour 12. Success can leave another exposure at hour 24. Failure means infection at hour 12 and transition to post-rest checks. The application cannot assume every later exposure is an independent, certain roll.

Proposed behavior:

- Dependent resolutions for one character and mechanic follow due-event order. Characters can be handled independently.
- After an earlier result, the mechanic determines the next relevant matters, including ones due before current world time.
- Infection is dated at the exposure deadline. If a rest ended in the meantime, its event remains available to determine the next check.
- The panel distinguishes known overdue occurrences of simple reminders from a mechanic's next check whose later progress depends on the result. A counter should not show hypothetical matters as certain.
- Required activity history, such as rest completions, is persistent. This does not require full Event Sourcing.
- Correcting an earlier result must account for dependent later resolutions. Correction and undo mechanisms will be refined separately.

## 18. Play layout — correction after sketch review

The first sketch with a dominant map and narrow side description was rejected. It is not the basis for further reader design. The user identified long-note readability as the application's main function; tracking tools are supplementary.

Current design principles:

- A wide main document area for headings, paragraphs, read-aloud text, rules tables, images and collapsible sections.
- Comfortable text width; wide tables and images can use more space. A large monitor does not mean stretching every paragraph across its entire width.
- Compact material navigation, search and a document contents list. Collapsible navigation is a proposal to refine.
- The map selects locations without forcing a narrower document during reading.
- Clock and due-matter indicators can remain available in a small bar. The GM deliberately opens full tools, preserving reading position.
- Map changes, tool opening and linked-entity previews preserve document position. The map retains its own zoom and pan.
- One screen does not require fitting a long document and every tool without scrolling.

Compared options (round seven selected B):

| Option | Behavior | Main consequence |
|---|---|---|
| A. Map above the note | POC-like layout: map above a wide description; selecting a marker moves to the description, with map return and collapse available. | Map and text share a page. Scrolling and returning to the document need refinement. |
| B. Note with on-demand map | Document occupies the main area. A button opens the map there; selecting a place restores the wide document. | All workspace can support reading; switching must preserve both views' context. |

**Option B accepted.** The map retains interactive material-opening markers, zoom in/out and pan. Moving markers remains an edit-mode action. The sketch used a simplified map to compare layouts, without limiting final functions. Option A remains only as a considered alternative. Sketches are not product implementation.

## 19. Round six — modules and interface priorities

1. Complex mechanics developed in code and released with the application were accepted.
2. Selected editable parameters were accepted with explicit edit mode. Ordinary clicks must not constantly open fields.
3. The narrow notes panel was rejected. Long-material readability matters most; tools are supplementary. A POC-like layout or another with adequate text space is required.

## 20. Reading, tool operation and editing

**Accepted:** the default view is for reading; editing requires explicit entry. **Proposal:** enter editing for a selected material or tool configuration rather than unlock every campaign element at once.

| Action | Proposed behavior |
|---|---|
| Clicking note content | Read or select text; a link opens its material; no automatic editing. |
| Clicking "Edit note" | Enables visual editing, shows formatting tools and a clear mode indicator. Autosave with visible status is accepted; "Finish editing" returns to reading after confirmed saving. |
| Clicking a map marker | Opens material. Moving markers and changing relationships require explicit map editing. |
| Using "+30 min" or "Success" | Ordinary session operation, available without configuration editing. A d6 result form opens as part of a deliberately selected resolution. |
| Clicking a DC or interval value | Read the value; no automatic form. |
| Clicking "Edit configuration" | Shows the tool's allowed parameters, module defaults and effects of the proposed change. |
| Manually correcting character state | A separate explicit action with correction history. Changing a rule parameter and correcting a current result have different meanings. |

Preparation and play views can use the same materials and explicit editing workflow. Play mode neither blocks needed editing nor starts it during ordinary reading.

## 21. Round seven — reading and navigation

1. Option B accepted: wide note with on-demand map. Missing map controls in the sketch were explained as presentation simplification, not scope reduction.
2. In-application material tabs with retained reading position accepted.

## 22. Tab and save behavior

Round eight accepted tab-based links with separate previews and autosave. The behavior below retains open details identified for refinement.

- A material link opens and activates its tab. Already-open material reuses its tab rather than creating a duplicate. Map markers follow the same rule.
- Ordinary tab return preserves reading position. A section link deliberately moves to that section; section IDs and return behavior need refinement.
- Tab switching preserves ongoing editing. Opening another material never starts its editor.
- Map and documents share the main area. The map retains zoom and pan; selecting a place opens its tab. The exact map switcher needs refinement.
- An explicit "Preview" action opens a wide material preview above the current note, with an option to open a full tab. Ordinary pointer movement does not open previews. This addresses BR-05 / US-05 without permanently narrowing the document.
- Accepted content saving: autosave after a short pause in explicit edit mode, with visible "Saving", "Saved" or "Save error" status. "Saved" means backend-confirmed durable persistence. "Finish editing" returns to reading after confirmed saving.
- Save failure must not close the editor or discard text. Recovery buffering and application-close behavior need a separate specification; abrupt interruption does not guarantee the last characters are saved.
- Manual "Save / Cancel" was not selected as the main document-save workflow. This decision concerns content; separate mechanic-configuration confirmation remains recommended because it affects ongoing campaigns.

## 23. Round eight — links and content saving

1. Recommendation accepted: a link opens or activates a tab; a wide preview is a separate explicit action.
2. Content autosave in edit mode selected.

## 24. Editor — scope for library selection

BR-04 and US-04 require headings, paragraphs, lists, tables, images, links and free layout without mandatory templates. Material links identify entities independently of names and folders. Read mode shows no formatting tools.

Working editing-experience proposal:

- One document with a traditional formatting toolbar and special-element insertion.
- **Accepted in round nine:** prepared read-aloud and GM information highlights and collapsible sections with custom titles. They are optional and can alternate with ordinary text. "For the GM" is a content style in a GM application, not a permission mechanism or commitment to a player view.
- Consistent heading/highlight styles for readable long materials. Freedom to choose colors, fonts and sizes needs refinement.
- Insert material links through campaign search; an @ shortcut can supplement it rather than be the only method.
- Renaming entities does not break links; custom link-label display needs clarification.

Round ten selected Tiptap 3 and JSON documents. Exact package selection still needs checks of extension licenses, Angular integration, offline operation, custom content types and table/image paste. Section 26 contains documentation assessment and the technical trial plan.

Autosave design implications: ordering saves for one document, preventing older requests overwriting newer content, preserving buffers through tab changes and backend failures, and separate editing-undo/version-history rules. Autosave does not automatically approve a full versioning system.

## 25. Round nine — material creation

1. All three elements were accepted for the first version: read-aloud blocks, GM information blocks and collapsible sections.
2. Materials will usually come from Markdown and web pages. Fragment paste and whole-document import are separate scopes; pilot content delivery from the reference does not depend on a generic user importer.

## 26. Editor library selection — accepted direction

Documentation reviewed on 29 September 2026. This evaluates documentation, without an integration prototype or compatibility tests for a future Angular version.

| Candidate | Fit | Cost or limitation |
|---|---|---|
| Tiptap 3 / ProseMirror | Flexible custom content types, JSON documents and collapsible-section extension. Recommended for MasterCompanion-specific blocks and links. | Custom toolbar and Angular integration component. Markdown extension marked beta. |
| CKEditor 5 | Ready-made editor and official Angular component. | The vendor specifies GPL 2+ or commercial licensing. The free commercial plan uses a CDN; local commercial distribution requires a custom plan. Not adopted as the default free local solution. |

Comparison sources: [Tiptap — JavaScript API integration](https://tiptap.dev/docs/editor/getting-started/install/vanilla-javascript), [custom extensions](https://tiptap.dev/docs/editor/extensions/custom-extensions), [Details](https://tiptap.dev/docs/editor/extensions/nodes/details), [CKEditor — Angular](https://ckeditor.com/docs/ckeditor5/latest/getting-started/installation/self-hosted/angular.html), [CKEditor licensing](https://ckeditor.com/docs/ckeditor5/latest/getting-started/licensing/license-and-legal.html), [CKEditor activation and distribution](https://ckeditor.com/docs/ckeditor5/latest/getting-started/licensing/license-key-and-activation.html).

**Accepted direction:** Tiptap 3 through direct `@tiptap/core` integration in our Angular component, with custom menus, lifecycle control and autosave coordination. Editor code and assets ship in the local application. No Tiptap Cloud or paid extensions assumed. The open editor repository uses the [MIT license](https://github.com/ueberdosis/tiptap/blob/main/LICENSE.md); verify selected package licenses before pinning versions. Repository MIT licensing does not mean the vendor's entire offering is free.

Accepted storage format: Tiptap/ProseMirror JSON documents in PostgreSQL; technical proposal: `jsonb` with an explicit MasterCompanion schema version. This follows [Tiptap persistence documentation](https://tiptap.dev/docs/editor/core-concepts/persistence). Custom elements retain highlight types, linked material IDs or asset IDs. Schema changes need migrations; JSON does not remove dependence on the editor model. Full campaign export preserves documents and assets without losing those data.

Markdown was accepted as input followed by visual editing. We do not promise lossless conversion of application-specific blocks and links to ordinary Markdown and back. Whole-note source editing is unnecessary in stage one. Markdown export remains a separate decision.

[The `@tiptap/markdown` extension](https://tiptap.dev/docs/editor/markdown/getting-started/installation) supports parsing and serialization but is beta. Before approving packages, plan a technical trial with real materials: Y4's long description, tables, nested lists, Polish characters, links and custom blocks. If conversion is unreliable, a dedicated input adapter lets the parser be replaced without changing storage format. No replacement parser has been selected.

## 27. Proposed content and asset input

- "Insert Markdown" converts entered text to editable document elements. A plain-text option preserves literal characters. Automatic clipboard Markdown detection needs investigation; do not assume an infallible heuristic.
- Pasting a web fragment preserves supported headings, lists, tables, bold and links while adopting application styling. Remove scripts, HTML events, unsupported embeds and incidental page styles; sanitization and validation belong to input/rendering implementation.
- GFM is the proposed baseline Markdown scope. Wiki-links, Obsidian callouts, front matter and generator-specific syntax are not automatically supported. Needed variants follow user examples.
- An external-URL image is not yet an offline asset. Propose explicit download-to-campaign-storage status and manual file addition when downloading fails. Material is not fully offline until required images are stored locally. Download automation details remain open.
- The technical trial also covers custom-block save/restore, paste undo, save failure, tab changes during saving and restored material with internet disconnected.

## 28. Round ten — technology and Markdown's role

1. Tiptap with custom Angular integration and PostgreSQL JSON documents accepted, with a technical trial before full editor implementation.
2. Markdown selected as input followed by visual editing. Used Markdown variants were unspecified; proposed GFM scope needs example-based verification.

## 29. Material model — accepted basis and proposed representation

A shared material model was accepted for notes, NPCs, locations and factions: name, type and free-form content with optional templates. Stage one does not require extra filtering fields. The technical proposal adds stable ID, campaign ownership, optional folder and versioned JSON document. Type assists navigation and link selection; content remains free-form.

| Element | Proposed representation | User consequence |
|---|---|---|
| Material | `Material`: ID, campaign, type, name, folder, content, schema version and save revision. | NPCs, locations and factions share the editor and reader. |
| Folder | Its own ID and optional parent within a campaign. | Moving branches preserves material identity. |
| Content link | Target material ID in a document element, with optional custom label. | Renaming/moving does not break links. Display-label update behavior needs refinement. |
| Map | Separate object referencing an image asset. | One map can lead to many materials. |
| Marker | Map, image-relative position, label and material reference. | Multiple markers can reference one description; deleting a marker does not delete it. |
| Image | Asset with its own ID and database metadata, with a stored file. | Documents reference assets independently of physical paths. |
| Party character | Separate record used by tools, optionally linked to descriptive material. | Arcane Blight belongs to a character rather than an arbitrary NPC document. |

Image storage recommendation remains open: files in a durable local directory exposed through an asset-storage interface. This allows another storage implementation later without changing document IDs. File persistence and database transactions need failure handling; do not assume one transaction covers both stores.

Proposed material slices: `CreateMaterial`, `GetMaterial`, `SaveMaterial`, `MoveMaterial`, `GetMaterialReferences`. `SaveMaterial` validates document and expected revision, saves newer content and updates derived relationships in one database transaction. Older autosave requests must not overwrite newer content. References are derived from documents, not a manually maintained second link copy.

Creating a campaign from a module assigns independent material/map IDs and rewrites internal links and markers for that copy. The module retains its starter-content version; automatic campaign-content replacement after package updates is not proposed. Update details remain separate.

## 30. Pilot content preparation — accepted source and proposed process

The HTML reference was accepted as the initial Ythryn package source: transfer act 7 text, map, markers, embedded assets and relationships. Supplemental materials and campaign additions stay in appropriate folders. Act 6 is outside the pilot. The reference does not automatically determine every mechanic's scope; Arcane Blight is the approved minimum tracker.

Proposed process: extract reference content → explicitly map pages, sections, links and images to the application model → convert to JSON documents → owner review of materials and rules → versioned module starter package. Not every old heading must become a separate material, and not every link has an equivalent without an editorial decision.

The reference converter would be a helper for preparing this module. It does not determine a universal GM HTML importer's scope. Later stages can prepare modules from application-authored materials; that process needs a decision.

## 31. Round eleven — entity model and pilot source

1. The user left the choice to the plan author. A simple name/type/free-form-document model was accepted. Relationships are content links; templates remain optional.
2. The user requested transfer of existing text, maps and other materials.

## 32. Ythryn reference inventory

Reading data embedded in the HTML on 30 September 2026 confirmed this act 7 scope:

| Element | Reference state |
|---|---|
| Source documents | 16, including supplemental, editorial and campaign-thread materials. |
| Content sections | 142; navigation units in the old application, not automatically 142 separate materials in the new model. |
| Ythryn map | 2012 × 1248 image embedded in HTML. |
| Markers | 29. |
| Local content links | 192 occurrences, including two to act 6. A simple ID check found no other unknown targets; this does not replace semantic review after conversion. |
| Obsidian links | 21 occurrences targeting a vault outside embedded material. This does not mean 21 unique notes. |

Source review found one unique embedded image used by this portion, the map. Act 7 sections contained no other `img` elements referencing nonembedded files. This does not establish completeness of the original vault or external attachments. The original reference remains preserved.

Conversion must explicitly account for every document, section, image and link: target material/section, reference retained as plain text, or a gap needing supplementation. Two act 6 references do not automatically expand pilot scope. Round twelve rejected Obsidian links as access to required content; section 35 describes further accounting.

## 33. Transferring the same campaign — accepted workflow and open details

**Superseded on 4 October 2026:** this workflow was first deferred in round fifteen, then removed from the product plan and backlog. The proposal below is preserved only as history.

Once implemented, export/import is an ordinary user action between computers A and B. Propose one ZIP archive with a version manifest, JSON materials, assets, maps, markers, party/tool state and implemented session/chronicle data. Export does not automatically add sessions/chronicle to earlier stages; the format allows later inclusion.

First import on computer B creates a local instance preserving campaign identity and internal IDs. On return to computer A, the application recognizes the existing campaign and offers an explicit choice:

- "Update this campaign" — replace local state from the archive after validation and a complete pre-import backup.
- "Create an independent copy" — create a campaign with rewritten IDs and references.

No silent overwrite. The archive transfers complete state; the first version does not automatically merge two independently changed copies. Export origin and revisions allow divergence warnings; campaign revision definition and export snapshot boundaries need technical design. Timestamps alone cannot identify a newer branch.

Round twelve accepted this workflow: once the same campaign is recognized, present update as the usual return path, with an independent copy as the second option. This supersedes earlier consideration of restoring as a new copy by default. Earlier-note version history was deferred in round thirteen; a deleted-material trash bin remains separate, undecided scope.

## 34. Round twelve — external notes and return between computers

1. The user required needed materials inside the application and editable; external references were unnecessary. Obsidian was not accepted as an external pilot dependency.
2. Updating the same campaign on import with a pre-import backup was accepted.

## 35. Self-contained pilot materials

Audit on 30 September 2026: 21 act 7 Obsidian link occurrences point to 18 distinct targets including headings. They include the rulebook, character notes, chronicle and earlier-act threads. No direct filename match was found among the 16 embedded act 7 documents. Some topics, such as Y19 and Y23, are covered in available content and may receive internal links after review. This does not establish complete target-note content.

Each of the 142 sections also has an Obsidian `sourceLink`. The old application displays a separate source button. The new reader does not reproduce that button; provenance can remain in migration metadata. Four SRD references were also found, including Symbol, Flesh to Stone and Phantasmal Killer.

Proposed implementation of the accepted principle:

- Content present in transferred materials receives a stable link to the correct document or section. Review confirms content correspondence, not just similar names.
- Rules needed during play should be local editable rule materials. An external spell/rulebook link does not establish that required descriptions were delivered.
- Bibliographic/contextual references remain readable text without active vault/internet links. Preserve the original reference as the migration source.
- References to absent earlier-act history or character biographies do not justify inventing descriptions. Needed pilot content enters a supplementation list and can be transferred from supplied sources or written in the application. Background-only references retain text without dead links.
- Package acceptance: required materials, rules, images and navigation work with internet disconnected and without Obsidian; no active dead links or hidden missing required content.

This is a migration and acceptance plan. Missing content has not yet been supplemented; the workspace still contains documentation and the reference rather than a ready-made new application module.

## 36. Content and game operation undo — accepted scope

Autosave also persists accidental edits, so content recovery needs a design separate from time/tool undo.

| Area | Proposed behavior |
|---|---|
| Ongoing document editing | Editor Undo/Redo, including after autosave. Verify undo-stack lifetime across tabs; do not assume persistence after restart. |
| Saved document | Saved-version history, previews and restore are deferred. The first version retains current content and a conflict-protection revision without needing prior documents. |
| Time and tools | Sequential campaign-scoped undo from the latest operation accepted. One operation restores clock and related effects. History records that it was undone. |
| Older operation with later resolutions | The GM undoes later game operations in reverse order before the time change. No partial undo leaving contradictory state. |

Example: 8 hours were added accidentally, then due rolls resolved. Reverting only the clock while retaining those results would be incorrect. The accepted first version undoes resolutions sequentially, then the time operation. Selecting an older operation and automatically undoing a specified dependency set after previewing effects remains a future possibility.

Game operation history excludes note editing. Undoing time or Arcane Blight results does not restore earlier material text. Initial retention limits, undo availability after restart and manual correction boundaries need agreement. A pre-import campaign backup restores complete state rather than replace individual-note history.

## 37. Round thirteen — recovering changes

1. The user deferred prior-note version history and excluded it from the first version to limit implementation scope.
2. Simpler sequential undo of time/tool operations from the latest was selected.

## 38. Proposed delivery stages for the first useful pilot

**Note after round fifteen:** this is a broader development path, not the current week's scope. [The minimum plan](04-MVP-minimum-scope.md) contains the current scope proposal; the budget is about 21 hours and campaign transfer is explicitly deferred.

This sequence quickly evaluates the GM's core experience: reading, editing and finding materials. It is not a schedule or approval of every BRD feature in the initial pilot. Each implemented feature includes interface, API and persistence rather than building the entire backend separately before the frontend.

| Stage | User outcome | Main work and completion condition |
|---|---|---|
| 1. Environment and editor trial | Open, edit and restore the long Y4 note locally. | Aspire, .NET API, Angular, PostgreSQL and Tiptap integration. Verify tables, Polish characters, highlights, collapsible sections, Markdown conversion and JSON persistence. Correct integration issues before expanding scope. |
| 2. Campaign materials | The GM creates a campaign, organizes folders and uses tabs, links and previews. | Basic campaign/material slices, image assets, reader B, explicit editing, autosave, name/content search and visible save failures. Restart preserves data. |
| 3. Map and Ythryn package | A marker opens a readable location description. A new campaign receives its pilot copy. | Map image, marker positions, zoom/pan, explicit marker editing; text/link migration and rule-gap accounting. Two campaigns from one package have independent content. Conversion can begin once stage one's schema is defined. |
| 4. Time and Arcane Blight | The GM advances time, finishes rests and resolves due character checks. | Party, clock/activities, module deadlines, Arcane Blight rules, operation persistence and latest-first undo. Tests cover 12-hour boundaries, large advances, dependent results, long rest, character independence and request replay. |
| 5. Campaign transfer | The GM prepares on A, plays on B and updates A through an archive. | Complete export/import of implemented data/assets, version compatibility, archive validation, pre-update backup and explicit independent copies. Acceptance compares content, links, maps, time, tool state and history. Basic content export can start earlier; this stage completes scope. |
| 6. Offline play package | The owner and GM friends start a ready-made application and run sessions without internet. | Prepared application/database images, durable data, installation/update instructions and local assets. Trial installation in a clean environment and offline restart. Full HD UI acceptance including scaling. |

The earliest pilot should support a Ythryn session with wide descriptions, map, time and Arcane Blight plus state transfer between computers. Ordinary materials can hold working notes during this trial. Separate session notes, manual chronicle, full simple-tool creator and other mechanics remain later product stages. The user also explicitly deferred note version history.

Before closing the technical plan, select supported component versions, project structure and endpoints, refine module/campaign packages, time transactions and precise application-update rules. These design tasks follow platform and pace decisions without reopening accepted product rules.

## 39. Future content recovery scope

Keep saved material-version history with preview/restore in the backlog. It may need version-creation rules, retention, history export and images used by old versions. These dependencies are outside stage one, which does not implement hidden full document history.

Selecting an older game operation and automatically undoing dependencies is a separate possibility. Sequential undo suffices in the current plan. Material trash and retention remain unselected.

## 40. Round fourteen — platform and delivery pace

1. The user chose Windows for initial acceptance while retaining .NET/Docker portability.
2. The user targeted one week at 1–2 hours daily. Define minimum functionality and additions. Main view takes priority; accounts, users and login are explicitly deferred.

## 41. Round fifteen — narrowing to one week

A [separate short minimum plan](04-MVP-minimum-scope.md) proposed scope, seven slots and acceptance. Implementation had not started. Accounts/login were deferred as explicitly requested; other cuts were proposals needing agreement.

1. For week one, do we accept one prepared Ythryn campaign with editing, map, time, Arcane Blight, simple undo and export/import, deferring campaign/folder/map management, separate preview and additions?
2. Does 1–2 hours daily mean the user's work/review time with an agent or the entire manual implementation budget? Available time determines whether the proposed minimum is realistic.

User answers:

1. For now, remove export/import, meaning state transfer. The result must cover the entire Ythryn chapter available in the POC. Interactive map and notes matter most, even with limited editing.
2. Available time is about 3 hours daily with the agent, or about 21 hours for the week.

## 42. Consequences of round fifteen — complete content, fewer features

[The minimum plan](04-MVP-minimum-scope.md) was updated to version 0.2. Preparing Ythryn from reference HTML is module building, not a user-facing campaign importer. Conversion and acceptance must account for all 16 documents, 142 sections and 29 markers. Tabs and reader B remain the main view's basis.

Propose limiting editing to a small whole-document formatting toolbar while preserving tables, images and existing highlights. Do not expand campaign, material, asset and map managers now. This editing detail and deferrals of earlier accepted features, such as separate previews and block-creation UI, are proposals rather than newly approved decisions.

Arcane Blight remains previously required minimum scope in the working plan. Emphasis on map and notes does not authorize removing it; ask whether it must ship in week one. Allocation reserves 12 hours for main view/editing, 6 for time/mechanics and 3 for acceptance/fixes. Verify this budget allocation after day one.

## 43. Round sixteen — two minimum-scope boundaries to agree

1. Should limited editing still allow changing the whole description with basic formatting, or only append personal comments to unchanged module content? Recommend the former, consistent with accepted Tiptap editing and JSON persistence.
2. Is Arcane Blight with time/simple undo still required this week, or does it move after the complete map and notes? Retain the earlier requirement and time allocation until answered; do not assume deferral.

User answer, translated: "Arcane Blight and editing must be included." This confirms required editing and mechanics in week one. Adopt the simple whole-description editor recommendation consistent with the earlier accepted direction; do not restrict editing to separate appended comments.

## 44. Round seventeen — new notes and rest participants

1. The user confirmed that editing all transferred materials is sufficient. Creating new separate notes is unnecessary this week.
2. The user confirmed that a shared party long rest is sufficient. Arcane Blight results remain individual.

No pending user answers are needed to establish minimum functional scope. Implementation details follow the accepted stack and budget without asking again about the same features.

## 45. Execution plan and technical recommendations

[The minimum plan](04-MVP-minimum-scope.md) was updated to version 0.3 and [the MVP execution plan](05-MVP-execution-plan.md) prepared. It contains seven-day task allocation, completion conditions and specific verification scenarios. Application projects had not been created at this stage.

Recommend .NET 10 LTS with Minimal APIs and direct EF Core in slices, PostgreSQL 18 with EF Core/Npgsql 10, Angular 22 and stable Aspire 13.x. These are the plan author's proposals based on the accepted stack; sources and precise version-pinning rules are in the execution plan. Tiptap 3 integration keeps conversion and editing on one schema.

Propose game state as a separate versioned document: time, characters, rests and disease. Derive the earliest due check from state, as in the JS reference. Persist game operations with before/after state for sequential undo after restart. Undo also advances revision; material documents have independent persistence and revisions. This introduces neither full Event Sourcing nor saved-note version history.

During transfer, retain 142 content units organized into 16 document groups. The map leads to a specific location; tabs open on demand. Do not create one enormous location document or automatically open every material.

Environment inspection confirmed .NET 10 SDK and Node 24.19.0. Docker CLI is available, but engine connectivity was not confirmed; the first execution task includes this verification. No dependencies were installed or containers started during planning.
