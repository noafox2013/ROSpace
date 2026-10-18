import { test, expect } from '@playwright/test';
test('F marker seats the explorer, blocks walking and allows standing and safe saving', async ({ page }) => {
  test.setTimeout(90000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1000, height: 750 });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nwindow.readSeatTest = () => { ship.updateMatrixWorld(true); return { seated: !!seatedBench, position: ship.position.toArray(), legs: limbRig.map(rig => ({ calf: new THREE.Box3().setFromObject(rig.leg), thigh: new THREE.Box3().setFromObject(rig.upperLeg) })) }; };' });
  });
  await page.addInitScript(() => {
    let locked = null;
    Object.defineProperty(document, 'pointerLockElement', { get: () => locked });
    HTMLCanvasElement.prototype.requestPointerLock = async function () { locked = this; document.dispatchEvent(new Event('pointerlockchange')); };
    document.exitPointerLock = () => { locked = null; document.dispatchEvent(new Event('pointerlockchange')); };
    localStorage.setItem('rust-mesa-save-v1', JSON.stringify({ version: 1, name: 'Bench',
      state: { health: 100, faceYaw: Math.PI / 2, cameraOrbitYaw: Math.PI / 2 },
      position: [5.75, -0.05, -30.5], dayElapsed: 100, sandwormRepelled: true, curseMessageSeen: true }));
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#load-button').click();
  await expect(page.locator('.bench-interaction:visible')).toHaveText('F');
  await page.keyboard.press('f');
  await expect(page.locator('#stand-hint')).toBeVisible();
  await expect(page.locator('#trade-menu')).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => window.readSeatTest().seated)).toBe(true);
  await page.keyboard.down('w'); await page.waitForTimeout(400); await page.keyboard.up('w');
  const seated = await page.evaluate(() => window.readSeatTest());
  expect(seated.position[0]).toBeCloseTo(6.95);
  for (const leg of seated.legs) {
    // On the right bench the front edge is x=6.675; calves must be fully beyond it.
    expect(leg.calf.max.x).toBeLessThan(6.675);
    // The cushion top is y=-0.41; thighs rest on top rather than inside it.
    expect(leg.thigh.min.y).toBeGreaterThanOrEqual(-0.41);
  }
  expect(seated.position[2]).toBeCloseTo(-30.5);
  await page.screenshot({ path: '/tmp/rospace-bench-seated.png' });
  await page.keyboard.press('f');
  await expect(page.locator('#stand-hint')).toBeHidden();
  const standing = await page.evaluate(() => window.readSeatTest());
  expect(standing.seated).toBe(false); expect(standing.position[0]).toBeCloseTo(5.75);
  await page.keyboard.press('f');
  await page.keyboard.press('Escape');
  await page.locator('#quit-button').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rust-mesa-saves-v2'))[0]);
  expect(saved.position[0]).toBeCloseTo(5.75); expect(saved.position[1]).toBeCloseTo(-0.05);
  expect(errors).toEqual([]);
});
