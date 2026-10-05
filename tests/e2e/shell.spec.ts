import { expect, test } from '@playwright/test';

test('@smoke English shell is LTR', async ({ page }) => {
  await page.goto('/en');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { name: 'Who is using Life OS?' })).toBeVisible();
});

test('@smoke Arabic shell is RTL with equivalent identity entry point', async ({ page }) => {
  await page.goto('/ar');

  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'من يستخدم Life OS؟' })).toBeVisible();
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
