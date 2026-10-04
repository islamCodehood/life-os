import { expect, test } from '@playwright/test';

test('@smoke English shell is LTR and consumes the design system', async ({ page }) => {
  await page.goto('/en');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { name: 'Life OS foundation is running.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Foundation ready' })).toBeVisible();
});

test('@smoke Arabic shell is RTL and preserves equivalent content', async ({ page }) => {
  await page.goto('/ar');

  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(
    page.getByRole('heading', { name: 'الأساس التقني لنظام Life OS يعمل.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'الأساس جاهز' })).toBeVisible();
});

test('@smoke health endpoint propagates a safe request ID', async ({ request }) => {
  const response = await request.get('/api/v1/health', {
    headers: { 'x-request-id': 'playwright-smoke-1' },
  });

  expect(response.ok()).toBeTruthy();
  expect(response.headers()['x-request-id']).toBe('playwright-smoke-1');
  expect(await response.json()).toMatchObject({
    ok: true,
    requestId: 'playwright-smoke-1',
  });
});
