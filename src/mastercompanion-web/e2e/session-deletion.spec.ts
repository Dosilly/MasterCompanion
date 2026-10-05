import type { Page } from '@playwright/test';
import { test, expect, text } from './fixtures';

const label = (key: string) => text('engine', 'meetings', key);
const view = (page: Page) => page.locator('mc-session-view');
const dialog = (page: Page) => page.getByRole('dialog', { name: label('deleteTitle') });

async function createSession(page: Page, title: string): Promise<void> {
  await view(page).getByLabel(label('newTitle'), { exact: true }).fill(title);
  await view(page)
    .getByRole('button', { name: label('create'), exact: true })
    .click();
  await expect(view(page).getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function requestDeletion(page: Page, title: string): Promise<void> {
  await view(page)
    .getByRole('button', { name: label('deleteNamed').replace('{title}', title), exact: true })
    .click();
  await expect(dialog(page)).toBeVisible();
}

test('Cancelling deletion preserves the record and returns focus to its secondary action @sessions @session-deletion', async ({
  page,
  api,
}, testInfo) => {
  await page.goto('/sessions');
  await createSession(page, 'Unwanted test meeting');
  await requestDeletion(page, 'Unwanted test meeting');
  await expect(dialog(page)).toContainText(label('deleteConsequences'));
  await expect(
    dialog(page).getByRole('button', { name: label('cancelDelete'), exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath('session-deletion-confirmation.png'),
    animations: 'disabled',
  });

  await page.keyboard.press('Escape');

  await expect(dialog(page)).not.toBeVisible();
  await expect(
    view(page).getByRole('button', {
      name: label('deleteNamed').replace('{title}', 'Unwanted test meeting'),
      exact: true,
    }),
  ).toBeFocused();
  expect(api.meetings.snapshot.sessions).toHaveLength(1);
  expect(
    api.meetings.requests.filter((request) => request.operation.kind === 'delete'),
  ).toHaveLength(0);
});

test('Deleting an active meeting retains its open ordinary play notes and chooses the latest remaining record @sessions @session-deletion', async ({
  page,
  api,
}) => {
  await page.goto('/sessions');
  await createSession(page, 'Active meeting');
  await view(page)
    .getByRole('button', { name: label('start'), exact: true })
    .click();
  await expect(view(page).locator('.status')).toHaveText(
    text('engine', 'meetings', 'status', 'active'),
  );
  const active = api.meetings.snapshot.sessions[0];
  if (!active) {
    throw new Error('The scenario requires an active session.');
  }
  await view(page)
    .getByRole('button', { name: label('notes'), exact: true })
    .click();
  await expect(page.locator('.meeting-document-context')).toContainText('Active meeting');
  await page.locator('[role="tab"][data-tab-id="@sessions"]').click();
  await createSession(page, 'Next meeting');
  await view(page)
    .getByRole('button', {
      name: 'Active meeting ' + text('engine', 'meetings', 'status', 'active'),
      exact: true,
    })
    .click();
  const gameBefore = structuredClone(api.data.game);
  const documentsBefore = structuredClone(api.createdMaterials);
  await requestDeletion(page, 'Active meeting');
  await expect(dialog(page)).toContainText(label('deleteActiveConsequences'));

  await dialog(page)
    .getByRole('button', { name: label('confirmDelete'), exact: true })
    .click();

  await expect(dialog(page)).not.toBeVisible();
  await expect(
    view(page).getByRole('heading', { name: 'Next meeting', exact: true }),
  ).toBeVisible();
  await expect(
    view(page).getByRole('heading', { name: label('title'), exact: true }),
  ).toBeFocused();
  expect(api.meetings.snapshot.sessions).toHaveLength(1);
  expect(api.createdMaterials).toEqual(documentsBefore);
  expect(api.data.game).toEqual(gameBefore);
  await page.locator(`[role="tab"][data-tab-id="${active.notesMaterialId}"]`).click();
  await expect(page.locator('.meeting-document-context')).not.toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: label('notesDocument').replace('{title}', 'Active meeting'),
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', {
      name: label('notesDocument').replace('{title}', 'Active meeting'),
      exact: true,
    }),
  ).toBeVisible();
  expect(api.meetings.snapshot.sessions.some((record) => record.id === active.id)).toBe(false);
});

