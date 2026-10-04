import type { Page } from '@playwright/test';
import { test, expect, text, openReader, expectNoHorizontalOverflow } from './fixtures';
import { readerId, readerTitle, linkedId, linkedTitle } from './fixtures/campaign';

const content = (page: Page, id: string) =>
  page.locator(`#panel-${id}`).getByLabel(text('engine', 'material', 'contentLabel'));
const refresh = (page: Page) =>
  page.getByRole('button', { name: text('engine', 'workspace', 'refreshMaterials'), exact: true });
const close = (page: Page, title: string) =>
  page.getByRole('button', {
    name: `${text('engine', 'workspace', 'closeTab')} ${title}`,
    exact: true,
  });
const paragraphDocument = (value: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
});

test('Startup preloads documents and tab close and reopen require no material reads @material-cache', async ({
  page,
  api,
}, testInfo) => {
  await openReader(page);
  await page.locator(`[data-material-id="${linkedId}"]`).click();
  await expect(content(page, linkedId)).toHaveText('Linked content opens in a separate tab.');

  await close(page, linkedTitle).click();
  await page.locator(`[data-material-id="${linkedId}"]`).click();

  await expect(content(page, linkedId)).toHaveText('Linked content opens in a separate tab.');
  expect(api.bulkReads).toEqual([1]);
  expect(api.materialReads).toEqual([]);
  expect(api.saves).toEqual([]);
  await expectNoHorizontalOverflow(page, page.locator('.material-nav'));
  const path = testInfo.outputPath('material-cache-ready.png');
  await page.screenshot({ path, animations: 'disabled', caret: 'hide' });
  await testInfo.attach('material-cache-ready', { path, contentType: 'image/png' });
});

test('Initial preload failure offers localized retry without individual request fallback @material-cache', async ({
  page,
  api,
}, testInfo) => {
  api.bulkFailures = 1;
  await page.goto('/');

  const alert = page.getByRole('alert');
  await expect(alert).toContainText(text('engine', 'materialCache', 'loadFailed'));
  await expect(alert).not.toContainText('Private material preload diagnostic');
  await expect(page.getByRole('tab')).toHaveCount(0);
  const path = testInfo.outputPath('material-cache-error.png');
  await page.screenshot({ path, animations: 'disabled', caret: 'hide' });
  await testInfo.attach('material-cache-error', { path, contentType: 'image/png' });

  await alert
    .getByRole('button', { name: text('engine', 'workspace', 'retry'), exact: true })
    .click();

  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(api.bulkReads).toEqual([1, 2]);
  expect(api.materialReads).toEqual([]);
});

test('Pending startup preload exposes loading and prevents duplicate refresh requests @material-cache', async ({
  page,
  api,
}) => {
  api.holdBulkRead(1);
  await page.goto('/');

  await expect(
    page.getByText(text('engine', 'materialCache', 'loading'), { exact: true }),
  ).toBeVisible();
  await expect(refresh(page)).toBeDisabled();
  expect(api.bulkReads).toEqual([1]);
  expect(api.materialReads).toEqual([]);

  api.releaseBulkReads();

  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
  await expect(refresh(page)).toBeEnabled();
  expect(api.bulkReads).toEqual([1]);
});

test('An unsupported document schema rejects the complete preload and offers retry @material-cache', async ({
  page,
  api,
}) => {
  api.data.materials[1].documentSchemaVersion = 2;
  await page.goto('/');

  await expect(page.getByRole('alert')).toContainText(
    text('engine', 'materialCache', 'loadFailed'),
  );
  await expect(page.getByRole('tab')).toHaveCount(0);
  expect(api.materialReads).toEqual([]);

  api.data.materials[1].documentSchemaVersion = 1;
  await page
    .getByRole('alert')
    .getByRole('button', { name: text('engine', 'workspace', 'retry'), exact: true })
    .click();

  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(api.bulkReads).toEqual([1, 2]);
  expect(api.materialReads).toEqual([]);
});

