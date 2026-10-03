# MasterCompanion

MasterCompanion is a campaign workspace for tabletop role-playing game masters. It brings adventure materials, personal notes, and maps together in a browser-based application backed by a local database.

## Architecture

The application separates a reusable campaign engine from adventure modules. The engine owns navigation, editing, persistence, and map rendering. Modules supply campaign content, assets, and adventure-specific rules through shared contracts.

The stack combines Angular, ASP.NET Core, PostgreSQL, and .NET Aspire. Aspire coordinates the local database, API, and frontend.

## Run with Docker

The root [Dockerfile](Dockerfile) builds the Angular libraries and production host,
then publishes the API. One non-root application container serves both the SPA and
`/api` on [http://localhost:4200](http://localhost:4200). PostgreSQL runs separately
with no published port; the application port is bound to loopback only.

Compose reuses the external volume `mastercompanion-postgres`. Use the **existing
database password** when switching from Aspire, and stop Aspire before starting
Compose so that two database processes never mount the same volume. Creating an
environment file does not change a password in an initialized PostgreSQL volume.
Back up an existing database before starting a newer application with migrations.

Store `POSTGRES_PASSWORD` in a private, Git-ignored file such as `.local/docker.env`.
Use single quotes around the value to preserve literal `$` characters. Do not
commit this file. A new installation must first create the named volume and choose
a database password; an existing Aspire installation retains its volume and password.

```powershell
# Safe if the volume already exists; this does not clear its contents.
docker volume create mastercompanion-postgres
docker compose --env-file .local/docker.env up -d --build --wait
```

Initial image preparation requires network access; the runtime image contains the
compiled frontend, module content and API and does not install packages at startup.
The container SDK is pinned by digest (.NET SDK 10.0.401), independently of the
Windows development SDK in `global.json`. Node.js and pnpm versions are pinned in
the Dockerfile, and frontend installation uses the existing lockfile and build policy.

Read-only verification and lifecycle commands:

```powershell
node --test tools/container.test.mjs
docker compose --env-file .local/docker.env ps
docker compose --env-file .local/docker.env logs --tail 50 app
docker compose --env-file .local/docker.env stop
docker compose --env-file .local/docker.env start --wait
```

`docker compose down` removes this application's containers and networks while
retaining the external database volume. Retain that volume to preserve campaign
notes and game state. Run either Compose or Aspire against it at a time.

## Local development

Install the .NET SDK specified in [global.json](global.json), Node.js compatible with the frontend dependencies, the pnpm version specified in [package.json](src/mastercompanion-web/package.json), and Docker with Linux container support.

Run these commands from the repository root:

```powershell
pnpm --dir src/mastercompanion-web install --frozen-lockfile
dotnet restore MasterCompanion.slnx
dotnet build MasterCompanion.slnx --no-restore
dotnet run --project src/MasterCompanion.AppHost --no-build
```

Open [http://localhost:4200](http://localhost:4200). The AppHost prints the Aspire dashboard address. Stop the environment with Ctrl+C.

Initial setup requires internet access to download dependencies and the database image. Aspire uses the local package cache for subsequent frontend starts. PostgreSQL stores campaign data in the persistent Docker volume `mastercompanion-postgres`; retain this volume to preserve your notes.

## Repository layout

- `src/MasterCompanion.Contracts` — shared backend module contracts.
- `src/MasterCompanion.Engine` — campaign behavior and persistence.
- `src/MasterCompanion.Modules.*` — adventure modules and their content.
- `src/MasterCompanion.Api` — HTTP endpoints and module composition.
- `src/MasterCompanion.AppHost` and `src/MasterCompanion.ServiceDefaults` — local orchestration and service configuration.
- `src/mastercompanion-web` — Angular host, libraries, and frontend tooling.
- [docs/planning](docs/planning) — product specifications, plans, and architecture decisions.

## Module content

Module defaults are maintained as individual Markdown documents with YAML metadata, alongside a small manifest, folder hierarchy, map definitions, and local assets. The module build validates these sources and compiles an embedded distribution package; generated JSON is not checked into Git. Frontend dependencies and Node.js must be available before building the .NET module.

For the first module, see the [content authoring instructions](src/MasterCompanion.Modules.Ythryn/Data/Source/README.md). To prepare its package separately:

```powershell
pnpm --dir src/mastercompanion-web prepare:ythryn
```

Application edits belong to the campaign copy in PostgreSQL. Rebuilding module defaults does not overwrite campaign notes. The removed legacy POC is not required for normal builds or tests; the optional reference importer accepts an external HTML file explicitly.

## Contributing

Follow the engineering and verification guidelines in [AGENTS.md](AGENTS.md). Keep general campaign behavior in the engine and adventure-specific behavior in modules. Update planning documents when scope or architecture changes.

### Automated browser checks

The Playwright UI suite serves a dedicated production frontend on loopback port
4310 and intercepts API calls with fresh fixtures in each browser context. It
requires no AppHost, Docker or database and does not access a running campaign.
Tests run concurrently with four workers, in both themes at 1920×1080 and
1536×864. The smaller viewport represents the available CSS space at 125% scaling
on a Full HD display; it does not emulate operating-system scaling itself.

```powershell
pnpm --dir src/mastercompanion-web exec playwright install chromium --only-shell
pnpm --dir src/mastercompanion-web check:ui
pnpm --dir src/mastercompanion-web test:ui

# Select only the affected area; all theme/viewport variants still apply.
pnpm --dir src/mastercompanion-web test:ui --grep @reader
pnpm --dir src/mastercompanion-web test:ui --grep @editor
pnpm --dir src/mastercompanion-web test:ui --grep @gameplay
pnpm --dir src/mastercompanion-web test:ui:report
```

The first run builds the frontend once. Later runs reuse the dedicated bundle
only if frontend sources, localization, dependencies and build configuration
match its fingerprint. Reports and traces are saved under the ignored frontend
`.local` directory. The server refuses an occupied port rather than reusing an
unrelated application.

Visual baselines are checked in per operating system, theme and viewport. Review
intentional appearance changes before updating only their affected screenshots:

```powershell
pnpm --dir src/mastercompanion-web test:ui:update reader.spec.ts
```

Use the same OS and pinned Playwright browser for comparisons. A missing baseline
fails a normal run; creating baselines for another OS requires explicit generation
and image review. See [UI test scope and evidence](docs/planning/13-UI-tests.md).

## License

Licensed under the [Apache License 2.0](LICENSE).
