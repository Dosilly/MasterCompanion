import { readFileSync } from 'node:fs';
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { campaignFixture, campaignId, readerId, readerTitle } from './fixtures/campaign';

// Read canonical localization data, without importing private library implementations.
const catalogs: Record<'engine' | 'ythryn', unknown> = {
  engine: JSON.parse(readFileSync(new URL('../projects/engine/src/lib/i18n/pl.json', import.meta.url), 'utf8')),
  ythryn: JSON.parse(readFileSync(new URL('../projects/ythryn/src/lib/i18n/pl.json', import.meta.url), 'utf8')),
};
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function text(catalog: keyof typeof catalogs, ...keys: string[]): string {
  let value = catalogs[catalog];
  for (const key of keys) {
    if (!record(value)) throw new Error(`Invalid localization path: ${catalog}.${keys.join('.')}`);
    value = value[key];
  }
  if (typeof value !== 'string') throw new Error(`Missing localization message: ${catalog}.${keys.join('.')}`);
  return value;
}

export class TestApi {
  readonly data = campaignFixture();
  readonly saves: unknown[] = [];
  readonly unexpectedRequests: string[] = [];
  readonly expectedHttpErrors: { url: string; status: number }[] = [];
  savedDocument: unknown = this.data.materials[0].document;
  revision = this.data.materials[0].revision;
  workspaceFailures = 0;
  saveMode: 'success' | 'hold' | 'conflict' = 'success';
  private readonly saveGate = Promise.withResolvers<void>();

  releaseSave() { this.saveGate.resolve(); }

  async install(page: Page, origin: string) {
    // Catch every request before navigation. API calls never leave this browser context.
    await page.context().route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const method = request.method();
      if (url.origin === origin && !path.startsWith('/api/')) { await route.continue(); return; }
      if (url.origin === origin) {
        if (method === 'GET' && path === '/api/workspace') {
          if (this.workspaceFailures > 0) {
            this.workspaceFailures--;
            this.expectedHttpErrors.push({ url: request.url(), status: 503 });
            await route.fulfill({ status: 503, json: { code: 'fixtureUnavailable' } });
          } else await route.fulfill({ json: this.data.workspace });
          return;
        }
        if (method === 'GET' && path === `/api/campaigns/${campaignId}/game`) { await route.fulfill({ json: this.data.game }); return; }
        const material = this.data.materials.find(item => path === `/api/materials/${item.id}`);
        if (material && method === 'GET') {
          await route.fulfill({ json: material.id === readerId ? { ...material, document: this.savedDocument, revision: this.revision } : material });
          return;
        }
        if (material?.id === readerId && method === 'PUT') {
          const body: unknown = request.postDataJSON();
          this.saves.push(body);
          if (this.saveMode === 'hold') await this.saveGate.promise;
          if (this.saveMode === 'conflict') {
            this.expectedHttpErrors.push({ url: request.url(), status: 409 });
            await route.fulfill({ status: 409, json: { code: 'revisionConflict' } });
          } else {
            expect(record(body) && body['expectedRevision'] === this.revision, 'Save must use the confirmed fixture revision.').toBe(true);
            if (!record(body)) throw new Error('Expected a material save object.');
            this.savedDocument = body['document'];
            await route.fulfill({ json: { revision: ++this.revision } });
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
  api: [async ({ page, baseURL }, use) => {
    if (!baseURL) throw new Error('UI tests require the isolated test server origin.');
    const api = new TestApi();
    const errors: { message: string; url: string }[] = [];
    const runtimeErrors: string[] = [];
    const consoleListener = (message: import('@playwright/test').ConsoleMessage) => {
      if (message.type() === 'error') errors.push({ message: message.text(), url: message.location().url });
    };
    const runtimeListener = (error: Error) => runtimeErrors.push(error.message);
    page.on('console', consoleListener);
    page.on('pageerror', runtimeListener);
    await api.install(page, new URL(baseURL).origin);
    try { await use(api); }
    finally {
      api.releaseSave();
      page.off('console', consoleListener);
      page.off('pageerror', runtimeListener);
      const unexpectedErrors = errors.filter(error => !api.expectedHttpErrors.some(response => response.url === error.url &&
        error.message.startsWith(`Failed to load resource: the server responded with a status of ${response.status} (`)));
      expect(api.unexpectedRequests, 'All API and external requests must have an explicit fixture.').toEqual([]);
      expect(runtimeErrors, 'The affected view must not raise browser runtime errors.').toEqual([]);
      expect(unexpectedErrors, 'The affected view must not log unexpected console errors.').toEqual([]);
    }
  }, { auto: true }],
});

export { expect };

export async function openReader(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
  await expect(page.locator('.save-state')).toHaveText(text('engine', 'material', 'status', 'saved'));
}

export async function expectNoHorizontalOverflow(page: Page, container: Locator) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    { message: 'The application must fit the viewport horizontally.' }).toBe(true);
  await expect.poll(() => container.evaluate(element => element.scrollWidth <= element.clientWidth + 1),
    { message: 'The affected view must not overflow horizontally.' }).toBe(true);
}
