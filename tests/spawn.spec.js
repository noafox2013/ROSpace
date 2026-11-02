import { test, expect } from '@playwright/test';

test('new runs spawn beside the spacecraft while saved positions and death checkpoints are preserved', async ({ page }) => {
  test.setTimeout(150000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 800, height: 600 });
  await page.addInitScript(() => {
    let lock = null;
    Object.defineProperty(document, 'pointerLockElement', { get: () => lock });
    HTMLCanvasElement.prototype.requestPointerLock = async function () { lock = this; document.dispatchEvent(new Event('pointerlockchange')); };
    document.exitPointerLock = () => { lock = null; document.dispatchEvent(new Event('pointerlockchange')); };
  });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      renderer.setPixelRatio(0.5); renderer.shadowMap.enabled = false;
      window.spawnTest = {
        read() { return {x:ship.position.x, z:ship.position.z,
          distance:Math.hypot(ship.position.x-spacecraft.group.position.x,ship.position.z-spacecraft.group.position.z),
          entrance:spacecraft.nearEntrance(ship.position), height:state.flightHeight}; },
        die() { gameOver('Spawn test'); },
        saveElsewhere() {
          ship.position.set(900,terrainHeight(900,900)+playerGroundOffset,900);
          state.flightHeight = state.flightVelocity = 0;
          updateTerrainAroundPlayer(); resetSceneryAroundPlayer();
          return saveGame();
        },
      };
    ` });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  const read = () => page.evaluate(() => window.spawnTest.read());
  expect((await read()).distance).toBeLessThan(12);
  expect((await read()).entrance).toBe(true);
  await page.evaluate(() => window.spawnTest.die());
  await page.locator('#start-button').click();
  expect((await read()).entrance).toBe(true);
  expect(await page.evaluate(() => window.spawnTest.saveElsewhere())).toBe(true);
  await page.reload();
  await page.locator('#load-button').click();
  expect(await read()).toMatchObject({ x:900, z:900, height:0 });
  await page.evaluate(() => window.spawnTest.die());
  await page.locator('#start-button').click();
  expect(await read()).toMatchObject({ x:900, z:900, height:0 });
  await page.keyboard.press('Escape');
  await page.locator('#quit-button').click();
  await page.locator('#start-button').click();
  expect((await read()).entrance).toBe(true);
  expect(errors).toEqual([]);
});
