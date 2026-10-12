import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('chapter links reach readable sections and scrolling back restores the opening composition', async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('hero-art')).toHaveAttribute('data-ready', 'true', {
    timeout: 60000,
  });
  const canvas = page.getByTestId('hero-art').locator('canvas');
  for (const [chapter, label] of [
    [3, 'Movement'],
    [4, 'Possibility'],
    [5, 'Your turn'],
  ] as const) {
    await page.getByRole('link', { name: `Chapter ${chapter}: ${label}`, exact: true }).click();
    await expect(
      page.getByRole('link', { name: `Chapter ${chapter}: ${label}`, exact: true }),
    ).toHaveAttribute('aria-current', 'step');
    await page.waitForTimeout(400);
    const a11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(a11y.violations).toEqual([]);
  }
  await page.getByRole('link', { name: 'Back to top' }).click();
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-progress')))
    .toBeLessThan(0.01);
  await expect(
    page.getByRole('link', { name: 'Step into the studio', exact: true }),
  ).toBeInViewport();
});
