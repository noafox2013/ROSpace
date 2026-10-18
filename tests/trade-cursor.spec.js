import { test, expect } from '@playwright/test';

test('trading releases the mouse and shows a cursor in first person', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    let locked = null;
    Object.defineProperty(document, 'pointerLockElement', { get: () => locked });
    HTMLCanvasElement.prototype.requestPointerLock = async function () { locked = this; document.dispatchEvent(new Event('pointerlockchange')); };
    document.exitPointerLock = () => { locked = null; document.dispatchEvent(new Event('pointerlockchange')); };
    localStorage.setItem('rust-mesa-save-v1', JSON.stringify({ version: 1, name: 'Trade cursor',
      state: { health: 40, stones: 20, crystals: 10, firstPerson: true }, position: [0, -0.05, -37],
      dayElapsed: 100, sandwormRepelled: true, curseMessageSeen: true }));
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#load-button').click();
  await expect(page.locator('#app')).toHaveClass(/is-first-person/);
  await page.keyboard.press('f');
  await expect(page.locator('#trade-menu')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBe(null);
  await expect(page.locator('#trade-menu')).toHaveCSS('cursor', 'auto');
  await expect(page.locator('#trade-title')).toHaveCSS('cursor', 'auto');
  await expect(page.locator('[data-product="medical"]')).toHaveCSS('cursor', 'pointer');
  await page.locator('[data-product="medical"]').click();
  await expect(page.locator('#health')).toHaveText('90');
  await expect(page.locator('#trade-balance')).toHaveText('15 Steine · 10 Kristalle');
  await page.locator('#trade-close').click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.id)).toBe('game-canvas');
});
