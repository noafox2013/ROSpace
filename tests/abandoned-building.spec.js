import { test, expect } from '@playwright/test';

test('ruin has compass marker, locked entry and a purchasable saved pass key', async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 800, height: 600 });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      window.viewRuinExterior = () => {
        dayStartedAt = performance.now() - (daylightDuration * 0.4 - initialSunAngle / Math.PI * daylightDuration) * 1000;
        updateSunAndKeyLight();
        setScreenshotMode(true);
        camera.position.set(abandonedLocation.x + 22, 12, abandonedLocation.z + 28);
        camera.lookAt(abandonedLocation.x, 3, abandonedLocation.z);
        skyDome.position.copy(camera.position);
        renderer.render(scene, camera);
      };
      window.viewDamagedTerminal = () => {
        setScreenshotMode(true);
        for (let i = 0; i < 100; i++) {
          abandonedBuilding.update(0.04);
          if (abandonedBuilding.group.getObjectByName('terminal-sparks').geometry.drawRange.count > 0) break;
        }
        camera.position.set(abandonedLocation.x + 2.5, abandonedLocation.ground + 2.3, abandonedLocation.z - 2.4);
        camera.lookAt(abandonedLocation.x, abandonedLocation.ground + 1.5, abandonedLocation.z - 5.8);
        skyDome.position.copy(camera.position);
        renderer.render(scene, camera);
        return abandonedBuilding.group.getObjectByName('terminal-sparks').geometry.drawRange.count;
      };
      window.archiveProgress = () => ({ elapsed: state.elapsed, paused: pausedAt, sparkTime: clock.elapsedTime });
      window.inspectArchive = () => {
        ship.position.set(abandonedLocation.x, abandonedLocation.ground + 1, abandonedLocation.z - 3.5);
        state.flightHeight = 0;
      };
      window.inspectRuin = () => {
        ship.position.set(abandonedLocation.x, abandonedLocation.ground + 1, abandonedLocation.z + 12);
        state.flightHeight = 0;
        updateTerrainAroundPlayer();
      };
      window.testPassKey = () => {
        state.stones = 30; state.crystals = 10;
        refreshTradingTerminal(); tradeMenu.showModal();
      };
      window.savePassKey = () => { tradeMenu.close(); saveGame(); return readSaves(localStorage)[activeSaveSlot].state.passKey; };
    ` });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  await expect(page.locator('#abandoned-compass-marker')).toContainText('☠');
  await page.evaluate(() => window.inspectRuin());
  await expect(page.locator('#abandoned-hint')).toContainText('Verschlossen');
  await page.screenshot({ path: '/tmp/rospace-abandoned.png' });
  await page.evaluate(() => window.testPassKey());
  await page.locator('[data-product="passkey"]').click();
  await expect(page.locator('[data-product="passkey"]')).toBeDisabled();
  expect(await page.evaluate(() => window.savePassKey())).toBe(1);
  await expect(page.locator('#abandoned-hint')).toContainText('F · Tür mit Pass-Key aufschließen');
  await page.keyboard.press('f');
  await expect(page.locator('#abandoned-hint')).toContainText('Zugang freigegeben');
  await page.evaluate(() => window.inspectArchive());
  await expect(page.locator('#archive-hint')).toBeVisible();
  await page.keyboard.press('f');
  await expect(page.locator('#archive-menu')).toBeVisible();
  await expect(page.locator('#archive-menu')).toContainText('Der Sandsturm hat die Solarmodule zerstört');
  expect(await page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  expect(await page.locator('#archive-menu').evaluate(el => getComputedStyle(el).cursor)).toBe('auto');
  const progress = await page.evaluate(() => window.archiveProgress());
  expect(progress.paused).toBeNull();
  await expect.poll(() => page.evaluate(() => window.archiveProgress().elapsed)).toBeGreaterThan(progress.elapsed);
  await expect(page.locator('#archive-menu')).toBeVisible();

  await page.locator('#archive-close').click();
  await expect(page.locator('#archive-menu')).toBeHidden();
  expect(await page.evaluate(() => window.viewDamagedTerminal())).toBeGreaterThan(0);
  await page.screenshot({ path: '/tmp/rospace-damaged-terminal.png' });
  await page.evaluate(() => window.viewRuinExterior());
  await page.screenshot({ path: '/tmp/rospace-outpost.png' });
  expect(errors).toEqual([]);
});
