import type { MaterialSearchResult } from '@mastercompanion/contracts';
import type { Page } from '@playwright/test';
import { test, expect, text, openReader, expectNoHorizontalOverflow } from './fixtures';
import { readerId, readerTitle, linkedId, linkedTitle } from './fixtures/campaign';

const searchFor = (page: Page) => page.getByRole('searchbox');
const resultsFor = (page: Page) => page.locator('.search-result');
const readerResult: MaterialSearchResult = {
  id: readerId,
  title: readerTitle,
  folderId: 'ui-child',
  snippet: 'A long campaign note used to verify comfortable reading.',
};
const linkedResult: MaterialSearchResult = {
  id: linkedId,
  title: linkedTitle,
  folderId: 'ui-child',
  snippet: 'Linked content opens in a separate tab.',
};

test('A note found after workspace loading opens and joins navigation without reloading the reader @search', async ({
  page,
  api,
}) => {
  // Arrange
  const result = { ...linkedResult, id: 'note-created-in-another-tab', title: 'Another tab note' };
  api.createdMaterials.push({
    ...api.data.materials[1],
    id: result.id,
    title: result.title,
    revision: 1,
  });
  api.searchResponses.set('another tab', { results: [result], hasMore: false });
  await openReader(page);
  const reader = page
    .locator(`#panel-${readerId}`)
    .getByLabel(text('engine', 'material', 'contentLabel'));
  const mountedReader = await reader.elementHandle();

  // Act
  await searchFor(page).fill('another tab');
  await resultsFor(page).click();

  // Assert
  await expect(page.getByRole('heading', { name: result.title, exact: true })).toBeVisible();
  await expect(page.locator(`[data-material-id="${result.id}"]`)).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator(`[data-material-id="${result.id}"]`)).toBeFocused();
  expect(await reader.evaluate((element, previous) => element === previous, mountedReader)).toBe(
    true,
  );
  await mountedReader?.dispose();
  expect(api.saves).toHaveLength(0);
});

test('A failed result open preserves the query and results so opening can be retried @search', async ({
  page,
  api,
}) => {
  // Arrange
  api.searchResponses.set('content', { results: [linkedResult], hasMore: false });
  api.materialReadFailures.set(linkedId, 1);
  await openReader(page);

  // Act
  await searchFor(page).fill('content');
  await resultsFor(page).click();

  // Assert
  await expect(page.getByRole('alert')).toContainText(
    text('engine', 'workspace', 'errors', 'materialLoadFailed'),
  );
  await expect(searchFor(page)).toHaveValue('content');
  await expect(resultsFor(page).locator('.search-result-title')).toHaveText(linkedTitle);
  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();

  // Act
  await resultsFor(page).click();

  // Assert
  await expect(page.getByRole('heading', { name: linkedTitle, exact: true })).toBeVisible();
  await expect(searchFor(page)).toHaveValue('');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(api.searches).toEqual(['content']);
});

test('A result opening response retains a newer phrase entered during the material read @search', async ({
  page,
  api,
}) => {
  // Arrange
  api.materialReadGates.set(linkedId, Promise.withResolvers<void>());
  api.searchResponses.set('content', { results: [linkedResult], hasMore: false });
  api.searchResponses.set('new phrase', { results: [readerResult], hasMore: false });
  await openReader(page);

  // Act
  await searchFor(page).fill('content');
  const materialRequest = page.waitForRequest((request) =>
    request.url().endsWith(`/api/materials/${linkedId}`),
  );
  await resultsFor(page).click();
  await materialRequest;
  await searchFor(page).fill('new phrase');

  // Assert
  await expect(resultsFor(page).locator('.search-result-title')).toHaveText(readerTitle);

  // Act
  api.releaseMaterialReads();

  // Assert
  await expect(page.getByRole('heading', { name: linkedTitle, exact: true })).toBeVisible();
  await expect(searchFor(page)).toHaveValue('new phrase');
  await expect(resultsFor(page).locator('.search-result-title')).toHaveText(readerTitle);
});

