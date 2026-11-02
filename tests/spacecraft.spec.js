import { writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test('spacecraft supports boarding, takeoff, mouse steering and landing before exit', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
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
        gear() { return spacecraft.group.children.filter(part => part.name.startsWith('landing-gear-')).map(part => ({ angle: part.rotation.x, visible: part.visible, parts: part.children.length })); },
        cameraView() {
          setDefaultCameraPerspective();
          camera.updateMatrixWorld(true);
          const inverse = spacecraft.group.quaternion.clone().invert();
          const center = new THREE.Vector3(0, 3.1, 0).applyQuaternion(spacecraft.group.quaternion).add(spacecraft.group.position);
          return {
            thirdPerson: spacecraftThirdPerson, firstPerson: state.firstPerson,
            playerVisible: ship.visible, craftVisible: spacecraft.group.visible,
            local: camera.position.clone().sub(spacecraft.group.position).applyQuaternion(inverse).toArray(),
            center: center.project(camera).toArray(),
            clearance: camera.position.y - terrainHeight(camera.position.x, camera.position.z),
            cockpitDistance: camera.position.distanceTo(spacecraft.cockpit),
          };
        },
        flight() { return { ...spacecraft.flight, landed: spacecraft.isLanded(), craft: spacecraft.group.position.toArray(), cockpit: spacecraft.cockpit.toArray(), camera: camera.position.toArray(), nose: new THREE.Vector3(0, 0, 1).applyQuaternion(spacecraft.group.quaternion).toArray(), view: camera.getWorldDirection(new THREE.Vector3()).toArray() }; },
        hullContact() {
          const player = new THREE.Vector3(2.8, 2, 0).applyQuaternion(spacecraft.group.quaternion).add(spacecraft.group.position);
          const previous = new THREE.Vector3(3.2, 2, 0).applyQuaternion(spacecraft.group.quaternion).add(spacecraft.group.position);
          spacecraft.resolve(player, 1, previous);
          return spacecraft.group.worldToLocal(player).toArray();
        },
        advanceFlight(seconds) {
          for (let frame = 0; frame < seconds * 60; frame++) spacecraft.update(1 / 60, {
            occupied: aboardSpacecraft, exitPending: spacecraftExitRequested,
            up: activeKeys.has('w'), down: activeKeys.has('s'), brake: activeKeys.has('space')
          });
        },
        capture() { renderer.render(scene, camera); return canvas.toDataURL(); },
        exterior() { screenshotMode = true; ship.visible = false; camera.position.copy(spacecraft.group.position).add(new THREE.Vector3(-20, 13, 23)); camera.lookAt(spacecraft.group.position.clone().add(new THREE.Vector3(0, 3, 0))); renderer.render(scene, camera); }
      };` });
  });
  await page.addInitScript(() => {
    let locked = null;
    Object.defineProperty(document, 'pointerLockElement', { get: () => locked });
    HTMLCanvasElement.prototype.requestPointerLock = async function () { locked = this; document.dispatchEvent(new Event('pointerlockchange')); };
    localStorage.setItem('rust-mesa-save-v1', JSON.stringify({ version: 1, name: 'Spacecraft', state: { spacecraftRepaired: 1, health: 100 }, position: [93.3, -0.05, -38.5], dayElapsed: 100, sandwormRepelled: true, curseMessageSeen: true }));
  });
  async function expectChaseCamera(minimumRearDistance = 20) {
    await expect.poll(() => page.evaluate(() => window.spacecraftTest.read().muffled)).toBe(false);
    const view = await page.evaluate(() => window.spacecraftTest.cameraView());
    expect(view.thirdPerson).toBe(true);
    expect(view.playerVisible).toBe(false);
    expect(view.craftVisible).toBe(true);
    expect(view.local[2]).toBeLessThan(-minimumRearDistance);
    expect(view.clearance).toBeGreaterThanOrEqual(2 - 1e-8);
    expect(Math.abs(view.center[0])).toBeLessThan(0.001);
    expect(Math.abs(view.center[1])).toBeLessThan(0.001);
    expect(view.center[2]).toBeGreaterThan(0);
    expect(view.center[2]).toBeLessThan(1);
  }
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#load-button').click();
  await page.evaluate(() => window.spacecraftTest.approach());
  await expect(page.locator('#spacecraft-hint')).toBeVisible();
  expect((await page.evaluate(() => window.spacecraftTest.read())).distance).toBe(100);
  expect((await page.evaluate(() => window.spacecraftTest.read())).canopyAngle).toBeCloseTo(-1.1);
  const deployedGear = await page.evaluate(() => window.spacecraftTest.gear());
  expect(deployedGear).toHaveLength(3);
  for (const leg of deployedGear) {
    expect(leg.visible).toBe(true);
    expect(leg.angle).toBeCloseTo(0);
    expect(leg.parts).toBeGreaterThan(0);
  }
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
  await page.keyboard.press('p');
  await expectChaseCamera();
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', repeat: true })));
  await expectChaseCamera();
  if (process.env.ROSPACE_CAPTURE) {
    const data = await page.evaluate(() => window.spacecraftTest.capture());
    writeFileSync('/tmp/rospace-spacecraft-third-person.png', Buffer.from(data.split(',')[1], 'base64'));
  }
  await page.keyboard.press('p');
  expect((await page.evaluate(() => window.spacecraftTest.cameraView())).thirdPerson).toBe(false);
  expect((await page.evaluate(() => window.spacecraftTest.cameraView())).cockpitDistance).toBeLessThan(0.01);
  await expect.poll(() => page.evaluate(() => window.spacecraftTest.read().muffled)).toBe(true);
  if (process.env.ROSPACE_CAPTURE) {
    const data = await page.evaluate(() => window.spacecraftTest.capture());
    writeFileSync('/tmp/rospace-spacecraft-cockpit-fixed.png', Buffer.from(data.split(',')[1], 'base64'));
  }
  await page.keyboard.down('Space');
  await page.keyboard.down('w');
  await expect.poll(() => page.evaluate(() => window.spacecraftTest.flight().phase)).toBe('lifting');
  const foldingGear = await page.evaluate(() => {
    window.spacecraftTest.advanceFlight(0.7);
    return window.spacecraftTest.gear();
  });
  for (const leg of foldingGear) {
    expect(leg.visible).toBe(true);
    expect(Math.abs(leg.angle)).toBeGreaterThan(0);
    expect(Math.abs(leg.angle)).toBeLessThan(Math.PI / 2);
  }
  await page.evaluate(() => window.spacecraftTest.advanceFlight(4));
  const hovering = await page.evaluate(() => window.spacecraftTest.flight());
  expect(hovering.phase).toBe('hover');
  expect(hovering.altitude).toBe(1.8);
  expect(hovering.forwardDistance).toBe(0);
  for (const leg of await page.evaluate(() => window.spacecraftTest.gear())) {
    expect(leg.visible).toBe(false);
    expect(Math.abs(leg.angle)).toBeCloseTo(Math.PI / 2);
  }
  await page.keyboard.up('w');
  await page.keyboard.up('Space');
  await page.evaluate(() => window.spacecraftTest.advanceFlight(1 / 60));
  expect((await page.evaluate(() => window.spacecraftTest.read())).bodyPose).toEqual(boarded.bodyPose);
  expect((await page.evaluate(() => window.spacecraftTest.read())).position[0]).toBeCloseTo(boarded.exit[0], 1);
  await page.keyboard.press('f');
  expect((await page.evaluate(() => window.spacecraftTest.read())).exitRequested).toBe(false);
  await page.keyboard.down('w');
  await expect.poll(() => page.evaluate(() => window.spacecraftTest.flight().forwardDistance)).toBeGreaterThan(0);
  await page.evaluate(() => window.spacecraftTest.advanceFlight(2));
  const flying = await page.evaluate(() => window.spacecraftTest.flight());
  expect(flying.phase).toBe('flying');
  expect(flying.forwardDistance).toBeGreaterThan(10);
  expect(flying.craft[2] - hovering.craft[2]).toBeCloseTo(flying.forwardDistance, 3);
  expect(flying.cockpit[2] - hovering.cockpit[2]).toBeCloseTo(flying.forwardDistance, 3);
  await expect.poll(() => page.evaluate(() => {
    const { camera, cockpit } = window.spacecraftTest.flight();
    return Math.hypot(...camera.map((n, i) => n - cockpit[i]));
  })).toBeLessThan(0.01);
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 300, movementY: -220, bubbles: true })));
  await page.evaluate(() => window.spacecraftTest.advanceFlight(2));
  const steered = await page.evaluate(() => window.spacecraftTest.flight());
  expect(steered.yaw).toBeLessThan(-0.5);
  expect(steered.pitch).toBeGreaterThan(0.35);
  expect(steered.craft[0]).toBeLessThan(flying.craft[0] - 1);
  expect(steered.height).toBeGreaterThan(flying.height + 1);
  expect(Math.abs(steered.yaw - Math.atan2(steered.velocityX, steered.velocityZ))).toBeLessThan(0.06);
  await expect(page.locator('#spacecraft-hint')).toContainText('Leertaste');
  await expect.poll(() => page.evaluate(() => {
    const { nose, view } = window.spacecraftTest.flight();
    return nose.reduce((sum, n, i) => sum + n * view[i], 0);
  })).toBeGreaterThan(0.9999);
  await page.keyboard.press('p');
  await expectChaseCamera();
  const yawBeforeExteriorTurn = (await page.evaluate(() => window.spacecraftTest.flight())).yaw;
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 120, movementY: 0, bubbles: true })));
  await page.evaluate(() => window.spacecraftTest.advanceFlight(1.2));
  expect((await page.evaluate(() => window.spacecraftTest.flight())).yaw).toBeLessThan(yawBeforeExteriorTurn - 0.2);
  await expectChaseCamera();
  await page.keyboard.press('p');
  expect((await page.evaluate(() => window.spacecraftTest.cameraView())).cockpitDistance).toBeLessThan(0.01);
  await expect.poll(() => page.evaluate(() => window.spacecraftTest.read().muffled)).toBe(true);
  expect((await page.evaluate(() => window.spacecraftTest.hullContact()))[0]).toBeGreaterThan(2.9);
  await page.keyboard.up('w');
  const beforeBrake = await page.evaluate(() => window.spacecraftTest.flight());
  await page.keyboard.down('Space');
  await page.evaluate(() => window.spacecraftTest.advanceFlight(1 / 60));
  expect((await page.evaluate(() => window.spacecraftTest.flight())).forwardSpeed).toBeLessThan(beforeBrake.forwardSpeed);
  await page.evaluate(() => window.spacecraftTest.advanceFlight(4));
  expect((await page.evaluate(() => window.spacecraftTest.flight())).forwardSpeed).toBe(0);
  await page.keyboard.up('Space');
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousemove', { movementY: -2000, bubbles: true })));
  await page.evaluate(() => window.spacecraftTest.advanceFlight(5));
  const pointingUp = await page.evaluate(() => window.spacecraftTest.flight());
  expect(pointingUp.nose[1]).toBeCloseTo(1, 8);
  await page.keyboard.down('w');
  await page.evaluate(() => window.spacecraftTest.advanceFlight(2));
  const verticalAscent = await page.evaluate(() => window.spacecraftTest.flight());
  expect(verticalAscent.altitude).toBeGreaterThan(pointingUp.altitude + 8);
  expect(verticalAscent.craft[0]).toBeCloseTo(pointingUp.craft[0], 6);
  expect(verticalAscent.craft[2]).toBeCloseTo(pointingUp.craft[2], 6);
  await page.keyboard.press('p');
  await expectChaseCamera(4);
  await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => window.spacecraftTest.flight().view[1])).toBeGreaterThan(0.9999);
  await page.keyboard.up('w');
  await page.keyboard.down('Space');
  await page.evaluate(() => window.spacecraftTest.advanceFlight(4));
  await page.keyboard.up('Space');
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousemove', { movementY: 4000, bubbles: true })));
  await page.evaluate(() => window.spacecraftTest.advanceFlight(6));
  const pointingDown = await page.evaluate(() => window.spacecraftTest.flight());
  expect(pointingDown.nose[1]).toBeCloseTo(-1, 8);
  await page.keyboard.down('w');
  await page.evaluate(() => window.spacecraftTest.advanceFlight(2));
  const verticalDescent = await page.evaluate(() => window.spacecraftTest.flight());
  expect(verticalDescent.altitude).toBeLessThan(pointingDown.altitude - 8);
  expect(verticalDescent.craft[0]).toBeCloseTo(pointingDown.craft[0], 6);
  expect(verticalDescent.craft[2]).toBeCloseTo(pointingDown.craft[2], 6);
  await expect.poll(() => page.evaluate(() => window.spacecraftTest.flight().view[1])).toBeLessThan(-0.9999);
  await page.keyboard.up('w');
  await page.keyboard.down('Space');
  await page.evaluate(() => window.spacecraftTest.advanceFlight(4));
  await page.keyboard.up('Space');
  const stopped = await page.evaluate(() => window.spacecraftTest.flight());
  expect(stopped.phase).toBe('hover');
  expect(stopped.forwardSpeed).toBe(0);
  expect(stopped.altitude).toBeGreaterThan(1.8);
  await page.keyboard.down('s');
  await expect.poll(() => page.evaluate(() => window.spacecraftTest.flight().phase)).toBe('landing');
  await page.keyboard.up('s');
  const extendingGear = await page.evaluate(() => {
    window.spacecraftTest.advanceFlight(0.6);
    return window.spacecraftTest.gear();
  });
  for (const leg of extendingGear) {
    expect(leg.visible).toBe(true);
    expect(Math.abs(leg.angle)).toBeLessThan(Math.PI / 2);
  }
  await page.evaluate(() => window.spacecraftTest.advanceFlight(30));
  expect((await page.evaluate(() => window.spacecraftTest.flight())).landed).toBe(true);
  expect((await page.evaluate(() => window.spacecraftTest.flight())).pitch).toBe(0);
  for (const leg of await page.evaluate(() => window.spacecraftTest.gear())) {
    expect(leg.visible).toBe(true);
    expect(leg.angle).toBeCloseTo(0);
  }
  expect((await page.evaluate(() => window.spacecraftTest.hullContact()))[0]).toBeGreaterThan(2.9);
  await page.keyboard.press('p');
  await expectChaseCamera();
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
  const onFootView = await page.evaluate(() => window.spacecraftTest.cameraView());
  expect(onFootView.thirdPerson).toBe(false);
  expect(onFootView.firstPerson).toBe(false);
  await page.keyboard.press('p');
  expect((await page.evaluate(() => window.spacecraftTest.cameraView())).firstPerson).toBe(true);
  await page.keyboard.press('p');
  if (process.env.ROSPACE_CAPTURE) {
    const data = await page.evaluate(() => { window.spacecraftTest.exterior(); return window.spacecraftTest.capture(); });
    writeFileSync('/tmp/rospace-spacecraft-exterior-fixed.png', Buffer.from(data.split(',')[1], 'base64'));
  }
  expect(errors).toEqual([]);
});
