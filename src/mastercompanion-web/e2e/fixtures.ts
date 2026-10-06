import { readFileSync } from 'node:fs';
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import type {
  FolderOperationRequest,
  FolderSnapshot,
  MaterialDto,
  MaterialSearchResponse,
} from '@mastercompanion/contracts';
import { campaignFixture, campaignId, readerId, readerTitle } from './fixtures/campaign';
import { SessionApi } from './fixtures/session-api';

// Read canonical localization data, without importing private library implementations.
const catalogs: Record<'engine' | 'ythryn', unknown> = {
  engine: JSON.parse(
    readFileSync(new URL('../projects/engine/src/lib/i18n/pl.json', import.meta.url), 'utf8'),
  ),
  ythryn: JSON.parse(
    readFileSync(new URL('../projects/ythryn/src/lib/i18n/pl.json', import.meta.url), 'utf8'),
  ),
};
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function text(catalog: keyof typeof catalogs, ...keys: string[]): string {
  let value = catalogs[catalog];
  for (const key of keys) {
    if (!record(value)) {
      throw new Error(`Invalid localization path: ${catalog}.${keys.join('.')}`);
    }
    value = value[key];
  }
  if (typeof value !== 'string') {
    throw new Error(`Missing localization message: ${catalog}.${keys.join('.')}`);
  }
  return value;
}

interface CreationRequest {
  id: string;
  title: string;
  folderId: string | null;
}

function folderRequest(value: unknown): FolderOperationRequest {
  if (
    !record(value) ||
    typeof value['requestId'] !== 'string' ||
    typeof value['expectedRevision'] !== 'number' ||
    !record(value['operation'])
  ) {
    throw new Error('Expected a typed folder operation request.');
  }
  expect(Object.keys(value).sort()).toEqual(['expectedRevision', 'operation', 'requestId']);
  const operation = value['operation'];
  if (
    (operation['kind'] === 'reorderMaterial' || operation['kind'] === 'moveMaterial') &&
    typeof operation['materialId'] === 'string' &&
    (operation['folderId'] === null || typeof operation['folderId'] === 'string') &&
    (operation['beforeId'] === null || typeof operation['beforeId'] === 'string')
  ) {
    return {
      requestId: value['requestId'],
      expectedRevision: value['expectedRevision'],
      operation: {
        kind: operation['kind'],
        materialId: operation['materialId'],
        folderId: operation['folderId'],
        beforeId: operation['beforeId'],
      },
    };
  }
  const folderId = operation['folderId'];
  if (typeof folderId !== 'string') {
    throw new Error('Expected a stable folder identity.');
  }
  if (operation['kind'] === 'rename' && typeof operation['title'] === 'string') {
    expect(Object.keys(operation).sort()).toEqual(['folderId', 'kind', 'title']);
    return {
      requestId: value['requestId'],
      expectedRevision: value['expectedRevision'],
      operation: { kind: 'rename', folderId, title: operation['title'] },
    };
  }
  if (
    operation['kind'] === 'move' &&
    (operation['parentId'] === null || typeof operation['parentId'] === 'string') &&
    (operation['beforeId'] === null || typeof operation['beforeId'] === 'string')
  ) {
    expect(Object.keys(operation).sort()).toEqual(['beforeId', 'folderId', 'kind', 'parentId']);
    return {
      requestId: value['requestId'],
      expectedRevision: value['expectedRevision'],
      operation: {
        kind: 'move',
        folderId,
        parentId: operation['parentId'],
        beforeId: operation['beforeId'],
      },
    };
  }
  throw new Error('Unsupported folder fixture operation.');
}