// Responses are explicit UI fixtures. Isolated PostgreSQL tests establish matching rules.
test('Title and body matches show literal snippets and open by keyboard @search @reader @visual', async ({
  page,
  api,
}) => {
  // Arrange
  api.searchResponses.set('fixture', {
    results: [readerResult, linkedResult],
    hasMore: false,
  });
  await openReader(page);

  // Act
  await searchFor(page).fill('fixture');

  // Assert
  await expect(resultsFor(page)).toHaveCount(2);
  await expect(resultsFor(page).first().locator('.search-result-title')).toHaveText(readerTitle);
  await expect(resultsFor(page).last().locator('.search-result-snippet')).toHaveText(
    linkedResult.snippet,
  );
  await expect(page.locator('[data-folder-id]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page, page.locator('.material-nav'));
  await expect(page).toHaveScreenshot('search-results.png');

  // Act
  await resultsFor(page).last().focus();
  await page.keyboard.press('Enter');

  // Assert
  await expect(page.getByRole('heading', { name: linkedTitle, exact: true })).toBeVisible();
  await expect(searchFor(page)).toHaveValue('');
  await expect(page.locator(`[data-material-id="${linkedId}"]`)).toBeFocused();
  await expect(page.locator(`[data-material-id="${linkedId}"]`)).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('[data-folder-id="ui-root"]')).toHaveAttribute('open', '');
  await expect(page.locator('[data-folder-id="ui-child"]')).toHaveAttribute('open', '');
  await expect(
    page.locator(`#panel-${linkedId}`).getByLabel(text('engine', 'material', 'contentLabel')),
  ).toHaveAttribute('contenteditable', 'false');
  expect(api.saves).toHaveLength(0);
});

test('Search result titles and snippets render markup as literal text @search', async ({
  page,
  api,
}) => {
  // Arrange
  const title = 'Literal <script>fixture</script> title';
  const snippet = 'An <img src=x onerror=alert(1)> remains text in the saved note.';
  api.searchResponses.set('literal', {
    results: [{ ...linkedResult, title, snippet }],
    hasMore: false,
  });
  await openReader(page);

  // Act
  await searchFor(page).fill('literal');

  // Assert
  await expect(resultsFor(page).locator('.search-result-title')).toHaveText(title);
  await expect(resultsFor(page).locator('.search-result-snippet')).toHaveText(snippet);
  await expect(resultsFor(page).locator('script, img')).toHaveCount(0);
});

test('An empty search result announces the outcome and Escape restores navigation @search', async ({
  page,
}, testInfo) => {
  // Arrange
  await openReader(page);

  // Act
  await searchFor(page).fill('absent phrase');

  // Assert
  await expect(page.locator('mc-material-search').getByRole('status')).toHaveText(
    text('engine', 'workspace', 'noSearchResults'),
  );
  await expect(resultsFor(page)).toHaveCount(0);
  await expectNoHorizontalOverflow(page, page.locator('.material-nav'));
  const image = testInfo.outputPath('search-empty.png');
  await page.screenshot({ path: image, animations: 'disabled', caret: 'hide' });
  await testInfo.attach('search-empty', { path: image, contentType: 'image/png' });

  // Act
  await searchFor(page).press('Escape');

  // Assert
  await expect(searchFor(page)).toHaveValue('');
  await expect(searchFor(page)).toBeFocused();
  await expect(page.locator(`[data-material-id="${readerId}"]`)).toBeVisible();
});

test('A capped result response asks the reader to refine the phrase @search', async ({
  page,
  api,
}) => {
  // Arrange
  api.searchResponses.set('common', {
    results: Array.from({ length: 50 }, (_, index) => ({
      ...linkedResult,
      id: `search-fixture-${index}`,
      title: `Common fixture ${index + 1}`,
    })),
    hasMore: true,
  });
  await openReader(page);

  // Act
  await searchFor(page).fill('common');

  // Assert
  await expect(resultsFor(page)).toHaveCount(50);
  await expect(page.locator('mc-material-search')).toContainText(
    text('engine', 'search', 'moreResults'),
  );
  await expectNoHorizontalOverflow(page, page.locator('.material-nav'));
});

test('A failed search retains the query and retries without exposing diagnostics @search', async ({
  page,
  api,
}, testInfo) => {
  // Arrange
  api.searchFailures = 1;
  api.searchResponses.set('content', { results: [linkedResult], hasMore: false });
  await openReader(page);

  // Act
  await searchFor(page).fill('content');

  // Assert
  const alert = page.locator('mc-material-search').getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).not.toContainText('Private search diagnostic');
  await expect(searchFor(page)).toHaveValue('content');
  await expectNoHorizontalOverflow(page, page.locator('.material-nav'));
  const image = testInfo.outputPath('search-error.png');
  await page.screenshot({ path: image, animations: 'disabled', caret: 'hide' });
  await testInfo.attach('search-error', { path: image, contentType: 'image/png' });

  // Act
  await alert
    .getByRole('button', { name: text('engine', 'workspace', 'retry'), exact: true })
    .click();

  // Assert
  await expect(resultsFor(page)).toHaveCount(1);
  await expect(alert).toHaveCount(0);
  expect(api.searches).toEqual(['content', 'content']);
});

