import { writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test('spacecraft is 100m from terminal and supports boarding, looking and leaving', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1100, height: 750 });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      renderer.setPixelRatio(0.75);
      renderer.shadowMap.enabled = false;
      let testCockpitMuffled = false;
      const originalSetCockpit = audio.setCockpit;
      audio.setCockpit = value => { testCockpitMuffled = value; originalSetCockpit(value); };
      window.spacecraftTest = {
        approach() { ship.position.copy(spacecraft.exit); state.flightHeight = 0; },
        read() { return { bodyPose: [...ship.rotation.toArray().slice(0, 3), ...bodyRig.torso.mesh.position.toArray(), ...bodyRig.torso.mesh.rotation.toArray().slice(0, 3), state.runCycle], muffled: testCockpitMuffled, exitRequested: spacecraftExitRequested, canopyAngle: spacecraft.canopy.rotation.x, aboard: aboardSpacecraft, visible: ship.visible, camera: camera.position.toArray(), cockpit: spacecraft.cockpit.toArray(), position: ship.position.toArray(), exit: spacecraft.exit.toArray(), distance: Math.hypot(spacecraft.group.position.x - planetaryBase.terminalPosition.x, spacecraft.group.position.z - planetaryBase.terminalPosition.z) }; },
        advanceCanopy(delta) { spacecraft.update(delta); },
        capture() { renderer.render(scene, camera); return canvas.toDataURL(); },
        exterior() { screenshotMode = true; ship.visible = false; camera.position.copy(spacecraft.group.position).add(new THREE.Vector3(-20, 13, 23)); camera.lookAt(spacecraft.group.position.clone().add(new THREE.Vector3(0, 3, 0))); renderer.render(scene, camera); }
      };` });
  });
  await page.addInitScript(() => {
    let locked = null;
    Object.defineProperty(document, 'pointerLockElement', { get: () => locked });
    HTMLCanvasElement.prototype.requestPointerLock = async function () { locked = this; document.dispatchEvent(new Event('pointerlockchange')); };
    localStorage.setItem('rust-mesa-save-v1', JSON.stringify({ version: 1, name: 'Spacecraft', state: { health: 100 }, position: [93.3, -0.05, -38.5], dayElapsed: 100, sandwormRepelled: true, curseMessageSeen: true }));
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#load-button').click();
  await page.evaluate(() => window.spacecraftTest.approach());
  await expect(page.locator('#spacecraft-hint')).toBeVisible();
  expect((await page.evaluate(() => window.spacecraftTest.read())).distance).toBe(100);
  expect((await page.evaluate(() => window.spacecraftTest.read())).canopyAngle).toBeCloseTo(-1.1);
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => window.spacecraftTest.read().aboard)).toBe(true);
  const boarded = await page.evaluate(() => window.spacecraftTest.read());
  expect(boarded.visible).toBe(false);
  expect(boarded.muffled).toBe(false);
  await page.evaluate(() => window.spacecraftTest.advanceCanopy(1.4));
  const halfway = (await page.evaluate(() => window.spacecraftTest.read())).canopyAngle;
  expect(halfway).toBeGreaterThan(-1.1);
  expect(halfway).toBeLessThan(0);
  expect((await page.evaluate(() => window.spacecraftTest.read())).muffled).toBe(false);
  await page.evaluate(() => window.spacecraftTest.advanceCanopy(2.8));
  expect((await page.evaluate(() => window.spacecraftTest.read())).canopyAngle).toBeCloseTo(0);
  await expect.poll(() => page.evaluate(() => window.spacecraftTest.read().muffled)).toBe(true);
  expect(Math.hypot(...boarded.camera.map((n, i) => n - boarded.cockpit[i]))).toBeLessThan(0.5);
  if (process.env.ROSPACE_CAPTURE) {
    const data = await page.evaluate(() => window.spacecraftTest.capture());
    writeFileSync('/tmp/rospace-spacecraft-cockpit-fixed.png', Buffer.from(data.split(',')[1], 'base64'));
  }
  await page.keyboard.down('Space');
  await page.keyboard.down('w');
  await page.waitForTimeout(350);
  await page.keyboard.up('w');
  await page.keyboard.up('Space');
  expect((await page.evaluate(() => window.spacecraftTest.read())).bodyPose).toEqual(boarded.bodyPose);
  expect((await page.evaluate(() => window.spacecraftTest.read())).position[0]).toBeCloseTo(boarded.exit[0], 1);
  await page.keyboard.press('f');
  const opening = await page.evaluate(() => window.spacecraftTest.read());
  expect(opening.aboard).toBe(true);
  expect(opening.exitRequested).toBe(true);
  await expect.poll(() => page.evaluate(() => window.spacecraftTest.read().muffled)).toBe(false);
  await page.keyboard.press('f');
  await page.evaluate(() => window.spacecraftTest.advanceCanopy(1.4));
  expect((await page.evaluate(() => window.spacecraftTest.read())).aboard).toBe(true);
  await page.evaluate(() => window.spacecraftTest.advanceCanopy(2.8));
  await expect.poll(() => page.evaluate(() => window.spacecraftTest.read().aboard)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.spacecraftTest.read().visible)).toBe(true);
  await page.evaluate(() => window.spacecraftTest.advanceCanopy(2.8));
  expect((await page.evaluate(() => window.spacecraftTest.read())).canopyAngle).toBeCloseTo(-1.1);
  if (process.env.ROSPACE_CAPTURE) {
    const data = await page.evaluate(() => { window.spacecraftTest.exterior(); return window.spacecraftTest.capture(); });
    writeFileSync('/tmp/rospace-spacecraft-exterior-fixed.png', Buffer.from(data.split(',')[1], 'base64'));
  }
});
