import { test, expect, text, openReader, expectNoHorizontalOverflow } from './fixtures';
import { readerId, readerTitle, linkedId } from './fixtures/campaign';

const label = (key: string) => text('engine', 'readerNavigation', key);

test('Outline, nested matches and return position preserve content and mounted navigation @retrieval', async ({
  page,
  api,
}, testInfo) => {
  await openReader(page);
  const panel = page.locator('#panel-' + readerId);
  const scroll = panel.locator('.material-scroll');
  await scroll.evaluate((element) => {
    element.scrollTop = 900;
  });
  await panel.getByRole('button', { name: label('outline'), exact: true }).click();
  const before = await scroll.evaluate((element) => element.scrollTop);
  await panel
    .getByRole('navigation', { name: label('outline') })
    .getByRole('button', { name: 'Reference table' })
    .click();
  await expect(panel.getByRole('heading', { name: 'Reference table' })).toBeInViewport();
  await panel.getByRole('button', { name: label('return'), exact: true }).click();
  expect(await scroll.evaluate((element) => element.scrollTop)).toBeCloseTo(before, 0);
  await panel.getByRole('button', { name: label('search'), exact: true }).click();
  await panel.getByRole('searchbox', { name: label('find'), exact: true }).fill('inscription');
  await panel.getByRole('button', { name: label('next'), exact: true }).click();
  await expect(panel.locator('.current-match')).toHaveText('inscription');
  await expect(panel.locator('.current-match')).toBeInViewport();
  await expectNoHorizontalOverflow(page, panel);
  await page.screenshot({ path: testInfo.outputPath('reader-retrieval.png') });
  await panel.getByRole('searchbox', { name: label('find'), exact: true }).fill('context');
  await panel.getByRole('button', { name: label('next'), exact: true }).click();
  await panel.getByRole('button', { name: label('next'), exact: true }).click();
  await expect(panel.locator('.reading-paper details')).toHaveAttribute('open', '');
  await panel.locator('.reading-paper a').first().click();
  await expect(page).toHaveURL(new RegExp('/materials/' + linkedId + '$'));
  await page.locator('[role="tab"]').filter({ hasText: readerTitle }).click();
  await expect(panel.getByRole('searchbox', { name: label('find'), exact: true })).toHaveValue(
    'context',
  );
  await panel.getByRole('button', { name: label('clear'), exact: true }).click();
  await expect(panel.locator('.document-match')).toHaveCount(0);
  expect(api.saves).toHaveLength(0);
});

test('Outline and find have separate keyboard controls and retain the query between panels @retrieval', async ({
  page,
  api,
}, testInfo) => {
  await openReader(page);
  const panel = page.locator('#panel-' + readerId);
  const outline = panel.getByRole('button', { name: label('outline'), exact: true });
  const find = panel.getByRole('button', { name: label('search'), exact: true });
  const searchbox = panel.getByRole('searchbox', { name: label('find'), exact: true });
  const outlinePanel = panel.getByRole('navigation', { name: label('outline') });

  await expect(outline).toHaveAttribute('aria-expanded', 'false');
  await expect(find).toHaveAttribute('aria-expanded', 'false');
  await expect(searchbox).not.toBeVisible();

  await find.focus();
  await page.keyboard.press('Enter');
  await expect(outlinePanel).not.toBeVisible();
  const next = panel.getByRole('button', { name: label('next'), exact: true });
  await expect(next).toBeDisabled();
  await expect(next.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  await expect(next).toHaveAttribute('title', label('next'));
  await searchbox.fill('inscription');
  await page.keyboard.press('Enter');
  await expect(panel.locator('.current-match')).toHaveText('inscription');
  await page.screenshot({ path: testInfo.outputPath('compact-find.png') });

  await outline.focus();
  await page.keyboard.press('Space');
  await expect(outlinePanel).toBeVisible();
  await expect(searchbox).not.toBeVisible();
  await expect(find).toHaveAttribute('aria-expanded', 'false');
  await page.screenshot({ path: testInfo.outputPath('separate-outline.png') });

  await find.click();
  await expect(outlinePanel).not.toBeVisible();
  await expect(searchbox).toHaveValue('inscription');
  await expect(panel.locator('.current-match')).toHaveText('inscription');
  await searchbox.focus();
  await page.keyboard.press('Escape');
  await expect(searchbox).toHaveValue('');
  await expect(searchbox).toBeFocused();
  await expect(panel.locator('.document-match')).toHaveCount(0);
  expect(api.saves).toHaveLength(0);
});

test('Campaign search disambiguates duplicate titles, highlights literal terms and offers persistent clear @retrieval', async ({
  page,
  api,
}) => {
  api.searchResponses.set('fixture', {
    results: [
      { id: readerId, title: 'Equal fixture', folderId: 'ui-child', snippet: '<img> fixture' },
      { id: linkedId, title: 'Equal fixture', folderId: null, snippet: 'Saved fixture' },
    ],
    hasMore: true,
  });
  await openReader(page);
  const search = page.locator('mc-material-search');
  await search.getByRole('searchbox').fill('fixture');
  await expect(search.locator('.search-result')).toHaveCount(2);
  await expect(search.locator('.search-result-path').first()).toHaveText(
    'Fixture chapter / Nested materials',
  );
  const selected = search.locator('.search-result.selected');
  await expect(selected.locator('.search-result-path')).toHaveCSS(
    'color',
    await selected.evaluate((element) => getComputedStyle(element).color),
  );
  await expect(search.locator('.search-result-path').last()).toHaveText(
    text('engine', 'workspace', 'unfiledMaterials'),
  );
  await expect(search.locator('.search-status').first()).toHaveText(
    text('engine', 'search', 'resultCount').replace('{count}', '2'),
  );
  await expect(search).toContainText(text('engine', 'search', 'moreResults'));
  await expect(search.locator('mark')).toHaveCount(4);
  await expect(search.locator('img')).toHaveCount(0);
  await search
    .getByRole('button', { name: text('engine', 'search', 'clear'), exact: true })
    .click();
  await expect(search.getByRole('searchbox')).toHaveValue('');
  await expect(search.getByRole('searchbox')).toBeFocused();
  expect(api.saves).toHaveLength(0);
});