test('An older response cannot replace the newest query and clear restores folders @search', async ({
  page,
  api,
}) => {
  // Arrange
  api.holdSearch('old');
  api.searchResponses.set('old', { results: [readerResult], hasMore: false });
  api.searchResponses.set('new', { results: [linkedResult], hasMore: false });
  await openReader(page);

  // Act
  await searchFor(page).fill('old');

  // Assert
  await expect.poll(() => api.searches).toEqual(['old']);
  await expect(resultsFor(page)).toHaveCount(0);
  await expect(page.locator('mc-material-search').getByRole('status')).toHaveText(
    text('engine', 'search', 'loading'),
  );

  // Act
  await searchFor(page).fill('new');

  // Assert
  await expect(resultsFor(page).locator('.search-result-title')).toHaveText(linkedTitle);

  // Act
  api.releaseSearches();

  // Assert
  await expect.poll(() => api.completedSearches).toContain('old');
  await expect(resultsFor(page).locator('.search-result-title')).toHaveText(linkedTitle);
  await expect(searchFor(page)).toHaveValue('new');

  // Act
  await searchFor(page).fill('');

  // Assert
  await expect(resultsFor(page)).toHaveCount(0);
  await expect(page.locator(`[data-material-id="${readerId}"]`)).toBeVisible();
  expect(api.searches).toEqual(['old', 'new']);
});

test('Opening a search result preserves the mounted unsaved editor and its selection @search @editor', async ({
  page,
  api,
}) => {
  // Arrange
  api.saveMode = 'hold';
  api.searchResponses.set('content', { results: [linkedResult], hasMore: false });
  await openReader(page);
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  const editor = page
    .locator(`#panel-${readerId}`)
    .getByLabel(text('engine', 'material', 'contentLabel'));
  await editor.fill('Unsaved draft retained during a search');
  await editor.press('Home');
  await editor.press('ArrowRight');
  const node = await editor.elementHandle();
  const selection = await editor.evaluate(() => document.getSelection()?.anchorOffset);
  await expect.poll(() => api.saves.length).toBe(1);

  // Act
  await searchFor(page).fill('content');
  await resultsFor(page).click();
  await page.getByRole('tab', { name: `${readerTitle} •`, exact: true }).click();

  // Assert
  await expect(editor).toHaveText('Unsaved draft retained during a search');
  await expect(editor).toHaveAttribute('contenteditable', 'true');
  expect(await editor.evaluate((element, previous) => element === previous, node)).toBe(true);
  await node?.dispose();
  await editor.focus();
  expect(await editor.evaluate(() => document.getSelection()?.anchorOffset)).toBe(selection);
  expect(api.saves).toHaveLength(1);

  // Act
  api.releaseSave();

  // Assert
  await expect(page.locator(`#panel-${readerId} .save-state`)).toHaveText(
    text('engine', 'material', 'status', 'saved'),
  );
});

test('Opening a search result preserves map pan and zoom @search @reader', async ({
  page,
  api,
}) => {
  // Arrange
  api.data.workspace.maps.push({
    id: 'ui-search-map',
    title: 'Search map fixture',
    assetId: 'ui-search-map.svg',
    width: 800,
    height: 600,
    markers: [],
  });
  api.searchResponses.set('content', { results: [linkedResult], hasMore: false });
  await openReader(page);
  await page.getByRole('button', { name: text('engine', 'workspace', 'map'), exact: true }).click();
  await page.getByRole('button', { name: text('engine', 'map', 'zoomIn'), exact: true }).click();
  const viewport = page.locator('#panel-map .map-viewport');
  const box = await viewport.boundingBox();
  if (!box) {
    throw new Error('Expected a visible map viewport.');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 65, box.y + box.height / 2 + 40);
  await page.mouse.up();
  const image = page.locator('#panel-map .map-image');
  await expect(image).toHaveAttribute('style', /translate\(65px, 40px\) scale\(1\.25\)/);
  const transform = await image.evaluate((element) => element.style.transform);

  // Act
  await searchFor(page).fill('content');
  await resultsFor(page).click();
  await page.getByRole('tab', { name: text('engine', 'workspace', 'map'), exact: true }).click();

  // Assert
  expect(await image.evaluate((element) => element.style.transform)).toBe(transform);
  await expect(page.locator('#panel-map')).toBeVisible();
  expect(api.saves).toHaveLength(0);
});

test('Search refreshes only after the current draft is confirmed saved @search @editor', async ({
  page,
  api,
}) => {
  // Arrange
  api.saveMode = 'hold';
  await openReader(page);
  await searchFor(page).fill('fresh phrase');
  await expect.poll(() => api.completedSearches).toEqual(['fresh phrase']);
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  const editor = page
    .locator(`#panel-${readerId}`)
    .getByLabel(text('engine', 'material', 'contentLabel'));

  // Act
  await editor.fill('The fresh phrase is present in the new saved note.');

  // Assert
  await expect.poll(() => api.saves.length).toBe(1);
  await expect(resultsFor(page)).toHaveCount(0);
  expect(api.searches).toEqual(['fresh phrase']);

  // Arrange
  api.searchResponses.set('fresh phrase', {
    results: [{ ...readerResult, snippet: 'The fresh phrase is present in the new saved note.' }],
    hasMore: false,
  });

  // Act
  api.releaseSave();

  // Assert
  await expect(resultsFor(page).locator('.search-result-snippet')).toHaveText(
    'The fresh phrase is present in the new saved note.',
  );
  expect(api.searches).toEqual(['fresh phrase', 'fresh phrase']);
});
