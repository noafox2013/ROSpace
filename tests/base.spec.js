import { test, expect } from '@playwright/test';
test('walk into the marked base, buy supplies and persist upgrades', async ({ page }) => {
  test.setTimeout(240000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 1100, height: 750 });
  await page.addInitScript(() => {
    let locked = null;
    Object.defineProperty(document, 'pointerLockElement', { get: () => locked });
    HTMLCanvasElement.prototype.requestPointerLock = async function () { locked = this; document.dispatchEvent(new Event('pointerlockchange')); };
    document.exitPointerLock = () => { locked = null; document.dispatchEvent(new Event('pointerlockchange')); };
    if (localStorage.getItem('base-test-seeded')) return;
    localStorage.setItem('base-test-seeded', 'true');
    localStorage.setItem('rust-mesa-save-v1', JSON.stringify({ version: 1, name: 'Base visit',
      state: { health: 40, stones: 50, crystals: 20 }, position: [0, -0.05, -21], dayElapsed: 0,
      sandwormRepelled: true, curseMessageSeen: true,
    }));
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#load-button').click();
  await expect(page.locator('#base-compass-marker')).toContainText('⌂');
  await page.screenshot({ path: '/tmp/rospace-base-outside.png' });
  await page.keyboard.down('w');
  await expect(page.locator('#terminal-hint')).toBeVisible({ timeout: 90000 });
  await page.keyboard.up('w');
  await page.screenshot({ path: '/tmp/rospace-base-inside.png' });
  await page.keyboard.press('f');
  await expect(page.locator('#trade-menu')).toBeVisible();
  await expect(page.locator('#pause-menu')).not.toBeVisible();
  await page.locator('[data-product="medical"]').click();
  await page.locator('[data-product="laser"]').click();
  await page.locator('[data-product="jetpack"]').click();
  await expect(page.locator('#trade-balance')).toHaveText('20 Steine · 13 Kristalle');
  await page.locator('#trade-close').click();
  await page.keyboard.press('Escape');
  await page.locator('#quit-button').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rust-mesa-saves-v2'))[0]);
  expect(saved.state.health).toBe(90);
  expect(saved.state.laserLevel).toBe(1); expect(saved.state.jetpackLevel).toBe(1);
  await page.reload(); await page.locator('#load-button').click();
  await page.keyboard.press('f');
  await expect(page.locator('#trade-menu')).toBeVisible();
  await expect(page.locator('#trade-balance')).toHaveText('20 Steine · 13 Kristalle');
  expect(errors).toEqual([]);
});
