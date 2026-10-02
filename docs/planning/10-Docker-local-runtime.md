# Local Docker runtime

1 October 2026

## Delivered configuration

The root Dockerfile builds the separately compiled Angular libraries and production
host with Node.js 24.19.0 and pnpm 11.19.0, using the frozen lockfile and existing
dependency build policy. A separate pinned .NET SDK image (10.0.401) publishes the
API and compiles module sources. The final ASP.NET Core 10.0.12 image contains only
the published backend, embedded module content, static frontend and curl for its
health probe. It runs as the image's non-root app user; SDKs and Node.js are not
required at runtime. Docker's SDK pin is independent of the local Windows SDK.

The API composition root serves static files and SPA navigation when `wwwroot` is
present. Missing API routes and missing asset files remain HTTP 404. API-only
Aspire development still works without a bundled frontend. No module or engine
ownership contract changed.

Compose runs the app on `127.0.0.1:4200` and PostgreSQL without published ports.
The application joins a bridge for its loopback port and an internal database
network. PostgreSQL joins only the internal network. The database mounts the
existing external `mastercompanion-postgres` volume at the PostgreSQL 18 location;
Compose does not own or remove that volume. Database health gates application
startup, and the application has its own HTTP health probe. Both services restart
unless explicitly stopped.

The user requested the existing campaign. Its original password was loaded from
local Aspire configuration into the ignored `.local/docker.env` file, without
logging credentials. No secret is copied into the image or committed configuration.
Before starting the new API, a custom-format backup was saved to
`.local/docker-before-start-20261001-171355.dump`. Restore is a separate operation
that must account for any later campaign edits.

## Verification

The Linux multi-stage image build passed, including frontend compilation,
code/localization and dependency boundaries, module preparation and API publish.
Both runtime containers reached healthy status; the application runs as UID 1654.
The published application port is bound to IPv4 loopback, and PostgreSQL has no
published port.

Four read-only integration tests in `tools/container.test.mjs` passed: health/root
document, production JS/CSS assets, SPA navigation with API/asset 404s preserved,
and existing campaign/material/map/gameplay reads through the same origin. These
probes make no material or game writes.

The existing database had the initial engine and folder migrations. Startup added
the previously verified, additive `CampaignGameplay` migration. Hashes of every
campaign, material row (including document and revision), folder and map were
captured before and compared immediately after startup. All 106 material rows and
other campaign fingerprints matched. Gameplay state/history were empty at that
comparison; a game read did not initialize gameplay or replace notes with module
defaults. Subsequent live gameplay writes were observed after verification and
were preserved rather than restored to the startup baseline.

The browser loaded the existing campaign reader and the lazily loaded Arcane
Blight tool from the production container. No JavaScript console errors were
observed in the fresh browser view. Browser checks performed no campaign writes.

## Lifecycle and limits

Stable build/start/stop/verification commands are in the root README. Use either
Aspire or Compose against the existing volume at a time. Image preparation needs
network access; starting a prepared runtime installs no packages. Full offline
operation is not a current requirement, following the user's decision on
2 October 2026. No internet-disconnected acceptance was performed. Phase one is
accepted in [the MVP acceptance record](11-MVP-acceptance.md). No cloud deployment,
account system or external publication is included.
