import type { Page } from '@playwright/test';
import { test, expect, text, openReader } from './fixtures';
import { readerId, readerTitle, linkedId } from './fixtures/campaign';
import { selectChoice } from './searchable-choice';

test.use({ timezoneId: 'Europe/Warsaw' });
const row = (page: Page, id: string) => page.locator(`.material-nav [data-material-id="${id}"]`);
const moveDialog = (page: Page) => page.locator('.material-move-dialog');

async function openMove(page: Page, id: string): Promise<void> {
  await row(page, id).focus();
  await page.keyboard.press('Shift+F10');
  await page.locator('[data-menu-action="move-material"]').click();
  await expect(moveDialog(page)).toBeVisible();
}

for (const target of [
  'encounter-queue',
  'avarice-arrival',
  'auril-arrival',
  'blight-character-41f8bec2-6c1b-4cf5-89de-cd0d58a1cf1a',
]) {
  test(`Pending action ${target} scrolls and focuses without leaving gameplay @ux-followup`, async ({
    page,
    api,
  }) => {
    await page.goto('/game');
    const label =
      target === 'encounter-queue'
        ? `${text('ythryn', 'expedition', 'queueTitle')}: 2`
        : target === 'avarice-arrival' || target === 'auril-arrival'
          ? text(
              'ythryn',
              'expedition',
              'factions',
              target === 'avarice-arrival' ? 'avarice' : 'auril',
            )
          : `Mira · ${text('ythryn', 'checks', 'recovery')}`;
    const reminder = page
      .locator('.pending-actions')
      .getByRole('button', { name: label, exact: true });
    await expect(reminder).toBeVisible();
    const url = page.url();

    await reminder.click();

    await expect(page.locator(`#${target}`)).toBeFocused();
    await expect(page.locator(`#${target}`)).toBeInViewport();
    expect(page.url()).toBe(url);
    await expect(page.locator('mc-game-view')).toBeVisible();
    expect(api.saves).toHaveLength(0);
    expect(api.data.game.snapshot.timeMinutes).toBe(1500);
  });
}

