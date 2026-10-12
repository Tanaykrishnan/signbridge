import { test, expect } from '@playwright/test';
test('local GenAI generation, prompt comparison and review evidence work end to end', async ({
  page,
}) => {
  // The CPU provider allows 180 seconds per inference, including a cold prompt.
  test.setTimeout(780000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/language-lab');
  await expect(page.getByText('LOCAL MODEL ONLINE')).toBeVisible();
  await page
    .getByLabel('English text to paraphrase')
    .fill('Could you please tell me where the SRM Central Library is located?');
  await page.getByRole('button', { name: 'Paraphrase English', exact: true }).click();
  await expect(page.locator('.genai-output')).toHaveCount(1, { timeout: 190000 });
  await expect(page.locator('.genai-output')).toContainText('SRM Central Library');
  await page.getByRole('button', { name: 'Compare prompts', exact: true }).click();
  await expect(page.locator('.genai-output')).toHaveCount(3, { timeout: 570000 });
  await expect(page.locator('.genai-comparison tbody tr')).toHaveCount(3);
  await page.screenshot({ path: 'outputs/SignBridge-Language-Lab.png', fullPage: true });
  await page.getByRole('main').getByRole('link', { name: 'Review evidence', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Model and GenAI justification' })).toBeVisible();
  await expect(page.locator('.genai-comparison tbody tr')).toHaveCount(3);
  await page.screenshot({ path: 'outputs/SignBridge-Review-Evidence.png', fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
test('studio automatically paraphrases before ISL without a separate apply step', async ({
  page,
}) => {
  test.setTimeout(240000);
  await page.goto(
    '/studio?text=Could%20you%20please%20tell%20me%20where%20the%20library%20is%20situated%3F',
  );
  const original = await page.getByLabel('Text to translate').inputValue();
  await expect(page.getByRole('tab', { name: 'Paraphrase', exact: true })).toHaveCount(0);
  await expect(page.getByText('English model online · paraphrasing required')).toBeVisible();
  const translating = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/translate') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Paraphrase & translate', exact: true }).click();
  const result = await (await translating).json();
  expect(result.targetLanguage).toBe('ISL');
  expect(result.sourceText).toBe(result.paraphrase.paraphrase);
  expect(result.originalSourceText).toBe(original);
  await expect(page.getByLabel('Text to translate')).toHaveValue(original);
  await expect(page.getByRole('region', { name: 'English paraphrase result' })).toContainText(
    result.sourceText,
  );
  expect(result.sequence.every((sign: { id: string }) => !sign.id.startsWith('asl-'))).toBe(true);
  if (result.playback === 'ready')
    await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeEnabled();
  else
    await expect(page.getByRole('button', { name: 'Play sequence', exact: true })).toBeDisabled();
});
