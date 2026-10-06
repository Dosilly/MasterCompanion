import {
  test,
  expect,
  text,
  openReader,
  expectNoHorizontalOverflow,
  type TestApi,
} from './fixtures';
import type { Page } from '@playwright/test';
import { readerId, readerTitle } from './fixtures/campaign';

const recovery = (key: string) => text('engine', 'recovery', key);
const button = (page: Page, key: string) =>
  page.getByRole('button', { name: recovery(key), exact: true });

async function conflict(page: Page, api: TestApi): Promise<void> {
  await openReader(page);
  api.materialInspectionAllowed = true;
  api.saveMode = 'conflict';
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  await page
    .locator(`#panel-${readerId}`)
    .getByRole('textbox', { name: text('engine', 'material', 'contentLabel'), exact: true })
    .fill('Retained local draft');
  await page
    .getByRole('button', { name: text('engine', 'material', 'finishEditing'), exact: true })
    .click();
  await expect(page.locator('.save-state:visible')).toHaveText(
    text('engine', 'material', 'status', 'conflict'),
  );
  api.savedDocument = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Saved remote version' }] }],
  };
  api.revision = 8;
}

test('Saved-version inspection retains the draft and adoption ends editing without a write @draft-recovery @editor', async ({
  page,
  api,
}, testInfo) => {
  await conflict(page, api);
  await button(page, 'inspect').click();
  const dialog = page.getByRole('dialog', { name: recovery('inspect') });
  await expect(dialog.getByRole('document')).toHaveText('Saved remote version');
  await expectNoHorizontalOverflow(page, dialog);
  await page.screenshot({ path: testInfo.outputPath('recovery-dialog.png') });
  await button(page, 'back').click();
  await expect(button(page, 'inspect')).toBeFocused();
  await expect(
    page
      .locator(`#panel-${readerId}`)
      .getByRole('textbox', { name: text('engine', 'material', 'contentLabel'), exact: true }),
  ).toHaveText('Retained local draft');

  await button(page, 'inspect').click();
  await expect(dialog.getByRole('document')).toHaveText('Saved remote version');
  await button(page, 'adopt').click();
  await expect(page.locator(`#panel-${readerId}`).getByRole('document')).toHaveText(
    'Saved remote version',
  );
  await expect(page.getByRole('tab', { name: readerTitle, exact: true })).toBeVisible();
  expect(api.saves).toHaveLength(1);
});

test('Reapplying against an inspected revision preserves draft on another conflict and then saves deliberately @draft-recovery', async ({
  page,
  api,
}) => {
  await conflict(page, api);
  await button(page, 'inspect').click();
  await expect(page.getByRole('dialog').getByRole('document')).toHaveText('Saved remote version');
  await button(page, 'reapply').click();
  await expect.poll(() => api.saves.length).toBe(2);
  expect(api.saves[1]).toEqual(expect.objectContaining({ expectedRevision: 8 }));
  await expect(
    page
      .locator(`#panel-${readerId}`)
      .getByRole('textbox', { name: text('engine', 'material', 'contentLabel'), exact: true }),
  ).toHaveText('Retained local draft');
  api.revision = 9;
  api.saveMode = 'success';
  await button(page, 'inspect').click();
  await expect(page.getByRole('dialog').getByRole('document')).toHaveText('Saved remote version');
  await button(page, 'reapply').click();
  await expect(page.locator('.save-state:visible')).toHaveText(
    text('engine', 'material', 'status', 'saved'),
  );
  expect(api.saves[2]).toEqual(expect.objectContaining({ expectedRevision: 9 }));
});

test('Failed inspection and clipboard copying keep a manually selectable draft @draft-recovery', async ({
  page,
  api,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('Clipboard unavailable')) },
    });
  });
  await conflict(page, api);
  await page
    .getByRole('button', { name: text('engine', 'material', 'copyDraft'), exact: true })
    .click();
  await expect(page.getByLabel(recovery('manualCopy'))).toHaveValue('Retained local draft');
  api.materialInspectionFailures = 1;
  await button(page, 'inspect').click();
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText(recovery('loadFailed'));
  await button(page, 'refresh').click();
  await expect(page.getByRole('dialog').getByRole('document')).toHaveText('Saved remote version');
  await page.keyboard.press('Escape');
  await expect(
    page
      .locator(`#panel-${readerId}`)
      .getByRole('textbox', { name: text('engine', 'material', 'contentLabel'), exact: true }),
  ).toHaveText('Retained local draft');
});

test('Session recovery inspects remote fields and deliberately reapplies the retained draft @draft-recovery @sessions', async ({
  page,
  api,
}) => {
  const meetings = (key: string) => text('engine', 'meetings', key);
  await page.goto('/sessions');
  const view = page.locator('mc-session-view');
  await view.getByLabel(meetings('newTitle')).fill('Recoverable meeting');
  await view.getByRole('button', { name: meetings('create'), exact: true }).click();
  await view.getByRole('button', { name: meetings('edit'), exact: true }).click();
  await view.getByLabel(meetings('summary'), { exact: true }).fill('Local session draft');
  api.meetings.snapshot = {
    revision: 2,
    sessions: api.meetings.snapshot.sessions.map((record) => ({
      ...record,
      summary: 'Remote session summary',
    })),
  };
  await view.getByRole('button', { name: meetings('save'), exact: true }).click();
  await expect(view.getByRole('alert')).toContainText(
    text('engine', 'meetings', 'errors', 'conflict'),
  );
  await button(page, 'inspect').click();
  await expect(view.getByRole('region', { name: recovery('savedVersion') })).toContainText(
    'Remote session summary',
  );
  await expect(view.getByLabel(meetings('summary'), { exact: true })).toHaveValue(
    'Local session draft',
  );
  await button(page, 'reapply').click();
  await expect(view.locator('.record-text')).toContainText('Local session draft');
  expect(api.meetings.snapshot.sessions[0]?.summary).toBe('Local session draft');
});
