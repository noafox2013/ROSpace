import { test, expect } from '@playwright/test';

test('world and gravity continue in inventory, and death closes it', async ({ page }) => {
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      window.prepareInventoryFlight = () => { state.flightHeight = 20; state.flightVelocity = 0; };
      window.readInventoryFlight = () => state.flightHeight;
      window.endInventoryRun = () => gameOver('Test');
    ` });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  await page.evaluate(() => window.prepareInventoryFlight());
  await page.keyboard.press('e');
  await expect(page.locator('#inventory')).toBeVisible();
  const height = await page.evaluate(() => window.readInventoryFlight());
  await expect.poll(() => page.evaluate(() => window.readInventoryFlight())).toBeLessThan(height - 0.2);
  await expect(page.locator('#inventory')).toBeVisible();
  await page.evaluate(() => window.endInventoryRun());
  await expect(page.locator('#inventory')).toBeHidden();
  await expect(page.locator('#overlay')).toBeVisible();
});