export class TestApi {
  readonly meetings = new SessionApi(
    (documents) => {
      this.createdMaterials.push(...documents);
      this.data.workspace.materials = [
        ...this.data.workspace.materials,
        ...documents.map(({ id, title, group, folderId }) => ({ id, title, group, folderId })),
      ];
      this.data.workspace.foldersRevision++;
    },
    (url, status) => this.expectedHttpErrors.push({ url, status }),
    (url) => this.expectedNetworkFailures.push(url),
  );
  readonly data = campaignFixture();
  readonly saves: unknown[] = [];
  readonly creations: CreationRequest[] = [];
  readonly folderRequests: FolderOperationRequest[] = [];
  folderMode: 'success' | 'hold' | 'conflict' | 'invalid' | 'lostResponse' = 'success';
  private readonly folderReceipts = new Map<
    string,
    {
      request: FolderOperationRequest;
      response: FolderSnapshot;
    }
  >();
  private readonly folderGate = Promise.withResolvers<void>();
  readonly createdMaterials: MaterialDto[] = [];
  readonly noteDocuments = new Map<string, unknown>();
  readonly unexpectedRequests: string[] = [];
  readonly expectedHttpErrors: { url: string; status: number }[] = [];
  readonly expectedNetworkFailures: string[] = [];
  readonly searches: string[] = [];
  readonly completedSearches: string[] = [];
  readonly searchResponses = new Map<string, MaterialSearchResponse>();
  readonly materialReads: string[] = [];
  readonly searchGates = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>();
  readonly bulkReads: number[] = [];
  readonly completedBulkReads: number[] = [];
  readonly bulkReadGates = new Map<number, ReturnType<typeof Promise.withResolvers<void>>>();
  bulkFailures = 0;
  searchFailures = 0;
  savedDocument: unknown = this.data.materials[0].document;
  revision = this.data.materials[0].revision;
  workspaceFailures = 0;
  materialInspectionAllowed = false;
  materialInspectionFailures = 0;
  saveMode: 'success' | 'hold' | 'conflict' | 'failure' = 'success';
  creationMode: 'success' | 'hold' | 'invalid' | 'lostResponse' = 'success';
  private readonly saveGate = Promise.withResolvers<void>();
  private readonly creationGate = Promise.withResolvers<void>();

  releaseSave() {
    this.saveGate.resolve();
  }
  releaseCreation() {
    this.creationGate.resolve();
  }
  releaseFolders() {
    this.folderGate.resolve();
  }
  holdSearch(query: string) {
    this.searchGates.set(query, Promise.withResolvers<void>());
  }
  releaseSearches() {
    for (const gate of this.searchGates.values()) {
      gate.resolve();
    }
  }
  holdBulkRead(requestNumber: number) {
    this.bulkReadGates.set(requestNumber, Promise.withResolvers<void>());
  }
  releaseBulkReads() {
    for (const gate of this.bulkReadGates.values()) {
      gate.resolve();
    }
  }

