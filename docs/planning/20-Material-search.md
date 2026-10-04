# Campaign material search

4 October 2026

## Scope and contract

The user selected full-text material search, authorized parallel implementation
on `codex/material-full-text-search`, and authorized merging into local `trunk`
and updating the existing application container after successful verification.

Search belongs to the generic engine and reads current persisted campaign copies,
including user-created notes. It does not read module defaults, change documents,
advance revisions or enter gameplay undo. Unsaved drafts are not search input.

`GET /api/campaigns/{campaignId}/materials/search?query=...` returns:

```json
{
  "results": [
    {
      "id": "stable-material-id",
      "title": "Material title",
      "folderId": null,
      "snippet": "Plain text around a match."
    }
  ],
  "hasMore": false
}
```

Queries contain a literal phrase, with case-insensitive matching and Unicode
normalization. Whitespace is collapsed; Polish diacritics remain meaningful.
The query is nonblank and at most 160 UTF-16 code units. Invalid queries receive
HTTP 400 with `invalid_search_query`; missing campaigns receive HTTP 404 with
`campaign_not_found`. At most 50 results are returned, with title matches first
and deterministic ordering. Snippets are plain text, at most 200 characters.
Document attributes, URLs and asset identifiers are not searchable content.

The initial implementation streams campaign-scoped, no-tracking material reads
and extracts supported rich-document text without a schema migration or data
backfill. It scans the campaign on each request; this is appropriate to evaluate
at the current approximately 106-document scale, not a claim of indexed search
performance. A larger collection may require a transactionally maintained text
projection and database index as a separately measured change.

## Frontend behavior

The existing navigation search field shows flat title/snippet results for a
nonempty query. Clearing the query restores the folder hierarchy. Result buttons
use existing material navigation and preserve mounted editors, drafts, reading
positions and map orientation. Search does not consume additional reader width.

The engine owns debouncing, cancellation, latest-query selection and localized
loading, empty, error, retry and result-limit messages. Results refresh after
confirmed note creation or material saves; drafts and failed saves do not appear
as persisted content. Responses are displayed as text, never injected HTML.

## Parallel ownership and verification

- Backend implementation owns the endpoint, text extraction, matching and real
  HTTP/PostgreSQL tests in the material integration project.
- Frontend implementation owns search state, navigation presentation, locale
  resources and focused typed state/session tests.
- Independent review owns isolated browser fixtures, search scenarios and visual
  review in both themes at Full HD and the existing scaled viewport.
- The primary agent owns public frontend contracts, API composition, planning
  records, final integration, branch merge and safe local deployment.

Verification covers query boundaries, Polish text, title/body matching, rich
document boundaries, excluded attributes, campaign scope, current confirmed
edits, result limits, cancellation and preservation of documents/revisions.
Frontend and browser checks cover loading, empty, errors/retry, request races,
keyboard operation and retained editor/map state. Builds verify the affected
API and separately compiled frontend contracts, libraries and host.

Before replacing the application container, retain its previous image, verify a
PostgreSQL backup and capture complete-table fingerprints after graceful app
shutdown. Replace only the application; retain the database container and volume.
Compare fingerprints after startup and run read-only container/search checks.

## Delivery evidence

Implementation is complete and the independent review has no unresolved blockers.

- 33 material-search HTTP tests passed against isolated real PostgreSQL through
  `WebApplicationFactory`; none failed or skipped.
- 31 frontend cases passed across search state, workspace sessions and autosave.
  Three selected navigation/content cases passed after removal of the obsolete
  local title-filter branch.
- All 72 selected browser cases have passing evidence across both themes and
  both viewports: 48 search cases, existing reader behavior and affected visuals.
  This is an aggregate of scoped runs, not a claim that one run passed all cases.
- Sixteen existing baselines were changed after reviewing the navigation label
  and input differences. Four new search baselines were added. Normal comparison
  passed against all 32 selected images. Twelve new result/empty/error views were
  reviewed. Significant changes remained within the navigation panel; minor
  Full HD editor header antialias differences affected at most 28 pixels with
  RGB differences at most 2.
- The full .NET solution built with zero warnings/errors. The final API build
  verified the named raw-query limit; scoped C# whitespace checks passed.
- Frontend contracts, engine, module and host compiled separately with strict
  templates. Quality checks passed formatting, ESLint, typed test fixtures,
  E2E types, matching locale resources and dependency boundaries.
- The candidate Docker image built successfully, including the production
  frontend quality/build path and API publication.

The restricted Windows environment initially denied the Docker pipe, SDK config
and Angular resolver ancestor access. Authorized execution resolved those setup
failures without changing source or weakening checks. The bundled pnpm wrapper
did not resolve some direct executables or forward a pipe-separated regex as
intended; equivalent installed Node entry points were used. Successful unchanged
cases were reused rather than repeating unrelated suites.

Commands actually run from the repository root:

```powershell
dotnet test tests/MasterCompanion.Materials.Tests.Integration/MasterCompanion.Materials.Tests.Integration.csproj --filter FullyQualifiedName~SearchMaterialsHttpTests --no-restore
dotnet build MasterCompanion.slnx --no-restore
dotnet build src/MasterCompanion.Api/MasterCompanion.Api.csproj --no-restore
docker build --tag mastercompanion:search-candidate-20261004 .
```

Scoped `dotnet format whitespace` verified the four new production search files,
the search HTTP tests and the changed API composition file. Applied migrations
and unrelated source were excluded.

Commands actually run from `src/mastercompanion-web`:

```powershell
node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.tests.json --test tests/unit/material-search.test.ts tests/unit/workspace-notes.test.ts tests/unit/autosave.test.ts
node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.tests.json --test --test-name-pattern="Module document assignments|All numbered locations|Opening a nested material" tests/integration/content.test.mjs
node tools/build.mjs
node tools/check-quality.mjs
node node_modules/@playwright/test/cli.js test --grep '@search|@reader|@visual'
node node_modules/@playwright/test/cli.js test search.spec.ts --grep 'Title and body' --update-snapshots=missing
node node_modules/@playwright/test/cli.js test --grep '@visual'
node node_modules/@playwright/test/cli.js test editor.spec.ts --grep '@visual'
```

The first normal browser run passed 56 cases and stopped 16 cases on expected
image differences or missing new images. Review preceded every baseline change.
Normal focused reruns established the remaining passing evidence, including
later dialog images that the first assertion had prevented from reaching.

Review also resolved linguistic matching of ignorable Unicode characters,
opening a search result created in another window after workspace startup,
retaining results after an opening failure, and retaining a newer search phrase
typed while a material GET is pending. Search results render literal text.

The confirmed revision signal is read-only outside `MaterialSession` and changes
only after successful PUT confirmation. Existing save ordering, conflicts and
draft ownership remain intact. No migration, live campaign write or module
source edit was required for implementation and verification.

Local merge and deployment preservation evidence is recorded below after the
authorized application update.
