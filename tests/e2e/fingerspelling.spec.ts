import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { srmInputs } from '../fixtures/srm-inputs';

async function ready(page: Page) {
  await expect(page.locator('.viewer-status')).toContainText('Procedural demonstration rig', {
    timeout: 60000,
  });
  await expect(page.locator('canvas')).toBeVisible();
}
async function pixels(page: Page) {
  return page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const copy = document.createElement('canvas');
    copy.width = 160;
    copy.height = 160;
    const context = copy.getContext('2d')!;
    context.drawImage(canvas, 0, 0, 160, 160);
    return Array.from(context.getImageData(0, 0, 160, 160).data);
  });
}
test('arbitrary English paragraph, word controls, distinct hand poses and history reopen', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/studio?mode=fingerspelling');
  await ready(page);
  await expect(
    page.getByRole('button', { name: 'ASL fingerspelling', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const paragraph = srmInputs.join('\n\n');
  expect(paragraph.length).toBeGreaterThan(500);
  await page.getByLabel('Text to translate').fill(paragraph);
  await page.getByRole('button', { name: 'Paraphrase & spell', exact: true }).click();
  await expect(page.getByText('READY TO SPELL', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeEnabled();
  await expect(page.locator('.sequence-step')).toHaveCount(17);
  await expect(page.locator('.spelling-caption strong')).toHaveText('What');
  await page.getByRole('button', { name: 'Next word', exact: true }).click();
  await expect(page.locator('.spelling-caption strong')).toHaveText('time');
  await page.getByRole('button', { name: 'Previous word', exact: true }).click();
  await expect(page.locator('.spelling-caption strong')).toHaveText('What');
  await page.getByRole('button', { name: 'Play sequence', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  const paused = await page.getByLabel('Playback timeline').inputValue();
  await page.waitForTimeout(150);
  await expect(page.getByLabel('Playback timeline')).toHaveValue(paused);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy source text' }).click();
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(
    paragraph,
  );
  await page.screenshot({ path: 'work/asl-paragraph-studio.png', fullPage: true });
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.locator('.history-content').first()).toContainText('ASL fingerspelling');
  await page.getByRole('link', { name: 'Reopen', exact: true }).first().click();
  await expect(page).toHaveURL(/mode=fingerspelling/);
  await expect(page.getByLabel('Text to translate')).toHaveValue(paragraph);
  await page.getByLabel('Text to translate').fill('AB');
  await page.getByRole('button', { name: 'Paraphrase & spell', exact: true }).click();
  await expect(page.locator('.spelling-letter')).toHaveText('A');
  await page.waitForTimeout(150);
  const a = await pixels(page);
  expect(a.filter((v, i) => i % 4 !== 3 && v > 100).length).toBeGreaterThan(500);
  await page.getByRole('button', { name: 'Next sign', exact: true }).click();
  await expect(page.locator('.spelling-letter')).toHaveText('B');
  await page.waitForTimeout(150);
  const b = await pixels(page);
  expect(b.filter((v, i) => Math.abs(v - a[i]) > 12).length).toBeGreaterThan(120);
  await page.getByRole('button', { name: 'Clear text', exact: true }).click();
  await expect(page.locator('.sequence-step')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(a11y.violations).toEqual([]);
});

test('all 26 letters render with finger articulation and moving J/Z', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/studio?mode=fingerspelling');
  await ready(page);
  await page.getByLabel('Text to translate').fill('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  await page.getByRole('button', { name: 'Paraphrase & spell', exact: true }).click();
  await expect(page.getByText('READY TO SPELL', { exact: true })).toBeVisible();
  const captures: { letter: string; image: string }[] = [];
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    await expect(page.locator('.spelling-letter')).toHaveText(letter);
    await page.waitForTimeout(120);
    const bounds = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const sample = document.createElement('canvas');
      sample.width = 160;
      sample.height = 160;
      const ctx = sample.getContext('2d')!;
      ctx.drawImage(canvas, 0, 0, 160, 160);
      const data = ctx.getImageData(0, 0, 160, 160).data;
      let top = 160,
        bottom = -1;
      for (let p = 0; p < data.length; p += 4) {
        if (data[p] > 100 && data[p + 1] > 100 && data[p + 2] > 100) {
          const y = Math.floor(p / 4 / 160);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
      return { top, bottom };
    });
    expect(bounds.top, `${letter} top framing`).toBeGreaterThan(3);
    expect(bounds.bottom, `${letter} bottom framing`).toBeLessThan(157);
    captures.push({
      letter,
      image: await page
        .locator('canvas')
        .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()),
    });
    if (letter !== 'Z') await page.getByRole('button', { name: 'Next sign', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Previous sign', exact: true }).click();
  await page.getByRole('button', { name: 'Next sign', exact: true }).click();
  const before = await pixels(page);
  await page.getByLabel('Playback speed', { exact: true }).selectOption('0.5');
  await page.getByRole('button', { name: 'Play sequence', exact: true }).click();
  await page.waitForTimeout(950);
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  const after = await pixels(page);
  expect(after.filter((v, i) => Math.abs(v - before[i]) > 12).length).toBeGreaterThan(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  // A local QA contact sheet, never a substitute for the live viewer or linguistic review.
  await page.setContent(
    `<main style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:8px;background:#0c1210;color:white;font-family:Arial">${captures.map(({ letter, image }) => `<div><h2>${letter}</h2><img style="width:100%" src="${image}" alt="Rendered pose ${letter}" /></div>`).join('')}</main>`,
  );
  await page.screenshot({ path: 'work/asl-alphabet-contact-sheet.png', fullPage: true });
});

test('full-length text stays bounded and skipped words do not break word navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/studio?mode=fingerspelling');
  await ready(page);
  await page.getByLabel('Text to translate').fill('A 中 B');
  await page.getByRole('button', { name: 'Paraphrase & spell', exact: true }).click();
  await expect(page.locator('.spelling-caption strong')).toHaveText('A');
  await page.getByRole('button', { name: 'Next word', exact: true }).click();
  await expect(page.locator('.spelling-caption strong')).toHaveText('B');
  await page.getByRole('button', { name: 'Previous word', exact: true }).click();
  await expect(page.locator('.spelling-caption strong')).toHaveText('A');
  await expect(page.locator('.conversion-warnings')).toContainText('Unsupported character');
  await page.getByLabel('Text to translate').fill('a'.repeat(5000));
  await page.getByRole('button', { name: 'Paraphrase & spell', exact: true }).click();
  await expect(page.getByText('READY TO SPELL', { exact: true })).toBeVisible();
  await expect(page.locator('.sequence-range')).toContainText('of 5000');
  expect((await page.locator('.spelling-caption strong').boundingBox())!.height).toBeLessThan(60);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
