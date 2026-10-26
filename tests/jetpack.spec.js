import { test, expect } from '@playwright/test';

test('jetpack exhaust renders without shader errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  await page.keyboard.down('Space');
  await page.waitForTimeout(1500);
  await page.keyboard.up('Space');
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});

test('jetpack keeps climbing beyond the old limit and camera follows', async ({ page }) => {
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      window.testUnlimitedFlight = () => {
        state.running = true; state.jetpackActive = true;
        state.flightHeight = 0; state.flightVelocity = 0; state.jetpackLevel = 0;
        for (let i = 0; i < 3000; i++) updateJetpack(0.04);
        const first = state.flightHeight;
        for (let i = 0; i < 3000; i++) updateJetpack(0.04);
        setDefaultCameraPerspective();
        return { first, second: state.flightHeight, cameraHeight: camera.position.y };
      };` });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  const result = await page.evaluate(() => window.testUnlimitedFlight());
  expect(result.first).toBeGreaterThan(600);
  expect(result.second).toBeGreaterThan(result.first + 600);
  expect(result.cameraHeight).toBeGreaterThan(result.second);
});