test('Suggested session name uses the local calendar date and permits closing an untouched form @ux-followup', async ({
  page,
  api,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-04T22:30:00Z'));
  await page.goto('/sessions');
  const name = text('engine', 'meetings', 'defaultTitle').replace('{date}', '2026-10-05');
  await expect(page.locator('#new-session-title')).toHaveValue(name);

  await page.locator('[data-tab-id="@sessions"] + button').click();

  await expect(page.locator('[data-tab-id="@sessions"]')).toHaveCount(0);
  await expect(page.locator('mc-session-view')).not.toBeVisible();
  expect(api.meetings.requests).toHaveLength(0);
});

test('Suggested session name can be submitted and resets after confirmed creation @ux-followup', async ({
  page,
  api,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-04T22:30:00Z'));
  await page.goto('/sessions');
  const name = text('engine', 'meetings', 'defaultTitle').replace('{date}', '2026-10-05');
  await expect(page.locator('#new-session-title')).toHaveValue(name);

  await page
    .locator('mc-session-view')
    .getByRole('button', { name: text('engine', 'meetings', 'create'), exact: true })
    .click();

  await expect(
    page.locator('mc-session-view').getByRole('heading', { name, exact: true }),
  ).toBeVisible();
  await expect(page.locator('#new-session-title')).toHaveValue(name);
  expect(api.meetings.snapshot.sessions[0]?.title).toBe(name);
});

test('Moving the active document through a searchable folder choice retains its editor and reloads the destination @ux-followup', async ({
  page,
  api,
}, testInfo) => {
  await openReader(page);
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  await openMove(page, readerId);
  const choice = moveDialog(page).locator('#material-move-folder');
  await choice.click();
  await moveDialog(page)
    .getByRole('combobox', { name: text('engine', 'choices', 'search'), exact: true })
    .fill('Fixture chapter');
  await moveDialog(page).locator('[data-choice-id="ui-root"]').click();
  await page.screenshot({ path: testInfo.outputPath('material-move-dialog.png') });

  await moveDialog(page)
    .getByRole('button', { name: text('engine', 'folders', 'save'), exact: true })
    .click();

  await expect(moveDialog(page)).not.toBeVisible();
  await expect(row(page, readerId)).toBeFocused();
  await expect(
    page.locator(
      `[data-folder-id="ui-root"] > .folder-contents > [data-material-id="${readerId}"]`,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: text('engine', 'material', 'contentLabel'), exact: true }),
  ).toBeVisible();
  expect(api.saves).toHaveLength(0);
  expect(api.folderRequests[0]?.operation).toEqual({
    kind: 'moveMaterial',
    materialId: readerId,
    folderId: 'ui-root',
    beforeId: null,
  });
  await page.reload();
  await expect(
    page.locator(
      `[data-folder-id="ui-root"] > .folder-contents > [data-material-id="${readerId}"]`,
    ),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
});

test('Dropping a document on a folder header moves it to that folder @ux-followup', async ({
  page,
  api,
}) => {
  await openReader(page);

  await row(page, linkedId).dragTo(page.locator('[data-folder-id="ui-root"] > summary'));

  await expect.poll(() => api.folderRequests.length).toBe(1);
  expect(api.folderRequests[0]?.operation).toEqual({
    kind: 'moveMaterial',
    materialId: linkedId,
    folderId: 'ui-root',
    beforeId: null,
  });
  await expect(
    page.locator(
      `[data-folder-id="ui-root"] > .folder-contents > [data-material-id="${linkedId}"]`,
    ),
  ).toBeVisible();
});

test('Moving a document to unfiled materials through the dialog opens the unfiled destination @ux-followup', async ({
  page,
  api,
}) => {
  await openReader(page);
  await openMove(page, readerId);
  await selectChoice(moveDialog(page).locator('#material-move-folder'), '');

  await moveDialog(page)
    .getByRole('button', { name: text('engine', 'folders', 'save'), exact: true })
    .click();

  await expect(
    page.locator(`[data-folder-id="@unfiled"] [data-material-id="${readerId}"]`),
  ).toBeVisible();
  expect(api.folderRequests[0]?.operation.folderId).toBeNull();
});

test('Dragging a document to the persistent unfiled drop target removes its folder assignment @ux-followup', async ({
  page,
  api,
}) => {
  await openReader(page);
  const source = await row(page, linkedId).boundingBox();
  if (!source) {
    throw new Error('Expected a visible material drag source.');
  }
  await page.mouse.move(source.x + 50, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + 65, source.y + source.height / 2 + 10);
  const destination = page.locator('.folder-root-drop');
  await expect(destination).toBeInViewport({ ratio: 1 });
  const bounds = await destination.boundingBox();
  if (!bounds) {
    throw new Error('Expected a visible unfiled drop target.');
  }

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.up();

  await expect.poll(() => api.folderRequests.length).toBe(1);
  expect(api.folderRequests[0]?.operation).toEqual({
    kind: 'moveMaterial',
    materialId: linkedId,
    folderId: null,
    beforeId: null,
  });
  await expect(
    page.locator(`[data-folder-id="@unfiled"] [data-material-id="${linkedId}"]`),
  ).toBeVisible();
});

test('Lost move response is retried with its original identity after reload @ux-followup', async ({
  page,
  api,
}) => {
  await openReader(page);
  api.folderMode = 'lostResponse';
  await openMove(page, linkedId);
  await selectChoice(moveDialog(page).locator('#material-move-folder'), 'ui-root');
  await moveDialog(page)
    .getByRole('button', { name: text('engine', 'folders', 'save'), exact: true })
    .click();
  await expect(moveDialog(page).getByRole('alert')).toContainText(
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
  expect(api.data.workspace.materials.find((item) => item.id === linkedId)?.folderId).toBe(
    'ui-root',
  );
});

test('Revision conflict leaves the move dialog open and the original folder unchanged @ux-followup', async ({
  page,
  api,
}) => {
  await openReader(page);
  api.folderMode = 'conflict';
  await openMove(page, linkedId);
  await selectChoice(moveDialog(page).locator('#material-move-folder'), 'ui-root');

  await moveDialog(page)
    .getByRole('button', { name: text('engine', 'folders', 'save'), exact: true })
    .click();

  await expect(moveDialog(page)).toBeVisible();
  await expect(moveDialog(page).getByRole('alert')).toContainText(
    text('engine', 'folders', 'errors', 'conflict'),
  );
  expect(api.data.workspace.materials.find((item) => item.id === linkedId)?.folderId).toBe(
    'ui-child',
  );
});
