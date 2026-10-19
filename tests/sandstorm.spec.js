import { test, expect } from '@playwright/test';
test('heavy sandstorm obscures terrain, pauses and saves its progress', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /shader|VALIDATE_STATUS|WebGLProgram/i.test(message.text())) errors.push(message.text()); });
  await page.setViewportSize({ width: 640, height: 480 });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      window.testStormWarning = () => sandstorm.restore({wait:14,age:0,duration:0});
      window.testStorm = () => sandstorm.restore({wait:0,age:20,duration:70});
      window.readStorm = () => ({intensity:sandstorm.getIntensity(),far:scene.fog.far,sky:skyDome.material.uniforms.stormStrength.value,sun:sun.material.opacity});
      window.lookAtStormSky = () => {state.cameraPitch = 1.05;};
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
  await page.evaluate(() => window.testStormWarning());
  await expect(page.locator('#curse-message')).toHaveText('HEFTIGER SANDSTURM NÄHERT SICH, BITTE SOFORT SCHUTZ FINDEN!!!');
  await expect(page.locator('#curse-message')).toBeVisible();
  await page.evaluate(() => window.testStorm());
  await expect.poll(() => page.evaluate(() => window.readStorm().intensity)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.readStorm().far)).toBeLessThan(30);
  await expect.poll(() => page.evaluate(() => window.readStorm().sky)).toBe(1);
  expect(await page.evaluate(() => window.readStorm().sun)).toBe(0);
  await page.screenshot({ path: 'test-results/sandstorm.png' });
  await page.evaluate(() => window.lookAtStormSky());
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/sandstorm-sky.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('#game-message-list')).not.toContainText('HEFTIGER SANDSTURM NÄHERT SICH');
  await page.locator('#quit-button').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rust-mesa-saves-v2'))[0]);
  expect(saved.sandstorm.duration).toBe(70);
  expect(saved.sandstorm.age).toBeGreaterThanOrEqual(20);
  expect(errors).toEqual([]);
});
