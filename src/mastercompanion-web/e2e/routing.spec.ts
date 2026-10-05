import { test, expect, text, openReader, expectNoHorizontalOverflow } from './fixtures';
import { readerId, readerTitle, linkedId, linkedTitle } from './fixtures/campaign';

test('A section URL opens its enclosing details and restores the anchor on reload @routing', async ({
  page,
  api,
}) => {
  api.data.materials[1].document = {
    type: 'doc',
    content: [
      ...Array.from({ length: 30 }, (_, index) => ({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: `Section preamble ${index}. This passage places the addressed section below the initial viewport.`,
          },
        ],
      })),
      {
        type: 'details',
        content: [
          { type: 'detailsSummary', content: [{ type: 'text', text: 'Section context' }] },
          {
            type: 'detailsContent',
            content: [
              {
                type: 'heading',
                attrs: { level: 2, sourceId: 'stable-section' },
                content: [{ type: 'text', text: 'Addressed section' }],
              },
            ],
          },
        ],
      },
    ],
  };

  await page.goto(`/materials/${linkedId}#stable-section`);

  const section = page.locator('#stable-section');
  await expect(section).toBeInViewport();
  await expect(page.locator(`#panel-${linkedId} details`)).toHaveAttribute('open', '');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await expect(section).toBeInViewport();
  expect(api.saves).toEqual([]);
});

test('Direct material URLs reload the same reader without mounting the start material @routing', async ({
  page,
  api,
}) => {
  await page.goto(`/materials/${linkedId}`);
  await expect(page.getByRole('heading', { name: linkedTitle, exact: true })).toBeVisible();
  await expect(
    page.locator(`#panel-${linkedId}`).getByLabel(text('engine', 'material', 'contentLabel')),
  ).toHaveAttribute('contenteditable', 'false');

  await page.reload();

  await expect(page.getByRole('heading', { name: linkedTitle, exact: true })).toBeVisible();
  expect(api.materialReads).toEqual([]);
  expect(api.bulkReads).toEqual([1, 2]);
  expect(api.saves).toEqual([]);
});

