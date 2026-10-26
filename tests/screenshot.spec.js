import { test, expect } from '@playwright/test';

test('O toggles screenshot mode and left click downloads a PNG without firing', async ({ page }) => {
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nwindow.testLaserActive = () => state.laserActive; window.readScreenshotState = () => ({ elapsed: state.elapsed, position: ship.position.toArray(), day: (pausedAt ?? performance.now()) - dayStartedAt });' });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  await page.keyboard.press('o');
  await expect(page.locator('#app')).toHaveClass(/screenshot-mode/);
  await expect(page.locator('.hud')).toBeHidden();
  await expect(page.locator('#screenshot-hint')).toBeVisible();
  const frozen = await page.evaluate(() => window.readScreenshotState());
  await page.keyboard.down('Space');
  await page.keyboard.down('w');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.readScreenshotState())).toEqual(frozen);
  await page.keyboard.up('Space');
  await page.keyboard.up('w');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#game-canvas').dispatchEvent('pointerdown', { button: 0, pointerType: 'mouse' });
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^Rust-Mesa-.*\.png$/);
  expect(await download.failure()).toBeNull();
  expect(await page.evaluate(() => window.testLaserActive())).toBe(false);
  await page.keyboard.press('o');
  await expect(page.locator('#app')).not.toHaveClass(/screenshot-mode/);
  await expect(page.locator('.hud')).toBeVisible();
  await expect(page.locator('#screenshot-hint')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.readScreenshotState().day)).toBeGreaterThan(frozen.day + 100);
  await page.keyboard.down('w');
  await expect.poll(() => page.evaluate(() => window.readScreenshotState().elapsed)).toBeGreaterThan(frozen.elapsed);
  await page.keyboard.up('w');
});
