import {
  test,
  expect,
  text,
  openReader,
  expectNoHorizontalOverflow,
  type TestApi,
} from './fixtures';
import { readerId, readerTitle } from './fixtures/campaign';
import { selectChoice } from './searchable-choice';

function largeChoices(api: TestApi): void {
  api.data.workspace.folders.push(
    ...Array.from({ length: 100 }, (_, index) => ({
      id: `choice-folder-${index}`,
      title: index === 99 ? 'Northern district' : `Chapter ${index}`,
      parentId: index === 99 ? 'choice-folder-98' : null,
    })),
  );
  api.data.workspace.materials.push(
    ...Array.from({ length: 200 }, (_, index) => ({
      id: `choice-material-${index}`,
      title: index >= 198 ? 'Shared title' : `Note ${index}`,
      folderId: index === 199 ? 'choice-folder-99' : 'choice-folder-0',
      group: 'Cached group',
    })),
  );
  api.data.materials.push(
    ...api.data.workspace.materials
      .filter((item) => item.id.startsWith('choice-material-'))
      .map((item) => ({
        ...item,
        revision: 1,
        documentSchemaVersion: 1,
        document: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: item.title }] }],
        },
      })),
  );
}

test('Session pinning filters 200 materials by title/path and keeps selection through empty results @choices', async ({
  page,
  api,
}, testInfo) => {
  largeChoices(api);
  await page.goto('/sessions');
  const view = page.locator('mc-session-view');
  await view
    .getByLabel(text('engine', 'meetings', 'newTitle'), { exact: true })
    .fill('Choice session');
  await view
    .getByRole('button', { name: text('engine', 'meetings', 'create'), exact: true })
    .click();
  const trigger = view.getByRole('button', {
    name: text('engine', 'meetings', 'chooseMaterial'),
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  const query = view.getByRole('combobox');
  await expect(query).toBeFocused();
  await query.fill('shared northern');
  await expect(view.getByRole('option')).toHaveCount(1);
  await expect(view.getByRole('option')).toContainText('Chapter 98 / Northern district');
  await page.keyboard.press('Enter');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('value', 'choice-material-199');

  await trigger.click();
  await query.fill('No such material');
  await expect(view.getByRole('status')).toContainText(text('engine', 'choices', 'noResults'));
  await expect(trigger).toHaveAttribute('value', 'choice-material-199');
  await page.keyboard.press('Enter');
  expect(api.meetings.requests).toHaveLength(1);
  await query.fill('');
  await expect(view.getByRole('option', { selected: true })).toContainText('Northern district');
  await query.fill('shared');
  await expect(view.getByRole('option')).toHaveCount(2);
  await expectNoHorizontalOverflow(page, view);
  await page.screenshot({
    path: testInfo.outputPath('searchable-material-choices.png'),
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await view.getByRole('button', { name: text('engine', 'meetings', 'pin'), exact: true }).click();
  await expect(view.locator('.pin-list')).toContainText('Shared title');
  expect(api.meetings.requests.at(-1)?.operation).toMatchObject({
    kind: 'pin',
    materialId: 'choice-material-199',
  });
});

test('Folder move searches 100 parent choices, keeps root/end, and Escape closes only the choice @choices', async ({
  page,
  api,
}) => {
  largeChoices(api);
  await openReader(page);
  await page.locator('[data-folder-id="ui-child"] > summary').click({ button: 'right' });
  await page.locator('[data-menu-action="move"]').click();
  const dialog = page.locator('.folder-management-dialog');
  const parent = dialog.locator('#folder-parent');
  await parent.click();
  await dialog.getByRole('combobox').fill('chapter 98 northern');
  await expect(dialog.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(parent).toHaveAttribute('value', 'choice-folder-99');
  await parent.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(parent).toBeFocused();
  await selectChoice(parent, '');
  await expect(dialog.locator('#folder-position')).toHaveAttribute('value', '');
  await selectChoice(dialog.locator('#folder-position'), 'choice-folder-98');
  await dialog
    .getByRole('button', { name: text('engine', 'folders', 'save'), exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(api.folderRequests.at(-1)?.operation).toEqual({
    kind: 'move',
    folderId: 'ui-child',
    parentId: null,
    beforeId: 'choice-folder-98',
  });
});

test('Note destination searches nested folder paths and disables confirmed choices while creating @choices', async ({
  page,
  api,
}) => {
  largeChoices(api);
  api.creationMode = 'hold';
  await openReader(page);
  await page.getByRole('button', { name: text('engine', 'notes', 'newNote'), exact: true }).click();
  const dialog = page.locator('.material-creation-dialog');
  await dialog
    .getByLabel(text('engine', 'notes', 'title'), { exact: true })
    .fill('Selected destination');
  const trigger = dialog.locator('#note-folder');
  await trigger.click();
  await dialog.getByRole('combobox').fill('Northern');
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('value', 'choice-folder-99');
  await dialog
    .getByRole('button', { name: text('engine', 'notes', 'create'), exact: true })
    .click();
  await expect.poll(() => api.creations.length).toBe(1);
  await expect(trigger).toBeDisabled();
  expect(api.creations[0]?.folderId).toBe('choice-folder-99');
  api.releaseCreation();
  await expect(
    page.getByRole('heading', { name: 'Selected destination', exact: true }),
  ).toBeVisible();
});

test('Material link insertion shares the title/path choice and preserves the editor selection @choices', async ({
  page,
  api,
}) => {
  largeChoices(api);
  await openReader(page);
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  const editor = page
    .locator(`#panel-${readerId}`)
    .getByLabel(text('engine', 'material', 'contentLabel'));
  await editor.focus();
  await page.keyboard.press('Control+Home');
  await page
    .getByRole('button', { name: text('engine', 'material', 'insertMaterialLink'), exact: true })
    .click();
  const dialog = page.locator('.editor-insertion-dialog:visible');
  const trigger = dialog.getByRole('button', {
    name: text('engine', 'material', 'linkTarget'),
    exact: true,
  });
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole('combobox').fill('shared northern');
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('value', 'choice-material-199');
  await dialog
    .getByRole('button', { name: text('engine', 'material', 'confirmInsertion'), exact: true })
    .click();
  await expect(editor.locator('a[href="#material/choice-material-199"]')).toHaveText(
    'Shared title',
  );
  await expect(editor).toBeFocused();
  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
});
