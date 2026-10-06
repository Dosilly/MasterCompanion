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
  await panel.locator('mc-document-navigation summary').click();
  const before = await scroll.evaluate((element) => element.scrollTop);
  await panel
    .getByRole('navigation', { name: label('outline') })
    .getByRole('button', { name: 'Reference table' })
    .click();
  await expect(panel.getByRole('heading', { name: 'Reference table' })).toBeInViewport();
  await panel.getByRole('button', { name: label('return'), exact: true }).click();
  expect(await scroll.evaluate((element) => element.scrollTop)).toBeCloseTo(before, 0);
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
