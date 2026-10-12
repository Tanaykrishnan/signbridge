import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('library directions resolve existing ISL motion and show generated English beside the input', async ({
  page,
}) => {
  test.setTimeout(240000);
  const original = 'can you please show me the way to the library';
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/studio');
  await page.getByLabel('Text to translate', { exact: true }).fill(original);
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/translate') && r.request().method() === 'POST',
    { timeout: 200000 },
  );
  await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
  const result = await (await response).json();
  expect(result.originalSourceText).toBe(original);
  expect(result.sourceText).toBe(result.paraphrase.paraphrase);
  expect(result.sourceText.toLowerCase()).toContain('library');
  expect(result.rendering).toBe('isl-model-motion');
  expect(result.generatedMotion.review.status).toBe('unreviewed');
  expect(result.generatedMotion.lexicalMappings).toContainEqual({
    source: 'way',
    target: 'Direction',
    rule: 'spatial-directions-v1',
    review: 'unreviewed',
  });
  expect(result.generatedMotion.segments[0].gloss).toContain('Direction');
  expect(result.sequence.every((s: { id: string }) => !s.id.startsWith('asl-'))).toBe(true);
  const preview = page.getByRole('region', { name: 'Paraphrased English preview' });
  await expect(preview).toContainText(result.sourceText);
  await expect(preview).toContainText('way → Direction');
  await page.getByRole('button', { name: 'Copy paraphrased English', exact: true }).click();
  await expect(page.getByText('Paraphrased English copied.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Text to translate')).toHaveValue(original);
  const input = (await page.locator('.source-field').boundingBox())!;
  const output = (await preview.boundingBox())!;
  expect(Math.abs(output.x - input.x)).toBeLessThan(2);
  expect(output.y - input.y - input.height).toBeLessThan(30);
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'work/visible-paraphrase-library-isl.png' });
  await page.getByRole('button', { name: 'Play sequence', exact: true }).click();
  await expect(page.locator('.viewer')).toHaveAttribute('data-playback', 'playing');
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);

  await page.getByRole('button', { name: 'ASL fingerspelling', exact: true }).click();
  await expect(preview).toContainText('Not generated yet.');
  const aslResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/translate') && r.request().method() === 'POST',
    { timeout: 200000 },
  );
  await page.getByRole('button', { name: 'Paraphrase & spell', exact: true }).click();
  const asl = await (await aslResponse).json();
  expect(asl.targetLanguage).toBe('ASL');
  await expect(preview).toContainText(asl.paraphrase.paraphrase);
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'work/visible-paraphrase-library-asl.png' });
  await page.getByLabel('Text to translate').fill('New source');
  await expect(preview).toContainText('Not generated yet.');
  await expect(
    page.getByRole('button', { name: 'Copy paraphrased English', exact: true }),
  ).toBeDisabled();
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
