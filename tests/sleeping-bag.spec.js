import { test, expect } from '@playwright/test';

test('sleeping bag skips the night to dawn and cannot skip daylight', async ({ page }) => {
  test.setTimeout(90000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    let locked = null;
    Object.defineProperty(document, 'pointerLockElement', { get: () => locked });
    HTMLCanvasElement.prototype.requestPointerLock = async function () { locked = this; queueMicrotask(() => document.dispatchEvent(new Event('pointerlockchange'))); };
    document.exitPointerLock = () => { locked = null; queueMicrotask(() => document.dispatchEvent(new Event('pointerlockchange'))); };
    if (localStorage.getItem('sleep-test-seeded')) return;
    localStorage.setItem('sleep-test-seeded', 'true');
    localStorage.setItem('rust-mesa-save-v1', JSON.stringify({ version: 1, name: 'Night camp',
      state: { health: 75, stones: 3, crystals: 0 }, position: [0, 1, 2], dayElapsed: 570 }));
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#load-button').click();
  await page.keyboard.press('e');
  await expect(page.locator('#inventory')).toBeVisible();
  await expect(page.locator('#sleeping-bag')).toContainText('Schlafsack');
  await page.locator('#sleeping-bag').click();
  const sleepStarted = Date.now();
  await page.keyboard.press('f');
  await expect(page.locator('#sleep-overlay')).toBeVisible();
  await expect(page.locator('#sleep-overlay')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  expect(Number(await page.locator('#sleep-overlay').evaluate(element => getComputedStyle(element).opacity))).toBeLessThan(1);
  await expect(page.locator('#sleep-overlay')).toHaveCSS('opacity', '1', { timeout: 2500 });
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-menu')).toBeHidden();
  await page.waitForTimeout(4000);
  await expect(page.locator('#sleep-overlay')).toBeVisible();
  await expect(page.locator('#sleep-overlay')).toBeHidden({ timeout: 4000 });
  expect(Date.now() - sleepStarted).toBeGreaterThanOrEqual(6900);
  await expect(page.locator('#inventory')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.locator('#quit-button').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rust-mesa-saves-v2'))[0]);
  expect(saved.dayElapsed).toBeGreaterThanOrEqual(720);
  expect(saved.dayElapsed % 720).toBeLessThan(420);
  expect(saved.state.health).toBe(75); expect(saved.state.stones).toBe(3);
  await page.reload(); await page.locator('#load-button').click();
  await page.keyboard.press('e');
  await page.locator('#sleeping-bag').focus();
  await page.keyboard.press('f');
  await expect(page.locator('#inventory')).toBeVisible();
  await expect(page.locator('#sleep-status')).toHaveText('Du kannst den Schlafsack nur nachts benutzen.');
  expect(errors).toEqual([]);
});
