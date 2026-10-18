import { test, expect } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`inventory opens and fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('http://127.0.0.1:5173/');
    await page.locator('#start-button').click();
    await page.keyboard.press('e');
    const inventory = page.locator('#inventory');
    await expect(inventory).toBeVisible();
    await expect(page.locator('.equipment-card')).toHaveCount(3);
    await expect(page.locator('.stone-thumbnail')).toHaveCount(2);
    await expect(page.locator('#inventory-total')).toHaveText('0 gesammelt');
    expect(await inventory.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    for (const image of await page.locator('.stone-thumbnail').all()) {
      await expect(image).toHaveJSProperty('complete', true);
      expect(await image.evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
    }
    await page.keyboard.press('Escape');
    await expect(inventory).not.toBeVisible();
  });
}
