import { test, expect } from '@playwright/test';
test('beam endpoint and shot direction follow the crosshair in both perspectives', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 480, height: 400 });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      window.setAimTest = (firstPerson, pitch, mode) => {
        state.firstPerson = firstPerson; state.cameraPitch = pitch;
        state.weaponMode = mode; state.laserActive = true;
      };
      window.readAimTest = () => {
        handLaser.beam.updateWorldMatrix(true, false);
        const end = new THREE.Vector3(0,0,laserRange/2).applyMatrix4(handLaser.beam.matrixWorld).project(camera);
        const expected = laserAimTarget.clone().sub(laserMuzzleWorld).normalize();
        const resting = new THREE.Quaternion().setFromEuler(state.firstPerson ? new THREE.Euler(0, Math.PI, 0) : laserBaseRotation);
        return {x:end.x,y:end.y,canFire:handLaser.canFire,shotDot:laserShotDirection.dot(expected),weaponAngle:handLaser.group.quaternion.angleTo(resting)};
      };
    ` });
  });
  await page.addInitScript(() => {
    let lock = null;
    Object.defineProperty(document, 'pointerLockElement', { get: () => lock });
    HTMLCanvasElement.prototype.requestPointerLock = async function () { lock = this; document.dispatchEvent(new Event('pointerlockchange')); };
    document.exitPointerLock = () => { lock = null; document.dispatchEvent(new Event('pointerlockchange')); };
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  for (const firstPerson of [true, false]) {
    for (const pitch of [-0.3, 0.7]) {
      await page.evaluate(({firstPerson,pitch}) => window.setAimTest(firstPerson,pitch,'beam'), {firstPerson,pitch});
      await expect.poll(() => page.evaluate(() => {
        const aim = window.readAimTest(); return Math.max(Math.abs(aim.x), Math.abs(aim.y));
      })).toBeLessThan(0.003);
      expect(await page.evaluate(() => window.readAimTest().weaponAngle)).toBeLessThan(0.00001);
      await page.evaluate(({firstPerson,pitch}) => window.setAimTest(firstPerson,pitch,'shots'), {firstPerson,pitch});
      await expect.poll(() => page.evaluate(() => window.readAimTest().shotDot)).toBeGreaterThan(0.9999);
    }
  }
  expect(errors).toEqual([]);
});
