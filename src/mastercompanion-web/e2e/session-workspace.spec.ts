import type { MaterialDto, SessionRecord } from '@mastercompanion/contracts';
import type { Page } from '@playwright/test';
import { test, expect, text, expectNoHorizontalOverflow } from './fixtures';

const label = (key: string) => text('engine', 'meetings', key);
const materialLabel = (key: string) => text('engine', 'material', key);
const view = (page: Page) => page.locator('mc-session-view');
const editor = (page: Page) =>
  page.getByRole('textbox', { name: materialLabel('contentLabel'), exact: true });
const closeSessions = (page: Page) =>
  page.getByRole('button', {
    name: text('engine', 'workspace', 'closeTab') + ' ' + label('title'),
    exact: true,
  });

async function create(page: Page, title: string): Promise<void> {
  await view(page)
    .getByRole('button', { name: label('newSession'), exact: true })
    .click();
  await view(page).getByLabel(label('newTitle'), { exact: true }).fill(title);
  await view(page)
    .getByRole('button', { name: label('create'), exact: true })
    .click();
  await expect(view(page).getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(view(page).locator('mc-material-view')).toBeVisible();
}

async function selectSection(page: Page, key: string): Promise<void> {
  await view(page)
    .getByRole('tab', { name: label(key), exact: true })
    .click();
}

test('Creation cancellation returns focus to the list and content tabs work without lifecycle changes @session-workspace', async ({
  page,
  api,
}, testInfo) => {
  await page.goto('/sessions');
  await create(page, 'Focused meeting');
  await view(page)
    .getByRole('button', { name: label('newSession'), exact: true })
    .click();
  await view(page).getByLabel(label('newTitle'), { exact: true }).fill('Cancelled meeting');
  await page.keyboard.press('Escape');
  await expect(
    view(page).getByRole('button', { name: label('newSession'), exact: true }),
  ).toBeFocused();
  expect(api.meetings.snapshot.sessions).toHaveLength(1);
  const preparation = view(page).getByRole('tab', { name: label('preparation'), exact: true });
  await preparation.focus();
  await page.keyboard.press('ArrowRight');
  await expect(view(page).getByRole('tab', { name: label('notes'), exact: true })).toBeFocused();
  await expect(view(page).getByRole('tab', { name: label('notes'), exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(api.meetings.snapshot.sessions[0]?.status).toBe('planned');
  expect(api.meetings.requests).toHaveLength(1);
  await expect(view(page)).toContainText(label('startConsequence'));
  await expectNoHorizontalOverflow(page, view(page));
  await page.screenshot({
    path: testInfo.outputPath('workspace-play-notes.png'),
    animations: 'disabled',
  });
});

test('Preparation editor, undo history and scroll survive summary and standalone visits @session-workspace', async ({
  page,
  api,
}, testInfo) => {
  const sessionId = '11111111-2222-4333-8444-555555555555';
  const record: SessionRecord = {
    id: sessionId,
    title: 'Editor owner',
    status: 'planned',
    preparationMaterialId: `session-${sessionId}-prep`,
    notesMaterialId: `session-${sessionId}-notes`,
    summary: '',
    followUp: '',
    pinnedMaterialIds: [],
  };
  const preparation: MaterialDto = {
    id: record.preparationMaterialId,
    title: 'Saved preparation',
    group: '',
    folderId: null,
    revision: 1,
    documentSchemaVersion: 1,
    document: {
      type: 'doc',
      content: Array.from({ length: 70 }, (_, index) => ({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: `Preparation paragraph ${index}: keep the reader wide and the notes readable.`,
          },
        ],
      })),
    },
  };
  const notes: MaterialDto = {
    ...preparation,
    id: record.notesMaterialId,
    title: 'Saved play notes',
    document: { type: 'doc', content: [{ type: 'paragraph' }] },
  };
  api.meetings.seed(record, [preparation, notes]);
  await page.goto(`/sessions/${record.id}`);
  await expect(view(page).locator('mc-material-view')).toBeVisible();
  await view(page)
    .locator('mc-material-view')
    .getByRole('button', { name: materialLabel('edit'), exact: true })
    .click();
  const material = view(page).locator('mc-material-view');
  const original = await material.elementHandle();
  if (!original) {
    throw new Error('Expected the mounted preparation material.');
  }
  await editor(page).press('Control+End');
  await editor(page).pressSequentially(' Retained undo marker');
  await material.locator('.material-scroll').evaluate((element) => {
    element.scrollTop = 340;
  });
  const scroll = await material
    .locator('.material-scroll')
    .evaluate((element) => element.scrollTop);
  expect(scroll).toBeGreaterThan(0);
  await selectSection(page, 'summaryTab');
  await selectSection(page, 'preparation');
  await expect(editor(page)).toContainText('Retained undo marker');
  expect(await original.evaluate((element) => element.isConnected)).toBe(true);
  expect(await material.locator('.material-scroll').evaluate((element) => element.scrollTop)).toBe(
    scroll,
  );
  await material.getByRole('button', { name: materialLabel('undo'), exact: true }).click();
  await expect(editor(page)).not.toContainText('Retained undo marker');
  await expect(editor(page)).toContainText('Preparation paragraph 69');
  await view(page)
    .getByRole('button', { name: label('start'), exact: true })
    .click();
  await page.getByRole('button', { name: label('openActiveNotes'), exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/materials/${record.notesMaterialId}$`));
  await page.locator(`[data-material-id="${record.preparationMaterialId}"]`).click();
  expect(await original.evaluate((element) => element.isConnected)).toBe(true);
  await expect(page.locator('mc-material-view:visible')).toHaveCount(1);
  await expect(editor(page)).toHaveAttribute('contenteditable', 'true');
  await expect(editor(page)).toContainText('Preparation paragraph 69');
  await page.locator('[role="tab"][data-tab-id="@sessions"]').click();
  await expect(material).toBeVisible();
  await expect(page.locator(`mc-material-view#panel-${record.preparationMaterialId}`)).toHaveCount(
    1,
  );
  await closeSessions(page).click();
  await expect(page.locator('[role="tab"][data-tab-id="@sessions"]')).not.toBeVisible();
  await page.locator(`[role="tab"][data-tab-id="${record.preparationMaterialId}"]`).click();
  await expect(editor(page)).toContainText('Preparation paragraph 69');
  await page
    .getByRole('navigation', { name: text('engine', 'workspace', 'primaryNavigationLabel') })
    .getByRole('button', { name: label('title'), exact: true })
    .click();
  await expect(material).toBeVisible();
  expect(await original.evaluate((element) => element.isConnected)).toBe(true);
  await expectNoHorizontalOverflow(page, view(page));
  await page.screenshot({
    path: testInfo.outputPath('workspace-populated-preparation.png'),
    animations: 'disabled',
  });
});

test('Closing sessions waits for every document and recovers a failed save after remote record deletion @session-workspace', async ({
  page,
  api,
}) => {
  await page.goto('/sessions');
  await create(page, 'Deleted record draft');
  api.saveMode = 'failure';
  await view(page)
    .locator('mc-material-view')
    .getByRole('button', { name: materialLabel('edit'), exact: true })
    .click();
  await editor(page).fill('Recover this embedded document');
  await expect(page.locator('.save-error:visible')).toBeVisible();
  api.meetings.snapshot = { revision: api.meetings.snapshot.revision + 1, sessions: [] };
  await view(page)
    .getByRole('button', { name: label('refresh'), exact: true })
    .first()
    .click();
  await expect(view(page)).toContainText(label('deletedRecordRecovery'));
  await closeSessions(page).click();
  await expect(page.locator('[role="tab"][data-tab-id="@sessions"]')).toBeVisible();
  await expect(view(page)).toContainText(label('closeDocumentFailed'));
  await view(page)
    .getByRole('button', { name: label('openFailedDocument'), exact: true })
    .click();
  await expect(editor(page)).toContainText('Recover this embedded document');
  api.saveMode = 'success';
  await page.getByRole('button', { name: materialLabel('retrySave'), exact: true }).click();
  await expect(page.locator('.save-state:visible')).toHaveText(
    text('engine', 'material', 'status', 'saved'),
  );
  await page.locator('[role="tab"][data-tab-id="@sessions"]').click();
  await closeSessions(page).click();
  await expect(page.locator('[role="tab"][data-tab-id="@sessions"]')).not.toBeVisible();
});

test('Pending parent close remains serialized while the embedded document saves @session-workspace', async ({
  page,
  api,
}) => {
  await page.goto('/sessions');
  await create(page, 'Await confirmed save');
  api.saveMode = 'hold';
  await view(page)
    .locator('mc-material-view')
    .getByRole('button', { name: materialLabel('edit'), exact: true })
    .click();
  await editor(page).fill('Wait for my document');
  await closeSessions(page).click();
  await expect(page.locator('[role="tab"][data-tab-id="@sessions"]')).toBeVisible();
  await expect(closeSessions(page)).toBeDisabled();
  api.releaseSave();
  await expect(page.locator('[role="tab"][data-tab-id="@sessions"]')).not.toBeVisible();
});

test('A competing active meeting is named and Finish opens summary without changing game time @session-workspace', async ({
  page,
  api,
}, testInfo) => {
  await page.goto('/sessions');
  await create(page, 'Current meeting');
  await selectSection(page, 'notes');
  await view(page)
    .getByRole('button', { name: label('start'), exact: true })
    .click();
  await create(page, 'Upcoming meeting');
  await expect(view(page)).toContainText(
    label('otherActive').replace('{title}', 'Current meeting'),
  );
  await view(page)
    .getByRole('button', { name: label('showActive'), exact: true })
    .click();
  await expect(view(page).getByRole('tab', { name: label('notes'), exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await view(page)
    .getByRole('button', { name: label('complete'), exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: label('complete'), exact: true });
  await expect(dialog).toContainText(label('finishConsequence'));
  await dialog.getByRole('button', { name: label('confirmFinish'), exact: true }).click();
  await expect(
    view(page).getByRole('tab', { name: label('summaryTab'), exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.active-meeting-context')).toHaveCount(0);
  expect(api.meetings.snapshot.sessions[0]?.summary).toBe('');
  expect(api.data.game.snapshot.timeMinutes).toBe(1500);
  await expectNoHorizontalOverflow(page, view(page));
  await page.screenshot({
    path: testInfo.outputPath('workspace-empty-summary.png'),
    animations: 'disabled',
  });
});

test('Rename saves the record through the reachable menu while preserving document IDs @session-workspace', async ({
  page,
  api,
}) => {
  await page.goto('/sessions');
  await create(page, 'Original meeting');
  const original = api.meetings.snapshot.sessions[0];
  await view(page)
    .getByRole('button', { name: label('recordActions'), exact: true })
    .click();
  await page.getByRole('menuitem', { name: label('rename'), exact: true }).click();
  const dialog = page.getByRole('dialog', { name: label('rename'), exact: true });
  await dialog.getByLabel(label('name'), { exact: true }).fill('Renamed meeting');
  await dialog.getByRole('button', { name: label('save'), exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    view(page).getByRole('heading', { name: 'Renamed meeting', exact: true }),
  ).toBeVisible();
  expect(api.meetings.snapshot.sessions[0]?.preparationMaterialId).toBe(
    original?.preparationMaterialId,
  );
  expect(api.meetings.snapshot.sessions[0]?.notesMaterialId).toBe(original?.notesMaterialId);
});

test('Rename requires deliberate summary saving and cancellation never commits its draft @session-workspace', async ({
  page,
  api,
}) => {
  await page.goto('/sessions');
  await create(page, 'Independent drafts');
  await selectSection(page, 'summaryTab');
  await view(page)
    .locator('.summary-section')
    .getByRole('button', { name: label('edit'), exact: true })
    .click();
  await view(page)
    .getByRole('textbox', { name: label('summary'), exact: true })
    .fill('Unconfirmed summary');
  await view(page)
    .getByRole('button', { name: label('recordActions'), exact: true })
    .click();
  await page.getByRole('menuitem', { name: label('rename'), exact: true }).click();
  await expect(view(page)).toContainText(label('renameDraftBlocked'));
  await expect(page.getByRole('dialog', { name: label('rename'), exact: true })).not.toBeVisible();
  await expect(view(page).getByLabel(label('summary'), { exact: true })).toHaveValue(
    'Unconfirmed summary',
  );
  expect(api.meetings.snapshot.sessions[0]?.summary).toBe('');
  await view(page)
    .getByRole('button', { name: label('save'), exact: true })
    .click();
  await view(page)
    .getByRole('button', { name: label('recordActions'), exact: true })
    .click();
  await page.getByRole('menuitem', { name: label('rename'), exact: true }).click();
  const dialog = page.getByRole('dialog', { name: label('rename'), exact: true });
  await dialog.getByLabel(label('name'), { exact: true }).fill('Discarded new title');
  await dialog.getByRole('button', { name: label('cancelRename'), exact: true }).click();
  expect(api.meetings.snapshot.sessions[0]?.title).toBe('Independent drafts');
  expect(api.meetings.snapshot.sessions[0]?.summary).toBe('Unconfirmed summary');
  expect(api.meetings.requests).toHaveLength(2);
});

test('Unsaved rename protects reload and cancellation keeps the confirmed record @session-workspace', async ({
  page,
  api,
}) => {
  await page.goto('/sessions');
  await create(page, 'Confirmed meeting');
  await view(page)
    .getByRole('button', { name: label('recordActions'), exact: true })
    .click();
  await page.getByRole('menuitem', { name: label('rename'), exact: true }).click();
  const dialog = page.getByRole('dialog', { name: label('rename'), exact: true });
  await dialog.getByLabel(label('name'), { exact: true }).fill('Unsaved meeting title');

  const protectedDraft = await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(protectedDraft).toBe(true);
  await page.keyboard.press('Escape');

  await expect(dialog).not.toBeVisible();
  expect(api.meetings.snapshot.sessions[0]?.title).toBe('Confirmed meeting');
  const cancelledDraft = await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(cancelledDraft).toBe(false);
});

test('Parent close waits for a second document edited during the first save @session-workspace', async ({
  page,
  api,
}) => {
  await page.goto('/sessions');
  await create(page, 'Late document draft');
  const session = api.meetings.snapshot.sessions[0];
  if (!session) {
    throw new Error('Expected the created session.');
  }
  const notesSaveStarted = Promise.withResolvers<void>();
  const notesSaveGate = Promise.withResolvers<void>();
  await page.route(`**/api/materials/${session.notesMaterialId}`, async (route) => {
    if (route.request().method() === 'PUT') {
      notesSaveStarted.resolve();
      await notesSaveGate.promise;
    }
    await route.fallback();
  });
  try {
    api.saveMode = 'hold';
    await view(page)
      .locator('mc-material-view')
      .getByRole('button', { name: materialLabel('edit'), exact: true })
      .click();
    await editor(page).fill('First pending draft');
    await closeSessions(page).click();
    await expect(closeSessions(page)).toBeDisabled();

    await selectSection(page, 'notes');
    await view(page)
      .locator('mc-material-view')
      .getByRole('button', { name: materialLabel('edit'), exact: true })
      .click();
    await editor(page).fill('Second pending draft');
    await notesSaveStarted.promise;
    api.releaseSave();
    await expect(
      page.locator(`mc-material-view#panel-${session.preparationMaterialId} .save-state`),
    ).toHaveText(text('engine', 'material', 'status', 'saved'));
    await expect(closeSessions(page)).toBeDisabled();

    notesSaveGate.resolve();
    await expect(page.locator('[role="tab"][data-tab-id="@sessions"]')).not.toBeVisible();
    expect(api.saves).toHaveLength(2);
  } finally {
    api.releaseSave();
    notesSaveGate.resolve();
  }
});
