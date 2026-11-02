import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('crashed ship requires the archive fuel tank, 30 crystals and 20 additional blue crystals, persists repairs and then flies', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1000, height: 700 });
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
      window.repairTest = {
        read() { return { activated:state.archiveActivated, cors:state.cors, tank:state.fuelTank, read:state.archiveRead, repaired:state.spacecraftRepaired,
          crystals:state.crystals, blue:state.blueCrystals, aboard:aboardSpacecraft,
          damaged:spacecraft.isDamaged(), damageVisible:spacecraft.group.getObjectByName('spacecraft-crash-damage').visible }; },
        approach() { ship.position.copy(spacecraft.exit); state.flightHeight = 0; },
        crystals(count, blue = Math.min(35, count)) { state.crystals = count; state.blueCrystals = blue; updateInventoryResources(); },
        strut() { state.landingStrut = 1; state.treasureScanned = state.treasureExcavated = state.treasureOpened = 1; spaceTreasure.restore(state); updateInventoryResources(); },
        archive() {
          state.passKey = state.abandonedUnlocked = 1; abandonedBuilding.setUnlocked(true);
          ship.position.set(abandonedLocation.x, abandonedLocation.ground + 1, abandonedLocation.z - 3.5);
          state.flightHeight = 0;
        },
        money(count) { state.cors = count; updateHud(); },
        save() { return saveGame(); },
        fly() {
          spacecraft.setBoarded(true, true);
          spacecraft.update(0.04, {occupied:aboardSpacecraft, up:true});
          for (let i = 0; i < 180; i++) spacecraft.update(0.04, {occupied:aboardSpacecraft});
          return spacecraft.flight.altitude;
        },
        crashCapture() {
          const position = camera.position.clone(), rotation = camera.quaternion.clone();
          camera.position.copy(spacecraft.group.position).add(new THREE.Vector3(-20, 12, 23));
          camera.lookAt(spacecraft.group.position.clone().add(new THREE.Vector3(0, 3, 0)));
          renderer.render(scene,camera); const data = canvas.toDataURL();
          camera.position.copy(position); camera.quaternion.copy(rotation); return data;
        },
      };
    ` });
  });
  const read = () => page.evaluate(() => window.repairTest.read());
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  expect(await read()).toMatchObject({ tank: 0, read: 0, repaired: 0, damaged: true, damageVisible: true });
  await page.evaluate(() => { window.repairTest.crystals(30); window.repairTest.approach(); });
  await expect(page.locator('#spacecraft-hint')).toContainText('abgestürzt');
  await page.keyboard.press('f');
  expect(await read()).toMatchObject({ aboard: false, repaired: 0, crystals: 30 });
  expect(await page.evaluate(() => window.repairTest.fly())).toBe(0);
  if (process.env.ROSPACE_CAPTURE) {
    const data = await page.evaluate(() => window.repairTest.crashCapture());
    writeFileSync('/tmp/rospace-crashed-ship.png', Buffer.from(data.split(',')[1], 'base64'));
  }
  await page.evaluate(() => { window.repairTest.archive(); window.repairTest.money(49); });
  await expect(page.locator('#archive-hint')).toContainText('50 Cors');
  await page.keyboard.press('f');
  await expect(page.locator('#archive-menu')).toBeHidden();
  expect(await read()).toMatchObject({ activated: 0, cors: 49, tank: 0, read: 0 });
  await page.evaluate(() => window.repairTest.money(70));
  await page.keyboard.press('f');
  expect(await read()).toMatchObject({ activated: 1, cors: 20 });
  await expect(page.locator('#archive-menu')).toBeVisible();
  await expect(page.locator('#archive-menu')).toContainText('Der Sandsturm hat die Solarmodule zerstört');
  expect((await read()).tank).toBe(0);
  expect((await read()).cors).toBe(20);
  await page.locator('#archive-close').click();
  expect(await read()).toMatchObject({ tank: 1, read: 1 });
  await page.keyboard.press('e');
  await expect(page.locator('#fuel-tank')).toBeVisible();
  await expect(page.locator('#equipment-title span')).toHaveText('4 Gegenstände');
  await page.keyboard.press('e');
  expect(await page.evaluate(() => window.repairTest.save())).toBe(true);
  await page.reload();
  await page.locator('#load-button').click();
  expect(await read()).toMatchObject({ activated: 1, cors: 20, tank: 1, read: 1, repaired: 0, damaged: true });
  await page.evaluate(() => { window.repairTest.crystals(60); window.repairTest.approach(); });
  await page.keyboard.press('f');
  expect(await read()).toMatchObject({ tank: 1, repaired: 0, crystals: 60, aboard: false });
  await page.evaluate(() => window.repairTest.strut());
  await page.evaluate(() => { window.repairTest.crystals(29); window.repairTest.approach(); });
  await page.keyboard.press('f');
  expect(await read()).toMatchObject({ tank: 1, repaired: 0, crystals: 29, aboard: false });
  await page.evaluate(() => window.repairTest.crystals(60, 19));
  await page.keyboard.press('f');
  expect(await read()).toMatchObject({ tank: 1, repaired: 0, crystals: 60, blue: 19, aboard: false });
  await page.evaluate(() => window.repairTest.crystals(49, 20));
  await page.keyboard.press('f');
  expect(await read()).toMatchObject({ tank: 1, repaired: 0, crystals: 49, blue: 20, aboard: false });
  await page.evaluate(() => window.repairTest.crystals(60));
  await expect(page.locator('#spacecraft-hint')).toContainText('F · Raumschiff reparieren');
  await page.keyboard.press('f');
  expect(await read()).toMatchObject({ tank: 0, repaired: 1, crystals: 10, blue: 10, damaged: false, damageVisible: false, aboard: false });
  await page.evaluate(() => window.repairTest.archive());
  await page.keyboard.press('f');
  await page.locator('#archive-close').click();
  expect((await read()).tank).toBe(0);
  expect((await read()).cors).toBe(20);
  expect(await page.evaluate(() => window.repairTest.save())).toBe(true);
  await page.reload();
  await page.locator('#load-button').click();
  expect(await read()).toMatchObject({ repaired: 1, tank: 0, crystals: 10, blue: 10, damaged: false });
  await page.evaluate(() => window.repairTest.approach());
  await page.keyboard.press('f');
  expect((await read()).aboard).toBe(true);
  expect(await page.evaluate(() => window.repairTest.fly())).toBeGreaterThan(0.5);
  expect(errors).toEqual([]);
});
