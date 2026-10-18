import { test, expect } from '@playwright/test';

test('compass follows the view across north and fits a narrow screen', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.addInitScript(() => {
    let locked = null;
    Object.defineProperty(document, 'pointerLockElement', { get: () => locked });
    HTMLCanvasElement.prototype.requestPointerLock = async function () {
      locked = this;
      document.dispatchEvent(new Event('pointerlockchange'));
    };
    document.exitPointerLock = () => { locked = null; };
  });
  await page.goto('http://127.0.0.1:5173/');
  await expect(page.locator('#compass')).toBeHidden();
  await page.locator('#start-button').click();
  await expect(page.locator('#compass-heading')).toHaveText('N · 0°');
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousemove', {
    movementX: Math.PI / 2 / 0.003, movementY: 0, bubbles: true,
  })));
  await expect(page.locator('#compass-heading')).toHaveText('O · 90°');
  await page.keyboard.press('p');
  await expect(page.locator('#compass-heading')).toHaveText('O · 90°');
  const compass = await page.locator('#compass').boundingBox();
  const hud = await page.locator('.hud').boundingBox();
  expect(compass.x).toBeGreaterThanOrEqual(0);
  expect(compass.x + compass.width).toBeLessThanOrEqual(390);
  expect(compass.y + compass.height).toBeLessThan(hud.y);
});
