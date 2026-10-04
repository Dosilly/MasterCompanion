import type { Page } from '@playwright/test';
import { test, expect, text, openReader, expectNoHorizontalOverflow } from './fixtures';
import { linkedId, linkedTitle, readerId, readerTitle } from './fixtures/campaign';

const folder = (page: Page, id: string) =>
  page.locator(`[data-folder-id="${id}"]`).locator('summary').first();
const action = (page: Page, id: string) => page.locator(`[role="menu"] [data-menu-action="${id}"]`);
const folderDialog = (page: Page) => page.locator('.folder-management-dialog');
const folderSave = (page: Page) =>
  folderDialog(page).getByRole('button', { name: text('engine', 'folders', 'save'), exact: true });

async function openFolderMenu(page: Page, id: string) {
  await folder(page, id).click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
}

test('Tab keyboard context menu returns focus to the original tab after Escape @folders @contextmenu', async ({
  page,
}) => {
  await openReader(page);
  const tab = page.getByRole('tab', { name: readerTitle, exact: true });
  await tab.focus();
  await page.keyboard.press('Shift+F10');
  await expect(action(page, 'close')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(tab).toBeFocused();
});

test('Folder drag distinguishes ordering from nesting and persists sibling order @folders', async ({
  page,
  api,
}) => {
  api.data.workspace.folders.push({ id: 'ui-other', title: 'Other chapter', parentId: null });
  await openReader(page);
  await folder(page, 'ui-other').dragTo(folder(page, 'ui-root'), {
    targetPosition: { x: 50, y: 2 },
  });
  await expect.poll(() => api.folderRequests.length).toBe(1);
  expect(api.folderRequests[0]?.operation).toEqual({
    kind: 'move',
    folderId: 'ui-other',
    parentId: null,
    beforeId: 'ui-root',
  });
  await expect(page.locator('.material-nav > details.nav-folder').first()).toHaveAttribute(
    'data-folder-id',
    'ui-other',
  );

  await folder(page, 'ui-other').dragTo(folder(page, 'ui-root'));
  await expect.poll(() => api.folderRequests.length).toBe(2);
  expect(api.folderRequests[1]?.operation).toEqual({
    kind: 'move',
    folderId: 'ui-other',
    parentId: 'ui-root',
    beforeId: null,
  });
  await expect(
    page.locator('[data-folder-id="ui-root"] [data-folder-id="ui-other"]'),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator('[data-folder-id="ui-root"] [data-folder-id="ui-other"]'),
  ).toBeVisible();
  expect(api.saves).toHaveLength(0);
});

test('Context menus dismiss outside, stay inside the viewport and preserve native reader actions @folders @contextmenu', async ({
  page,
  api,
}) => {
  await openReader(page);
  const viewport = page.viewportSize();
  if (!viewport) {
    throw new Error('Expected a configured browser viewport.');
  }
  await folder(page, 'ui-child').dispatchEvent('contextmenu', {
    clientX: viewport.width - 2,
    clientY: viewport.height - 2,
  });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  const bounds = await menu.boundingBox();
  if (!bounds) {
    throw new Error('Expected a visible menu at the viewport edge.');
  }
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
  await page.getByRole('heading', { name: readerTitle, exact: true }).click();
  await expect(menu).toHaveCount(0);
  await page.locator(`#panel-${readerId} .reading-paper`).click({ button: 'right' });
  await expect(menu).toHaveCount(0);
  expect(api.folderRequests).toHaveLength(0);
  expect(api.saves).toHaveLength(0);
});

test('Folder context note creation uses the clicked folder and preserves a cancelled draft @folders @notes', async ({
  page,
  api,
}) => {
  await openReader(page);
  await openFolderMenu(page, 'ui-root');
  await action(page, 'new-note').click();
  const dialog = page.getByRole('dialog', {
    name: text('engine', 'notes', 'newNote'),
    exact: true,
  });
  const title = dialog.getByLabel(text('engine', 'notes', 'title'), { exact: true });
  const destination = dialog.getByLabel(text('engine', 'notes', 'folder'), { exact: true });
  await expect(title).toBeFocused();
  await expect(destination).toHaveValue('ui-root');
  await title.fill('Context note');
  await page.keyboard.press('Escape');
  await expect(folder(page, 'ui-root')).toBeFocused();

  await openFolderMenu(page, 'ui-child');
  await action(page, 'new-note').click();
  await expect(title).toHaveValue('Context note');
  await expect(destination).toHaveValue('ui-child');
  await dialog
    .getByRole('button', { name: text('engine', 'notes', 'create'), exact: true })
    .click();

  await expect(page.getByRole('heading', { name: 'Context note', exact: true })).toBeVisible();
  expect(api.creations).toEqual([
    expect.objectContaining({ title: 'Context note', folderId: 'ui-child' }),
  ]);
  expect(api.saves).toHaveLength(0);
});

test('Folder rename preserves a mounted draft and persists across reload @folders @editor', async ({
  page,
  api,
}) => {
  await openReader(page);
  api.saveMode = 'hold';
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  const editor = page
    .locator(`#panel-${readerId}`)
    .getByLabel(text('engine', 'material', 'contentLabel'));
  await editor.fill('Draft survives folder rename');
  await expect.poll(() => api.saves.length).toBe(1);

  await openFolderMenu(page, 'ui-child');
  await action(page, 'rename').click();
  await expect(folderDialog(page).locator('#folder-title')).toBeFocused();
  await folderDialog(page).locator('#folder-title').fill('Renamed folder');
  await folderSave(page).click();

  await expect(folderDialog(page)).not.toBeVisible();
  await expect(folder(page, 'ui-child')).toContainText('Renamed folder');
  await expect(editor).toHaveText('Draft survives folder rename');
  await expect(editor).toHaveAttribute('contenteditable', 'true');
  await expect(page.locator(`[data-material-id="${readerId}"]`)).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(api.folderRequests).toEqual([
    expect.objectContaining({
      expectedRevision: 1,
      operation: { kind: 'rename', folderId: 'ui-child', title: 'Renamed folder' },
    }),
  ]);

  api.releaseSave();
  await expect(page.locator(`#panel-${readerId} .save-state`)).toHaveText(
    text('engine', 'material', 'status', 'saved'),
  );
  await page.reload();
  await expect(folder(page, 'ui-child')).toContainText('Renamed folder');
  await expect(editor).toHaveText('Draft survives folder rename');
});

test('Keyboard folder move exposes valid parents and retains the complete subtree @folders', async ({
  page,
  api,
}) => {
  api.data.workspace.folders.push({ id: 'ui-other', title: 'Other chapter', parentId: null });
  await openReader(page);
  await folder(page, 'ui-root').focus();
  await page.keyboard.press('Shift+F10');
  await expect(action(page, 'new-note')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(action(page, 'move')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(folderDialog(page).locator('#folder-parent')).toBeFocused();
  await expect(folderDialog(page).locator('#folder-parent option[value="ui-root"]')).toHaveCount(0);
  await expect(folderDialog(page).locator('#folder-parent option[value="ui-child"]')).toHaveCount(
    0,
  );
  await folderDialog(page).locator('#folder-parent').selectOption('ui-other');
  await folderSave(page).click();

  await expect(
    page.locator(
      '[data-folder-id="ui-other"] [data-folder-id="ui-root"] [data-folder-id="ui-child"]',
    ),
  ).toBeVisible();
  await expect(page.locator('[data-folder-id="ui-other"]')).toHaveAttribute('open', '');
  await expect(page.locator(`[data-material-id="${readerId}"]`)).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
  expect(api.folderRequests[0]?.operation).toEqual({
    kind: 'move',
    folderId: 'ui-root',
    parentId: 'ui-other',
    beforeId: null,
  });
  await expect(folder(page, 'ui-root')).toBeFocused();
  expect(api.saves).toHaveLength(0);
});

test('Native folder drag moves to the root and rejects nesting a folder inside its descendant @folders', async ({
  page,
  api,
}) => {
  await openReader(page);
  const root = folder(page, 'ui-root');
  const child = folder(page, 'ui-child');
  await root.dragTo(child);
  expect(api.folderRequests).toHaveLength(0);

  const source = await child.boundingBox();
  if (!source) {
    throw new Error('Expected a visible folder drag source.');
  }
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 15, source.y + source.height / 2 + 10);
  const destination = page.locator('.folder-root-drop');
  await expect(destination).toBeVisible();
  const target = await destination.boundingBox();
  if (!target) {
    throw new Error('Expected a visible campaign root drop target.');
  }
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
  await page.mouse.up();
  await expect.poll(() => api.folderRequests.length).toBe(1);
  await expect(page.locator('[data-folder-id="ui-root"] [data-folder-id="ui-child"]')).toHaveCount(
    0,
  );
  await expect(child).toBeVisible();
  expect(api.folderRequests[0]?.operation).toEqual({
    kind: 'move',
    folderId: 'ui-child',
    parentId: null,
    beforeId: null,
  });
});

test('A folder conflict retains rename input and refresh allows a deliberate retry @folders', async ({
  page,
  api,
}) => {
  await openReader(page);
  api.folderMode = 'conflict';
  await openFolderMenu(page, 'ui-child');
  await action(page, 'rename').click();
  await folderDialog(page).locator('#folder-title').fill('My folder name');
  await folderSave(page).click();

  await expect(folderDialog(page).getByRole('alert')).toBeVisible();
  await expect(folderDialog(page).locator('#folder-title')).toHaveValue('My folder name');
  await expect(folder(page, 'ui-child')).toContainText('Nested materials');
  await expect(folderDialog(page)).not.toContainText('Private fixture diagnostic');

  api.data.workspace.foldersRevision = 2;
  const externalFolder = api.data.workspace.folders.find((item) => item.id === 'ui-child');
  if (!externalFolder) {
    throw new Error('Expected the fixture child folder.');
  }
  externalFolder.title = 'Name from another window';
  api.folderMode = 'success';
  await folderDialog(page)
    .getByRole('button', { name: text('engine', 'folders', 'refresh'), exact: true })
    .click();
  await expect(folder(page, 'ui-child')).toContainText('Name from another window');
  await expect(folderDialog(page).locator('#folder-title')).toHaveValue('My folder name');
  await folderSave(page).click();

  await expect(folder(page, 'ui-child')).toContainText('My folder name');
  expect(api.folderRequests).toHaveLength(2);
  expect(api.folderRequests[1]?.expectedRevision).toBe(2);
  expect(api.folderRequests[1]?.requestId).not.toBe(api.folderRequests[0]?.requestId);
});

test('Lost folder confirmation survives reload and retries the identical request @folders', async ({
  page,
  api,
}) => {
  await openReader(page);
  api.folderMode = 'lostResponse';
  await openFolderMenu(page, 'ui-child');
  await action(page, 'rename').click();
  await folderDialog(page).locator('#folder-title').fill('Recovered folder');
  await folderSave(page).click();
  await expect(folderDialog(page).getByRole('alert')).toBeVisible();
  await expect(folderDialog(page).locator('#folder-title')).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(folder(page, 'ui-child')).toContainText('Recovered folder');
  await page
    .locator('.folder-recovery')
    .getByRole('button', { name: text('engine', 'folders', 'retry'), exact: true })
    .click();

  await expect(page.locator('.folder-recovery')).toHaveCount(0);
  expect(api.folderRequests).toHaveLength(2);
  expect(api.folderRequests[1]).toEqual(api.folderRequests[0]);
  expect(api.data.workspace.foldersRevision).toBe(2);
  expect(api.saves).toHaveLength(0);
});

test('Material context actions copy a stable address and reveal its navigation path @folders @contextmenu', async ({
  page,
  context,
  api,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openReader(page);
  await page.locator(`[data-material-id="${linkedId}"]`).click({ button: 'right' });
  await action(page, 'copy-link').click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(new URL(`/materials/${linkedId}`, page.url()).href);
  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();

  await page.locator(`[data-material-id="${linkedId}"]`).click({ button: 'right' });
  await action(page, 'open').click();
  await expect(page.getByRole('heading', { name: linkedTitle, exact: true })).toBeVisible();
  await folder(page, 'ui-root').click();
  await page.getByRole('tab', { name: linkedTitle, exact: true }).click({ button: 'right' });
  await action(page, 'reveal').click();

  await expect(page.locator(`[data-material-id="${linkedId}"]`)).toBeFocused();
  await expect(page.locator('[data-folder-id="ui-root"]')).toHaveAttribute('open', '');
  expect(api.saves).toHaveLength(0);
});

test('Close other tabs retains a draft when save fails @folders @contextmenu @editor', async ({
  page,
  api,
}) => {
  await openReader(page);
  api.saveMode = 'failure';
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  const editor = page
    .locator(`#panel-${readerId}`)
    .getByLabel(text('engine', 'material', 'contentLabel'));
  await editor.fill('Recoverable draft from failed save');
  await expect(page.locator(`#panel-${readerId} .save-state`)).toHaveText(
    text('engine', 'material', 'status', 'error'),
  );
  await page.locator(`[data-material-id="${linkedId}"]`).click();
  await page.getByRole('tab', { name: linkedTitle, exact: true }).click({ button: 'right' });
  await action(page, 'close-others').click();

  await expect(page.getByRole('tab', { name: `${readerTitle} •`, exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: linkedTitle, exact: true })).toBeVisible();
  await page.getByRole('tab', { name: `${readerTitle} •`, exact: true }).click();
  await expect(editor).toHaveText('Recoverable draft from failed save');
  await expect(editor).toHaveAttribute('contenteditable', 'true');
});

test('Context menu keyboard, focus return and themed presentation @folders @contextmenu @visual', async ({
  page,
  api,
}, testInfo) => {
  await openReader(page);
  const trigger = folder(page, 'ui-child');
  await trigger.focus();
  await page.keyboard.press('Shift+F10');
  await expect(action(page, 'new-note')).toBeFocused();
  await page.keyboard.press('End');
  await expect(action(page, 'toggle-expansion')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(action(page, 'new-note')).toBeFocused();
  await expectNoHorizontalOverflow(page, page.getByRole('menu'));
  await expect(page).toHaveScreenshot('folder-context-menu.png');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await openFolderMenu(page, 'ui-child');
  await action(page, 'move').click();
  await expectNoHorizontalOverflow(page, folderDialog(page));
  const image = testInfo.outputPath('folder-move-dialog.png');
  await page.screenshot({ path: image, animations: 'disabled', caret: 'hide' });
  await testInfo.attach('folder-move-dialog', { path: image, contentType: 'image/png' });
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  expect(api.folderRequests).toHaveLength(0);
});
