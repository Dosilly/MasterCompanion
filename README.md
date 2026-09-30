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

## Contributing

Follow the engineering and verification guidelines in [AGENTS.md](AGENTS.md). Keep general campaign behavior in the engine and adventure-specific behavior in modules. Update planning documents when scope or architecture changes.

## License

Licensed under the [Apache License 2.0](LICENSE).
