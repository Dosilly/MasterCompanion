import type { Page } from '@playwright/test';
import {
  test,
  expect,
  text,
  openReader,
  expectNoHorizontalOverflow,
  type TestApi,
} from './fixtures';
import { readerId, readerTitle } from './fixtures/campaign';

const label = (key: string) => text('engine', 'meetings', key);
const view = (page: Page) => page.locator('mc-session-view');
const sessionTab = (page: Page) => page.locator('[role="tab"][data-tab-id="@sessions"]');
function firstSession(api: TestApi) {
  const record = api.meetings.snapshot.sessions[0];
  if (!record) {
    throw new Error('The scenario requires a created session.');
  }
  return record;
}
async function openSessions(page: Page): Promise<void> {
  await page.goto('/sessions');
  await expect(
    view(page).getByRole('heading', { name: label('title'), exact: true }),
  ).toBeVisible();
  await expect(view(page).getByLabel(label('newTitle'), { exact: true })).toBeEnabled();
}
async function createSession(page: Page, title = 'Meeting one'): Promise<void> {
  await view(page).getByLabel(label('newTitle'), { exact: true }).fill(title);
  await view(page)
    .getByRole('button', { name: label('create'), exact: true })
    .click();
  await expect(view(page).getByRole('heading', { name: title, exact: true })).toBeVisible();
}

