import { test, expect } from '@playwright/test';

test('high falls deal 10 health and recovery waits 25 seconds, including after saving and loading', async ({ page }) => {
  test.setTimeout(150000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 800, height: 600 });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      renderer.setPixelRatio(0.5); renderer.shadowMap.enabled = false;
      window.healthTest = {
        read() { return { health:state.health, wait:state.healthRecoveryDelay, height:state.flightHeight }; },
        fall(height) {
          state.health = 100; state.healthRecoveryDelay = state.fallDistance = 0;
          state.flightHeight = height; state.flightVelocity = 0; state.jetpackActive = false;
          ship.position.set(900,terrainHeight(900,900)+playerGroundOffset+height,900);
          resetSceneryAroundPlayer();
          for (let i = 0; i < 400 && state.flightHeight > 0; i++) updateGame(0.04);
          return this.read();
        },
        advance(seconds) { for (let remaining = seconds; remaining > 0.000001; remaining -= 0.04) updateGame(Math.min(0.04,remaining)); return this.read(); },
        hit() { damageHealth(state,10); },
        save() { return saveGame(); },
      };
    ` });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  expect((await page.evaluate(() => window.healthTest.fall(3))).health).toBe(100);
  const fallen = await page.evaluate(() => window.healthTest.fall(12));
  expect(fallen).toEqual({ health:90, wait:25, height:0 });
  expect((await page.evaluate(() => window.healthTest.advance(24))).health).toBe(90);
  expect((await page.evaluate(() => window.healthTest.advance(0.9))).health).toBe(90);
  const healing = await page.evaluate(() => window.healthTest.advance(0.3));
  expect(healing.health).toBeGreaterThan(90); expect(healing.health).toBeLessThan(93);
  await page.evaluate(() => { window.healthTest.hit(); window.healthTest.advance(10); window.healthTest.save(); });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rust-mesa-saves-v2'))[0]);
  expect(saved.state.healthRecoveryDelay).toBeCloseTo(15,1);
  expect(saved.state.health).toBeLessThan(83);
  await page.reload();
  await page.locator('#load-button').click();
  const loaded = await page.evaluate(() => window.healthTest.read());
  expect(loaded.health).toBeCloseTo(saved.state.health,1);
  expect(loaded.wait).toBeGreaterThan(14);
  const recovered = await page.evaluate(() => window.healthTest.advance(21));
  expect(recovered.health).toBe(100);
  await expect(page.locator('#health')).toHaveText('100');
  expect(errors).toEqual([]);
});
