# Test organization

4 October 2026

The test suites are classified by their dependencies and run through standard
runners. The former backend console applications and manually maintained method
lists have been removed.

| Suite | Scope | Runner |
|---|---|---|
| `MasterCompanion.Gameplay.Tests.Unit` | Pure Ythryn Arcane Blight and expedition rules; references contracts and the module, without the engine or API. | xUnit / `dotnet test` |
| `MasterCompanion.Gameplay.Tests.Integration` | Engine persistence, transactions, revisions, undo, module upgrades and the real gameplay HTTP endpoints. | xUnit / PostgreSQL Testcontainers / WebApplicationFactory |
| `MasterCompanion.Materials.Tests.Integration` | Real material HTTP endpoints, validation, concurrent creation, revision protection, failure recovery and initialization preservation. | xUnit / PostgreSQL Testcontainers / WebApplicationFactory |
| `src/mastercompanion-web/tests/unit` | Sessions with controlled HTTP/storage dependencies, projections, commands and workspace transformations. | Node `test` and `describe` |
| `src/mastercompanion-web/tests/integration` | Real editor/schema composition, module import and compilation, Angular tool injection and the isolated UI server. | Node `test` and `describe` |
| `src/mastercompanion-web/e2e` | Browser behavior and reviewed visual baselines, using intercepted campaign data. | Playwright |
| `tests/e2e/container.test.mjs` | Read-only checks of an explicitly running deployed local container. | Node `test` |

## Design conventions

Use operation/condition/result names and separate Arrange, Act and Assert blocks.
Keep one behavior per unit test, with multiple assertions when they describe the
same result. Dice values, table endpoints and corrupted snapshot/character fields
are separate xUnit theory cases. Stateful save, recovery and undo protocols retain
intermediate assertions where those states are part of the scenario. Do not
replace a protocol with only a final-state assertion or add empty phases.

Node suites have feature-level `describe` groups. Existing feature-specific npm
scripts still select both levels when that feature spans them; `test:unit` and
`test:integration` select a dependency level directly. Tests and tools are now
separate. Source-specific fixtures remain under `tools/fixtures` because the
importer and API verification tool also consume them.

## Backend isolation and lifecycle

Both integration assemblies pin `Testcontainers.PostgreSql` 4.14.0 and
`Microsoft.AspNetCore.Mvc.Testing` 10.0.11. Each assembly has one PostgreSQL
collection fixture using the same `postgres:18.6` image as AppHost. Container
credentials are generated at runtime; the database port binds to loopback with
a random host port. No named volume, fixed container name, production connection
string or application restart is used.

Every test creates its own randomly named database inside that container and
applies the existing EF migrations. The collection serializes tests, including
trigger and lock fault injection, and disposes its container after completion.
The runtime's resource reaper remains enabled. Docker setup failures fail the
suite; tests are not silently skipped or redirected to a configured live database.

HTTP tests use a shared source implementation of `CampaignApiFactory`, derived
from `WebApplicationFactory<Program>`. It supplies only the generated connection
string and test environment, keeping real API registrations, endpoint mapping,
exception middleware, migrations and startup initialization. A single fixture
campaign with a folder is seeded before host startup, so initialization exercises
its existing-campaign path without importing module defaults. Material ownership
fixtures add the second campaign after startup. Each case owns its host/client;
no separate test server reimplements the application composition root.

The PostgreSQL fixture and API factory are linked into both integration projects.
Gameplay persistence helpers are specific to that suite and grouped into party,
recovery, expedition, upgrade and transaction test classes. They are not a generic
repository or a runtime abstraction.

## Running selected suites

Start Docker Desktop in Linux-container mode, then run from the repository root:

```powershell
dotnet test tests/MasterCompanion.Gameplay.Tests.Unit
dotnet test tests/MasterCompanion.Gameplay.Tests.Integration
dotnet test tests/MasterCompanion.Materials.Tests.Integration
dotnet test tests/MasterCompanion.Gameplay.Tests.Integration --filter FullyQualifiedName~TransactionsPersistenceTests
pnpm --dir src/mastercompanion-web test:unit
pnpm --dir src/mastercompanion-web test:integration
pnpm --dir src/mastercompanion-web test:ui --grep '@editor'
```

Testcontainers downloads its pinned PostgreSQL/resource-reaper images if they are
not cached. Unit and frontend Node tests do not require Docker. The container E2E
probe still requires a separately running application and performs reads only.
Browser setup and baseline policy remain in [UI test instructions](13-UI-tests.md).

The fixture lifecycle follows the official
[PostgreSQL Testcontainers module](https://dotnet.testcontainers.org/modules/postgres/)
and the host uses
[ASP.NET Core WebApplicationFactory](https://learn.microsoft.com/en-us/aspnet/core/testing/integration-testing).

## Verification evidence

- All 120 backend unit cases passed after removing unrelated setup and replacing
  equality checks with assertions that report expected and actual values.
- All 23 gameplay and 11 material integration cases passed using the shared
  PostgreSQL collection fixture, separate databases per test and the real API
  factory. No infrastructure cases were skipped.
- All 68 frontend unit cases passed in six named suites; all 37 frontend
  integration cases passed in six named suites, including the source round trips,
  real editors and UI server.
- All 48 Playwright cases passed with four workers across light/dark themes and
  both viewport sizes. The existing visual baselines were compared without updates.
- The solution build passed without warnings or errors. The final unit-only
  cleanup was compiled and tested separately; unchanged integration results were
  reused. Code/localization policy and strict UI type checking passed.
- The moved deployed-container E2E file passed a syntax check. Its read-only live
  application probes were not rerun for this structural change.
- The initial browser build needed additional sandbox filesystem access for
  Angular CSS resolution; the subsequent authorized run passed. The local
  application and its PostgreSQL volume were not restarted, migrated or reset.
