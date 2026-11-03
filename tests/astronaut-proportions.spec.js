import { test, expect } from '@playwright/test';

test('adult proportions keep elbows, knees and boots connected through walking and flight', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      renderer.setPixelRatio(0.5);
      window.auditAstronaut = () => {
        state.running = true;
        state.gaitBlend = 0;
        state.flightHeight = state.jetpackBurn = 0;
        state.depthVelocity = state.steerVelocity = 0;
        updateRunAnimation(0.04, 0, 1, 0);
        ship.updateMatrixWorld(true);
        const head = new THREE.Box3().setFromObject(helmet);
        const sole = new THREE.Box3().setFromObject(limbRig[0].bootSole);
        const fullHeight = head.max.y - sole.min.y;
        const headFraction = (head.max.y - head.min.y) / fullHeight;
        const shoulders = limbRig.map(rig => new THREE.Box3().setFromObject(rig.shoulder));
        const shoulderWidth = Math.max(...shoulders.map(box => box.max.x)) - Math.min(...shoulders.map(box => box.min.x));
        const shoulderToHead = shoulderWidth / (head.max.x - head.min.x);
        const soleHeight = sole.min.y - terrainHeight(ship.position.x, ship.position.z);
        const legFraction = (limbRig[0].hip.position.y - limbRig[0].base.bootSolePosition.y) * ship.scale.y / fullHeight;
        const limb = limbRig[0];
        const armLength = limb.shoulder.position.distanceTo(limb.elbow.position)
          + limb.elbow.position.distanceTo(limb.wristRing.position);
        const legLength = limb.hip.position.clone().add(new THREE.Vector3(0,-0.035,0)).distanceTo(limb.knee.position)
          + limb.knee.position.distanceTo(limb.ankleRing.position);
        const endpoint = (mesh, y) => new THREE.Vector3(0, y, 0).applyQuaternion(mesh.quaternion).add(mesh.position);
        let maxGap = 0;
        const hands = [];
        const shouldersTurn = [];
        const elbowBend = [];
        for (const [height, velocity, burn] of [[0,0,0], [2,4,1], [3,-5,0], [0.2,-4,0]]) {
          const flying = height > 0;
          state.flightHeight = height;
          state.flightVelocity = velocity;
          state.jetpackBurn = burn;
          for (let frame = 0; frame < 48; frame++) {
            updateRunAnimation(0.04, 1, 1, 1);
            if (!flying) {
              hands.push(limbRig[0].glove.position.z);
              shouldersTurn.push(chestRig.rotation.y);
              elbowBend.push(limbRig[0].upperArm.quaternion.angleTo(limbRig[0].forearm.quaternion));
            }
            for (const rig of limbRig) {
              maxGap = Math.max(maxGap,
                endpoint(rig.upperArm, -astronautAnatomy.upperArm / 2).distanceTo(rig.elbow.position),
                endpoint(rig.forearm, astronautAnatomy.forearm / 2).distanceTo(rig.elbow.position),
                endpoint(rig.forearm, -astronautAnatomy.forearm / 2).distanceTo(rig.wristRing.position),
                endpoint(rig.upperLeg, -astronautAnatomy.thigh / 2).distanceTo(rig.knee.position),
                endpoint(rig.leg, astronautAnatomy.shin / 2).distanceTo(rig.knee.position),
                endpoint(rig.leg, -astronautAnatomy.shin / 2).distanceTo(rig.ankleRing.position));
            }
          }
        }
        const range = values => Math.max(...values) - Math.min(...values);
        return {headFraction, shoulderToHead, legFraction, armToLeg:armLength/legLength, soleHeight, maxGap,
          armSwing: range(hands), chestTurn: range(shouldersTurn), elbowFlex: range(elbowBend)};
      };
    ` });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => typeof window.auditAstronaut === 'function');
  await page.locator('#start-button').click();
  const result = await page.evaluate(() => window.auditAstronaut());
  expect(result.headFraction).toBeGreaterThan(0.15);
  expect(result.headFraction).toBeLessThan(0.24);
  expect(result.shoulderToHead).toBeGreaterThan(1.5);
  expect(result.shoulderToHead).toBeLessThan(2.1);
  expect(result.legFraction).toBeGreaterThan(0.4);
  expect(result.legFraction).toBeLessThan(0.55);
  expect(result.armToLeg).toBeGreaterThan(0.65);
  expect(result.armToLeg).toBeLessThan(0.78);
  expect(Math.abs(result.soleHeight)).toBeLessThan(0.12);
  expect(result.maxGap).toBeLessThan(0.025);
  expect(result.armSwing).toBeGreaterThan(0.22);
  expect(result.armSwing).toBeLessThan(0.65);
  expect(result.chestTurn).toBeGreaterThan(0.12);
  expect(result.elbowFlex).toBeGreaterThan(0.15);
  expect(errors).toEqual([]);
});
