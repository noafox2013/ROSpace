import { test, expect } from '@playwright/test';

test('third-person running supports full mouse turns and releases the cursor on pause', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 400 });
  // macOS headless Chromium rejects native pointer lock; emulate its browser events
  // to verify the game's turning and pause/resume integration independently.
  await page.addInitScript(() => {
    let locked = null;
    Object.defineProperty(document, 'pointerLockElement', { get: () => locked });
    HTMLCanvasElement.prototype.requestPointerLock = async function () {
      locked = this;
      document.dispatchEvent(new Event('pointerlockchange'));
    };
    document.exitPointerLock = () => {
      locked = null;
      document.dispatchEvent(new Event('pointerlockchange'));
    };
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.bringToFront();
  await page.locator('#start-button').click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.id)).toBe('game-canvas');
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousemove', {
    movementX: 600, movementY: 0, bubbles: true,
  })));
  await page.keyboard.down('w');
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousemove', {
    movementX: 2400, movementY: -2000, bubbles: true,
  })));
  await page.keyboard.up('w');
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-menu')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBe(null);
  await page.locator('#quit-button').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rust-mesa-saves-v2'))[0]);
  expect(saved.state.firstPerson).toBe(false);
  expect(saved.state.cameraPitch).toBeCloseTo(Math.PI / 2);
  expect(Math.abs(saved.state.faceYaw - Math.PI)).toBeGreaterThan(Math.PI * 2);
  await page.locator('#load-button').click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.id)).toBe('game-canvas');
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousemove', {
    movementX: 0, movementY: 2000, bubbles: true,
  })));
  await page.keyboard.press('Escape');
  await page.locator('#quit-button').click();
  const lookingDown = await page.evaluate(() => JSON.parse(localStorage.getItem('rust-mesa-saves-v2'))[0]);
  expect(lookingDown.state.cameraPitch).toBeCloseTo(-Math.PI / 3);

});
