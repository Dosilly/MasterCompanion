import type { Page } from '@playwright/test';
import { test, expect, text, openReader } from './fixtures';
import { linkedId, readerId } from './fixtures/campaign';
import { selectChoice } from './searchable-choice';

const row = (page: Page, id: string) => page.locator(`.material-nav [data-material-id="${id}"]`);
const dialog = (page: Page) => page.locator('.material-order-dialog');
async function keyboardOrder(page: Page, id: string) {
  await row(page, id).focus();
  await page.keyboard.press('Shift+F10');
  await page.locator('[role="menu"] [data-menu-action="reorder"]').click();
  await expect(dialog(page)).toBeVisible();
}

test('Material drag before a sibling persists on reload and preserves the mounted reader @ordering', async ({
  page,
  api,
}) => {
  await openReader(page);
  await row(page, linkedId).dragTo(row(page, readerId), { targetPosition: { x: 40, y: 3 } });
  await expect.poll(() => api.folderRequests.length).toBe(1);
  expect(api.folderRequests[0]?.operation).toEqual({
    kind: 'reorderMaterial',
    materialId: linkedId,
    folderId: 'ui-child',
    beforeId: readerId,
  });
  await expect(
    page.locator('[data-folder-id="ui-child"] [data-material-id]').first(),
  ).toHaveAttribute('data-material-id', linkedId);
  await expect(page.locator(`mc-material-view#panel-${readerId}`)).toBeVisible();
  await page.reload();
  await expect(
    page.locator('[data-folder-id="ui-child"] [data-material-id]').first(),
  ).toHaveAttribute('data-material-id', linkedId);
});

test('Keyboard position action sends the same last insertion and returns focus @ordering', async ({
  page,
  api,
}) => {
  await openReader(page);
  await keyboardOrder(page, readerId);
  await dialog(page).locator('#material-order-position').selectOption('last');
  await dialog(page)
    .getByRole('button', { name: text('engine', 'folders', 'save'), exact: true })
    .click();
  await expect(dialog(page)).not.toBeVisible();
  expect(api.folderRequests[0]?.operation).toEqual({
    kind: 'reorderMaterial',
    materialId: readerId,
    folderId: 'ui-child',
    beforeId: null,
  });
  await expect(row(page, readerId)).toBeFocused();
});

test('Cross-folder material drop is rejected and sends no organization write @ordering', async ({
  page,
  api,
}) => {
  for (const material of [...api.data.workspace.materials, ...api.data.materials]) {
    if (material.id === linkedId) {
      material.folderId = null;
    }
  }
  await openReader(page);
  await page.locator('[data-folder-id="@unfiled"] summary').click();
  await row(page, linkedId).dragTo(row(page, readerId), { targetPosition: { x: 40, y: 3 } });
  await expect(row(page, linkedId)).toBeVisible();
  expect(api.folderRequests).toHaveLength(0);
});

test('Unfiled material ordering uses null folder ownership @ordering', async ({ page, api }) => {
  for (const material of [...api.data.workspace.materials, ...api.data.materials]) {
    material.folderId = null;
  }
  await openReader(page);
  await keyboardOrder(page, linkedId);
  await dialog(page)
    .getByRole('button', { name: text('engine', 'folders', 'save'), exact: true })
    .click();
  await expect(dialog(page)).not.toBeVisible();
  expect(api.folderRequests[0]?.operation).toEqual({
    kind: 'reorderMaterial',
    materialId: linkedId,
    folderId: null,
    beforeId: readerId,
  });
});

test('Lost response keeps ordering recoverable after reload and replays one immutable request @ordering', async ({
  page,
  api,
}) => {
  await openReader(page);
  api.folderMode = 'lostResponse';
  await keyboardOrder(page, linkedId);
  await dialog(page)
    .getByRole('button', { name: text('engine', 'folders', 'save'), exact: true })
    .click();
  await expect(dialog(page).getByRole('alert')).toContainText(
    text('engine', 'folders', 'errors', 'uncertain'),
  );
  await page.reload();
  await page
    .locator('.folder-recovery')
    .getByRole('button', { name: text('engine', 'folders', 'retry'), exact: true })
    .click();
  await expect(page.locator('.folder-recovery')).toHaveCount(0);
  expect(api.folderRequests).toHaveLength(2);
  expect(api.folderRequests[1]).toEqual(api.folderRequests[0]);
  await expect(
    page.locator('[data-folder-id="ui-child"] [data-material-id]').first(),
  ).toHaveAttribute('data-material-id', linkedId);
});

