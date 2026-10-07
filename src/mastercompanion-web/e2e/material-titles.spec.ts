import { test, expect, text, openReader, expectNoHorizontalOverflow } from './fixtures';
import { readerId, readerTitle, linkedTitle } from './fixtures/campaign';

test('Title draft saves with its document and updates navigation, tabs, search and reload @editor', async ({
  page,
  api,
}) => {
  await openReader(page);
  api.saveMode = 'hold';
  const query = 'campaign';
  api.searchResponses.set(query, {
    results: [{ id: readerId, title: readerTitle, folderId: 'ui-child', snippet: '' }],
    hasMore: false,
  });
  await page.getByRole('searchbox').fill(query);
  await expect(page.locator('.search-result')).toContainText(readerTitle);
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  const title = page.getByLabel(text('engine', 'material', 'titleLabel'), { exact: true });
  await expect(title).toHaveValue(readerTitle);
  await expectNoHorizontalOverflow(page, page.locator(`#panel-${readerId} .material-scroll`));
  await expect(page).toHaveScreenshot('editable-title.png');
  await page.getByRole('searchbox').fill('');

  await title.fill('Renamed campaign document');
  const editor = page
    .locator(`#panel-${readerId}`)
    .getByLabel(text('engine', 'material', 'contentLabel'));
  await editor.fill('Combined title and body draft');
  await page.getByRole('button', { name: linkedTitle, exact: true }).click();
  await page.getByRole('tab', { name: `${readerTitle} •`, exact: true }).click();
  await expect(title).toHaveValue('Renamed campaign document');
  await page.getByRole('searchbox').fill(query);
  await expect(page.locator('.search-result')).toContainText(readerTitle);
  await page
    .getByRole('button', { name: text('engine', 'material', 'finishEditing'), exact: true })
    .click();
  await expect.poll(() => api.saves.length).toBe(1);
  await expect(title).toBeVisible();
  api.searchResponses.set(query, {
    results: [
      { id: readerId, title: 'Renamed campaign document', folderId: 'ui-child', snippet: '' },
    ],
    hasMore: false,
  });
  api.releaseSave();

  await expect(title).not.toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Renamed campaign document', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.search-result-title')).toHaveText(/Renamed\s+campaign\s+document/);
  await page.getByRole('searchbox').fill('');
  await expect(page.locator(`[data-material-id="${readerId}"]`)).toHaveText(
    'Renamed campaign document',
  );
  await expect(
    page.getByRole('tab', { name: 'Renamed campaign document', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Renamed campaign document', exact: true }),
  ).toBeVisible();
  await expect(editor).toHaveText('Combined title and body draft');
  expect(page.url()).toContain(`/materials/${readerId}`);
});

test('An empty title keeps editing open and displays localized validation without saving @editor', async ({
  page,
  api,
}) => {
  await openReader(page);
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  const title = page.getByLabel(text('engine', 'material', 'titleLabel'), { exact: true });

  await title.fill('');
  await page
    .getByRole('button', { name: text('engine', 'material', 'finishEditing'), exact: true })
    .click();

  await expect(title).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.title-error')).toHaveText(
    text('engine', 'material', 'errors', 'invalidTitle'),
  );
  await expect(title).toBeVisible();
  expect(api.saves).toHaveLength(0);
  await title.fill('Recovered title');
  await page
    .getByRole('button', { name: text('engine', 'material', 'finishEditing'), exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Recovered title', exact: true })).toBeVisible();
});

test('A title save conflict retains the title when closure fails and explicit adoption restores the saved title @editor', async ({
  page,
  api,
}) => {
  await openReader(page);
  api.saveMode = 'conflict';
  api.materialInspectionAllowed = true;
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  const title = page.getByLabel(text('engine', 'material', 'titleLabel'), { exact: true });

  await title.fill('Recoverable title');
  await page
    .getByRole('button', {
      name: `${text('engine', 'workspace', 'closeTab')} ${readerTitle}`,
      exact: true,
    })
    .click();

  await expect(page.locator('.save-state')).toHaveText(
    text('engine', 'material', 'status', 'conflict'),
  );
  await expect(title).toHaveValue('Recoverable title');
  api.data.materials[0].title = 'Remote saved title';
  api.revision = 8;
  await page
    .getByRole('button', { name: text('engine', 'recovery', 'inspect'), exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Remote saved title', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: text('engine', 'recovery', 'adopt'), exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Remote saved title', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Remote saved title', exact: true })).toBeVisible();
});