test('Dirty detail fields require explicit disposal and remain recoverable when deletion conflicts @sessions @session-deletion', async ({
  page,
  api,
}) => {
  await page.goto('/sessions');
  await createSession(page, 'Draft meeting');
  await view(page)
    .getByRole('button', { name: label('edit'), exact: true })
    .click();
  await view(page)
    .getByRole('textbox', { name: label('summary'), exact: true })
    .fill('Keep my unsaved summary');
  await requestDeletion(page, 'Draft meeting');
  await expect(
    dialog(page).getByRole('button', { name: label('confirmDelete'), exact: true }),
  ).toBeDisabled();
  await dialog(page)
    .getByRole('checkbox', { name: label('deleteDiscardDraft'), exact: true })
    .check();
  api.meetings.mode = 'conflict';

  await dialog(page)
    .getByRole('button', { name: label('confirmDelete'), exact: true })
    .click();

  await expect(dialog(page).getByRole('alert')).toContainText(
    text('engine', 'meetings', 'errors', 'conflict'),
  );
  await dialog(page)
    .getByRole('button', { name: label('cancelDelete'), exact: true })
    .click();
  await expect(
    view(page).getByRole('textbox', { name: label('summary'), exact: true }),
  ).toHaveValue('Keep my unsaved summary');
  expect(api.meetings.snapshot.sessions).toHaveLength(1);
  expect(
    api.meetings.requests.filter((request) => request.operation.kind === 'update'),
  ).toHaveLength(0);
});

test('A lost deletion response retries its exact identity and clears the explicitly discarded draft after confirmation @sessions @session-deletion', async ({
  page,
  api,
}) => {
  await page.goto('/sessions');
  await createSession(page, 'Disposable meeting');
  await view(page)
    .getByRole('button', { name: label('edit'), exact: true })
    .click();
  await view(page)
    .getByRole('textbox', { name: label('followUp'), exact: true })
    .fill('Discard only on confirmed success');
  await requestDeletion(page, 'Disposable meeting');
  await dialog(page)
    .getByRole('checkbox', { name: label('deleteDiscardDraft'), exact: true })
    .check();
  api.meetings.mode = 'lostResponse';
  await dialog(page)
    .getByRole('button', { name: label('confirmDelete'), exact: true })
    .click();
  await expect(dialog(page).getByRole('alert')).toContainText(
    text('engine', 'meetings', 'errors', 'uncertain'),
  );
  const original = api.meetings.requests.at(-1);

  await dialog(page)
    .getByRole('button', { name: label('retry'), exact: true })
    .click();

  await expect(dialog(page)).not.toBeVisible();
  await expect(view(page)).toContainText(label('empty'));
  expect(api.meetings.requests.at(-1)).toEqual(original);
  expect(api.createdMaterials).toHaveLength(2);
  await page
    .getByRole('button', {
      name: text('engine', 'workspace', 'closeTab') + ' ' + label('title'),
      exact: true,
    })
    .click();
  await expect(page.locator('[role="tab"][data-tab-id="@sessions"]')).not.toBeVisible();
});

test('Refreshing a remotely deleted session exposes its unsaved text until explicit recovery disposal @sessions @session-deletion', async ({
  page,
  api,
}) => {
  await page.goto('/sessions');
  await createSession(page, 'Deleted elsewhere');
  await view(page)
    .getByRole('button', { name: label('edit'), exact: true })
    .click();
  await view(page)
    .getByRole('textbox', { name: label('summary'), exact: true })
    .fill('Recover this summary');
  api.meetings.snapshot = { revision: api.meetings.snapshot.revision + 1, sessions: [] };

  await view(page)
    .getByRole('button', { name: label('refresh'), exact: true })
    .first()
    .click();

  const recovery = view(page).getByRole('region', {
    name: label('missingDraftTitle'),
    exact: true,
  });
  await expect(recovery.getByRole('textbox', { name: label('summary'), exact: true })).toHaveValue(
    'Recover this summary',
  );
  await expect(recovery).toContainText(label('missingDraftHint'));
  await recovery.getByRole('button', { name: label('discardMissingDraft'), exact: true }).click();
  await expect(recovery).not.toBeVisible();
});
