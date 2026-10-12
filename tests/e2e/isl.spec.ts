import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { srmInputs } from '../fixtures/srm-inputs';
import { ISL_REFERENCE_PHRASES } from '../../src/lib/isl-reference';
import { testMotion } from '../fixtures/isl-motion';

async function convert(page: Page, text: string) {
  await page.getByLabel('Text to translate').fill(text);
  await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeEnabled();
}
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
async function referenceOnly(page: Page) {
  await page.getByText('Output settings & asset details', { exact: true }).click();
  await page.getByLabel('Reference animation previews (unreviewed)').check();
  await expect(page.getByLabel('Unreviewed model output')).not.toBeChecked();
  await page.getByText('Output settings & asset details', { exact: true }).click();
}
test('ISL reference previews differ, animate, sequence and clear when options change', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/studio?mode=isl&reviewedOnly=1');
  await referenceOnly(page);
  await convert(page, 'Hello');
  await expect(page.getByText('ISL REFERENCE PREVIEW', { exact: true })).toBeVisible();
  await page.waitForTimeout(200);
  const hello = await pixels(page);
  expect(hello.filter((v, i) => i % 4 !== 3 && v > 100).length).toBeGreaterThan(500);
  await page.getByLabel('Playback speed', { exact: true }).selectOption('0.5');
  await page.getByRole('button', { name: 'Play sequence', exact: true }).click();
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  const moving = await pixels(page);
  expect(moving.filter((v, i) => Math.abs(v - hello[i]) > 12).length).toBeGreaterThan(100);
  await page.screenshot({ path: 'work/isl-hello-studio.png', fullPage: true });
  await convert(page, 'Thank you');
  await page.waitForTimeout(200);
  const thanks = await pixels(page);
  expect(thanks.filter((v, i) => Math.abs(v - hello[i]) > 12).length).toBeGreaterThan(150);
  await convert(page, 'Hello! Thank you. How are you?');
  await expect(page.locator('.sequence-step')).toHaveCount(3);
  await page.getByRole('button', { name: 'Next phrase', exact: true }).click();
  await expect(page.locator('.spelling-caption strong')).toHaveText('Thank you.');
  await page.getByRole('button', { name: 'Previous phrase', exact: true }).click();
  await expect(page.locator('.spelling-caption strong')).toHaveText('Hello!');
  await page.getByText('Output settings & asset details', { exact: true }).click();
  await page.getByLabel('Reference animation previews (unreviewed)').uncheck();
  await page.getByText('Output settings & asset details', { exact: true }).click();
  await expect(page.locator('.sequence-step')).toHaveCount(0);
  await page.getByLabel('Text to translate').fill('Hello');
  await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
  await expect(page.getByText('ANIMATION UNAVAILABLE', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('ISL is the default; arbitrary input never silently becomes ASL or partial signs', async ({
  page,
}) => {
  // The optional local planner has a 90-second request deadline; do not confuse
  // a slow vocabulary check with an unsupported-input UI regression.
  test.setTimeout(840000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/studio');
  await expect(page.getByRole('button', { name: 'ISL translation', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('ASL fallback for unsupported text')).toHaveCount(0);
  for (const text of [
    'Hello. My name is Zzyqx.',
    ...srmInputs.map((text) => `${text} Zzyqx.`),
    'x'.repeat(5000),
  ]) {
    await page.getByLabel('Text to translate').fill(text);
    await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Paraphrase & translate', exact: true })).toBeEnabled({
      timeout: 100000,
    });
    await expect(page.getByText('ISL GENERATION UNAVAILABLE', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeDisabled();
    await expect(page.locator('.sequence-step')).toHaveCount(0);
    await expect(page.getByLabel('Text to translate')).toHaveValue(text);
  }
  await page.getByLabel('Text to translate').fill('Are you free today?');
  await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Paraphrase & translate', exact: true })).toBeEnabled({
    timeout: 100000,
  });
  const annotation = page
    .locator('.dataset-annotation')
    .filter({ hasText: 'ISL-CSLTR / PUBLISHED TEXT ANNOTATION' });
  await expect(annotation).toContainText('YOU FREE TODAY');
  await expect(annotation).toContainText(
    /No corresponding avatar motion|not the source of this generated motion/,
  );
  await page.getByText('Dataset source and attribution').click();
  await expect(annotation).toContainText('Elakkiya R');
  await page.screenshot({ path: 'work/isl-no-substitution.png', fullPage: true });
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(a11y.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('synthetic model-motion fixture drives real avatar playback (not an ISL accuracy test)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.route('**/api/capabilities', (route) =>
    route.fulfill({
      json: {
        targetLanguage: 'ISL',
        model: {
          state: 'configured',
          message: 'Synthetic test-only endpoint, not a real ISL model.',
        },
        arbitraryTextGuaranteed: false,
        referencePreviewCount: 7,
        maxTextLength: 5000,
      },
    }),
  );
  await page.route('**/api/translate', async (route) => {
    const input = route.request().postDataJSON();
    const motion = testMotion(input.text);
    await route.fulfill({
      json: {
        status: 'supported',
        sourceText: input.text,
        normalized: input.text.toLowerCase(),
        language: 'en',
        phrase: null,
        sequence: [
          {
            id: 'isl-generated-0',
            clip: 'isl-generated-0',
            label: 'Synthetic playback fixture',
            gloss: null,
            asset: null,
            duration: 1,
            transition: 0,
            review: 'unreviewed',
            source: motion.model.source,
            license: motion.model.license,
            provenance: motion.model.attribution,
            available: true,
            fallback: 'rest',
            token: {
              start: 0,
              end: input.text.length,
              wordIndex: 0,
              wordStart: 0,
              wordEnd: input.text.length,
              kind: 'phrase',
            },
          },
        ],
        playback: 'ready',
        match: null,
        provenance: motion.model.attribution,
        linguisticConfidence: null,
        assetAvailability: 'available',
        message: 'NOT AN ISL TRANSLATION. Synthetic test data.',
        outputMode: 'isl',
        targetLanguage: 'ISL',
        rendering: 'isl-model-motion',
        generatedMotion: motion,
        warnings: motion.limitations,
      },
    });
  });
  await page.goto('/studio');
  await page.getByText('Output settings & asset details', { exact: true }).click();
  await page.getByLabel('Unreviewed model output').check();
  await page.getByText('Output settings & asset details', { exact: true }).click();
  await convert(page, srmInputs[2]);
  await expect(page.getByText('ISL MODEL OUTPUT', { exact: true })).toBeVisible();
  await expect(page.locator('.viewer')).toContainText('ISL model output / review pending');
  const before = await pixels(page);
  await page.getByLabel('Playback speed', { exact: true }).selectOption('0.5');
  const timeline = page.getByLabel('Playback timeline');
  await timeline.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('PageUp');
  await page.waitForTimeout(150);
  const after = await pixels(page);
  expect(after.filter((v, i) => Math.abs(v - before[i]) > 12).length).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Restart playback', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause playback', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  const paused = await timeline.inputValue();
  await page.waitForTimeout(150);
  await expect(timeline).toHaveValue(paused);
  await page.getByRole('button', { name: 'Resume playback', exact: true }).click();
  await expect(page.locator('.viewer')).toHaveAttribute('data-playback', 'complete');
  await page.screenshot({ path: 'work/isl-model-test-fixture.png', fullPage: true });
  await page.getByLabel('Text to translate').fill('New input');
  await expect(page.locator('.sequence-step')).toHaveCount(0);
});

test('all seven reference clips render and remain navigable in the desktop studio', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/studio?mode=isl&reviewedOnly=1');
  await referenceOnly(page);
  const captures: { label: string; image: string }[] = [];
  for (const phrase of ISL_REFERENCE_PHRASES) {
    await convert(page, phrase.text);
    await expect(page.locator('.sequence-step.current')).toContainText(phrase.text);
    const timeline = page.getByLabel('Playback timeline');
    await timeline.focus();
    await page.keyboard.press('Home');
    for (let step = 0; step < 4; step++) await page.keyboard.press('PageUp');
    await expect
      .poll(async () => (await pixels(page)).filter((v, i) => i % 4 !== 3 && v > 100).length)
      .toBeGreaterThan(500);
    await page.waitForTimeout(120);
    captures.push({
      label: phrase.text,
      image: await page
        .locator('canvas')
        .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()),
    });
  }
  await page.setContent(
    `<main style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:12px;background:#0c1210;color:white;font-family:Arial">${captures.map((c) => `<div><h2>${c.label}</h2><img style="width:100%" src="${c.image}" alt="Unreviewed reference pose" /></div>`).join('')}</main>`,
  );
  await page.screenshot({ path: 'work/isl-reference-contact-sheet.png', fullPage: true });
});