  async install(page: Page, origin: string) {
    // Catch every request before navigation. API calls never leave this browser context.
    await page.context().route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const method = request.method();
      if (url.origin === origin && !path.startsWith('/api/')) {
        await route.continue();
        return;
      }
      if (url.origin === origin) {
        if (path === `/api/campaigns/${campaignId}/sessions`) {
          await this.meetings.handle(route);
          return;
        }
        if (path === `/api/campaigns/${campaignId}/folders` && method === 'GET') {
          await route.fulfill({
            json: {
              revision: this.data.workspace.foldersRevision,
              folders: this.data.workspace.folders,
              materialOrder: this.data.workspace.materials.map(({ id, folderId }) => ({
                id,
                folderId,
              })),
            },
          });
          return;
        }
        if (path === `/api/campaigns/${campaignId}/folders` && method === 'POST') {
          const body = folderRequest(request.postDataJSON());
          this.folderRequests.push(body);
          if (this.folderMode === 'hold') {
            await this.folderGate.promise;
          }
          const receipt = this.folderReceipts.get(body.requestId);
          if (receipt) {
            expect(body).toEqual(receipt.request);
            await route.fulfill({ json: receipt.response });
            return;
          }
          if (
            this.folderMode === 'conflict' ||
            body.expectedRevision !== this.data.workspace.foldersRevision
          ) {
            this.expectedHttpErrors.push({ url: request.url(), status: 409 });
            await route.fulfill({ status: 409, json: { code: 'folder_revision_conflict' } });
            return;
          }
          if (this.folderMode === 'invalid') {
            this.expectedHttpErrors.push({ url: request.url(), status: 400 });
            await route.fulfill({
              status: 400,
              json: {
                code: 'invalid_folder_operation',
                detail: 'Private fixture diagnostic.',
              },
            });
            return;
          }
          const operation = body.operation;
          if (operation.kind === 'reorderMaterial' || operation.kind === 'moveMaterial') {
            const material = this.data.workspace.materials.find(
              (item) => item.id === operation.materialId,
            );
            if (
              !material ||
              (operation.kind === 'reorderMaterial' && material.folderId !== operation.folderId)
            ) {
              throw new Error('Invalid material fixture organization.');
            }
            material.folderId = operation.folderId;
            const document = [...this.data.materials, ...this.createdMaterials].find(
              (item) => item.id === material.id,
            );
            if (document) {
              document.folderId = operation.folderId;
            }
            const others = this.data.workspace.materials.filter((item) => item.id !== material.id);
            const beforeIndex = others.findIndex((item) => item.id === operation.beforeId);
            others.splice(beforeIndex < 0 ? others.length : beforeIndex, 0, material);
            this.data.workspace.materials = others;
          } else {
            const folder = this.data.workspace.folders.find(
              (item) => item.id === operation.folderId,
            );
            if (!folder) {
              throw new Error('Folder writes must target a fixture-owned folder.');
            }
            if (operation.kind === 'rename') {
              folder.title = operation.title;
            } else {
              folder.parentId = operation.parentId;
              const others = this.data.workspace.folders.filter((item) => item.id !== folder.id);
              const beforeIndex = others.findIndex((item) => item.id === operation.beforeId);
              others.splice(beforeIndex < 0 ? others.length : beforeIndex, 0, folder);
              this.data.workspace.folders = others;
            }
          }
          const response = {
            revision: ++this.data.workspace.foldersRevision,
            folders: structuredClone(this.data.workspace.folders),
            materialOrder: this.data.workspace.materials.map(({ id, folderId }) => ({
              id,
              folderId,
            })),
          };
          this.folderReceipts.set(body.requestId, { request: body, response });
          if (this.folderMode === 'lostResponse') {
            this.folderMode = 'success';
            this.expectedNetworkFailures.push(request.url());
            await route.abort('failed');
          } else {
            await route.fulfill({ json: response });
          }
          return;
        }
        if (method === 'GET' && path === `/api/campaigns/${campaignId}/materials`) {
          const requestNumber = this.bulkReads.length + 1;
          this.bulkReads.push(requestNumber);
          const documents = structuredClone(
            [...this.data.materials, ...this.createdMaterials].map((material) =>
              material.id === readerId
                ? { ...material, document: this.savedDocument, revision: this.revision }
                : {
                    ...material,
                    document: this.noteDocuments.get(material.id) ?? material.document,
                  },
            ),
          );
          await this.bulkReadGates.get(requestNumber)?.promise;
          if (this.bulkFailures > 0) {
            this.bulkFailures--;
            this.expectedHttpErrors.push({ url: request.url(), status: 503 });
            await route.fulfill({
              status: 503,
              json: { code: 'fixtureUnavailable', detail: 'Private material preload diagnostic.' },
            });
          } else {
            await route.fulfill({ json: documents });
          }
          this.completedBulkReads.push(requestNumber);
          return;
        }
        if (method === 'GET' && path === `/api/campaigns/${campaignId}/materials/search`) {
          const query = url.searchParams.get('query');
          if (query === null) {
            throw new Error('Search requests require the query parameter.');
          }
          this.searches.push(query);
          const response = this.searchResponses.get(query) ?? { results: [], hasMore: false };
          await this.searchGates.get(query)?.promise;
          if (this.searchFailures > 0) {
            this.searchFailures--;
            this.expectedHttpErrors.push({ url: request.url(), status: 503 });
            await route.fulfill({
              status: 503,
              json: { code: 'fixtureUnavailable', detail: 'Private search diagnostic.' },
            });
          } else {
            await route.fulfill({ json: response });
          }
          this.completedSearches.push(query);
          return;
        }
        if (
          method === 'GET' &&
          this.data.workspace.maps.some((map) => path === `/api/assets/${map.assetId}`)
        ) {
          await route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#567b87"/><path d="M0 300H800M400 0V600" stroke="#c3d0cd" stroke-width="8"/></svg>',
          });
          return;
        }
        if (method === 'GET' && path === '/api/workspace') {
          if (this.workspaceFailures > 0) {
            this.workspaceFailures--;
            this.expectedHttpErrors.push({ url: request.url(), status: 503 });
            await route.fulfill({ status: 503, json: { code: 'fixtureUnavailable' } });
          } else {
            await route.fulfill({ json: this.data.workspace });
          }
          return;
        }
        if (method === 'GET' && path === `/api/campaigns/${campaignId}/game`) {
          await route.fulfill({ json: this.data.game });
          return;
        }
        if (method === 'POST' && path === `/api/campaigns/${campaignId}/materials`) {
          const body: unknown = request.postDataJSON();
          if (
            !record(body) ||
            typeof body['id'] !== 'string' ||
            typeof body['title'] !== 'string' ||
            (body['folderId'] !== null && typeof body['folderId'] !== 'string')
          ) {
            throw new Error('Expected the exact note creation contract.');
          }
          expect(Object.keys(body).sort()).toEqual(['folderId', 'id', 'title']);
          expect(body['id']).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
          );
          const creation = { id: body['id'], title: body['title'], folderId: body['folderId'] };
          this.creations.push(creation);
          if (this.creationMode === 'hold') {
            await this.creationGate.promise;
          }
          if (this.creationMode === 'invalid') {
            const status = 400;
            const code = 'invalid_material_creation';
            this.expectedHttpErrors.push({ url: request.url(), status });
            await route.fulfill({
              status,
              json: { code, detail: 'Private fixture diagnostic must never appear in the UI.' },
            });
            return;
          }
          const id = `note-${creation.id}`;
          const existing = this.createdMaterials.find((item) => item.id === id);
          if (existing) {
            expect(existing.title).toBe(creation.title);
            expect(existing.folderId).toBe(creation.folderId);
          }
          const folder = this.data.workspace.folders.find((item) => item.id === creation.folderId);
          expect(
            creation.folderId === null || folder !== undefined,
            'Creation must use a fixture-owned folder.',
          ).toBe(true);
          const material: MaterialDto = existing ?? {
            id,
            title: creation.title,
            folderId: creation.folderId,
            group: folder?.title ?? '',
            document: { type: 'doc', content: [{ type: 'paragraph' }] },
            documentSchemaVersion: 1,
            revision: 1,
          };
          if (!existing) {
            this.createdMaterials.push(material);
            const { title, group, folderId } = material;
            this.data.workspace.materials.push({ id, title, group, folderId });
          }
          if (this.creationMode === 'lostResponse') {
            // Commit in the intercepted fixture, then lose the response. This is frontend evidence only.
            this.creationMode = 'success';
            this.expectedNetworkFailures.push(request.url());
            await route.abort('failed');
          } else {
            await route.fulfill({
              status: existing ? 200 : 201,
              json: { ...material, document: this.noteDocuments.get(id) ?? material.document },
            });
          }
          return;
        }
        const material =
          this.data.materials.find((item) => path === `/api/materials/${item.id}`) ??
          this.createdMaterials.find((item) => path === `/api/materials/${item.id}`);
        if (material && method === 'GET') {
          this.materialReads.push(material.id);
          if (this.materialInspectionAllowed) {
            if (this.materialInspectionFailures > 0) {
              this.materialInspectionFailures--;
              this.expectedHttpErrors.push({ url: request.url(), status: 503 });
              await route.fulfill({ status: 503, json: { code: 'fixtureReadFailure' } });
            } else {
              await route.fulfill({
                json:
                  material.id === readerId
                    ? { ...material, document: this.savedDocument, revision: this.revision }
                    : material,
              });
            }
            return;
          }
          this.unexpectedRequests.push(`${method} ${request.url()}`);
          await route.abort('blockedbyclient');
          return;
        }
        if (
          material &&
          (material.id === readerId || this.createdMaterials.includes(material)) &&
          method === 'PUT'
        ) {
          const body: unknown = request.postDataJSON();
          this.saves.push(body);
          if (this.saveMode === 'hold') {
            await this.saveGate.promise;
          }
          if (this.saveMode === 'conflict' || this.saveMode === 'failure') {
            const status = this.saveMode === 'conflict' ? 409 : 503;
            this.expectedHttpErrors.push({ url: request.url(), status });
            await route.fulfill({ status, json: { code: 'fixtureSaveFailure' } });
          } else {
            const revision = material.id === readerId ? this.revision : material.revision;
            expect(
              record(body) && body['expectedRevision'] === revision,
              'Save must use the confirmed fixture revision.',
            ).toBe(true);
            if (!record(body)) {
              throw new Error('Expected a material save object.');
            }
            if (material.id === readerId) {
              this.savedDocument = body['document'];
              await route.fulfill({ json: { revision: ++this.revision } });
            } else {
              if (
                !record(body['document']) ||
                body['document']['type'] !== 'doc' ||
                !Array.isArray(body['document']['content'])
              ) {
                throw new Error('Expected a note document with a supported root.');
              }
              this.noteDocuments.set(material.id, body['document']);
              await route.fulfill({ json: { revision: ++material.revision } });
            }
          }
          return;
        }
      }
      this.unexpectedRequests.push(`${method} ${request.url()}`);
      await route.abort('blockedbyclient');
    });
  }
}

