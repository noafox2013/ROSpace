import { test, expect } from '@playwright/test';
test('death restores checkpoint progress at the death location without creating another save', async ({ page }) => {
  test.setTimeout(240000);
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      renderer.setPixelRatio(0.5);
      window.testWormDeath = () => { ship.position.set(123,10,87); state.faceYaw=0.7; state.health = 0; gameOver('Der Sandwurm hat dich mit seinem Maul erwischt.'); };
      window.testUnsavedDeath = () => { currentRunHasSave=false; window.testWormDeath(); };
      window.readDeathTest = () => ({ slot: activeSaveSlot, name: saveNameInput.value, health: state.health, stones: state.stones, laserLevel: state.laserLevel, x:ship.position.x, z:ship.position.z, yaw:state.faceYaw, flight:state.flightHeight });
    ` });
  });
  await page.addInitScript(() => {
    let locked = null;
    Object.defineProperty(document, 'pointerLockElement', { get: () => locked });
    HTMLCanvasElement.prototype.requestPointerLock = async function () { locked = this; document.dispatchEvent(new Event('pointerlockchange')); };
    document.exitPointerLock = () => { locked = null; document.dispatchEvent(new Event('pointerlockchange')); };
    const saves = Array(10).fill(null);
    saves[2] = { version: 1, name: 'Other save', state: { health: 90 }, position: [0, 1, 2], dayElapsed: 100 };
    saves[7] = { version: 1, name: 'Morning camp', state: { health: 65, stones: 42, laserLevel: 2 }, position: [0, 1, 2], dayElapsed: 100 };
    localStorage.setItem('rust-mesa-saves-v2', JSON.stringify(saves));
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => typeof window.testWormDeath === 'function');
  await page.locator('#load-slot').selectOption('7');
  await page.locator('#load-button').click();
  for (const keyboard of [false, true]) {
    await page.evaluate(() => window.testWormDeath());
    await expect(page.locator('#overlay')).toHaveClass(/visible/);
    await expect(page.locator('#pause-menu')).toBeHidden();
    await page.locator('#load-slot').selectOption('2');
    if (keyboard) { await page.locator('#start-button').focus(); await page.keyboard.press('Enter'); }
    else await page.locator('#start-button').click();
    await expect(page.locator('#overlay')).not.toHaveClass(/visible/);
    await expect.poll(() => page.evaluate(() => window.readDeathTest())).toEqual({ slot: 7, name: 'Morning camp', health: 65, stones: 42, laserLevel: 2, x:123, z:87, yaw:0.7, flight:0 });
  }
  await page.keyboard.press('Escape');
  await page.locator('#quit-button').click();
  const saves = await page.evaluate(() => JSON.parse(localStorage.getItem('rust-mesa-saves-v2')));
  expect(saves.filter(Boolean)).toHaveLength(2);
  expect(saves[7].name).toBe('Morning camp');
  expect(saves[2].name).toBe('Other save');
  await page.evaluate(() => window.testUnsavedDeath());
  await page.locator('#start-button').click();
  await expect.poll(() => page.evaluate(() => window.readDeathTest())).toMatchObject({ health:100, x:123, z:87, yaw:0.7, flight:0 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rust-mesa-saves-v2')).filter(Boolean).length)).toBe(2);
});
