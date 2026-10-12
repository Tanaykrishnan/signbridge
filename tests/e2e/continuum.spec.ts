import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function pixels(page: Page) {
  return page
    .getByTestId('hero-art')
    .locator('canvas')
    .evaluate((canvas: HTMLCanvasElement) => {
      const sample = document.createElement('canvas');
      sample.width = 200;
      sample.height = 120;
      const context = sample.getContext('2d')!;
      context.drawImage(canvas, 0, 0, 200, 120);
      return Array.from(context.getImageData(0, 0, 200, 120).data);
    });
}

test('one live sculpture transforms through the whole page and footer', async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('hero-art')).toHaveAttribute('data-ready', 'true', {
    timeout: 60000,
  });
  await page.waitForTimeout(1500);
  const canvas = page.getByTestId('hero-art').locator('canvas');
  const start = await pixels(page);
  expect(start.filter((value, i) => i % 4 === 3 && value > 20).length).toBeGreaterThan(800);
  await page.screenshot({ path: 'work/continuum-hero.png' });
  await page.waitForTimeout(900);
  const moving = await pixels(page);
  expect(moving.filter((value, i) => Math.abs(value - start[i]) > 8).length).toBeGreaterThan(60);
  await page.getByRole('button', { name: 'Pause page motion', exact: true }).click();
  await page.waitForTimeout(200);
  const paused = await pixels(page);
  await page.waitForTimeout(250);
  expect(await pixels(page)).toEqual(paused);
  await page.getByRole('button', { name: 'Rotate sculpture right' }).click();
  await page.waitForTimeout(150);
  const rotated = await pixels(page);
  expect(rotated.filter((value, i) => Math.abs(value - paused[i]) > 10).length).toBeGreaterThan(
    100,
  );
  await page.getByRole('button', { name: 'Reset sculpture' }).click();
  await page.waitForTimeout(150);
  expect(await pixels(page)).toEqual(paused);
  await page.getByRole('button', { name: 'Resume page motion' }).click();
  for (const [index, id] of ['language', 'movement', 'possibility', 'your-turn'].entries()) {
    await page.locator(`#${id}`).evaluate((element) =>
      window.scrollTo({
        top: window.scrollY + element.getBoundingClientRect().top,
        behavior: 'instant',
      }),
    );
    await page.waitForTimeout(1200);
    await expect(canvas).toBeVisible();
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-progress')))
      .toBeGreaterThan((index + 1) * 0.17);
    const current = await pixels(page);
    expect(current.filter((value, i) => i % 4 === 3 && value > 20).length).toBeGreaterThan(400);
    expect(current.filter((value, i) => Math.abs(value - start[i]) > 10).length).toBeGreaterThan(
      400,
    );
    await page.screenshot({ path: `work/continuum-${id}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
  );
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-progress')))
    .toBeGreaterThan(0.99);
  await expect(page.getByRole('navigation', { name: 'Footer navigation' })).toBeInViewport();
  expect(
    (await pixels(page)).filter((value, i) => i % 4 === 3 && value > 20).length,
  ).toBeGreaterThan(400);
  await page.screenshot({ path: 'work/continuum-footer.png' });
  await page.getByRole('button', { name: 'What can I try today?' }).click();
  await expect(page.locator('#landing-answer-0')).toBeVisible();
  await page.getByRole('link', { name: 'Open SignBridge', exact: true }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByLabel('Text to translate')).toBeVisible();
  expect(errors).toEqual([]);
});

test('desktop navigation, accessible content and narrow layout remain usable', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(
    page.getByRole('link', { name: 'Step into the studio', exact: true }),
  ).toBeInViewport();
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole('link', { name: 'Step into the studio', exact: true }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('hero-art')).toHaveAttribute('data-ready', 'true', {
    timeout: 60000,
  });
  await expect
    .poll(async () => (await pixels(page)).filter((value, i) => i % 4 === 3 && value > 20).length)
    .toBeGreaterThan(200);
  await page.screenshot({ path: 'work/continuum-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open homepage navigation' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close homepage navigation' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});
