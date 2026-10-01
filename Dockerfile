# syntax=docker/dockerfile:1
FROM node:24.19.0-bookworm-slim AS frontend
WORKDIR /source
COPY src/mastercompanion-web/package.json src/mastercompanion-web/pnpm-lock.yaml src/mastercompanion-web/pnpm-workspace.yaml src/mastercompanion-web/.npmrc ./src/mastercompanion-web/
RUN npm install --global pnpm@11.19.0 \
    && pnpm --dir src/mastercompanion-web install --frozen-lockfile
COPY src ./src
RUN pnpm --dir src/mastercompanion-web build

# Pin the container SDK separately from the Windows development SDK.
FROM mcr.microsoft.com/dotnet/sdk:10.0@sha256:35d40304542c8689331f8cab17c65926cdf48fe711e289321d71924b230a7d29 AS backend
WORKDIR /source
COPY Directory.Build.props ./
COPY --from=frontend /usr/local/bin/node /usr/local/bin/node
COPY --from=frontend /source/src ./src
RUN dotnet restore src/MasterCompanion.Api/MasterCompanion.Api.csproj \
    && dotnet publish src/MasterCompanion.Api/MasterCompanion.Api.csproj \
       --configuration Release --no-restore --output /publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0.12 AS application
WORKDIR /app
RUN apt-get update \
    && apt-get install --yes --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=backend /publish ./
COPY --from=frontend /source/src/mastercompanion-web/dist/web/browser ./wwwroot
ENV ASPNETCORE_HTTP_PORTS=8080
USER $APP_UID
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3 \
    CMD curl --fail --silent http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["dotnet", "MasterCompanion.Api.dll"]
