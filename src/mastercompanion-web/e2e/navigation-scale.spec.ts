import { test, expect, text, openReader, expectNoHorizontalOverflow } from './fixtures';
import { readerId } from './fixtures/campaign';

const label = (key: string) => text('engine', 'workspace', key);

test('Sidebar resize is bounded by pointer and keyboard and collapse retains reading context @navigation-scale', async ({
  page,
  api,
}, testInfo) => {
  await openReader(page);
  const separator = page.getByRole('separator', { name: label('resizeNavigation') });
  await separator.focus();
  await page.keyboard.press('End');
  await expect(separator).toHaveAttribute('aria-valuenow', '420');
  await page.keyboard.press('ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', '420');
  await page.keyboard.press('Home');
  await expect(separator).toHaveAttribute('aria-valuenow', '228');
  const box = await separator.boundingBox();
  if (!box) {
    throw new Error('Expected the navigation separator.');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 200);
  await page.mouse.up();
  await expect(separator).toHaveAttribute('aria-valuenow', '324');
  const scroll = page.locator('#panel-' + readerId + ' .material-scroll');
  await scroll.evaluate((element) => {
    element.scrollTop = 400;
  });
  await page.getByRole('button', { name: label('hideNavigation'), exact: true }).click();
  await expect(page.locator('.material-sidebar')).not.toBeVisible();
  await expect(page.locator('.collapsed-context')).toContainText(
    'Fixture chapter / Nested materials',
  );
  await expectNoHorizontalOverflow(page, page.locator('.workspace-shell'));
  await page.screenshot({ path: testInfo.outputPath('collapsed-navigation.png') });
  const reopen = page.getByRole('button', { name: label('showNavigation'), exact: true });
  await reopen.focus();
  await page.keyboard.press('Enter');
  await expect(separator).toHaveAttribute('aria-valuenow', '324');
  expect(await scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(api.saves).toHaveLength(0);
});

test('All open tabs remain reachable with path, dirty and saving-before-close states @navigation-scale', async ({
  page,
  api,
}) => {
  const materials = Array.from({ length: 18 }, (_, index) => ({
    ...api.data.materials[1],
    id: 'tab-' + index,
    title: 'Long location title ' + index,
  }));
  api.createdMaterials.push(...materials);
  api.data.workspace.materials.push(...materials);
  await openReader(page);
  for (const material of materials) {
    await page
      .locator('.material-nav')
      .getByRole('button', { name: material.title, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp('/materials/' + material.id + '$'));
  }
  const currentPanel = page.locator('#panel-tab-17');
  await currentPanel
    .getByRole('button', { name: text('engine', 'material', 'edit'), exact: true })
    .click();
  api.saveMode = 'failure';
  await currentPanel.getByRole('textbox').fill('Retained dirty tab');
  await expect(currentPanel.getByRole('alert')).toBeVisible();
  const summary = page.locator('mc-open-tabs summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  const list = page.locator('.open-tabs-list');
  await expect(list).toContainText(label('unsavedTab'));
  await expect(list).toContainText('Fixture chapter / Nested materials');
  await list
    .getByRole('button', { name: /Long location title 0/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/materials\/tab-0$/);
  await expect(page.locator('[role="tab"][data-tab-id="tab-0"]')).toBeInViewport();
  await expect(page.locator('#panel-tab-17 [contenteditable]')).toHaveText('Retained dirty tab');
  await summary.click();
  api.saveMode = 'hold';
  await list
    .getByRole('button', { name: label('closeTab') + ' Long location title 17', exact: true })
    .click();
  await expect(list).toContainText(label('closingTab'));
  await expect(
    list.getByRole('button', { name: label('closeTab') + ' Long location title 17', exact: true }),
  ).toBeDisabled();
  api.releaseSave();
  await expect(
    list.getByRole('button', { name: label('closeTab') + ' Long location title 17', exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(summary).toBeFocused();
});
