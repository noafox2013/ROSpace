import { test, expect } from '@playwright/test';

test('both buildings block worm bites and body damage while outside and roofs remain exposed', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 800, height: 600 });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      renderer.setPixelRatio(0.5); renderer.shadowMap.enabled = false;
      window.auditWormBuildings = () => {
        const matrix = new THREE.Matrix4(), world = new THREE.Matrix4(), bounds = new THREE.Box3();
        let intersections = 0;
        for (const location of [baseLocation, abandonedLocation]) {
          const player = new THREE.Vector3(location.x, location.ground + 1, location.z);
          sandworm.reset(player, 0, true);
          for (let frame = 0; frame < 240; frame++) {
            sandworm.update(0.1, player, 0, true);
            if (frame % 4) continue;
            sandworm.object.updateMatrixWorld(true);
            for (const object of sandworm.getLaserTargets()) {
              if (object.isInstancedMesh) {
                object.geometry.computeBoundingBox();
                for (let index = 0; index < object.count; index++) {
                  object.getMatrixAt(index, matrix); world.multiplyMatrices(object.matrixWorld, matrix);
                  bounds.copy(object.geometry.boundingBox).applyMatrix4(world);
                  if (wormBuildingBounds.some(building => bounds.intersectsBox(building))) intersections++;
                }
              } else {
                bounds.setFromObject(object);
                if (wormBuildingBounds.some(building => bounds.intersectsBox(building))) intersections++;
              }
            }
          }
        }
        sandworm.reset(ship.position, state.faceYaw, false);
        return intersections;
      };
      window.indoorWormTest = (location, contact) => {
        state.running = true; state.health = 100; state.hurtCooldown = state.hurtFlash = 0;
        state.flightVelocity = 0; state.jetpackActive = false;
        state.depthInput = state.depthVelocity = state.steer = state.steerVelocity = 0;
        state.abandonedUnlocked = 1; abandonedBuilding.setUnlocked(true);
        const x = location === 'ruin' ? abandonedLocation.x : 0;
        const z = location === 'ruin' ? abandonedLocation.z : location === 'outside' ? 0 : baseLocation.z;
        state.flightHeight = location === 'roof' ? baseLayout.height + 2 : 0;
        ship.position.set(x, terrainHeight(x,z) + playerGroundOffset + state.flightHeight, z);
        let protectedAtCollision;
        const original = sandworm.update;
        sandworm.update = (delta, position, yaw, sheltered) => { protectedAtCollision = sheltered; return contact; };
        updateGame(0.04);
        sandworm.update = original;
        return {health:state.health, running:state.running, sheltered:protectedAtCollision};
      };
    ` });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  expect(await page.evaluate(() => window.auditWormBuildings())).toBe(0);
  for (const location of ['base', 'ruin']) {
    for (const contact of ['mouth', 'body']) {
      expect(await page.evaluate(([location, contact]) => window.indoorWormTest(location, contact), [location, contact]))
        .toEqual({ health:100, running:true, sheltered:true });
    }
  }
  for (const location of ['outside', 'roof']) {
    expect(await page.evaluate(location => window.indoorWormTest(location, 'body'), location))
      .toEqual({ health:50, running:true, sheltered:false });
    expect(await page.evaluate(location => window.indoorWormTest(location, 'mouth'), location))
      .toEqual({ health:0, running:false, sheltered:false });
  }
  expect(errors).toEqual([]);
});
