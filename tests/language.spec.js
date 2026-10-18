import { test, expect } from '@playwright/test';

test('language can be switched in the pause menu and persists after reload', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  await page.keyboard.press('Escape');
  await page.locator('#language-select').selectOption('en');
  await expect(page.locator('#pause-title')).toHaveText('Game paused');
  await expect(page.locator('#resume-button')).toHaveText('Resume');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('#save-name').fill('My expedition');
  await page.locator('#quit-button').click();
  await expect(page.locator('#save-message')).toHaveText('Game saved.');
  await page.reload();
  await expect(page.locator('#load-button')).toHaveText('Load game: My expedition');
  await page.locator('#load-button').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#language-select')).toHaveValue('en');
  await page.locator('#language-select').selectOption('de');
  await expect(page.locator('#pause-title')).toHaveText('Spiel pausiert');
  await expect(page.locator('#resume-button')).toHaveText('Weiterspielen');
  await expect(page.locator('#save-name')).toHaveValue('My expedition');
});
