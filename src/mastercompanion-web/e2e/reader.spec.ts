import { test, expect, text, openReader, expectNoHorizontalOverflow } from './fixtures';
import { readerId, readerTitle, linkedId, linkedTitle } from './fixtures/campaign';
test('Reader keeps useful width and rich content @reader @visual', async ({
  page,
  api,
}, testInfo) => {
  // Arrange
  const reader = page.locator(`#panel-${readerId}`);

  // Act
  await openReader(page);

  // Assert
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    testInfo.project.use.colorScheme ?? 'light',
  );
  await expect(reader.getByLabel(text('engine', 'material', 'contentLabel'))).toHaveAttribute(
    'contenteditable',
    'false',
  );
  await expect(reader.locator('.editor-toolbar')).toHaveCount(0);
  await expect(reader.getByRole('table')).toBeVisible();
  await expect(page.locator('[data-folder-id="ui-root"]')).toHaveAttribute('open', '');
  await expect(page.locator('[data-folder-id="ui-child"]')).toHaveAttribute('open', '');
  await expect(page.locator(`[data-material-id="${readerId}"]`)).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect
    .poll(() =>
      reader.locator('.reading-paper').evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBeGreaterThanOrEqual(900);
  await expectNoHorizontalOverflow(page, reader.locator('.material-scroll'));
  await expect(page).toHaveScreenshot('reader.png');
  expect(api.saves).toHaveLength(0);
});
test('Reader preserves scroll and keyboard tab navigation @reader', async ({ page, api }) => {
  // Arrange
  await openReader(page);

  // Act
  await page.getByRole('link', { name: 'Open linked material' }).click();

  // Assert
  await expect(page.getByRole('tab', { name: linkedTitle, exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const firstTab = page.getByRole('tab', { name: readerTitle, exact: true });

  // Act
  await firstTab.click();
  const scroll = page.locator(`#panel-${readerId} .material-scroll`);
  await scroll.evaluate((element) => (element.scrollTop = 450));

  // Assert
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(450);

  // Act
  await firstTab.focus();
  await page.keyboard.press('ArrowRight');

  // Assert
  await expect(page.getByRole('tab', { name: linkedTitle, exact: true })).toBeFocused();
  await expect(page.locator(`[data-material-id="${linkedId}"]`)).toHaveAttribute(
    'aria-current',
    'page',
  );

  // Act
  await page.keyboard.press('ArrowLeft');

  // Assert
  await expect(firstTab).toBeFocused();
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(450);
  expect(api.saves).toHaveLength(0);
});
test('Theme selection persists across reload @reader', async ({ page }, testInfo) => {
  // Arrange
  await openReader(page);
  const initial = testInfo.project.use.colorScheme ?? 'light';
  const changed = initial === 'dark' ? 'light' : 'dark';

  // Act
  await page
    .getByRole('button', {
      name: text('engine', 'workspace', initial === 'dark' ? 'lightMode' : 'darkMode'),
      exact: true,
    })
    .click();

  // Assert
  await expect(page.locator('html')).toHaveAttribute('data-theme', changed);

  // Act
  await page.reload();

  // Assert
  await expect(page.locator('html')).toHaveAttribute('data-theme', changed);
  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
});
test('Campaign load failure offers recovery @reader', async ({ page, api }) => {
  // Arrange
  api.workspaceFailures = 1;

  // Act
  await page.goto('/');

  // Assert
  await expect(page.getByRole('alert')).toContainText(
    text('engine', 'workspace', 'errors', 'campaignLoadFailed'),
  );

  // Act
  await page
    .getByRole('button', { name: text('engine', 'workspace', 'retry'), exact: true })
    .click();

  // Assert
  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
