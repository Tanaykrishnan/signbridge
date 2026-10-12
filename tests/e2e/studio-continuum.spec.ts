import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Continuum studio identity, real alphabet playback and accessible composition', async ({
  page,
}) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/studio?reviewedOnly=1');
  await expect(page.locator('.viewer-status')).toContainText('Procedural demonstration rig', {
    timeout: 60000,
  });
  const shell = page.locator('.studio-shell');
  await expect(shell).toHaveCSS('background-color', 'rgb(241, 242, 235)');
  await expect(page.locator('.translate-button')).toHaveCSS('background-color', 'rgb(223, 255, 0)');
  await expect(page.locator('.studio-title-word')).toHaveCSS('font-style', 'italic');
  expect(
    await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
      .then((result) => result.violations),
  ).toEqual([]);
  await page.screenshot({ path: 'work/studio-continuum-desktop.png', fullPage: true });

  await page.getByRole('button', { name: 'ASL fingerspelling', exact: true }).click();
  await page
    .getByLabel('Text to translate', { exact: true })
    .fill('SignBridge makes language visible.');
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/translate') && r.request().method() === 'POST',
    { timeout: 200000 },
  );
  await page.getByRole('button', { name: 'Paraphrase & spell', exact: true }).click();
  const result = await (await response).json();
  expect(result.paraphrase.model.id).toBe('signbridge-qwen2.5-1.5b');
  await expect(page.getByRole('region', { name: 'Translation result' })).toContainText(
    'ASL fingerspelling ready',
  );
  await page.getByLabel('Playback speed', { exact: true }).selectOption('0.5');
  await page.getByRole('button', { name: 'Play sequence', exact: true }).click();
  await expect(page.locator('.viewer')).toHaveAttribute('data-playback', 'playing');
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  await expect(page.locator('.viewer')).toHaveAttribute('data-playback', 'paused');
  await page.getByRole('button', { name: 'Next sign', exact: true }).click();
  await expect(
    page.getByRole('button', { name: `Go to motion 2: ${result.sequence[1].label}`, exact: true }),
  ).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: 'Resume playback', exact: true }).click();
  await expect(page.locator('.viewer')).toHaveAttribute('data-playback', 'playing');
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'work/studio-continuum-playing.png', fullPage: true });

  await page.getByRole('button', { name: 'Reduce studio interface motion' }).click();
  await expect(page.locator('.avatar-workspace')).toHaveCSS('animation-name', 'none');
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