for (const position of ['before', 'after'] as const) {
  test(`Keyboard ${position} a searched sibling submits a stable identity @ordering`, async ({
    page,
    api,
  }) => {
    await openReader(page);
    await keyboardOrder(page, readerId);
    await dialog(page).locator('#material-order-position').selectOption(position);
    await selectChoice(dialog(page).locator('#material-order-sibling'), linkedId);
    await page.screenshot({ path: test.info().outputPath('material-position.png') });
    await dialog(page)
      .getByRole('button', { name: text('engine', 'folders', 'save'), exact: true })
      .click();
    await expect(dialog(page)).not.toBeVisible();
    expect(api.folderRequests[0]?.operation).toEqual({
      kind: 'reorderMaterial',
      materialId: readerId,
      folderId: 'ui-child',
      beforeId: position === 'before' ? linkedId : null,
    });
  });
}

test('Material lower-edge drag appends after the last sibling @ordering', async ({ page, api }) => {
  await openReader(page);
  const bounds = await row(page, linkedId).boundingBox();
  if (!bounds) {
    throw new Error('The target material must be visible.');
  }
  await row(page, readerId).dragTo(row(page, linkedId), {
    targetPosition: { x: 40, y: bounds.height - 3 },
  });
  await expect.poll(() => api.folderRequests.length).toBe(1);
  expect(api.folderRequests[0]?.operation).toEqual({
    kind: 'reorderMaterial',
    materialId: readerId,
    folderId: 'ui-child',
    beforeId: null,
  });
  await expect(
    page.locator('[data-folder-id="ui-child"] [data-material-id]').last(),
  ).toHaveAttribute('data-material-id', readerId);
});
test('Ordering conflict retains confirmed order and the dialog position for recovery @ordering', async ({
  page,
  api,
}) => {
  await openReader(page);
  api.folderMode = 'conflict';
  await keyboardOrder(page, readerId);
  await dialog(page).locator('#material-order-position').selectOption('last');
  await dialog(page)
    .getByRole('button', { name: text('engine', 'folders', 'save'), exact: true })
    .click();
  await expect(dialog(page).getByRole('alert')).toContainText(
    text('engine', 'folders', 'errors', 'conflict'),
  );
  await expect(dialog(page).locator('#material-order-position')).toHaveValue('last');
  await expect(
    page.locator('[data-folder-id="ui-child"] [data-material-id]').first(),
  ).toHaveAttribute('data-material-id', readerId);
});

test('Confirmed session creation refreshes organization before ordering an existing note @ordering', async ({
  page,
  api,
}) => {
  const initialOrganizationRevision = api.data.workspace.foldersRevision;
  await openReader(page);
  await page
    .getByRole('navigation', {
      name: text('engine', 'workspace', 'primaryNavigationLabel'),
      exact: true,
    })
    .getByRole('button', { name: text('engine', 'meetings', 'title'), exact: true })
    .click();
  const sessions = page.locator('mc-session-view');
  await sessions
    .getByLabel(text('engine', 'meetings', 'newTitle'), { exact: true })
    .fill('Organization refresh fixture');
  await sessions
    .getByRole('button', { name: text('engine', 'meetings', 'create'), exact: true })
    .click();
  await expect(
    sessions.getByRole('heading', { name: 'Organization refresh fixture', exact: true }),
  ).toBeVisible();

  await keyboardOrder(page, readerId);
  await dialog(page).locator('#material-order-position').selectOption('last');
  await dialog(page)
    .getByRole('button', { name: text('engine', 'folders', 'save'), exact: true })
    .click();

  await expect(dialog(page)).not.toBeVisible();
  expect(api.folderRequests[0]?.expectedRevision).toBe(initialOrganizationRevision + 1);
  expect(api.folderRequests[0]?.operation.kind).toBe('reorderMaterial');
});
