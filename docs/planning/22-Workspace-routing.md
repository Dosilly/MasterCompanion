# Workspace URL navigation

4 October 2026 · implemented, merged into local `trunk` and deployed.

The active material or tool now has an Angular Router address. Bookmarks,
direct links, reload and browser Back/Forward restore that location inside the
existing single campaign. Campaign selection is outside this slice.

## Address contract

| Address | Behavior |
| --- | --- |
| `/materials/:materialId` | Open the campaign material; new sessions start in read mode. |
| `/materials/:materialId#sectionId` | Reveal its stable source anchor, including enclosing details. |
| `/maps/:mapId` | Resolve that specific campaign map. |
| `/game` | Show the existing gameplay session. |
| `/party` | Show the existing party session. |
| `/workspace` | Keep an explicitly empty workspace after closing the last tab. |
| `/` | Replace the initial address with the campaign start material or empty workspace. |

Identifiers are URL segments, not titles. Angular's serializer handles escaping;
material reads encode their API segment. Dotted, colon-containing and Unicode
identifiers retain their identity. Query parameters, matrix parameters, auxiliary
outlets, unsupported paths and malformed identifiers are rejected by the engine.
Missing materials/maps and missing sections have localized recovery actions.
A failed target retains the requested address and any previously active view.
Unknown material IDs are rejected against current campaign summaries or a
confirmed current-campaign search result before any global material read.
Refresh can obtain metadata for a note created in another window.

## Ownership and history

The Angular host declares one persistent workspace parent with componentless
child routes. The engine's `WorkspaceRouting` owns URL intent and cancellation
of obsolete activation. `WorkspaceMaterials` retains material sessions and
deduplicates document reads. The workspace owns mounted views, tab closure and
DOM focus/scroll effects. Modules continue emitting semantic material targets;
documents, module contracts and campaign persistence are unchanged.

Meaningful navigation pushes history. Initialization and closing the active tab
replace the current entry; repeated navigation to the current address does not
push. Back/Forward can reopen a closed material but never issues game writes or
undo. The latest navigation wins over delayed reads. Leaving an in-flight target
can finish its read into a retained session without activating it.

Editors, drafts, selection, reading position, folders, game recovery and map
pan/zoom remain workspace state. Material closure still waits for confirmed
persistence; failure retains the draft and does not change the active address.
Reload restores persisted content at the URL, not unsaved material drafts or
the complete collection of open tabs. Visited maps retain their mounted views.

Both the local test server and API host serve the SPA on deep material/map
addresses, including IDs containing dots. Missing API routes and missing
standalone asset files retain their HTTP failures.

## Verification

- Frontend quality checks passed: formatting, lint, typed unit/E2E fixtures,
  matching locale catalogs and library boundaries. Frontend libraries and host
  compiled; the affected API project compiled with no warnings or errors.
- 22 routing unit cases and 8 material-session cases passed against the actual
  Angular serializer, controlled router events and real HTTP client transport.
- 9 isolated static-server integration cases passed, covering GET/HEAD deep
  links, dotted/colon identifiers, missing API/assets and traversal rejection.
- 144 affected browser cases passed across light/dark themes at 1920×1080 and
  1536×864. Four additional source-anchor cases passed. Coverage includes direct
  links, reload, Back/Forward, late reads, missing targets/sections, retained
  editors and drafts, save failure/conflict, notes, keyboard focus and map state.
  Existing visual baselines passed unchanged. New routing-error screenshots
  were reviewed in both Full HD themes.

No database migration or content replacement is required. Production operations
and backup infrastructure are outside this frontend feature.

## Local delivery

Routing commits `e782a81` and `2f63299` are included in trunk merge `039ac27`,
together with the concurrently delivered rival-force feature. The only merge
conflict was appended architecture documentation; both ownership sections were
retained. Unrelated documentation edits in the original checkout remain intact.

The combined source passed quality checks and 64 additional routing/gameplay
browser cases across both themes and viewports. The production Docker build
passed frozen-lockfile installation, frontend quality/compilation and API
publication. The deployed image is
`sha256:beec9900cf2015498a4ebba6e1c8e69c83d895d25b664238177b82a6817cbd94`,
pinned as `mastercompanion:workspace-routing-039ac27` to prevent concurrent image
builds from changing the deployment target.

Only the application container was recreated. It is healthy at
`http://localhost:4200`; the PostgreSQL container and volume were not restarted
or replaced. All nine read-only deployed-container cases passed, including dotted
material/map addresses, tools, SPA/API/asset behavior and persisted campaign reads.
The first deployed probe exposed ASP.NET's static-file fallback rejection of
dotted paths; explicit material/map SPA file endpoints corrected it and the final
same probes passed. No material or gameplay write was used for verification.
