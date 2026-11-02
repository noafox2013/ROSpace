import { test, expect } from '@playwright/test';

test('sprinting keeps the torso, hips and head level through the stride', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      window.auditSprintPosture = () => {
        state.running = true;
        state.faceYaw = state.cameraOrbitYaw = 0;
        state.cameraPitch = state.flightHeight = state.jetpackBurn = 0;
        state.depthVelocity = 1;
        state.steerVelocity = 0;
        ship.rotation.set(0,0,0);
        const frame = sprint => {
          updateRunAnimation(1/60,1,1,sprint);
          const settle = Math.max(0,-Math.cos(state.runCycle*2))*0.026;
          applyAstronautLean(settle,Math.sin(state.runCycle)*0.04);
          ship.updateMatrixWorld(true);
        };
        for(let i=0;i<120;i++) frame(1);
        let rootRoll=0, torsoRoll=0, hipRoll=0, headRoll=0, forwardLean=0;
        const yawAxis = new THREE.Vector3(0,1,0);
        const up = mesh => new THREE.Vector3(0,1,0)
          .applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()))
          .applyAxisAngle(yawAxis,-state.faceYaw);
        // Forward lean must stay forward after turning, including headings
        // where world-axis pitch used to look like a sideways roll.
        for(const heading of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*2+0.4]) {
          state.faceYaw=state.cameraOrbitYaw=heading;
          ship.rotation.y=heading;
          for(let i=0;i<90;i++) frame(1);
          for(let i=0;i<120;i++) {
            frame(1);
            const bodyUp=up(ship), chestUp=up(chestRig), hipUp=up(pelvis), headUp=up(headRig);
            rootRoll=Math.max(rootRoll,Math.abs(Math.atan2(bodyUp.x,bodyUp.y)));
            torsoRoll=Math.max(torsoRoll,Math.abs(Math.atan2(chestUp.x,chestUp.y)));
            hipRoll=Math.max(hipRoll,Math.abs(Math.atan2(hipUp.x,hipUp.y)));
            headRoll=Math.max(headRoll,Math.abs(Math.atan2(headUp.x,headUp.y)));
            forwardLean=Math.max(forwardLean,Math.atan2(chestUp.z,chestUp.y));
          }
        }
        let turningRoll=0;
        for(const steer of [-0.6,0.6]) {
          state.steerVelocity=steer;
          for(let i=0;i<120;i++) {
            frame(1);
            const chestUp=up(chestRig);
            turningRoll=Math.max(turningRoll,Math.abs(Math.atan2(chestUp.x,chestUp.y)));
          }
        }
        return {rootRoll,torsoRoll,hipRoll,headRoll,forwardLean,turningRoll};
      };
    ` });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  const result = await page.evaluate(() => window.auditSprintPosture());
  expect(result.rootRoll).toBeLessThan(0.007);
  expect(result.torsoRoll).toBeLessThan(0.025);
  expect(result.hipRoll).toBeLessThan(0.02);
  expect(result.headRoll).toBeLessThan(0.05);
  expect(result.forwardLean).toBeGreaterThan(0.1);
  expect(result.forwardLean).toBeLessThan(0.24);
  expect(result.turningRoll).toBeLessThan(0.06);
  expect(errors).toEqual([]);
});