test('Preparation, pinned material and separate play notes use the existing editor @sessions', async ({
  page,
  api,
}, testInfo) => {
  await openSessions(page);
  await createSession(page);
  await view(page).getByLabel(label('chooseMaterial'), { exact: true }).selectOption(readerId);
  await view(page)
    .getByRole('button', { name: label('pin'), exact: true })
    .click();
  await expect(view(page).locator('.pin-list')).toContainText(readerTitle);
  await expectNoHorizontalOverflow(page, view(page));
  await page.screenshot({
    path: testInfo.outputPath('session-preparation.png'),
    animations: 'disabled',
  });

  await view(page)
    .locator('.pin-list')
    .getByRole('button', { name: readerTitle, exact: true })
    .click();
  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
  expect(firstSession(api).pinnedMaterialIds).toEqual([readerId]);
  await sessionTab(page).click();
  await view(page)
    .getByRole('button', { name: label('notes'), exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Meeting one · ' + label('notes'), exact: true }),
  ).toBeVisible();
  await expect(page.locator('.meeting-document-context')).toContainText('Meeting one');
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  const editor = page.getByRole('textbox', {
    name: text('engine', 'material', 'contentLabel'),
    exact: true,
  });
  await editor.fill('Recorded during this meeting');
  await expect(page.locator('.save-state:visible')).toHaveText(
    text('engine', 'material', 'status', 'saved'),
  );
  expect(api.noteDocuments.get(firstSession(api).notesMaterialId)).toEqual(
    expect.objectContaining({ type: 'doc' }),
  );
  await sessionTab(page).click();
  await view(page)
    .getByRole('button', { name: label('preparation'), exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: label('preparationDocument').replace('{title}', 'Meeting one'),
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('.tiptap:visible')).not.toContainText('Recorded during this meeting');
});

test('Session lifecycle preserves summary, follow-up and time across the next meeting and reload @sessions', async ({
  page,
  api,
}, testInfo) => {
  await openSessions(page);
  await createSession(page);
  const gameBefore = structuredClone(api.data.game);
  await view(page)
    .getByRole('button', { name: label('edit'), exact: true })
    .click();
  await view(page)
    .getByRole('textbox', { name: label('summary'), exact: true })
    .fill('Resolved the first scene');
  await view(page)
    .getByRole('textbox', { name: label('followUp'), exact: true })
    .fill('Return to the observatory');
  await view(page)
    .getByRole('button', { name: label('start'), exact: true })
    .click();
  await expect(view(page).locator('.status')).toHaveText(
    text('engine', 'meetings', 'status', 'active'),
  );
  await view(page)
    .getByRole('button', { name: label('complete'), exact: true })
    .click();
  await expect(view(page).locator('.status')).toHaveText(
    text('engine', 'meetings', 'status', 'completed'),
  );
  await page.screenshot({
    path: testInfo.outputPath('session-completed.png'),
    animations: 'disabled',
  });
  await createSession(page, 'Meeting two');
  await view(page)
    .getByRole('button', { name: label('edit'), exact: true })
    .click();
  await expect(
    view(page).getByRole('textbox', { name: label('summary'), exact: true }),
  ).toHaveValue('');
  await view(page)
    .getByRole('button', { name: label('start'), exact: true })
    .click();
  await expect(
    view(page).getByRole('button', { name: label('complete'), exact: true }),
  ).toBeEnabled();
  await page.reload();
  await view(page)
    .getByRole('button', {
      name: 'Meeting one ' + text('engine', 'meetings', 'status', 'completed'),
      exact: true,
    })
    .click();
  await view(page)
    .getByRole('button', { name: label('edit'), exact: true })
    .click();
  await expect(
    view(page).getByRole('textbox', { name: label('summary'), exact: true }),
  ).toHaveValue('Resolved the first scene');
  await expect(
    view(page).getByRole('textbox', { name: label('followUp'), exact: true }),
  ).toHaveValue('Return to the observatory');
  expect(api.data.game).toEqual(gameBefore);
  expect(api.createdMaterials).toHaveLength(4);
});

test('Text drafts survive material navigation and save before closing the sessions tab @sessions', async ({
  page,
  api,
}) => {
  await openReader(page);
  await page.getByRole('button', { name: label('title'), exact: true }).click();
  await createSession(page);
  await view(page)
    .getByRole('button', { name: label('edit'), exact: true })
    .click();
  await view(page)
    .getByRole('textbox', { name: label('summary'), exact: true })
    .fill('Draft remains mounted');
  await page.getByRole('tab', { name: readerTitle, exact: true }).click();
  await sessionTab(page).click();
  await expect(
    view(page).getByRole('textbox', { name: label('summary'), exact: true }),
  ).toHaveValue('Draft remains mounted');
  await page
    .getByRole('button', {
      name: text('engine', 'workspace', 'closeTab') + ' ' + label('title'),
      exact: true,
    })
    .click();
  await expect(sessionTab(page)).not.toBeVisible();
  expect(firstSession(api).summary).toEqual('Draft remains mounted');
  await page.goBack();
  await page.getByRole('button', { name: label('title'), exact: true }).click();
  await expect(
    view(page).getByRole('textbox', { name: label('summary'), exact: true }),
  ).toHaveValue('Draft remains mounted');
});

test('A conflicting save retains the draft through refresh and requires deliberate discard @sessions', async ({
  page,
  api,
}) => {
  await openSessions(page);
  await createSession(page);
  await view(page)
    .getByRole('button', { name: label('edit'), exact: true })
    .click();
  await view(page)
    .getByRole('textbox', { name: label('summary'), exact: true })
    .fill('Recoverable local draft');
  api.meetings.snapshot = {
    revision: 2,
    sessions: api.meetings.snapshot.sessions.map((item) => ({
      ...item,
      summary: 'Remote summary',
    })),
  };
  await view(page)
    .getByRole('button', { name: label('save'), exact: true })
    .click();
  await expect(view(page).getByRole('alert')).toContainText(
    text('engine', 'meetings', 'errors', 'conflict'),
  );
  await view(page)
    .getByRole('button', { name: label('refresh'), exact: true })
    .first()
    .click();
  await expect(
    view(page).getByRole('textbox', { name: label('summary'), exact: true }),
  ).toHaveValue('Recoverable local draft');
  await view(page)
    .getByRole('button', { name: label('save'), exact: true })
    .click();
  await expect(view(page).getByRole('alert')).toContainText(label('draftConflict'));
  expect(api.meetings.requests).toHaveLength(2);
  await view(page)
    .getByRole('button', { name: label('discardDraft'), exact: true })
    .click();
  await view(page)
    .getByRole('button', { name: label('edit'), exact: true })
    .click();
  await expect(
    view(page).getByRole('textbox', { name: label('summary'), exact: true }),
  ).toHaveValue('Remote summary');
});

test('Lost creation response retries after reload without duplicating records or documents @sessions', async ({
  page,
  api,
}) => {
  await openSessions(page);
  api.meetings.mode = 'lostResponse';
  await view(page).getByLabel(label('newTitle'), { exact: true }).fill('Recover this meeting');
  await view(page)
    .getByRole('button', { name: label('create'), exact: true })
    .click();
  await expect(view(page).getByRole('button', { name: label('retry'), exact: true })).toBeVisible();
  const first = api.meetings.requests[0];
  await page.reload();
  await view(page)
    .getByRole('button', { name: label('retry'), exact: true })
    .click();
  await expect(view(page).getByLabel(label('newTitle'), { exact: true })).toBeEnabled();
  expect(api.meetings.requests[1]).toEqual(first);
  expect(api.meetings.snapshot.sessions).toHaveLength(1);
  expect(api.createdMaterials).toHaveLength(2);
});

test('Pending writes block repeated actions and failed loading has visible retry @sessions', async ({
  page,
  api,
}) => {
  api.meetings.loadFails = true;
  await page.goto('/sessions');
  await expect(view(page).getByRole('alert')).toContainText(
    text('engine', 'meetings', 'errors', 'loadFailed'),
  );
  api.meetings.loadFails = false;
  await view(page)
    .getByRole('button', { name: label('refresh'), exact: true })
    .first()
    .click();
  await view(page).getByLabel(label('newTitle'), { exact: true }).fill('Pending meeting');
  api.meetings.mode = 'hold';
  await view(page)
    .getByRole('button', { name: label('create'), exact: true })
    .click();
  await expect(
    view(page).getByRole('button', { name: label('create'), exact: true }),
  ).toBeDisabled();
  expect(api.meetings.requests).toHaveLength(1);
  api.meetings.release();
  await expect(
    view(page).getByRole('heading', { name: 'Pending meeting', exact: true }),
  ).toBeVisible();
});
