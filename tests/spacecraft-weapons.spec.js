import { test, expect } from '@playwright/test';

test('left mouse fires ship cannons in both views, hits targets and stops on release or pause', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1100, height: 750 });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      renderer.setPixelRatio(0.75);
      renderer.shadowMap.enabled = false;
      let volleys = 0, lastShots = [], target = null;
      const originalEmit = emitSpacecraftShots;
      emitSpacecraftShots = () => {
        originalEmit();
        volleys++;
        const nose = new THREE.Vector3(0, 0, 1).applyQuaternion(spacecraft.group.quaternion);
        lastShots = [2, 1].map(offset => {
          const shot = laserShots[(laserShotIndex - offset + laserShots.length) % laserShots.length];
          return {
            source: shot.userData.source,
            muzzleDistance: Math.min(...spacecraft.weaponMuzzles.map(muzzle => muzzle.distanceTo(shot.position))),
            direction: shot.userData.velocity.clone().normalize().dot(nose),
            scale: shot.scale.x,
          };
        });
      };
      window.shipWeapons = {
        approach() { ship.position.copy(spacecraft.exit); state.flightHeight = 0; },
        closeCanopy() { spacecraft.update(3); },
        advance(seconds) { for (let i = 0; i < seconds * 60; i++) spacecraft.update(1 / 60, { occupied: true, up: activeKeys.has('w') }); },
        target() {
          for (const rock of rocks) rock.position.x = spacecraft.group.position.x + 90;
          target = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 1), new THREE.MeshStandardMaterial());
          target.position.copy(spacecraft.weaponMuzzles[0]).lerp(spacecraft.weaponMuzzles[1], 0.5);
          target.position.z += 12;
          target.userData = { hitRadius: 1, laserDamage: 0 };
          rocks.push(target); scene.add(target);
        },
        removeTarget() { rocks.splice(rocks.indexOf(target), 1); target.removeFromParent(); },
        read() { return { volleys, lastShots, firing: state.laserActive, handCanFire: handLaser.canFire, beam: handLaser.beam.visible, thirdPerson: spacecraftThirdPerson, aboard: aboardSpacecraft, stones: state.stones, phase: spacecraft.flight.phase }; },
      };
    ` });
  });
  await page.addInitScript(() => {
    let locked = null;
    Object.defineProperty(document, 'pointerLockElement', { get: () => locked });
    HTMLCanvasElement.prototype.requestPointerLock = async function () { locked = this; document.dispatchEvent(new Event('pointerlockchange')); };
    document.exitPointerLock = () => { locked = null; document.dispatchEvent(new Event('pointerlockchange')); };
    localStorage.setItem('rust-mesa-save-v1', JSON.stringify({ version: 1, name: 'Ship weapons', state: { spacecraftRepaired: 1, health: 100, firstPerson: true }, position: [93.3, -0.05, -38.5], dayElapsed: 100, sandwormRepelled: true, curseMessageSeen: true }));
  });
  const read = () => page.evaluate(() => window.shipWeapons.read());
  const canvas = page.locator('#game-canvas');
  async function release() {
    await canvas.dispatchEvent('pointerup', { button: 0 });
    const count = (await read()).volleys;
    await page.waitForTimeout(350);
    expect((await read()).volleys).toBe(count);
    expect((await read()).firing).toBe(false);
  }
  async function fire() {
    const count = (await read()).volleys;
    await canvas.dispatchEvent('pointerdown', { button: 0 });
    await expect.poll(async () => (await read()).volleys).toBeGreaterThan(count + 1);
    const fired = await read();
    expect(fired.handCanFire).toBe(false);
    expect(fired.beam).toBe(false);
    expect(fired.lastShots).toHaveLength(2);
    for (const shot of fired.lastShots) {
      expect(shot.source).toBe('spacecraft');
      expect(shot.muzzleDistance).toBeLessThan(0.00001);
      expect(shot.direction).toBeGreaterThan(0.9999);
      expect(shot.scale).toBeGreaterThan(1);
    }
  }
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#load-button').click();
  await page.evaluate(() => window.shipWeapons.approach());
  await page.keyboard.press('f');
  await expect.poll(async () => (await read()).aboard).toBe(true);
  await page.evaluate(() => window.shipWeapons.closeCanopy());
  await expect(page.locator('#spacecraft-hint')).toContainText('Schießen');
  await canvas.dispatchEvent('pointerdown', { button: 2 });
  expect((await read()).firing).toBe(false);
  await canvas.dispatchEvent('pointerup', { button: 2 });
  await page.evaluate(() => window.shipWeapons.target());
  const stones = (await read()).stones;
  await fire();
  await expect.poll(async () => (await read()).stones).toBeGreaterThan(stones);
  await release();
  await page.evaluate(() => window.shipWeapons.removeTarget());
  await page.keyboard.press('p');
  expect((await read()).thirdPerson).toBe(true);
  await fire();
  await release();
  await page.keyboard.down('w');
  await page.evaluate(() => window.shipWeapons.advance(4));
  await page.keyboard.up('w');
  await expect.poll(async () => (await read()).phase).toBe('hover');
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 400, movementY: -220, bubbles: true })));
  await page.evaluate(() => window.shipWeapons.advance(2));
  await fire();
  await page.keyboard.press('Escape');
  expect((await read()).firing).toBe(false);
  const pausedCount = (await read()).volleys;
  await page.locator('#resume-button').click();
  await page.waitForTimeout(350);
  expect((await read()).volleys).toBe(pausedCount);
  await fire();
  await canvas.dispatchEvent('pointercancel', { button: -1 });
  expect((await read()).firing).toBe(false);
  await fire();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect((await read()).firing).toBe(false);
  expect(errors).toEqual([]);
});
