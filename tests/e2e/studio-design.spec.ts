import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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

test('expanded studio keeps a large signing stage and reachable source, playback and result', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1508, height: 830 });
  await page.goto('/studio?text=See%20you%20later&reviewedOnly=1');
  await expect(page.locator('.viewer-status')).toContainText('Procedural demonstration rig', {
    timeout: 60000,
  });
  await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Translation result' })).toContainText(
    'See you later',
  );
  for (const viewport of [
    { width: 1508, height: 830 },
    { width: 1920, height: 875 },
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByLabel('Text to translate')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Paraphrase & translate', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Translation result' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await page.getByTestId('avatar-canvas').boundingBox())!.height).toBeGreaterThanOrEqual(
      300,
    );
    expect((await page.locator('.avatar-workspace').boundingBox())!.height).toBeGreaterThanOrEqual(
      640,
    );
    await expect
      .poll(async () => {
        const stage = (await page.getByTestId('avatar-canvas').boundingBox())!;
        const canvas = (await page.locator('.canvas-wrap canvas').boundingBox())!;
        return Math.abs(stage.height - canvas.height);
      })
      .toBeLessThan(2);
  }
  await page.setViewportSize({ width: 1508, height: 830 });
  await page.screenshot({ path: 'work/studio-single-screen-compose.png' });
  await expect(page.getByRole('tab', { name: 'Paraphrase', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'English paraphrase result' })).toBeVisible();
  await expect(page.getByLabel('Text to translate')).toHaveValue('See you later');
  await page.getByText('Output settings & asset details', { exact: true }).click();
  await expect(page.getByLabel('Reference animation previews (unreviewed)')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByText('Output settings & asset details', { exact: true }).click();
  await page.getByRole('button', { name: 'ASL fingerspelling', exact: true }).click();
  await page
    .getByLabel('Text to translate')
    .fill('The SRM Central Library closes at five. '.repeat(30));
  await page.getByRole('button', { name: 'Paraphrase & spell', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeEnabled();
  for (const viewport of [
    { width: 1508, height: 830 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeVisible();
    const avatarBounds = (await page
      .getByRole('region', { name: 'Avatar workspace' })
      .boundingBox())!;
    const playbackBounds = (await page.locator('.viewer-bottom').boundingBox())!;
    const sequenceBounds = (await page.locator('.sequence-strip').boundingBox())!;
    expect(playbackBounds.y + playbackBounds.height).toBeLessThanOrEqual(
      avatarBounds.y + avatarBounds.height,
    );
    expect(sequenceBounds.y + sequenceBounds.height).toBeLessThanOrEqual(
      avatarBounds.y + avatarBounds.height,
    );
    expect((await page.getByTestId('avatar-canvas').boundingBox())!.height).toBeGreaterThan(90);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test('desktop creative studio, camera presets, review states and accessible controls', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/studio?mode=isl&reviewedOnly=1');
  await expect(page.locator('.viewer-status')).toContainText('Procedural demonstration rig', {
    timeout: 60000,
  });
  await page.waitForTimeout(800);
  await expect(page.locator('.input-workspace')).toHaveCSS('opacity', '1');
  await expect(page.locator('.avatar-workspace')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'work/studio-redesign-desktop.png', fullPage: true });
  const initial = await pixels(page);
  expect(initial.filter((v, i) => i % 4 !== 3 && v > 100).length).toBeGreaterThan(500);
  for (const name of ['Three-quarter view', 'Upper-body view']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(180);
    const next = await pixels(page);
    expect(next.filter((v, i) => Math.abs(v - initial[i]) > 12).length).toBeGreaterThan(150);
  }
  await page.getByRole('button', { name: 'Front view', exact: true }).click();
  await page.getByRole('button', { name: 'Hello', exact: true }).click();
  await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
  await expect(page.locator('.pipeline-step').nth(1)).toHaveClass(/complete/);
  await expect(page.locator('.pipeline-step').nth(2)).toHaveClass(/blocked/);
  await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Motion lab', exact: true }).click();
  await page.getByRole('button', { name: 'Play sequence', exact: true }).click();
  await page.waitForTimeout(650);
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  await page.screenshot({ path: 'work/studio-redesign-lab.png', fullPage: true });
  await page.getByRole('button', { name: 'Reduce studio interface motion' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await expect(
    page.getByRole('button', { name: 'Reduce studio interface motion' }),
  ).toHaveAttribute('aria-pressed', 'true');
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(a11y.violations).toEqual([]);
  for (const width of [1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.avatar-workspace')).toHaveCSS('opacity', '1');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
