import { test, expect, text, openReader } from './fixtures';

test('Theme utility announces its next action and exposes visible keyboard focus @controls', async ({
  page,
}, testInfo) => {
  await openReader(page);
  const initial = testInfo.project.use.colorScheme ?? 'light';
  const firstName = initial === 'dark' ? 'lightMode' : 'darkMode';
  const nextName = initial === 'dark' ? 'darkMode' : 'lightMode';
  const utility = page.getByRole('button', {
    name: text('engine', 'workspace', firstName),
    exact: true,
  });

  await utility.focus();

  await expect(utility).toBeFocused();
  await expect(utility).toHaveCSS('outline-style', 'solid');
  await expect(utility).toHaveCSS('outline-width', '2px');
  await expect(utility.locator('svg')).toHaveAttribute('aria-hidden', 'true');

  await page.keyboard.press('Enter');

  await expect(
    page.getByRole('button', { name: text('engine', 'workspace', nextName), exact: true }),
  ).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    initial === 'dark' ? 'light' : 'dark',
  );
});

test('Search boundaries contrast with both adjacent surfaces and refresh remains named @controls', async ({
  page,
}) => {
  await openReader(page);
  const search = page.getByRole('searchbox', {
    name: text('engine', 'search', 'label'),
    exact: true,
  });
  const contrast = await search.evaluate((element) => {
    function luminance(color: string): number {
      const channels = color
        .match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number);
      if (!channels || channels.length !== 3) {
        throw new Error('Expected an RGB color.');
      }
      const linear = channels.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      const [red = 0, green = 0, blue = 0] = linear;
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    }
    const style = getComputedStyle(element);
    const border = luminance(style.borderTopColor);
    const paper = luminance(style.backgroundColor);
    const pageColor = getComputedStyle(document.documentElement).getPropertyValue('--page').trim();
    const probe = document.createElement('span');
    probe.style.color = pageColor;
    document.body.append(probe);
    const outside = luminance(getComputedStyle(probe).color);
    probe.remove();
    return [paper, outside].map(
      (surface) => (Math.max(border, surface) + 0.05) / (Math.min(border, surface) + 0.05),
    );
  });

  for (const ratio of contrast) {
    expect(ratio).toBeGreaterThanOrEqual(3);
  }
  const refresh = page.getByRole('button', {
    name: text('engine', 'workspace', 'refreshMaterials'),
    exact: true,
  });
  await expect(refresh).toHaveAttribute('title', text('engine', 'materialCache', 'refreshHint'));
  await expect(refresh.locator('mc-icon')).toBeVisible();
});
