import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function scenePixels(page: Page) {
  return page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const sample = document.createElement('canvas');
    sample.width = 160;
    sample.height = 160;
    const context = sample.getContext('2d')!;
    context.drawImage(canvas, 0, 0, 160, 160);
    return Array.from(context.getImageData(0, 0, 160, 160).data);
  });
}

test('real Qwen paraphrase drives ASL motions, history and accessible desktop studio', async ({
  page,
  request,
}) => {
  test.setTimeout(240000);
  expect((await (await request.get('/api/paraphrase/status')).json()).state).toBe('ready');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/studio?mode=fingerspelling');
  await page.getByRole('button', { name: 'ASL fingerspelling', exact: true }).click();
  const original = 'Could you please tell me where the SRM Central Library is situated?';
  await page.getByLabel('Text to translate', { exact: true }).fill(original);
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/translate') && r.request().method() === 'POST',
    { timeout: 200000 },
  );
  await page.getByRole('button', { name: 'Paraphrase & spell', exact: true }).click();
  const result = await (await response).json();
  expect(result.paraphrase.model.id).toBe('signbridge-qwen2.5-1.5b');
  expect(result.paraphrase.strategy).toBe('constrained');
  expect(result.sourceText).toBe(result.paraphrase.paraphrase);
  expect(result.originalSourceText).toBe(original);
  expect(result.sourceText).toContain('SRM Central Library');
  expect(result.targetLanguage).toBe('ASL');
  expect(
    result.sequence
      .filter((s: { token?: { kind: string } }) => s.token?.kind === 'letter')
      .map((s: { label: string }) => s.label)
      .join(''),
  ).toBe(result.sourceText.replace(/[^a-z]/gi, '').toUpperCase());
  await expect(page.getByLabel('Text to translate')).toHaveValue(original);
  await expect(page.getByRole('region', { name: 'English paraphrase result' })).toContainText(
    result.sourceText,
  );
  await expect(page.getByRole('region', { name: 'Paraphrased English preview' })).toContainText(
    result.sourceText,
  );
  await expect(
    page.getByRole('button', { name: 'Copy paraphrased English', exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole('tab', { name: 'Paraphrase', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }).getByText('English language lab'),
  ).toHaveCount(0);
  await expect(page.locator('.viewer-status')).toContainText('Procedural demonstration rig', {
    timeout: 60000,
  });
  const still = await scenePixels(page);
  expect(still.filter((v, i) => i % 4 !== 3 && v > 100).length).toBeGreaterThan(500);
  await page.getByRole('button', { name: 'Play sequence', exact: true }).click();
  await expect(page.locator('.viewer')).toHaveAttribute('data-playback', 'playing');
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  const moving = await scenePixels(page);
  expect(moving.filter((v, i) => Math.abs(v - still[i]) > 10).length).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Resume playback', exact: true }).click();
  await expect(page.locator('.viewer')).toHaveAttribute('data-playback', 'playing');
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'work/paraphrase-first-asl.png', fullPage: true });
  await expect
    .poll(async () =>
      (await (await page.request.get('/api/history')).json()).items.some(
        (item: { sourceText: string }) => item.sourceText === original,
      ),
    )
    .toBe(true);
  expect(errors).toEqual([]);
});

test('real paraphrase precedes local ISL and unknown vocabulary remains explicit', async ({
  page,
  request,
}) => {
  test.setTimeout(300000);
  const capabilities = await (await request.get('/api/capabilities')).json();
  expect(capabilities.model.state).toBe('configured');
  expect(capabilities.model.engine).toBe('local-sign-vqvae');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/studio');
  for (const original of [
    'Could you please tell me where the library is?',
    'Hello. My name is Zzyqx.',
  ]) {
    await page.getByLabel('Text to translate').fill(original);
    const response = page.waitForResponse(
      (r) => r.url().endsWith('/api/translate') && r.request().method() === 'POST',
      { timeout: 250000 },
    );
    await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
    const result = await (await response).json();
    expect(result.paraphrase.model.id).toBe('signbridge-qwen2.5-1.5b');
    expect(result.originalSourceText).toBe(original);
    expect(result.sourceText).toBe(result.paraphrase.paraphrase);
    expect(result.targetLanguage).toBe('ISL');
    expect(result.sequence.every((s: { id: string }) => !s.id.startsWith('asl-'))).toBe(true);
    await expect(page.getByRole('region', { name: 'English paraphrase result' })).toContainText(
      result.sourceText,
    );
    await expect(page.getByRole('region', { name: 'Paraphrased English preview' })).toContainText(
      result.sourceText,
    );
    if (original.includes('Zzyqx')) {
      expect(result.blockReason).toBe('model-vocabulary-unavailable');
      expect(result.unsupportedWords).toContain('Zzyqx');
      await expect(page.locator('.studio-coverage-note')).toContainText('Zzyqx');
      expect(result.sequence).toEqual([]);
      expect(result.sourceText).toContain('Zzyqx');
      await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeDisabled();
      await page.screenshot({ path: 'work/paraphrase-first-isl-unavailable.png', fullPage: true });
    } else {
      expect(result.rendering).toBe('isl-model-motion');
      expect(result.generatedMotion.sourceText).toBe(result.sourceText);
      expect(result.generatedMotion.review.status).toBe('unreviewed');
      await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Play sequence', exact: true }).click();
      await expect(page.locator('.viewer')).toHaveAttribute('data-playback', 'playing');
      await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
      await page.screenshot({ path: 'work/paraphrase-first-isl.png', fullPage: true });
    }
  }
  await page.getByLabel('Text to translate').fill('New input');
  await expect(page.getByRole('region', { name: 'English paraphrase result' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeDisabled();
});

test('offline English-model status blocks both modes without fake conversion', async ({ page }) => {
  // Fault injection tests the unavailable UI; it does not stand in for successful inference.
  let translations = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/api/translate')) translations++;
  });
  await page.route('**/api/paraphrase/status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        state: 'offline',
        model: 'fault-injection',
        provider: 'test',
        inputLimit: 5000,
        message: 'Unavailable test state',
      }),
    }),
  );
  await page.goto('/studio');
  await page.getByLabel('Text to translate').fill('Hello');
  await expect(
    page.getByRole('button', { name: 'Paraphrase & translate', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'ASL fingerspelling', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Paraphrase & spell', exact: true }),
  ).toBeDisabled();
  await expect(page.getByText('English model unavailable · signing paused')).toBeVisible();
  await page.unroute('**/api/paraphrase/status');
  await page.getByRole('button', { name: 'Refresh model status' }).click();
  await expect(page.getByRole('button', { name: 'Paraphrase & spell', exact: true })).toBeEnabled();
  expect(translations).toBe(0);
});
