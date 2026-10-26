import { test, expect } from '@playwright/test';

test('C scans nearby targets and clears the markers afterwards', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 640, height: 480 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  await page.keyboard.press('c');
  await expect(page.locator('#scan-status')).toHaveText('Umgebung wird gescannt …');
  await expect.poll(() => page.locator('.scan-marker').count()).toBeGreaterThan(0);
  const count = await page.locator('.scan-marker').count();
  await page.keyboard.press('c');
  expect(await page.locator('.scan-marker').count()).toBe(count);
  await expect(page.locator('#scan-status')).toHaveText('Scan abgeschlossen', { timeout: 40000 });
  await expect(page.locator('#scan-status')).toBeHidden({ timeout: 40000 });
  await expect(page.locator('.scan-marker')).toHaveCount(0);
  expect(errors).toEqual([]);
});
