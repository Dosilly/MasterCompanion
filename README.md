# MasterCompanion

MasterCompanion is a campaign workspace for tabletop role-playing game masters. It brings adventure materials, personal notes, and maps together in a browser-based application backed by a local database.

## Architecture

The application separates a reusable campaign engine from adventure modules. The engine owns navigation, editing, persistence, and map rendering. Modules supply campaign content, assets, and adventure-specific rules through shared contracts.

The stack combines Angular, ASP.NET Core, PostgreSQL, and .NET Aspire. Aspire coordinates the local database, API, and frontend.

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

## License

Licensed under the [Apache License 2.0](LICENSE).
