import { test, expect, text, openReader, expectNoHorizontalOverflow } from './fixtures';
import { readerId, readerTitle, linkedId, linkedTitle } from './fixtures/campaign';

test('Reader keeps useful width and rich content @reader @visual', async ({ page, api }, testInfo) => {
  await openReader(page);
  const reader = page.locator(`#panel-${readerId}`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', testInfo.project.use.colorScheme ?? 'light');
  await expect(reader.getByLabel(text('engine', 'material', 'contentLabel'))).toHaveAttribute('contenteditable', 'false');
  await expect(reader.locator('.editor-toolbar')).toHaveCount(0);
  await expect(reader.getByRole('table')).toBeVisible();
  await expect(page.locator('[data-folder-id="ui-root"]')).toHaveAttribute('open', '');
  await expect(page.locator('[data-folder-id="ui-child"]')).toHaveAttribute('open', '');
  await expect(page.locator(`[data-material-id="${readerId}"]`)).toHaveAttribute('aria-current', 'page');
  await expect.poll(() => reader.locator('.reading-paper').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(900);
  await expectNoHorizontalOverflow(page, reader.locator('.material-scroll'));
  await expect(page).toHaveScreenshot('reader.png');
  expect(api.saves).toHaveLength(0);
});

test('Reader preserves scroll and keyboard tab navigation @reader', async ({ page, api }) => {
  await openReader(page);
  await page.getByRole('link', { name: 'Open linked material' }).click();
  await expect(page.getByRole('tab', { name: linkedTitle, exact: true })).toHaveAttribute('aria-selected', 'true');
  const firstTab = page.getByRole('tab', { name: readerTitle, exact: true });
  await firstTab.click();
  const scroll = page.locator(`#panel-${readerId} .material-scroll`);
  await scroll.evaluate(element => element.scrollTop = 450);
  await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBe(450);
  await firstTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: linkedTitle, exact: true })).toBeFocused();
  await expect(page.locator(`[data-material-id="${linkedId}"]`)).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('ArrowLeft');
  await expect(firstTab).toBeFocused();
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBe(450);
  expect(api.saves).toHaveLength(0);
});

test('Theme selection persists across reload @reader', async ({ page }, testInfo) => {
  await openReader(page);
  const initial = testInfo.project.use.colorScheme ?? 'light';
  const changed = initial === 'dark' ? 'light' : 'dark';
  await page.getByRole('button', { name: text('engine', 'workspace', 'darkMode'), exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', changed);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', changed);
  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
});

test('Campaign load failure offers recovery @reader', async ({ page, api }) => {
  api.workspaceFailures = 1;
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText(text('engine', 'workspace', 'errors', 'campaignLoadFailed'));
  await page.getByRole('button', { name: text('engine', 'workspace', 'retry'), exact: true }).click();
  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
