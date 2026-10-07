# Module content sources

This directory is the authoritative source of the module's default content. Edit documents here, not the generated distribution JSON. The application does not read Markdown at runtime.

- `module.json`: module identity, version, start material, source paths, and asset registry.
- `navigation.json`: folder IDs, titles, parent IDs, and ordering.
- `documents/`: one UTF-8 Markdown file per material. Directory names are organizational; YAML metadata determines the navigation folder.
- `maps/`: map definitions and markers pointing to stable material IDs.
- `assets/`: local binary assets.
- `conversion-report.json`: historical accounting of the initial POC import, not a validation report for subsequent edits.

## Editing a material

Each document starts with YAML front matter:

```markdown
---
id: stable-material-id
title: Material title
folderId: stable-folder-id
sortOrder: 0
---

## A section {#stable-section-id}

Write **formatted content**, lists, quotes, and tables here.

[Open another material](#material/another-material-id)
[Open a section](#material/another-material-id/stable-section-id)
```

Keep existing material IDs and section IDs unchanged: map markers, links, and campaign copies depend on them. Renaming a file does not change its ID. Use YAML quoting when a title contains characters such as `: ` or `#`.

Locations Y1–Y29, including Y19 and its rooms, belong directly to the single `Lokacje` folder in adventure order. The Y19 document contains the spire overview and shared features. Navigation-only index pages are omitted; references point to substantive materials.

Every numbered location starts with a single-sentence GM summary before any read-aloud text. It identifies the place's purpose and its main threat, discovery, reward, or progression clue. Keep it consistent with the detailed description, including campaign-specific additions; it may contain spoilers and is not a player handout.

Write Polish read-aloud descriptions as natural spoken narration, with connected sentences and varied rhythm. Address the characters directly where it helps the flow, and allow a brief atmospheric detail or comparison grounded in the visible scene. Preserve observable clues and relevant dimensions; do not reveal hidden identities, threats, mechanics, or discoveries before their existing trigger. Apply this style to later room descriptions as well as arrivals. Keep dialogue, inscriptions, player handouts, and GM rules distinct from this prose.

Fenes has four complete documents directly inside the character folder: the GM guide and three short in-world handouts (recovery report, observatory note, and portable-device instructions). Y9 establishes a successful recovery, Y15 enables a first voice exchange, and Y19q supplies sustained contact and a future shared search. The measurement worksheet and mandatory two-point protocol are removed. Preserve the remaining section anchors and update incoming links when revising a document. Intentional changes to reviewed content must update the affected evidence in the content reference fixture at ../../../mastercompanion-web/tools/fixtures/ythryn-source.json.

Harkan has three complete documents in his character folder under the player threads: one GM guide and two in-world handouts. The report is found in Y24; the caregiver instructions accompany the existing chardalyn staff in Y19f. Arrival dialogue, ritual guidance and the Moonbow scene are linked from the introduction, Y1, Y6 and Y25. Keep GM rules, telepathic dialogue and epilogue choices out of the handouts. The staff suppresses the father's symptoms while its protection is active; it does not permanently cure the corruption. Moonbow speaks only to Harkan, and leaving the bow in the city is a voluntary epilogue choice.

Folder IDs can contain colons. Source export encodes these IDs in portable directory names prefixed with `folder-`; material filenames also encode their IDs. YAML retains the original identifiers. Authored directories can use another portable name because their names do not determine navigation.

The compiler supports standard Markdown, pipe tables, and heading IDs written as `{#id}`. Rich structures that Markdown cannot represent exactly remain HTML blocks, particularly `<details>` and some tables. Text inside a raw HTML block uses HTML formatting; Markdown inside it is not interpreted. Do not replace these blocks with plain text if their formatting or anchors matter. The compiler rejects unsupported tags, event handlers, unsafe styles, external links, and remote images. Images, when used, reference registered assets as `/api/assets/asset-id`.

## Building and validation

Install the frontend dependencies once, then run from the repository root:

```powershell
pnpm --dir src/mastercompanion-web prepare:ythryn
pnpm --dir src/mastercompanion-web test:content
dotnet build MasterCompanion.slnx --no-restore
```

The .NET module build automatically compiles these sources into `Data/Generated/pilot.json` and embeds the package. Generated files are ignored by Git. Compilation validates metadata, duplicate IDs, folder cycles, material/section links, asset paths, and map markers. Invalid input fails the build and preserves the previous generated package. Node must be on PATH; a custom executable can be supplied with `-p:NodeExecutable=<absolute-path>`.

Regression tests compile the maintained Markdown sources, export their rich documents to a new source directory, and recompile them to verify exact preservation of documents, navigation, and map. A separate fixture tests importing an explicitly supplied external POC file. Other content tests check the maintained module's links, navigation, and schema round trips. Tests do not require the removed legacy directory.

## Campaign content and future authoring

Visual editing in the application changes the campaign copy in PostgreSQL. It does not rewrite these Markdown sources. Rebuilding or restarting must not replace campaign edits. Applying a new module version to an existing campaign remains a separate future feature.

A future visual module editor will edit individual Markdown sources and metadata, preview content with the application's schema, manage internal links/assets, and validate before packaging. Lossless preservation of supported HTML structures and stable IDs is an acceptance requirement. It is not implemented in the current MVP.

## Re-importing the reference

The legacy POC directory was removed from this repository. Normal builds and tests use the maintained Markdown sources. If a fresh import of an external copy is needed, supply its absolute HTML path and a new staging directory:

```powershell
pnpm --dir src/mastercompanion-web import:ythryn-poc "C:/path/to/reference.html" .local/poc-reimport
```

The import refuses an existing destination. Review and merge staged changes explicitly; never import directly over edited sources.
