import { test, expect, text, expectNoHorizontalOverflow } from './fixtures';
import type { Page } from '@playwright/test';
import { readerId } from './fixtures/campaign';

const label = (key: string) => text('engine', 'meetings', key);
const view = (page: Page) => page.locator('mc-session-view');

async function create(page: Page, title: string): Promise<void> {
  const field = view(page).getByLabel(label('newTitle'));
  if (!(await field.isVisible())) {
    await view(page)
      .getByRole('button', { name: label('newSession'), exact: true })
      .click();
  }
  await field.fill(title);
  await view(page)
    .getByRole('button', { name: label('create'), exact: true })
    .click();
  await expect(view(page).getByRole('heading', { name: title, exact: true })).toBeVisible();
}

test('Record URLs, history and reload retain selection with independent drafts @session-workflow', async ({
  page,
  api,
}) => {
  await page.goto('/sessions');
  await create(page, 'First meeting');
  const first = api.meetings.snapshot.sessions[0];
  if (!first) {
    throw new Error('Expected the first meeting.');
  }
  await expect(page).toHaveURL(new RegExp(`/sessions/${first.id}$`));
  await view(page)
    .getByRole('tab', { name: label('summaryTab'), exact: true })
    .click();
  await view(page)
    .locator('.summary-section')
    .getByRole('button', { name: label('edit'), exact: true })
    .click();
  await view(page).getByLabel(label('summary'), { exact: true }).fill('First retained draft');
  await create(page, 'Second meeting');
  const second = api.meetings.snapshot.sessions[1];
  if (!second) {
    throw new Error('Expected the second meeting.');
  }
  await expect(page).toHaveURL(new RegExp(`/sessions/${second.id}$`));
  await expect(view(page).getByLabel(label('newTitle'))).not.toBeVisible();
  await view(page)
    .getByRole('tab', { name: label('summaryTab'), exact: true })
    .click();
  await view(page)
    .locator('.summary-section')
    .getByRole('button', { name: label('edit'), exact: true })
    .click();
  await view(page).getByLabel(label('followUp'), { exact: true }).fill('Second retained draft');
  await page.goBack();
  await expect(view(page).getByLabel(label('summary'), { exact: true })).toHaveValue(
    'First retained draft',
  );
  await page.goForward();
  await expect(view(page).getByLabel(label('followUp'), { exact: true })).toHaveValue(
    'Second retained draft',
  );
  await view(page)
    .getByRole('button', { name: label('discardDraft'), exact: true })
    .click();
  await page.goto(`/sessions/${first.id}`);
  await expect(view(page).getByRole('heading', { name: first.title, exact: true })).toBeVisible();
  await page.reload();
  await expect(view(page).getByRole('heading', { name: first.title, exact: true })).toBeVisible();
});

test('Direct material visits resolve active context and one action opens live notes @session-workflow', async ({
  page,
  api,
}, testInfo) => {
  await page.goto('/sessions');
  await create(page, 'Active meeting');
  await view(page)
    .getByRole('button', { name: label('start'), exact: true })
    .click();
  const meeting = api.meetings.snapshot.sessions[0];
  if (!meeting) {
    throw new Error('Expected an active meeting.');
  }
  await page.goto(`/materials/${readerId}`);
  await expect(
    page.getByRole('button', { name: label('openActiveNotes'), exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: label('openActiveNotes'), exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/materials/${meeting.notesMaterialId}$`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/materials/${readerId}$`));
  await page.getByRole('button', { name: meeting.title, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/sessions/${meeting.id}$`));
  await expect(view(page)).toContainText(label('finishConsequence'));
  await expectNoHorizontalOverflow(page, page.locator('.app-header'));
  await page.screenshot({ path: testInfo.outputPath('active-session.png') });
  await view(page)
    .getByRole('button', { name: label('complete'), exact: true })
    .click();
  await page
    .getByRole('dialog', { name: label('complete'), exact: true })
    .getByRole('button', { name: label('confirmFinish'), exact: true })
    .click();
  await expect(page.locator('.active-meeting-context')).toHaveCount(0);
  expect(api.data.game.snapshot.timeMinutes).toBe(1500);
  expect(api.meetings.snapshot.sessions[0]?.summary).toBe('');
});

test('Missing record address stays visible and does not select a different meeting @session-workflow', async ({
  page,
}) => {
  await page.goto('/sessions');
  await create(page, 'Existing meeting');
  await page.goto('/sessions/absent');
  await expect(view(page).getByRole('status')).toContainText(label('deletedRecordRecovery'));
  await expect(view(page).locator('.session-content')).not.toBeVisible();
  await expect(page).toHaveURL(/\/sessions\/absent$/);
  await view(page).getByRole('button').filter({ hasText: 'Existing meeting' }).click();
  await expect(
    view(page).getByRole('heading', { name: 'Existing meeting', exact: true }),
  ).toBeVisible();
});
