import { test, expect } from '@playwright/test';

test('health is displayed and survives saving and loading, including older saves', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  await expect(page.locator('#health')).toHaveText('100');
  await page.keyboard.press('Escape');
  await page.locator('#quit-button').click();
  await page.evaluate(() => {
    const saves = JSON.parse(localStorage.getItem('rust-mesa-saves-v2'));
    const saved = saves[0];
    saved.state.health = 75;
    localStorage.setItem('rust-mesa-saves-v2', JSON.stringify(saves));
  });
  await page.reload();
  await page.locator('#load-button').click();
  await expect(page.locator('#health')).toHaveText('75');
  await expect(page.locator('#health-bar')).toHaveJSProperty('value', 75);
  await page.evaluate(() => {
    const saves = JSON.parse(localStorage.getItem('rust-mesa-saves-v2'));
    const saved = saves[0];
    delete saved.state.health;
    localStorage.setItem('rust-mesa-saves-v2', JSON.stringify(saves));
  });
  await page.reload();
  await page.locator('#load-button').click();
  await expect(page.locator('#health')).toHaveText('100');
});
