import { test, expect } from '@playwright/test';

test('gimballed jetpack outlets stay aligned with thrust and boots stay grounded', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      window.auditEquipment = () => {
        state.running = true;
        state.jetpackActive = true;
        let separation = 0;
        let alignment = 1;
        for (const [depth, steer] of [[0,0],[1,0],[0,1],[0.5,-0.5]]) {
          state.depthVelocity = depth; state.steerVelocity = steer;
          for (let frame = 0; frame < 30; frame++) {
            updateJetpack(1 / 60);
            ship.updateMatrixWorld(true);
            for (const flame of jetpackFlames.children) {
              const nozzle = jetpackNozzles[flame.userData.side < 0 ? 0 : 1];
              const outlet = nozzle.localToWorld(new THREE.Vector3(0,0,-0.1));
              separation = Math.max(separation, outlet.distanceTo(flame.getWorldPosition(new THREE.Vector3())));
              alignment = Math.min(alignment, nozzle.getWorldDirection(new THREE.Vector3())
                .dot(flame.getWorldDirection(new THREE.Vector3())));
            }
          }
        }
        state.jetpackActive = false;
        state.flightHeight = state.flightVelocity = state.jetpackBurn = 0;
        state.depthVelocity = state.steerVelocity = 0;
        for (let frame = 0; frame < 90; frame++) updateRunAnimation(1/60,0,1,0);
        ship.updateMatrixWorld(true);
        const soles = limbRig.map(rig => new THREE.Box3().setFromObject(rig.bootSole));
        const ground = terrainHeight(ship.position.x, ship.position.z);
        const maxSoleOffset = Math.max(...soles.map(box => Math.abs(box.min.y-ground)));
        return {separation,alignment,maxSoleOffset};
      };
    ` });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  const result = await page.evaluate(() => window.auditEquipment());
  expect(result.separation).toBeLessThan(0.00001);
  expect(result.alignment).toBeGreaterThan(0.9999);
  expect(result.maxSoleOffset).toBeLessThan(0.12);
  expect(errors).toEqual([]);
});
