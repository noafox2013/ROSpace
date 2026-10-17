import { test, expect } from '@playwright/test';

test('jetpack exhaust renders without shader errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  await page.keyboard.down('Space');
  await page.waitForTimeout(1500);
  await page.keyboard.up('Space');
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});
