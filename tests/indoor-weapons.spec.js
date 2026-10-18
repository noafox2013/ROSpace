import { test, expect } from '@playwright/test';
test('both laser modes are blocked indoors and an active beam stops on entering', async ({ page }) => {
  test.setTimeout(90000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      window.readWeaponTest = () => ({ active: state.laserActive, beam: handLaser.beam.visible, shots: laserShotIndex, canFire: handLaser.canFire });
      window.moveWeaponTest = z => { ship.position.set(0, terrainHeight(0, z) + 1, z); };
    ` });
  });
  await page.addInitScript(() => {
    let locked = null;
    Object.defineProperty(document, 'pointerLockElement', { get: () => locked });
    HTMLCanvasElement.prototype.requestPointerLock = async function () { locked = this; document.dispatchEvent(new Event('pointerlockchange')); };
    localStorage.setItem('rust-mesa-save-v1', JSON.stringify({ version: 1, name: 'Weapon lock',
      state: { health: 100, firstPerson: true, faceYaw: 0 }, position: [0, -0.05, -32], dayElapsed: 100,
      sandwormRepelled: true, curseMessageSeen: true }));
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#load-button').click();
  const canvas = page.locator('#game-canvas');
  await canvas.dispatchEvent('pointerdown', { button: 0 });
  await expect.poll(() => page.evaluate(() => window.readWeaponTest())).toEqual({ active: false, beam: false, shots: 0, canFire: false });
  await canvas.dispatchEvent('pointerup', { button: 0 });
  await page.keyboard.press('g');
  await canvas.dispatchEvent('pointerdown', { button: 0 });
  await page.waitForTimeout(250);
  expect((await page.evaluate(() => window.readWeaponTest())).shots).toBe(0);
  await canvas.dispatchEvent('pointerup', { button: 0 });
  await page.evaluate(() => window.moveWeaponTest(-18));
  await expect.poll(() => page.evaluate(() => window.readWeaponTest().canFire)).toBe(true);
  await canvas.dispatchEvent('pointerdown', { button: 0 });
  await expect.poll(() => page.evaluate(() => window.readWeaponTest().shots)).toBeGreaterThan(0);
  await canvas.dispatchEvent('pointerup', { button: 0 });
  await page.keyboard.press('g');
  await canvas.dispatchEvent('pointerdown', { button: 0 });
  await expect.poll(() => page.evaluate(() => window.readWeaponTest().beam)).toBe(true);
  await page.evaluate(() => window.moveWeaponTest(-32));
  await expect.poll(() => page.evaluate(() => window.readWeaponTest().active)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.readWeaponTest().beam)).toBe(false);
  expect(errors).toEqual([]);
});
