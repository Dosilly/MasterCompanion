import { test, expect, text, openReader } from './fixtures';
import { readerId, readerTitle } from './fixtures/campaign';

test('Deep material selection keeps search and primary navigation visible @navigation', async ({
  page,
  api,
}) => {
  const materials = Array.from({ length: 50 }, (_, index) => ({
    ...api.data.materials[1],
    id: `deep-note-${index}`,
    title: `Deep note ${index}`,
  }));
  api.createdMaterials.push(...materials);
  api.data.workspace.materials.push(...materials);
  await openReader(page);

  await page
    .locator('.material-nav')
    .getByRole('button', { name: 'Deep note 49', exact: true })
    .click();

  await expect(page.getByRole('heading', { name: 'Deep note 49', exact: true })).toBeVisible();
  const search = page.getByRole('searchbox', {
    name: text('engine', 'search', 'label'),
    exact: true,
  });
  await expect(search).toBeInViewport();
  const navigation = page.getByRole('navigation', {
    name: text('engine', 'workspace', 'primaryNavigationLabel'),
    exact: true,
  });
  await expect(navigation).toBeInViewport();
  await expect(
    navigation.getByRole('button', { name: text('engine', 'meetings', 'title'), exact: true }),
  ).toBeVisible();
  await expect(page.locator('.header-actions button')).toHaveCount(1);
  expect(api.saves).toHaveLength(0);
});

test('Document commands stay available at the end and formatting state follows the editor @navigation', async ({
  page,
  api,
}) => {
  await openReader(page);
  const panel = page.locator(`#panel-${readerId}`);
  const scroll = panel.locator('.material-scroll');
  const editor = panel.getByLabel(text('engine', 'material', 'contentLabel'), { exact: true });

  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  await expect(
    panel.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }),
  ).toBeInViewport();
  await expect(editor).toHaveAttribute('role', 'document');
  expect(api.saves).toHaveLength(0);

  await panel
    .getByRole('button', { name: text('engine', 'material', 'edit'), exact: true })
    .click();
  await editor.click();
  await page.keyboard.press('Control+End');
  const bold = panel.getByRole('button', { name: text('engine', 'material', 'bold'), exact: true });
  await bold.click();

  await expect(bold).toHaveAttribute('aria-pressed', 'true');
  await expect(bold).toBeInViewport();
  await expect(editor).toHaveAttribute('role', 'textbox');
  await expect(editor).toHaveAttribute('aria-readonly', 'false');

  await page.keyboard.type(' Persistent command fixture');
  await panel
    .getByRole('button', { name: text('engine', 'material', 'finishEditing'), exact: true })
    .click();

  await expect(editor).toHaveAttribute('contenteditable', 'false');
  await expect(editor).toHaveAttribute('role', 'document');
  expect(api.saves.length).toBeGreaterThan(0);
});

test('Long search results scroll independently from the search field @navigation', async ({
  page,
  api,
}) => {
  const materials = Array.from({ length: 40 }, (_, index) => ({
    ...api.data.materials[1],
    id: `result-${index}`,
    title: `Result ${index}`,
  }));
  api.createdMaterials.push(...materials);
  api.data.workspace.materials.push(...materials);
  api.searchResponses.set('many results', {
    results: materials.map((material) => ({
      id: material.id,
      title: material.title,
      folderId: material.folderId,
      snippet: 'A representative search result with contextual text.',
    })),
    hasMore: false,
  });
  await openReader(page);
  const search = page.getByRole('searchbox', {
    name: text('engine', 'search', 'label'),
    exact: true,
  });

  await search.fill('many results');
  await page.locator('.search-result').last().scrollIntoViewIfNeeded();

  await expect(search).toBeInViewport();
  await expect(search).toHaveValue('many results');
  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
  expect(api.saves).toHaveLength(0);
});
