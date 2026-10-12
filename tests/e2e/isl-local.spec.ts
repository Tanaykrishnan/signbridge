import { test, expect, type Page } from '@playwright/test';

async function pixels(page: Page) {
  return page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const copy = document.createElement('canvas');
    copy.width = 160;
    copy.height = 160;
    const ctx = copy.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0, 160, 160);
    return Array.from(ctx.getImageData(0, 0, 160, 160).data);
  });
}

test('real local ISL inference, distinct moving poses, paragraphs and coverage errors', async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  const capabilities = await (await request.get('/api/capabilities')).json();
  test.skip(
    capabilities.model.engine !== 'local-sign-vqvae' || capabilities.model.state !== 'configured',
    'Start npm run isl:start for this real-model integration test.',
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1508, height: 830 });
  await page.goto('/studio');
  await page
    .getByLabel('Text to translate')
    .fill('What is your name? I am a student. Where is the blue building?');
  const responsePromise = page.waitForResponse(
    (r) => r.url().endsWith('/api/translate') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
  const result = await (await responsePromise).json();
  expect(result.rendering).toBe('isl-model-motion');
  expect(result.generatedMotion.model.id).toBe('local-sign-vqvae');
  expect(result.generatedMotion.model.commercialUse).toBe(false);
  expect(result.sequence).toHaveLength(3);
  expect(result.sequence.map((s: { gloss: string }) => s.gloss)).toEqual([
    'Your / Name / What',
    'I (Person) / Student',
    'Blue / Building / Where',
  ]);
  expect(result.sequence.every((s: { id: string }) => !s.id.startsWith('asl-'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Upper-body view', exact: true }).click();
  await page.waitForTimeout(250);
  const initial = await pixels(page);
  expect(initial.filter((v, i) => i % 4 !== 3 && v > 100).length).toBeGreaterThan(500);
  await page.getByRole('button', { name: 'Play sequence', exact: true }).click();
  await page.waitForTimeout(2400);
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  const animated = await pixels(page);
  expect(animated.filter((v, i) => Math.abs(v - initial[i]) > 12).length).toBeGreaterThan(100);
  await page.screenshot({ path: 'work/isl-local-actual-model.png' });
  await page.getByRole('button', { name: 'Next phrase', exact: true }).click();
  await page.waitForTimeout(250);
  const different = await pixels(page);
  expect(different.filter((v, i) => Math.abs(v - animated[i]) > 12).length).toBeGreaterThan(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Text to translate').fill('Hello. My name is Zzyqx.');
  await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Translation result' })).toContainText('Zzyqx');
  await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeDisabled();
  await expect(page.locator('.sequence-step')).toHaveCount(0);
  await page.screenshot({ path: 'work/isl-local-coverage-error.png' });
  await page.getByText('Output settings & asset details', { exact: true }).click();
  await expect(page.getByLabel('Unreviewed model output')).toBeEnabled();
  await expect(page.getByLabel('Unreviewed model output')).toBeChecked();
  await page.getByLabel('Unreviewed model output').uncheck();
  await expect(page.getByLabel('Unreviewed model output')).not.toBeChecked();
  await page.getByText('Output settings & asset details', { exact: true }).click();
  await page.getByLabel('Text to translate').fill('Hello');
  const previewPromise = page.waitForResponse(
    (r) => r.url().endsWith('/api/translate') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
  expect((await (await previewPromise).json()).rendering).toBe('isl-reference-preview');
  await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});
