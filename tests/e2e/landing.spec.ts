import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
]) {
  test(`homepage CTA is unobstructed and opens the studio at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const cta = page.getByRole('link', { name: 'Step into the studio', exact: true });
    await expect(cta).toBeInViewport();
    await expect
      .poll(() =>
        cta.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return (
            document
              .elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
              ?.closest('a') === element
          );
        }),
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await cta.click();
    await expect(page).toHaveURL(/\/studio$/);
    await expect(page.getByLabel('Text to translate')).toBeVisible();
  });
}

test('homepage links and source-text deep links retain their application destinations', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'The experience', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Language takes shape.' })).toBeInViewport();
  await page.getByRole('link', { name: 'Explore the motion lab', exact: true }).click();
  await expect(page).toHaveURL(/\/studio\?mode=lab$/);
  await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeEnabled();
  await page.goto('/?text=Thank%20you');
  await expect(page).toHaveURL(/\/studio\?text=Thank%20you$/);
  await expect(page.getByLabel('Text to translate')).toHaveValue('Thank you');
});
