import { test, expect, text, openReader, expectNoHorizontalOverflow } from './fixtures';
import { readerTitle } from './fixtures/campaign';

test('Activity selection explains clock effects before submitting the selected rest @gameplay-hierarchy', async ({
  page,
  api,
}) => {
  const writes: unknown[] = [];
  await page.route('**/api/campaigns/*/game/operations', async (route) => {
    const body: unknown = route.request().postDataJSON();
    writes.push(body);
    expect(body).toMatchObject({ kind: 'shortRest', expectedRevision: 12 });
    if (
      typeof body !== 'object' ||
      body === null ||
      !('requestId' in body) ||
      typeof body.requestId !== 'string'
    ) {
      throw new Error('Expected an operation identity.');
    }
    api.data.game.revision++;
    api.data.game.snapshot.timeMinutes += 60;
    api.data.game.lastOperation = { requestId: body.requestId, kind: 'shortRest', revision: 13 };
    await route.fulfill({ json: api.data.game });
  });
  await page.goto('/game');
  const game = page.locator('mc-game-view');
  await expect(game).toContainText(text('engine', 'game', 'advanceEffect'));
  await game
    .getByRole('button', { name: text('engine', 'game', 'shortRest'), exact: true })
    .click();
  await expect(game).toContainText(text('engine', 'game', 'shortRestEffect'));
  expect(writes).toHaveLength(0);
  await game
    .getByRole('button', { name: text('engine', 'game', 'applyActivity'), exact: true })
    .click();
  await expect.poll(() => writes.length).toBe(1);
  await expect(
    game.getByRole('button', { name: text('engine', 'game', 'undo'), exact: true }),
  ).toBeEnabled();
});

test('Collapsed tools retain inputs and attention links open and focus their targets @gameplay-hierarchy', async ({
  page,
  api,
}, testInfo) => {
  await openReader(page);
  await page
    .getByRole('navigation', { name: text('engine', 'workspace', 'primaryNavigationLabel') })
    .getByRole('button', { name: new RegExp(`^${text('engine', 'game', 'title')}`) })
    .click();
  const blight = page.locator('.tool-section').filter({ has: page.locator('mc-ythryn-blight') });
  await expect(blight).not.toHaveAttribute('open', '');
  const reminder = page.locator('.pending-actions').getByRole('button').filter({ hasText: 'Mira' });
  await reminder.focus();
  await page.keyboard.press('Enter');
  await expect(blight).toHaveAttribute('open', '');
  const character = api.data.game.snapshot.party[1];
  if (!character) {
    throw new Error('The scenario requires the second party character.');
  }
  await expect(page.locator('#blight-character-' + character.id)).toBeFocused();
  const die = page.getByLabel(text('ythryn', 'dieResult'), { exact: true });
  await die.selectOption('4');
  await blight.locator('summary').first().click();
  await expect(page.locator('.pending-actions')).toBeVisible();
  await page.getByRole('tab', { name: readerTitle, exact: true }).click();
  await page.getByRole('tab', { name: text('engine', 'game', 'title'), exact: true }).click();
  await reminder.click();
  await expect(die).toHaveValue('4');
  await expectNoHorizontalOverflow(page, page.locator('.game-view'));
  await page.screenshot({ path: testInfo.outputPath('gameplay-hierarchy.png') });
  expect(api.saves).toHaveLength(0);
});

test('Arrival review names the target, entered time and Auril conversion before submission @gameplay-hierarchy', async ({
  page,
}) => {
  await page.goto('/game');
  const auril = page.locator('#auril-arrival');
  await auril.locator('input').fill('1440');
  await expect(auril.locator('.consequence-review')).toContainText('1440');
  await expect(auril.locator('.consequence-review')).toContainText(
    text('ythryn', 'expedition', 'conversionHint'),
  );
  await expect(
    auril.getByRole('button', {
      name: `${text('ythryn', 'expedition', 'confirmArrival')} — ${text('ythryn', 'expedition', 'factions', 'auril')}`,
      exact: true,
    }),
  ).toBeVisible();
});

test('Five character tools show a named transformation consequence before the third failure @gameplay-hierarchy', async ({
  page,
  api,
}, testInfo) => {
  const view = api.data.game.moduleView;
  if (
    typeof view !== 'object' ||
    view === null ||
    !('characters' in view) ||
    !Array.isArray(view.characters)
  ) {
    throw new Error('Expected a character projection.');
  }
  const extra = ['Kael', 'Lina', 'Oren'].map((name) => ({ id: crypto.randomUUID(), name }));
  api.data.game.snapshot.party.push(...extra);
  const characters: unknown[] = view.characters;
  api.data.game.moduleView = {
    ...view,
    characters: [
      ...characters.map((character) =>
        typeof character === 'object' &&
        character !== null &&
        'status' in character &&
        character.status === 'infected'
          ? { ...character, failures: 2 }
          : character,
      ),
      ...extra.map((character) => ({
        id: character.id,
        status: 'healthy',
        dc: 15,
        failures: 0,
        nextCheck: { kind: 'exposure', minute: 720, pending: true },
      })),
    ],
  };
  await page.goto('/game');
  await page.locator('.pending-actions').getByRole('button').filter({ hasText: 'Mira' }).click();
  await expect(page.locator('.blight-tool .character')).toHaveCount(5);
  await expect(page.locator('.transformation-review')).toHaveText(
    text('ythryn', 'transformationReview').replace('{name}', 'Mira'),
  );
  await expectNoHorizontalOverflow(page, page.locator('.blight-tool'));
  await page.screenshot({ path: testInfo.outputPath('five-characters.png') });
});
