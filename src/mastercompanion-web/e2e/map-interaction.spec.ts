import { fileURLToPath } from 'node:url';
import type { Locator, Page } from '@playwright/test';
import { test, expect, text, expectNoHorizontalOverflow, type TestApi } from './fixtures';
import { readerId, linkedId } from './fixtures/campaign';
import { selectChoice } from './searchable-choice';
import sourceMap from '../../MasterCompanion.Modules.Ythryn/Data/Source/maps/ythryn.json' with { type: 'json' };

const label = (key: string) => text('engine', 'map', key);
const map = (page: Page) => page.locator('[id="panel-map:' + sourceMap.id + '"]');
async function zoomTo(panel: Locator, zoom: 'minimum' | 'fit' | 'maximum'): Promise<void> {
  await panel.getByRole('button', { name: label('fit'), exact: true }).click();
  await expect(panel.locator('.map-heading .actions span')).toHaveText('100%');
  const percentages =
    zoom === 'minimum'
      ? [80, 64, 51, 50]
      : zoom === 'maximum'
        ? [125, 156, 195, 244, 305, 381, 400]
        : [];
  for (const percentage of percentages) {
    await panel
      .getByRole('button', { name: label(zoom === 'minimum' ? 'zoomOut' : 'zoomIn'), exact: true })
      .click();
    await expect(panel.locator('.map-heading .actions span')).toHaveText(percentage + '%');
  }
}
async function openMap(page: Page, api: TestApi): Promise<void> {
  api.data.workspace.maps.push({
    ...sourceMap,
    markers: sourceMap.markers.map((marker, index) => ({
      ...marker,
      materialId: index % 2 ? linkedId : readerId,
    })),
  });
  await page.route('**/api/assets/' + sourceMap.assetId, (route) =>
    route.fulfill({
      path: fileURLToPath(
        new URL(
          '../../MasterCompanion.Modules.Ythryn/Data/Source/assets/ythryn-map.webp',
          import.meta.url,
        ),
      ),
      contentType: 'image/webp',
    }),
  );
  await page.goto('/maps/' + sourceMap.id);
  await expect(map(page).locator('img')).toBeVisible();
  await expect
    .poll(() =>
      map(page)
        .locator('img')
        .evaluate(
          (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true);
}

test('Real dense map markers keep stable target sizes at minimum, fitted and maximum zoom @map-interaction', async ({
  page,
  api,
}, testInfo) => {
  await openMap(page, api);
  const panel = map(page);
  const markers = panel.locator('.map-marker');
  const original = await markers.first().boundingBox();
  if (!original) {
    throw new Error('Expected a map marker.');
  }
  const zooms: ('minimum' | 'fit' | 'maximum')[] = ['minimum', 'fit', 'maximum'];
  for (const zoom of zooms) {
    await zoomTo(panel, zoom);
    const sizes = await markers.evaluateAll((elements) =>
      elements.map((element) => {
        const bounds = element.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      }),
    );
    for (const size of sizes) {
      expect(size.width).toBeGreaterThanOrEqual(31.99);
      expect(size.height).toBeGreaterThanOrEqual(31.99);
    }
    expect(sizes[0]?.width).toBeCloseTo(original.width, 1);
    expect(sizes[0]?.height).toBeCloseTo(original.height, 1);
    await expectNoHorizontalOverflow(page, panel);
    await page.screenshot({ path: testInfo.outputPath('map-' + zoom + '.png') });
  }
  expect(api.saves).toHaveLength(0);
  expect(api.folderRequests).toHaveLength(0);
});

test('Named keyboard selection reaches an offscreen location and preserves pan/zoom on return @map-interaction', async ({
  page,
  api,
}) => {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.url().includes('/api/')) {
      writes.push(request.url());
    }
  });
  await openMap(page, api);
  const panel = map(page);
  const viewport = panel.getByRole('region', { name: label('viewport') + ': ' + sourceMap.title });
  await viewport.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('+');
  await expect(panel.locator('.map-image')).toHaveAttribute(
    'style',
    /translate\(40px, 40px\) scale\(1\.25\)/,
  );
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('+');
  }
  const location = sourceMap.markers[0];
  if (!location) {
    throw new Error('Expected a named map location.');
  }
  const choice = panel.getByLabel(label('locations'), { exact: true });
  await choice.focus();
  await page.keyboard.press('Enter');
  await panel.getByRole('combobox').fill(location.title);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const marker = panel.getByRole('button', {
    name: location.code + ': ' + location.title,
    exact: true,
  });
  await expect(marker).toBeInViewport();
  await expect(
    panel.getByRole('button', {
      name: label('openLocation').replace('{title}', location.title),
      exact: true,
    }),
  ).toBeVisible();
  const transform = await panel
    .locator('.map-image')
    .evaluate((element) => element.style.transform);
  await panel
    .getByRole('button', {
      name: label('openLocation').replace('{title}', location.title),
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(new RegExp('/materials/' + readerId + '$'));
  await page.goBack();
  expect(await panel.locator('.map-image').evaluate((element) => element.style.transform)).toBe(
    transform,
  );
  await viewport.focus();
  await page.keyboard.press('Home');
  await expect(panel.locator('.map-image')).toHaveAttribute(
    'style',
    /translate\(0px, 0px\) scale\(1\)/,
  );
  await marker.click();
  await expect(page).toHaveURL(new RegExp('/materials/' + readerId + '$'));
  expect(writes).toEqual([]);
});

test('Each destination in a dense cluster is independently reachable by its named choice @map-interaction', async ({
  page,
  api,
}) => {
  await openMap(page, api);
  const panel = map(page);
  await zoomTo(panel, 'minimum');
  const choice = panel.getByLabel(label('locations'), { exact: true });
  for (const code of ['Y15', 'Y16', 'Y11', 'Y12']) {
    const location = sourceMap.markers.find((marker) => marker.code === code);
    if (!location) {
      throw new Error('Expected a real dense-cluster location: ' + code);
    }
    await selectChoice(choice, code);
    await expect(
      panel.getByRole('button', {
        name: label('openLocation').replace('{title}', location.title),
        exact: true,
      }),
    ).toBeVisible();
    await expect(panel.locator('.map-marker.selected')).toHaveText(code);
  }
  expect(api.saves).toHaveLength(0);
});
