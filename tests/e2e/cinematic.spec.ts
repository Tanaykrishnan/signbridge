import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('completed translation is usable while real history storage is pending', async ({ page }) => {
  let release!: () => void;
  let started!: () => void;
  const historyStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/history', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch();
    started();
    await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  try {
    await page.goto('/studio?reviewedOnly=1');
    await page.getByLabel('Text to translate').fill('Hello');
    await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
    await historyStarted;
    await expect(page.getByText('ANIMATION UNAVAILABLE', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Paraphrase & translate', exact: true })).toBeEnabled();
    await page.getByLabel('Text to translate').fill('Thank you');
    release();
    await expect(page.getByLabel('Text to translate')).toHaveValue('Thank you');
    await expect(page.getByRole('heading', { name: 'Ready for a new result' })).toBeVisible();
  } finally {
    release();
  }
});

test('homepage chapters support keyboard navigation and sculpture controls change real pixels', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('hero-art')).toHaveAttribute('data-ready', 'true', {
    timeout: 60000,
  });
  await page.getByRole('button', { name: 'Pause page motion', exact: true }).click();
  const canvas = page.getByTestId('hero-art').locator('canvas');
  const pixels = () =>
    canvas.evaluate((element: HTMLCanvasElement) => {
      const sample = document.createElement('canvas');
      sample.width = 160;
      sample.height = 100;
      const context = sample.getContext('2d')!;
      context.drawImage(element, 0, 0, 160, 100);
      return Array.from(context.getImageData(0, 0, 160, 100).data);
    });
  const before = await pixels();
  await page.getByRole('button', { name: 'Rotate sculpture right' }).click();
  await page.waitForTimeout(150);
  const after = await pixels();
  expect(
    after.filter((value, index) => Math.abs(value - before[index]) > 10).length,
  ).toBeGreaterThan(100);
  await page.getByRole('link', { name: 'Chapter 4: Possibility', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('link', { name: 'Chapter 4: Possibility', exact: true }),
  ).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('heading', { name: 'Make room for more.' })).toBeVisible();
  await page.screenshot({ path: 'work/cinematic-pipeline.png' });
  await page.getByRole('link', { name: 'See the project in depth', exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
});

test('new identity is consistent across every workspace route and accessible themes', async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of [
    'dashboard',
    'studio',
    'language-lab',
    'review',
    'library',
    'history',
    'favorites',
    'settings',
    'about',
    'privacy',
    'help',
    'phrases/hello',
  ]) {
    await page.goto(`/${route}`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.workspace-shell')).toHaveAttribute('data-experience', 'cinematic');
    await expect(page.locator('.workspace-shell')).toHaveCSS(
      'background-color',
      'rgb(241, 242, 235)',
    );
    await expect(page.locator('.loading-state')).toHaveCount(0);
    await expect(page.locator('.main')).toHaveCSS('opacity', '1');
    for (const item of await page
      .locator('.overview-start, .stat, .phrase-card, .history-row')
      .all()) {
      await expect(item).toHaveCSS('opacity', '1');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `work/continuum-${route.replaceAll('/', '-')}.png`,
      fullPage: true,
    });
    {
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      ).toEqual([]);
    }
  }
  await page.goto('/settings');
  await page.getByLabel('Theme', { exact: true }).selectOption('light');
  await expect(page.locator('.workspace-shell')).toHaveCSS(
    'background-color',
    'rgb(250, 251, 245)',
  );
  await page.getByLabel('Larger text').check();
  await page.getByLabel('High contrast', { exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'true');
  await page.goto('/library');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const light = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    light.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([]);
  await page.screenshot({ path: 'work/cinematic-light.png', fullPage: true });
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 820, height: 1180 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/studio?mode=lab');
    await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.screenshot({ path: `work/cinematic-studio-${viewport.width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});
