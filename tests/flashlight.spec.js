import { test, expect } from '@playwright/test';

test('automatic chest flashlight renders at night in both camera views', async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 900, height: 650 });
  await page.addInitScript(() => localStorage.setItem('rust-mesa-save-v1', JSON.stringify({
    version: 1, name: 'Night', state: { health: 100 }, position: [0, 1, 2], dayElapsed: 570,
  })));
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#load-button').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('p');
  await expect(page.locator('#app')).toHaveClass(/is-first-person/);
  await page.locator('#game-canvas').dispatchEvent('pointerdown', { button: 0 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/rospace-flashlight-night.png' });
  await page.locator('#game-canvas').dispatchEvent('pointerup', { button: 0 });
  await page.keyboard.down('Space');
  await page.waitForTimeout(1000);
  await page.keyboard.up('Space');
  await page.screenshot({ path: '/tmp/rospace-flashlight-flying.png' });
  expect(errors).toEqual([]);
});
