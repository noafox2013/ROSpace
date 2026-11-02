import { test, expect } from '@playwright/test';

test('helmet nods, follows looking smoothly and keeps its visor attached', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      window.auditHead = () => {
        state.cameraOrbitYaw = state.faceYaw;
        state.cameraPitch = state.flightHeight = state.jetpackBurn = 0;
        state.depthVelocity = 1;
        state.steerVelocity = 0;
        const nod = [];
        const roll = [];
        const visorDistances = [];
        for (let frame = 0; frame < 180; frame++) {
          updateRunAnimation(1 / 60, 1, 1, 0);
          ship.updateMatrixWorld(true);
          nod.push(headRig.rotation.x);
          roll.push(headRig.rotation.z);
          // Measure within the chest so its tiny breathing scale is excluded.
          const shell = chestRig.worldToLocal(helmet.getWorldPosition(new THREE.Vector3()));
          const glass = chestRig.worldToLocal(visor.getWorldPosition(new THREE.Vector3()));
          visorDistances.push(shell.distanceTo(glass));
        }
        const before = headRig.rotation.y;
        state.cameraOrbitYaw = state.faceYaw + Math.PI / 2;
        updateRunAnimation(1 / 60, 0, 1, 0);
        const firstStep = Math.abs(headRig.rotation.y - before);
        for (let frame = 0; frame < 120; frame++) updateRunAnimation(1 / 60, 0, 1, 0);
        const lookRight = headRig.rotation.y;
        state.cameraOrbitYaw = state.faceYaw - Math.PI / 2;
        state.cameraPitch = 0.65;
        for (let frame = 0; frame < 120; frame++) updateRunAnimation(1 / 60, 0, 1, 0);
        const lookLeft = headRig.rotation.y;
        const lookUp = headRig.rotation.x;
        state.cameraPitch = -0.65;
        for (let frame = 0; frame < 120; frame++) updateRunAnimation(1 / 60, 0, 1, 0);
        const lookDown = headRig.rotation.x;
        const cameraBefore = camera.matrixWorld.toArray();
        for (let frame = 0; frame < 60; frame++) updateRunAnimation(1 / 60, 0, 1, 0);
        const cameraStable = camera.matrixWorld.toArray().every((value, i) => value === cameraBefore[i]);
        const range = values => Math.max(...values) - Math.min(...values);
        return {nod:range(nod), roll:range(roll), visorDrift:range(visorDistances),
          firstStep, lookRight, lookLeft, lookUp, lookDown, cameraStable};
      };
    ` });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  const result = await page.evaluate(() => window.auditHead());
  expect(result.nod).toBeGreaterThan(0.07);
  expect(result.roll).toBeGreaterThan(0.06);
  expect(result.firstStep).toBeLessThan(0.09);
  expect(result.lookRight).toBeGreaterThan(0.45);
  expect(result.lookLeft).toBeLessThan(-0.45);
  expect(result.lookUp).toBeLessThan(-0.25);
  expect(result.lookDown).toBeGreaterThan(0.25);
  expect(result.visorDrift).toBeLessThan(0.000001);
  expect(result.cameraStable).toBe(true);
  expect(errors).toEqual([]);
});