test('Confirmed edits survive close and reopen with the confirmed revision @material-cache', async ({
  page,
  api,
}) => {
  await openReader(page);
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  await content(page, readerId).fill('First confirmed cache edit');
  await expect.poll(() => api.revision).toBe(8);

  await close(page, readerTitle).click();
  await page.locator(`[data-material-id="${readerId}"]`).click();

  await expect(content(page, readerId)).toHaveText('First confirmed cache edit');
  await expect(content(page, readerId)).toHaveAttribute('contenteditable', 'false');
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  await content(page, readerId).fill('Second confirmed cache edit');
  await expect.poll(() => api.revision).toBe(9);
  expect(api.saves).toEqual([
    expect.objectContaining({ expectedRevision: 7 }),
    expect.objectContaining({ expectedRevision: 8 }),
  ]);
  expect(api.bulkReads).toEqual([1]);
  expect(api.materialReads).toEqual([]);
});

test('Refreshing materials preserves a mounted unsaved editor and updates closed documents @material-cache', async ({
  page,
  api,
}) => {
  api.saveMode = 'hold';
  await openReader(page);
  await page.locator(`[data-material-id="${linkedId}"]`).click();
  await expect(content(page, linkedId)).toBeVisible();
  await close(page, linkedTitle).click();
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  const editor = content(page, readerId);
  await editor.fill('Local draft kept through refresh');
  const mounted = await editor.elementHandle();
  await expect.poll(() => api.saves.length).toBe(1);
  api.savedDocument = paragraphDocument('Remote reader change');
  api.revision = 8;
  api.data.materials[1].document = paragraphDocument('Remote linked change');
  api.data.materials[1].revision = 4;

  await refresh(page).click();

  await expect.poll(() => api.completedBulkReads).toEqual([1, 2]);
  await expect(editor).toHaveText('Local draft kept through refresh');
  await expect(editor).toHaveAttribute('contenteditable', 'true');
  expect(await editor.evaluate((element, previous) => element === previous, mounted)).toBe(true);
  await page.locator(`[data-material-id="${linkedId}"]`).click();
  await expect(content(page, linkedId)).toHaveText('Remote linked change');
  expect(api.materialReads).toEqual([]);
  api.saveMode = 'conflict';
  api.releaseSave();
  await expect(page.locator(`#panel-${readerId} .save-state`)).toHaveText(
    text('engine', 'material', 'status', 'conflict'),
  );
  await expect(editor).toHaveText('Local draft kept through refresh');
  await mounted?.dispose();
});

test('A failed refresh retains cached documents and can be retried @material-cache', async ({
  page,
  api,
}) => {
  await openReader(page);
  api.bulkFailures = 1;

  await refresh(page).click();

  await expect(page.getByRole('alert')).toContainText(
    text('engine', 'materialCache', 'loadFailed'),
  );
  await page.locator(`[data-material-id="${linkedId}"]`).click();
  await expect(content(page, linkedId)).toHaveText('Linked content opens in a separate tab.');
  await page
    .getByRole('alert')
    .getByRole('button', { name: text('engine', 'workspace', 'retry'), exact: true })
    .click();

  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(api.bulkReads).toEqual([1, 2, 3]);
  expect(api.materialReads).toEqual([]);
});

test('A stale refresh response cannot replace a save confirmed during the request @material-cache', async ({
  page,
  api,
}) => {
  await openReader(page);
  api.holdBulkRead(2);
  await refresh(page).click();
  await expect.poll(() => api.bulkReads).toEqual([1, 2]);
  await expect(refresh(page)).toBeDisabled();

  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  await content(page, readerId).fill('Save confirmed after refresh started');
  await expect.poll(() => api.revision).toBe(8);
  await close(page, readerTitle).click();
  api.releaseBulkReads();

  await expect(refresh(page)).toBeEnabled();
  await page.locator(`[data-material-id="${readerId}"]`).click();
  await expect(content(page, readerId)).toHaveText('Save confirmed after refresh started');
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  await content(page, readerId).fill('Next edit uses the newer confirmed revision');
  await expect.poll(() => api.revision).toBe(9);
  expect(api.saves).toEqual([
    expect.objectContaining({ expectedRevision: 7 }),
    expect.objectContaining({ expectedRevision: 8 }),
  ]);
  expect(api.materialReads).toEqual([]);
});

test('Reload preloads persisted content into a new read-only session @material-cache', async ({
  page,
  api,
}) => {
  await openReader(page);
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  await content(page, readerId).fill('Persisted cache content after reload');
  await expect.poll(() => api.revision).toBe(8);

  await page.reload();

  await expect(content(page, readerId)).toHaveText('Persisted cache content after reload');
  await expect(content(page, readerId)).toHaveAttribute('contenteditable', 'false');
  expect(api.bulkReads).toEqual([1, 2]);
  expect(api.materialReads).toEqual([]);
});
