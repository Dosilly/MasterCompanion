import type { Page } from '@playwright/test';
import { test, expect, text, openReader, expectNoHorizontalOverflow } from './fixtures';
import { readerId, readerTitle } from './fixtures/campaign';
const dialogFor = (page: Page) =>
  page.getByRole('dialog', { name: text('engine', 'notes', 'newNote'), exact: true });
const titleFor = (page: Page) =>
  dialogFor(page).getByLabel(text('engine', 'notes', 'title'), { exact: true });
const folderFor = (page: Page) =>
  dialogFor(page).getByLabel(text('engine', 'notes', 'folder'), { exact: true });
const createFor = (page: Page) =>
  dialogFor(page).getByRole('button', { name: text('engine', 'notes', 'create'), exact: true });
async function openCreation(page: Page) {
  await page.getByRole('button', { name: text('engine', 'notes', 'newNote'), exact: true }).click();
  await expect(dialogFor(page)).toBeVisible();
  await expect(titleFor(page)).toBeFocused();
}
// All creation and save responses belong to the intercepted fixture. PostgreSQL evidence is separate.
test('Root note creation preserves keyboard focus and opens a persisted reader @notes', async ({
  page,
  api,
}, testInfo) => {
  // Arrange
  await openReader(page);
  const opener = page.getByRole('button', {
    name: text('engine', 'notes', 'newNote'),
    exact: true,
  });

  // Act
  await opener.focus();
  await page.keyboard.press('Enter');

  // Assert
  await expect(titleFor(page)).toBeFocused();

  // Act
  await page.keyboard.press('Escape');

  // Assert
  await expect(dialogFor(page)).not.toBeVisible();
  await expect(opener).toBeFocused();
  expect(api.creations).toHaveLength(0);

  // Act
  await openCreation(page);
  await titleFor(page).fill('  Campaign note  ');
  await folderFor(page).selectOption('');

  // Assert
  await expectNoHorizontalOverflow(page, dialogFor(page));
  // Arrange
  const dialogImage = testInfo.outputPath('note-creation-dialog.png');

  // Act
  await page.screenshot({ path: dialogImage, animations: 'disabled', caret: 'hide' });
  await testInfo.attach('note-creation-dialog', { path: dialogImage, contentType: 'image/png' });
  await createFor(page).click();

  // Assert
  await expect(dialogFor(page)).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Campaign note', exact: true })).toBeVisible();
  expect(api.creations).toEqual([
    expect.objectContaining({ title: 'Campaign note', folderId: null }),
  ]);
  expect(api.createdMaterials).toHaveLength(1);
  // Arrange
  const created = api.createdMaterials[0];
  if (!created) {
    throw new Error('Expected a confirmed root note.');
  }
  const note = page.locator(`#panel-${created.id}`);

  // Assert
  await expect(note.getByLabel(text('engine', 'material', 'contentLabel'))).toHaveAttribute(
    'contenteditable',
    'false',
  );
  await expect(note.locator('.editor-toolbar')).toHaveCount(0);
  await expect(page.locator(`[data-material-id="${created.id}"]`)).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator(`[data-material-id="${created.id}"]`)).toBeFocused();
  await expect(page.locator('[data-folder-id="@unfiled"]')).toHaveAttribute('open', '');
  await expectNoHorizontalOverflow(page, note.locator('.material-scroll'));
  // Arrange
  const readerImage = testInfo.outputPath('created-note-reader.png');

  // Act
  await page.screenshot({ path: readerImage, animations: 'disabled', caret: 'hide' });
  await testInfo.attach('created-note-reader', { path: readerImage, contentType: 'image/png' });

  // Assert
  expect(api.saves).toHaveLength(0);

  // Act
  await page.reload();

  // Assert
  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();

  // Act
  await page.locator('[data-folder-id="@unfiled"] > summary').click();
  await page.getByRole('button', { name: 'Campaign note', exact: true }).click();

  // Assert
  await expect(note.getByLabel(text('engine', 'material', 'contentLabel'))).toHaveAttribute(
    'contenteditable',
    'false',
  );
  expect(api.creations).toHaveLength(1);
});
test('Folder creation blocks repeated submissions and preserves another editable draft @notes @editor', async ({
  page,
  api,
}) => {
  // Arrange
  await openReader(page);
  api.saveMode = 'hold';
  api.creationMode = 'hold';

  // Act
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  const reader = page
    .locator(`#panel-${readerId}`)
    .getByLabel(text('engine', 'material', 'contentLabel'));
  await reader.fill('Draft retained while another note is created');

  // Assert
  await expect.poll(() => api.saves.length).toBe(1);

  // Act
  await page.getByRole('searchbox').fill('An unrelated filter');
  await openCreation(page);

  // Assert
  await expect(folderFor(page)).toHaveValue('ui-child');

  // Act
  await titleFor(page).fill('Nested note');
  await createFor(page).click();

  // Assert
  await expect.poll(() => api.creations.length).toBe(1);
  await expect(
    dialogFor(page).getByRole('button', { name: text('engine', 'notes', 'retry'), exact: true }),
  ).toBeDisabled();
  await expect(
    dialogFor(page).getByRole('button', { name: text('engine', 'notes', 'cancel'), exact: true }),
  ).toBeDisabled();

  // Act
  await page.keyboard.press('Escape');

  // Assert
  await expect(dialogFor(page)).toBeVisible();
  expect(api.createdMaterials).toHaveLength(0);

  // Act
  api.releaseCreation();

  // Assert
  await expect(page.getByRole('heading', { name: 'Nested note', exact: true })).toBeVisible();
  // Arrange
  const created = api.createdMaterials[0];
  if (!created) {
    throw new Error('Expected a confirmed folder note.');
  }

  // Assert
  expect(created.folderId).toBe('ui-child');
  await expect(page.locator('[data-folder-id="ui-root"]')).toHaveAttribute('open', '');
  await expect(page.locator('[data-folder-id="ui-child"]')).toHaveAttribute('open', '');
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(
    page.locator(`#panel-${created.id}`).getByLabel(text('engine', 'material', 'contentLabel')),
  ).toHaveAttribute('contenteditable', 'false');

  // Act
  await page.getByRole('tab', { name: `${readerTitle} •`, exact: true }).click();

  // Assert
  await expect(reader).toHaveText('Draft retained while another note is created');
  await expect(reader).toHaveAttribute('contenteditable', 'true');
  expect(api.saves).toHaveLength(1);

  // Act
  api.releaseSave();

  // Assert
  await expect(page.locator(`#panel-${readerId} .save-state`)).toHaveText(
    text('engine', 'material', 'status', 'saved'),
  );
  expect(api.creations).toHaveLength(1);
});
test('A lost creation response survives reload and retries the same request once @notes', async ({
  page,
  api,
}) => {
  // Arrange
  await openReader(page);
  api.creationMode = 'lostResponse';

  // Act
  await openCreation(page);
  await titleFor(page).fill('Uncertain note');
  await folderFor(page).selectOption('');
  await createFor(page).click();

  // Assert
  await expect(dialogFor(page).getByRole('alert')).toBeVisible();
  await expect(titleFor(page)).toHaveValue('Uncertain note');
  await expect(titleFor(page)).toBeDisabled();
  await expect(folderFor(page)).toBeDisabled();
  expect(api.createdMaterials).toHaveLength(1);
  expect(api.creations).toHaveLength(1);
  // Arrange
  const persisted = api.createdMaterials[0];
  if (!persisted) {
    throw new Error('Expected creation to commit before losing its response.');
  }
  // Another editor can save before this browser receives its creation confirmation.
  persisted.revision = 4;

  // Act
  api.noteDocuments.set(persisted.id, {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Current saved content' }] }],
  });
  await page.keyboard.press('Escape');

  // Assert
  await expect(dialogFor(page)).not.toBeVisible();
  await expect(page.locator('.note-recovery')).toBeVisible();

  // Act
  await page.reload();

  // Assert
  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();

  // Act
  await page.getByRole('button', { name: text('engine', 'notes', 'recover'), exact: true }).click();

  // Assert
  await expect(dialogFor(page)).toBeVisible();
  await expect(titleFor(page)).toHaveValue('Uncertain note');
  await expect(titleFor(page)).toBeDisabled();

  // Act
  await dialogFor(page)
    .getByRole('button', { name: text('engine', 'notes', 'retry'), exact: true })
    .click();

  // Assert
  await expect(page.getByRole('heading', { name: 'Uncertain note', exact: true })).toBeVisible();
  await expect(page.locator('.note-recovery')).toHaveCount(0);
  expect(api.creations).toHaveLength(2);
  expect(api.creations[1]).toEqual(api.creations[0]);
  expect(api.createdMaterials).toHaveLength(1);
  await expect(page.getByRole('tab', { name: 'Uncertain note', exact: true })).toHaveCount(1);
  const note = page
    .locator(`#panel-${persisted.id}`)
    .getByLabel(text('engine', 'material', 'contentLabel'));
  await expect(note).toHaveText('Current saved content');
  await expect(note).toHaveAttribute('contenteditable', 'false');
  expect(api.saves).toHaveLength(0);

  // Act
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  await note.fill('Edit after recovered confirmation');
  await page
    .getByRole('button', { name: text('engine', 'material', 'finishEditing'), exact: true })
    .click();

  // Assert
  await expect(note).toHaveAttribute('contenteditable', 'false');
  expect(api.saves).toEqual([expect.objectContaining({ expectedRevision: 4 })]);
});
test('Rejected creation retains editable input and renders title text safely after correction @notes', async ({
  page,
  api,
}) => {
  // Arrange
  await openReader(page);
  api.creationMode = 'invalid';

  // Act
  await openCreation(page);
  await titleFor(page).fill('Rejected draft');
  await folderFor(page).selectOption('ui-child');
  await createFor(page).click();

  // Assert
  await expect(dialogFor(page).getByRole('alert')).toBeVisible();
  await expect(dialogFor(page)).not.toContainText('Private fixture diagnostic');
  await expect(titleFor(page)).toHaveValue('Rejected draft');
  await expect(titleFor(page)).toBeEnabled();
  await expect(folderFor(page)).toHaveValue('ui-child');
  await expect(folderFor(page)).toBeEnabled();
  expect(api.createdMaterials).toHaveLength(0);
  // Arrange
  api.creationMode = 'success';
  const correctedTitle = 'Literal <script>fixture</script> title';

  // Act
  await titleFor(page).fill(correctedTitle);
  await createFor(page).click();

  // Assert
  await expect(page.getByRole('heading', { name: correctedTitle, exact: true })).toBeVisible();
  // Arrange
  const created = api.createdMaterials[0];
  if (!created) {
    throw new Error('Expected the corrected note to be persisted.');
  }

  // Assert
  await expect(page.locator(`#panel-${created.id} .reading-paper h1 script`)).toHaveCount(0);
  expect(api.creations).toHaveLength(2);
  expect(api.createdMaterials).toHaveLength(1);
  expect(api.saves).toHaveLength(0);
});
