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
    .locator('.header-actions')
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
