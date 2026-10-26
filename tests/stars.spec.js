import { test, expect } from '@playwright/test';

test('night stars and visor compile without rendering errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /shader|WebGLProgram|VALIDATE_STATUS/i.test(message.text())) errors.push(message.text());
  });
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      window.showNightStars = () => {
        dayStartedAt = performance.now() - (daylightDuration + nightDuration * 0.5 - initialSunAngle / Math.PI * daylightDuration) * 1000;
        state.cameraPitch = 0.85;
        sandstorm.restore({wait: 9999, age: 0, duration: 0});
      };
      window.readNightStars = () => skyDome.material.uniforms.nightStrength.value;
    ` });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  await page.evaluate(() => window.showNightStars());
  await expect.poll(() => page.evaluate(() => window.readNightStars())).toBe(1);
  await page.screenshot({ path: '/tmp/rospace-stars.png' });
  expect(errors).toEqual([]);
});
