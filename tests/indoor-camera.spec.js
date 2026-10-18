import { test, expect } from '@playwright/test';

test('third-person camera stays within the building when turning indoors', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 900, height: 650 });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + '\nwindow.readTestCamera = () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z });' });
  });
  await page.addInitScript(() => {
    let locked = null;
    Object.defineProperty(document, 'pointerLockElement', { get: () => locked });
    HTMLCanvasElement.prototype.requestPointerLock = async function () { locked = this; document.dispatchEvent(new Event('pointerlockchange')); };
    localStorage.setItem('rust-mesa-save-v1', JSON.stringify({ version: 1, name: 'Indoor camera', state: { health: 100 },
      position: [0, -0.05, -33.5], dayElapsed: 100, sandwormRepelled: true, curseMessageSeen: true }));
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#load-button').click();
  await expect(page.locator('#app')).not.toHaveClass(/is-first-person/);
  for (let turn = 0; turn < 4; turn++) {
    await expect.poll(async () => {
      const camera = await page.evaluate(() => window.readTestCamera());
      return Math.abs(camera.x) < 5.8 && Math.abs(camera.z + 32) < 5.8 && camera.y < 3.525;
    }).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousemove', {
      movementX: 524, movementY: 0, bubbles: true,
    })));
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: '/tmp/rospace-base-indoor-camera.png' });
});