test('Links and browser history retain the mounted reader and scroll @routing', async ({
  page,
  api,
}) => {
  await openReader(page);
  await expect(page).toHaveURL(new RegExp(`/materials/${readerId}$`));
  const reader = page.locator(`#panel-${readerId} .material-scroll`);
  await reader.evaluate((element) => {
    element.scrollTop = 450;
  });
  const mounted = await reader.elementHandle();

  await page.getByRole('link', { name: 'Open linked material' }).click();
  await expect(page).toHaveURL(new RegExp(`/materials/${linkedId}$`));
  await expect(page.getByRole('heading', { name: linkedTitle, exact: true })).toBeVisible();
  await page.goBack();

  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
  expect(await reader.evaluate((element, previous) => element === previous, mounted)).toBe(true);
  await reader.evaluate((element) => {
    element.scrollTop = 450;
  });
  await page.getByRole('tab', { name: linkedTitle, exact: true }).click();
  await expect(page.getByRole('heading', { name: linkedTitle, exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
  await expect.poll(() => reader.evaluate((element) => element.scrollTop)).toBe(450);
  await page.goForward();
  await expect(page.getByRole('heading', { name: linkedTitle, exact: true })).toBeVisible();
  expect(api.materialReads).toEqual([]);
  expect(api.bulkReads).toEqual([1]);
  expect(api.saves).toEqual([]);
  await mounted?.dispose();
});

for (const location of ['game', 'party'] as const) {
  test(`Direct ${location} address survives reload and history performs no game operations @routing`, async ({
    page,
    api,
  }) => {
    await page.goto(`/${location}`);
    await expect(page.locator(`#panel-${location}`)).toBeVisible();
    await page.reload();
    await expect(page.locator(`#panel-${location}`)).toBeVisible();
    await page.locator('[data-folder-id="ui-root"] > summary').click();
    await page.locator('[data-folder-id="ui-child"] > summary').click();
    await page.locator(`[data-material-id="${readerId}"]`).click();
    await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.locator(`#panel-${location}`)).toBeVisible();
    expect(api.saves).toEqual([]);
  });
}

test('A newer history target wins when a search result refresh completes late @routing', async ({
  page,
  api,
}) => {
  await openReader(page);
  const fresh = { ...api.data.materials[1], id: 'late-navigation-material' };
  api.createdMaterials.push(fresh);
  api.data.workspace.materials.push(fresh);
  api.searchResponses.set('late material', {
    results: [{ ...fresh, snippet: 'A recently created material.' }],
    hasMore: false,
  });
  api.holdBulkRead(2);
  await page.getByRole('searchbox').fill('late material');
  await page.locator('.search-result').click();
  await expect.poll(() => api.bulkReads).toEqual([1, 2]);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/materials/${readerId}$`));
  api.releaseBulkReads();

  await expect.poll(() => api.completedBulkReads).toContain(2);
  await expect(page.getByRole('heading', { name: readerTitle, exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: readerTitle, exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

for (const scenario of [
  { url: '/materials/absent', error: 'materialNotFound' },
  { url: '/maps/absent', error: 'mapNotFound' },
  { url: '/unknown-location', error: 'invalidRoute' },
] as const) {
  test(`Unavailable address ${scenario.url} has a localized error and no material reads @routing`, async ({
    page,
    api,
  }, testInfo) => {
    await page.goto(scenario.url);
    await expect(page.getByRole('alert')).toContainText(
      text('engine', 'routes', 'errors', scenario.error),
    );
    await expect(page).toHaveURL(new RegExp(`${scenario.url}$`));
    await expectNoHorizontalOverflow(page, page.locator('.workspace-main'));
    expect(api.materialReads).toEqual([]);
    expect(api.saves).toEqual([]);
    if (scenario.error === 'materialNotFound') {
      const path = testInfo.outputPath('route-error.png');
      await page.screenshot({ path, animations: 'disabled', caret: 'hide' });
      await testInfo.attach('route-error', { path, contentType: 'image/png' });
    }
  });
}

test('A missing section offers recovery to the addressed material without duplicating history @routing', async ({
  page,
  api,
}) => {
  await page.goto(`/materials/${linkedId}#missing-section`);
  await expect(page.getByRole('heading', { name: linkedTitle, exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(
    text('engine', 'routes', 'errors', 'sectionNotFound'),
  );

  await page
    .getByRole('button', { name: text('engine', 'routes', 'openMaterial'), exact: true })
    .click();

  await expect(page).toHaveURL(new RegExp(`/materials/${linkedId}$`));
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(api.materialReads).toEqual([]);
  expect(api.saves).toEqual([]);
});

test('Maps resolve by stable ID and history preserves zoom and mounted view @routing', async ({
  page,
  api,
}) => {
  api.data.workspace.maps.push(
    {
      id: 'map.one',
      title: 'First map',
      assetId: 'first.svg',
      width: 800,
      height: 600,
      markers: [],
    },
    {
      id: 'map.two',
      title: 'Second map',
      assetId: 'second.svg',
      width: 800,
      height: 600,
      markers: [],
    },
  );
  await page.goto('/maps/map.two');
  await expect(page.getByRole('heading', { name: 'Second map', exact: true })).toBeVisible();
  await page.getByRole('button', { name: text('engine', 'map', 'zoomIn'), exact: true }).click();
  const image = page.locator('[id="panel-map:map.two"] .map-image');
  await expect(image).toHaveAttribute('style', /scale\(1\.25\)/);
  const mounted = await image.elementHandle();
  await page
    .getByRole('navigation', {
      name: text('engine', 'workspace', 'primaryNavigationLabel'),
      exact: true,
    })
    .getByRole('button', { name: text('engine', 'game', 'partyTitle'), exact: true })
    .click();
  await expect(page).toHaveURL(/\/party$/);

  await page.goBack();

  await expect(page.getByRole('heading', { name: 'Second map', exact: true })).toBeVisible();
  await expect(image).toHaveAttribute('style', /scale\(1\.25\)/);
  expect(await image.evaluate((element, previous) => element === previous, mounted)).toBe(true);
  expect(api.materialReads).toEqual([]);
  await mounted?.dispose();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Second map', exact: true })).toBeVisible();
});

test('Closing the last material replaces its URL with an empty workspace @routing', async ({
  page,
  api,
}) => {
  await openReader(page);
  await page
    .getByRole('button', {
      name: `${text('engine', 'workspace', 'closeTab')} ${readerTitle}`,
      exact: true,
    })
    .click();

  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByRole('tab')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('tab')).toHaveCount(0);
  expect(api.materialReads).toEqual([]);
});

test('History retains an unsaved editor and a failed close preserves its URL and draft @routing', async ({
  page,
  api,
}) => {
  api.saveMode = 'hold';
  await openReader(page);
  await page.getByRole('button', { name: text('engine', 'material', 'edit'), exact: true }).click();
  const editor = page
    .locator(`#panel-${readerId}`)
    .getByLabel(text('engine', 'material', 'contentLabel'));
  await editor.fill('Recoverable routing draft');
  const mounted = await editor.elementHandle();
  await expect.poll(() => api.saves.length).toBe(1);
  await page
    .getByRole('navigation', {
      name: text('engine', 'workspace', 'primaryNavigationLabel'),
      exact: true,
    })
    .getByRole('button', { name: text('engine', 'game', 'partyTitle'), exact: true })
    .click();
  await expect(page).toHaveURL(/\/party$/);
  await page.goBack();
  await expect(editor).toBeVisible();
  await expect(editor).toHaveText('Recoverable routing draft');
  expect(await editor.evaluate((element, previous) => element === previous, mounted)).toBe(true);
  await page
    .getByRole('button', {
      name: `${text('engine', 'workspace', 'closeTab')} ${readerTitle}`,
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(new RegExp(`/materials/${readerId}$`));
  api.saveMode = 'failure';
  api.releaseSave();
  await expect(page.locator(`#panel-${readerId} .save-state`)).toHaveText(
    text('engine', 'material', 'status', 'error'),
  );
  await expect(editor).toHaveText('Recoverable routing draft');
  await expect(page).toHaveURL(new RegExp(`/materials/${readerId}$`));
  await mounted?.dispose();
});
