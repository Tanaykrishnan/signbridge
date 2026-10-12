import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
    const ctx = copy.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0, 160, 160);
    return Array.from(ctx.getImageData(0, 0, 160, 160).data);
  });
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}
test('desktop translation, animated pixels, complete playback controls, clipboard and persistence', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/studio?mode=isl&reviewedOnly=1');
  await ready(page);
  await expect(page.getByRole('button', { name: 'Paraphrase & translate', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Hello', exact: true }).click();
  await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
  await expect(page.getByText('ANIMATION UNAVAILABLE', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeDisabled();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy source text' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Hello');
  await page.getByRole('button', { name: 'Save phrase', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Motion lab', exact: true }).click();
  const before = await pixels(page);
  expect(before.filter((v, i) => i % 4 !== 3 && v > 100).length).toBeGreaterThan(500);
  await page.getByLabel('Playback speed', { exact: true }).selectOption('0.5');
  await page.getByRole('button', { name: 'Play sequence', exact: true }).click();
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  const after = await pixels(page);
  expect(after.filter((v, i) => Math.abs(v - before[i]) > 12).length).toBeGreaterThan(100);
  const paused = await page.getByLabel('Playback timeline').inputValue();
  await page.waitForTimeout(350);
  await expect(page.getByLabel('Playback timeline')).toHaveValue(paused);
  await page.getByRole('button', { name: 'Resume playback' }).click();
  await page.getByRole('button', { name: 'Next sign', exact: true }).click();
  await expect(page.locator('.sequence-step.current')).toContainText('Return to neutral');
  await page.getByRole('button', { name: 'Previous sign', exact: true }).click();
  await page.getByRole('button', { name: 'Pause playback' }).click();
  await page.getByLabel('Playback timeline').focus();
  await page.keyboard.press('End');
  await expect(page.getByText('PLAYBACK COMPLETE', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restart playback' }).click();
  await page.getByRole('button', { name: 'Pause playback' }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  await page.getByRole('button', { name: 'Enter full screen' }).click();
  await expect(page.getByRole('button', { name: 'Exit full screen' })).toBeVisible();
  await page.getByRole('button', { name: 'Exit full screen' }).click();
  await page.getByRole('button', { name: 'ISL translation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ready for a new result' })).toBeVisible();
  await noOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'work/studio-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Saved phrases', exact: true }).click();
  await expect(page).toHaveURL(/\/favorites$/);
  await expect(page.locator('.phrase-title')).toHaveText('Hello');
  await page.reload();
  await expect(page.locator('.phrase-title')).toHaveText('Hello');
  await page.getByRole('button', { name: 'Remove saved phrase' }).click();
  await expect(page.getByText('No saved phrases match')).toBeVisible();
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.locator('.history-content').first()).toContainText('Hello');
  await page.getByRole('link', { name: 'Reopen', exact: true }).first().click();
  await expect(page.getByLabel('Text to translate')).toHaveValue('Hello');
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await page.getByLabel('Search history').fill('Hello');
  await page.getByRole('button', { name: 'Remove history: Hello', exact: true }).first().click();
  await expect(page.getByText('No translations here yet')).toBeVisible();
  expect(errors).toEqual([]);
});

test('unsupported phrases, missing assets, library filters and detail provenance', async ({
  page,
}) => {
  await page.goto('/studio?mode=isl&reviewedOnly=1');
  await page.getByLabel('Text to translate').fill('This sentence is not in the dictionary');
  await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'ISL generation model not installed' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play sequence' })).toBeDisabled();
  await page.getByRole('link', { name: 'Browse supported phrases' }).click();
  await page.getByLabel('Review status').selectOption('reviewed');
  await expect(page.getByText('No phrases match your filters')).toBeVisible();
  await page.getByLabel('Review status').selectOption('');
  await page.getByLabel('Category', { exact: true }).selectOption('education');
  await page.getByLabel('Asset availability').selectOption('false');
  await page.getByLabel('Search phrases').fill('library');
  await expect(page.locator('.phrase-title')).toHaveText('Where is the library?');
  await page.getByRole('button', { name: 'List layout' }).click();
  await expect(page.locator('.phrase-grid')).toHaveClass(/list-layout/);
  await page.locator('.phrase-title').click();
  await ready(page);
  await expect(page.getByText('Missing asset', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play sequence' })).toBeDisabled();
  await expect(page.getByText('No linguistic reviewer assigned')).toBeVisible();
});

test('mobile canvas, navigation, settings, keyboard and accessible contrast', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/studio?mode=isl&reviewedOnly=1');
  await ready(page);
  await noOverflow(page);
  const data = await pixels(page);
  expect(data.filter((v, i) => i % 4 !== 3 && v > 100).length).toBeGreaterThan(500);
  await page.getByRole('button', { name: 'Hello', exact: true }).click();
  await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
  await expect(page.getByText('ANIMATION UNAVAILABLE', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Motion lab', exact: true }).click();
  await page.getByRole('button', { name: 'Play sequence', exact: true }).click();
  await expect
    .poll(async () => Number(await page.getByLabel('Playback timeline').inputValue()))
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  // Sample inside the first clip; software-renderer latency can otherwise let
  // the sequence reach its neutral second clip before the pause click lands.
  await page.getByLabel('Playback timeline').focus();
  await page.keyboard.press('Home');
  for (let step = 0; step < 3; step++) await page.keyboard.press('PageUp');
  await expect
    .poll(async () => (await pixels(page)).filter((v, i) => Math.abs(v - data[i]) > 12).length)
    .toBeGreaterThan(100);
  const moving = await pixels(page);
  expect(moving.filter((v, i) => Math.abs(v - data[i]) > 12).length).toBeGreaterThan(100);
  await page.screenshot({ path: 'work/studio-mobile.png', fullPage: true });
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(a11y.violations).toEqual([]);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Theme', { exact: true }).selectOption('light');
  await page.getByLabel('High contrast', { exact: true }).check();
  await page.getByLabel('Larger text', { exact: true }).check();
  await page.getByLabel('Reduce interface motion').check();
  await page.reload();
  await expect(page.getByLabel('High contrast', { exact: true })).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await noOverflow(page);
  await page.screenshot({ path: 'work/settings-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Restore default preferences' }).click();
  await expect(page.getByLabel('High contrast', { exact: true })).not.toBeChecked();
});

test('all navigation pages and tablet layout', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  for (const path of [
    '/dashboard',
    '/library',
    '/history',
    '/favorites',
    '/settings',
    '/about',
    '/privacy',
    '/help',
  ]) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    await noOverflow(page);
  }
  await page.getByText('Which phrases can I use?', { exact: true }).click();
  await expect(page.locator('details[open]')).toBeVisible();
  await page.goto('/library');
  await page.getByLabel('Search phrases').fill('thank');
  await expect(page.locator('.phrase-title')).toHaveText('Thank you');
  await page.screenshot({ path: 'work/library-tablet.png', fullPage: true });
});

test('failed configured model gives explicit usable fallback', async ({ page }) => {
  await page.route('**/api/assets', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.avatar.url = '/assets/avatar/not-present.glb';
    await route.fulfill({ response, json });
  });
  await page.goto('/studio?mode=isl&reviewedOnly=1');
  await expect(page.locator('.viewer-status')).toContainText('Model loading failed', {
    timeout: 60000,
  });
  await page.getByRole('button', { name: 'Hello', exact: true }).click();
  await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play sequence' })).toBeDisabled();
  await page.getByRole('button', { name: 'Motion lab', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play sequence' })).toBeEnabled();
});

test('compatible GLB loads and its embedded clips animate', async ({ page }) => {
  await page.route('**/api/assets', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.avatar.url = '/assets/avatar/demo-rig.glb';
    json.avatar.name = 'Original GLB test rig';
    await route.fulfill({ response, json });
  });
  await page.goto('/studio?mode=isl&reviewedOnly=1');
  await expect(page.locator('.viewer-status')).toHaveText('Asset loaded', { timeout: 60000 });
  await page.getByRole('button', { name: 'Hello', exact: true }).click();
  await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
  await expect(page.getByText('ANIMATION UNAVAILABLE', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Motion lab', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play sequence' })).toBeEnabled();
  const before = await pixels(page);
  await page.getByRole('button', { name: 'Play sequence' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Pause playback' }).click();
  const after = await pixels(page);
  expect(after.filter((v, i) => Math.abs(v - before[i]) > 12).length).toBeGreaterThan(100);
  await page.screenshot({ path: 'work/glb-loader.png', fullPage: true });
});

test('changing phrases clears stale output and refuses recycled test motions', async ({ page }) => {
  await page.goto('/studio?mode=isl&reviewedOnly=1');
  await ready(page);
  for (const phrase of ['Hello', 'Thank you', 'Good morning', 'I need help']) {
    await page.getByLabel('Text to translate').fill(phrase);
    await expect(page.locator('.sequence-step')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Play sequence' })).toBeDisabled();
    await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
    await expect(
      page
        .getByRole('region', { name: 'Translation result' })
        .getByRole('heading', { name: phrase, exact: true }),
    ).toBeVisible();
    await expect(page.getByText('ANIMATION UNAVAILABLE', { exact: true })).toBeVisible();
    await expect(page.locator('.sequence-step')).toHaveCount(0);
  }
  await page.getByLabel('Text to translate').fill('an unmatched sentence');
  await expect(page.getByText('ANIMATION UNAVAILABLE', { exact: true })).toHaveCount(0);
  await expect(page.locator('.viewer')).toHaveAttribute('data-playback', 'idle');
  await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'ISL generation model not installed' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play sequence' })).toBeDisabled();
});

test('a delayed real API response cannot overwrite edited input', async ({ page }) => {
  let finish!: () => void;
  let fetched!: () => void;
  const responseFetched = new Promise<void>((resolve) => {
    fetched = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route('**/api/translate', async (route) => {
    const response = await route.fetch();
    fetched();
    await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  await page.goto('/studio?mode=isl&reviewedOnly=1');
  await page.getByLabel('Text to translate').fill('Hello');
  await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
  await responseFetched;
  await page.getByLabel('Text to translate').fill('Thank you');
  finish();
  await expect(page.getByRole('heading', { name: 'Ready for a new result' })).toBeVisible();
  await page.waitForTimeout(400);
  await expect(
    page
      .getByRole('region', { name: 'Translation result' })
      .getByRole('heading', { name: 'Hello', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play sequence' })).toBeDisabled();
});

test('motion lab clips visibly differ and leaving the lab clears the pose', async ({ page }) => {
  await page.goto('/studio?mode=isl&reviewedOnly=1');
  await ready(page);
  const idle = await pixels(page);
  await page.getByRole('button', { name: 'Motion lab', exact: true }).click();
  const timeline = page.getByLabel('Playback timeline');
  await timeline.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp');
  await page.waitForTimeout(120);
  const first = await pixels(page);
  await page.getByRole('button', { name: /02 Reach motion/ }).click();
  await timeline.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp');
  await page.waitForTimeout(120);
  const second = await pixels(page);
  expect(second.filter((v, i) => Math.abs(v - first[i]) > 12).length).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'ISL translation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play sequence' })).toBeDisabled();
  await expect(page.locator('.sequence-step')).toHaveCount(0);
  await page.waitForTimeout(120);
  const cleared = await pixels(page);
  expect(cleared.filter((v, i) => Math.abs(v - idle[i]) > 12).length).toBeLessThan(60);
});

test('desktop workspace pages share the studio design and usable motion controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of [
    '/dashboard',
    '/library',
    '/history',
    '/favorites',
    '/settings',
    '/about',
    '/privacy',
    '/help',
  ]) {
    await page.goto(path);
    await expect(page.locator('.workspace-shell:not(.studio-shell)')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
    await noOverflow(page);
  }
  await page.getByText('Which phrases can I use?', { exact: true }).click();
  await expect(page.locator('details[open]')).toBeVisible();
  await page.getByRole('button', { name: 'Reduce workspace interface motion' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await page.goto('/settings');
  await expect(page.getByLabel('Reduce interface motion')).toBeChecked();
  await page.getByLabel('Theme', { exact: true }).selectOption('light');
  await page.goto('/library');
  await expect(page.locator('.workspace-shell')).toHaveCSS(
    'background-color',
    'rgb(250, 251, 245)',
  );
  await page.screenshot({ path: 'work/workspace-library-light.png', fullPage: true });
  const lightA11y = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(lightA11y.violations).toEqual([]);
  await page.locator('.phrase-title').first().click();
  await expect(page).toHaveURL(/\/phrases\/hello$/);
  await expect(page.getByRole('button', { name: 'Save phrase', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Save phrase', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove saved phrase' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove saved phrase' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove saved phrase' }).click();
  await expect(page.getByRole('button', { name: 'Save phrase', exact: true })).toBeVisible();
});
