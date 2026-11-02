import { test, expect } from '@playwright/test';

test('flight poses follow cardinal and diagonal directions with smooth reversals', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      window.auditFlight = () => {
        state.running = state.jetpackActive = true;
        state.faceYaw = state.cameraOrbitYaw = 0;
        state.cameraPitch = 0;
        const frame = (depth, steer) => {
          state.depthVelocity = depth; state.steerVelocity = steer;
          state.flightHeight = 3;
          updateJetpack(1/60);
          updateRunAnimation(1/60,Math.min(1,Math.hypot(depth,steer)),depth<0?-1:1,0);
          applyAstronautLean(0,0,0);
        };
        const read = () => ({
          pitch:ship.rotation.x, roll:ship.rotation.z,
          hands:limbRig.map(rig=>rig.glove.position.toArray()),
          feet:limbRig.map(rig=>rig.boot.position.toArray()),
          exhaust:jetpackRearAxis.clone().applyQuaternion(jetpackFlames.children[0].quaternion).toArray(),
        });
        const poses = {};
        let maxGap = 0;
        const endpoint = (mesh,y) => new THREE.Vector3(0,y,0).applyQuaternion(mesh.quaternion).add(mesh.position);
        for (const [name,depth,steer] of [['hover',0,0],['forward',1,0],['backward',-1,0],
          ['left',0,-1],['right',0,1],['forwardLeft',1,-1],['forwardRight',1,1],
          ['backwardLeft',-1,-1],['backwardRight',-1,1]]) {
          for (let i=0;i<90;i++) frame(depth,steer);
          poses[name] = read();
          for (const rig of limbRig) {
            maxGap=Math.max(maxGap,
              endpoint(rig.upperArm,-astronautAnatomy.upperArm/2).distanceTo(rig.elbow.position),
              endpoint(rig.forearm,astronautAnatomy.forearm/2).distanceTo(rig.elbow.position),
              endpoint(rig.forearm,-astronautAnatomy.forearm/2).distanceTo(rig.wristRing.position),
              endpoint(rig.upperLeg,-astronautAnatomy.thigh/2).distanceTo(rig.knee.position),
              endpoint(rig.leg,astronautAnatomy.shin/2).distanceTo(rig.knee.position),
              endpoint(rig.leg,-astronautAnatomy.shin/2).distanceTo(rig.ankleRing.position));
          }
        }
        for(let i=0;i<90;i++) frame(1,0);
        const before=read(); frame(-1,0); const after=read();
        const firstFrameTurn=Math.abs(after.pitch-before.pitch);
        const firstFrameFoot=Math.max(...after.feet.map((foot,i)=>new THREE.Vector3(...foot)
          .distanceTo(new THREE.Vector3(...before.feet[i]))));
        return {poses,maxGap,firstFrameTurn,firstFrameFoot};
      };
    ` });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  const { poses, maxGap, firstFrameTurn, firstFrameFoot } = await page.evaluate(() => window.auditFlight());
  expect(Math.abs(poses.hover.pitch)).toBeLessThan(0.03);
  expect(Math.abs(poses.hover.roll)).toBeLessThan(0.03);
  expect(poses.forward.pitch).toBeGreaterThan(0.25);
  expect(poses.backward.pitch).toBeLessThan(-0.25);
  expect(poses.left.roll).toBeLessThan(-0.2);
  expect(poses.right.roll).toBeGreaterThan(0.2);
  expect(poses.backward.feet[0][2]-poses.forward.feet[0][2]).toBeGreaterThan(0.4);
  expect(poses.left.feet[1][1]-poses.left.feet[0][1]).toBeGreaterThan(0.07);
  expect(poses.right.feet[1][1]-poses.right.feet[0][1]).toBeLessThan(-0.07);
  expect(poses.left.hands[1][1]-poses.left.hands[0][1]).toBeGreaterThan(0.07);
  expect(poses.right.hands[1][1]-poses.right.hands[0][1]).toBeLessThan(-0.07);
  expect(poses.forward.exhaust[2]).toBeLessThan(-0.5);
  expect(poses.backward.exhaust[2]).toBeGreaterThan(0.5);
  expect(poses.left.exhaust[0]).toBeLessThan(-0.5);
  expect(poses.right.exhaust[0]).toBeGreaterThan(0.5);
  for (const name of ['forwardLeft','forwardRight','backwardLeft','backwardRight']) {
    expect(Math.abs(poses[name].pitch)).toBeGreaterThan(0.15);
    expect(Math.abs(poses[name].roll)).toBeGreaterThan(0.15);
    expect(Math.hypot(poses[name].pitch,poses[name].roll)).toBeLessThan(0.35);
  }
  expect(firstFrameTurn).toBeLessThan(0.08);
  expect(firstFrameFoot).toBeLessThan(0.09);
  expect(maxGap).toBeLessThan(0.025);
  expect(errors).toEqual([]);
});