export const test = base.extend<{ api: TestApi }>({
  api: [
    async ({ page, baseURL }, use) => {
      if (!baseURL) {
        throw new Error('UI tests require the isolated test server origin.');
      }
      const api = new TestApi();
      const errors: { message: string; url: string }[] = [];
      const runtimeErrors: string[] = [];
      const consoleListener = (message: import('@playwright/test').ConsoleMessage) => {
        if (message.type() === 'error') {
          errors.push({ message: message.text(), url: message.location().url });
        }
      };
      const runtimeListener = (error: Error) => runtimeErrors.push(error.message);
      page.on('console', consoleListener);
      page.on('pageerror', runtimeListener);
      await api.install(page, new URL(baseURL).origin);
      try {
        await use(api);
      } finally {
        api.releaseSave();
        api.meetings.release();
        api.releaseCreation();
        api.releaseFolders();
        api.releaseSearches();
        api.releaseBulkReads();
        page.off('console', consoleListener);
        page.off('pageerror', runtimeListener);
        const unexpectedErrors = errors.filter(
          (error) =>
            !api.expectedHttpErrors.some(
              (response) =>
                response.url === error.url &&
                error.message.startsWith(
                  `Failed to load resource: the server responded with a status of ${response.status} (`,
                ),
            ) &&
            !(
              api.expectedNetworkFailures.includes(error.url) &&
              error.message === 'Failed to load resource: net::ERR_FAILED'
            ),
        );
        expect(
          api.unexpectedRequests,
          'All API and external requests must have an explicit fixture.',
        ).toEqual([]);
        expect(runtimeErrors, 'The affected view must not raise browser runtime errors.').toEqual(
          [],
        );
        expect(
          unexpectedErrors,
          'The affected view must not log unexpected console errors.',
        ).toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };

export async function openReader(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
  await expect(page.locator('.save-state')).toHaveText(
    text('engine', 'material', 'status', 'saved'),
  );
}

export async function expectNoHorizontalOverflow(page: Page, container: Locator) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), {
      message: 'The application must fit the viewport horizontally.',
    })
    .toBe(true);
  await expect
    .poll(() => container.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), {
      message: 'The affected view must not overflow horizontally.',
    })
    .toBe(true);
}
