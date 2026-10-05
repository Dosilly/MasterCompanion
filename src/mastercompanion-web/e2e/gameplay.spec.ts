import { test, expect, text, openReader, expectNoHorizontalOverflow } from './fixtures';
import { readerTitle } from './fixtures/campaign';
test('Game clock, expedition tools and Arcane Blight remain readable @gameplay @visual', async ({
  page,
  api,
}) => {
  // Arrange
  await openReader(page);

  // Act
  await page
    .getByRole('navigation', {
      name: text('engine', 'workspace', 'primaryNavigationLabel'),
      exact: true,
    })
    .getByRole('button', { name: new RegExp(`^${text('engine', 'game', 'title')}`) })
    .click();
  const game = page.locator('.game-view');

  // Assert
  await expect(
    page.getByRole('heading', { name: text('ythryn', 'expedition', 'title'), exact: true }),
  ).toBeVisible();
  await expect(page.locator('.tool-grid > section')).toHaveCount(4);
  await expect(page.locator('.encounter-queue')).toContainText(
    text('ythryn', 'expedition', 'queueTitle'),
  );
  await expect(page.locator('.blight-tool .character')).toHaveCount(2);
  await expect(game.getByRole('alert')).toHaveCount(0);
  await expectNoHorizontalOverflow(page, game);
  await expect(page).toHaveScreenshot('game-tools.png');
  const auril = page.getByRole('region', {
    name: text('ythryn', 'expedition', 'factions', 'auril'),
    exact: true,
  });

  // Act
  await auril.scrollIntoViewIfNeeded();

  // Assert
  await expect(auril).toHaveScreenshot('auril-arrival.png');

  // Act
  await page.locator('.encounter-queue').scrollIntoViewIfNeeded();

  // Assert
  await expect(page.locator('.encounter-queue')).toHaveScreenshot('encounter-queue.png');

  // Act
  await page.locator('.blight-tool').scrollIntoViewIfNeeded();

  // Assert
  await expect(page.locator('.blight-tool')).toHaveScreenshot('arcane-blight.png');
  const success = page.getByRole('button', {
    name: `${text('ythryn', 'success')} — Mira`,
    exact: true,
  });
  await expect(success).toBeDisabled();

  // Act
  await page.getByLabel(text('ythryn', 'dieResult'), { exact: true }).selectOption('4');

  // Assert
  await expect(success).toBeEnabled();

  // Act
  await page.getByRole('tab', { name: readerTitle, exact: true }).click();
  await page.getByRole('tab', { name: text('engine', 'game', 'title'), exact: true }).click();

  // Assert
  await expect(page.getByLabel(text('ythryn', 'dieResult'), { exact: true })).toHaveValue('4');
  expect(api.saves).toHaveLength(0);
});

test('Rival force counters and casualty inputs remain accessible @gameplay @forces @visual', async ({
  page,
}) => {
  await openReader(page);
  await page
    .getByRole('navigation', {
      name: text('engine', 'workspace', 'primaryNavigationLabel'),
      exact: true,
    })
    .getByRole('button', { name: new RegExp(`^${text('engine', 'game', 'title')}`) })
    .click();
  const forces = page.getByRole('region', { name: text('ythryn', 'forces', 'title'), exact: true });

  await forces.scrollIntoViewIfNeeded();

  await expect(forces).toBeVisible();
  await expect(forces.locator('[data-force-unit]')).toHaveCount(8);
  await expect(forces.locator('[data-force-unit="cultFanatics"] strong')).toHaveText('20');
  await expect(forces.locator('[data-force-unit="coldlightWalkers"] input')).toBeDisabled();
  const input = forces.getByLabel(
    `${text('ythryn', 'forces', 'lossCount')} — ${text('ythryn', 'forces', 'units', 'cultFanatics')}`,
    { exact: true },
  );
  await input.fill('5');
  await input.focus();
  await expect(input).toBeFocused();
  await expectNoHorizontalOverflow(page, forces);
  await forces.evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await expect(forces).toHaveScreenshot('rival-forces.png');
});

test('Confirmed casualty form writes one module operation and refreshes counters @gameplay @forces', async ({
  page,
  api,
}) => {
  const requests: unknown[] = [];
  await page.route('**/api/campaigns/*/game/operations', async (route) => {
    const body: unknown = route.request().postDataJSON();
    requests.push(body);
    expect(body).toMatchObject({
      expectedRevision: 12,
      kind: 'module',
      command: { kind: 'recordForceLoss', unit: 'cultFanatics', count: 5 },
    });
    if (
      typeof body !== 'object' ||
      body === null ||
      !('requestId' in body) ||
      typeof body.requestId !== 'string'
    ) {
      throw new Error('Expected a typed gameplay request identity.');
    }
    api.data.game.revision = 13;
    api.data.game.lastOperation = { requestId: body.requestId, kind: 'module', revision: 13 };
    const view = api.data.game.moduleView;
    if (
      typeof view !== 'object' ||
      view === null ||
      !('forces' in view) ||
      typeof view.forces !== 'object' ||
      view.forces === null
    ) {
      throw new Error('Expected a rival forces projection.');
    }
    api.data.game.moduleView = { ...view, forces: { ...view.forces, cultFanatics: 15 } };
    await route.fulfill({ json: api.data.game });
  });
  await openReader(page);
  await page
    .getByRole('navigation', {
      name: text('engine', 'workspace', 'primaryNavigationLabel'),
      exact: true,
    })
    .getByRole('button', { name: new RegExp(`^${text('engine', 'game', 'title')}`) })
    .click();
  const row = page.locator('[data-force-unit="cultFanatics"]');

  await row.locator('input').fill('5');
  await row.getByRole('button').click();

  await expect(row.locator('strong')).toHaveText('15');
  await expect(row.locator('input')).toHaveValue('');
  expect(requests).toHaveLength(1);
  expect(api.saves).toHaveLength(0);
});
