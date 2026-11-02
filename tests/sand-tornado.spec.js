import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('storm funnels render, throw the explorer and save a slam that deals 25 damage after loading', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /shader|WebGLProgram/i.test(message.text())) errors.push(message.text());
  });
  await page.setViewportSize({ width: 800, height: 600 });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      renderer.setPixelRatio(0.5); renderer.shadowMap.enabled = false;
      window.tornadoTest = {
        suction() {
          tornadoFlight.reset();
          ship.position.set(198, terrainHeight(198, 180) + playerGroundOffset, 180);
          state.flightHeight = state.flightVelocity = 0;
          const original = sandstorm.getTornadoes;
          sandstorm.getTornadoes = () => [{x:180,z:180,radius:6,height:34}];
          for (let i = 0; i < 10; i++) updateGame(0.04);
          sandstorm.getTornadoes = original;
          return {distance:Math.hypot(ship.position.x - 180, ship.position.z - 180), height:state.flightHeight, health:state.health};
        },
        prepare() {
          ship.position.set(180, terrainHeight(180, 180) + playerGroundOffset, 180);
          sandstorm.restore({wait:0,age:20,duration:70});
          sandstorm.update(0.04, ship.position, false);
          const hazard = sandstorm.getTornadoes()[0];
          ship.position.set(hazard.x, terrainHeight(hazard.x, hazard.z) + playerGroundOffset, hazard.z);
          state.health = 100; state.flightHeight = state.flightVelocity = 0;
          state.jetpackActive = true;
          let peak = 0;
          for (let i = 0; i < 31; i++) {
            updateGame(0.04); peak = Math.max(peak, state.flightHeight);
          }
          const phase = tornadoFlight.snapshot().phase;
          saveGame();
          const visible = scene.children.filter(object => object.name.startsWith('sand-tornado-') && object.visible).length;
          return {peak, phase, health:state.health, visible};
        },
        read() { return {health:state.health, height:state.flightHeight, phase:tornadoFlight.snapshot().phase}; },
        capture() {
          const funnel = scene.getObjectByName('sand-tornado-0');
          const position = camera.position.clone(), rotation = camera.quaternion.clone();
          camera.position.copy(funnel.position).add(new THREE.Vector3(13, 9, 16));
          camera.lookAt(funnel.position.clone().add(new THREE.Vector3(0, 15, 0)));
          renderer.render(scene, camera);
          const data = canvas.toDataURL();
          camera.position.copy(position); camera.quaternion.copy(rotation);
          return data;
        },
        shelter() {
          tornadoFlight.reset();
          ship.position.set(0, baseLocation.ground + 1, -32);
          state.flightHeight = state.flightVelocity = 0;
          const original = sandstorm.getTornadoes;
          sandstorm.getTornadoes = () => [{x:0,z:-32,radius:6,height:34}];
          updateGame(0.04);
          sandstorm.getTornadoes = original;
          return tornadoFlight.snapshot().phase;
        },
      };
    ` });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  const sucked = await page.evaluate(() => window.tornadoTest.suction());
  expect(sucked.distance).toBeLessThan(17);
  expect(sucked.distance).toBeGreaterThan(6);
  expect(sucked.height).toBe(0);
  expect(sucked.health).toBe(100);
  const prepared = await page.evaluate(() => window.tornadoTest.prepare());
  expect(prepared.peak).toBeGreaterThan(25);
  expect(prepared.phase).toBe('slam');
  expect(prepared.health).toBe(100);
  expect(prepared.visible).toBe(3);
  await page.screenshot({ path: 'test-results/sand-tornado.png' });
  if (process.env.ROSPACE_CAPTURE) {
    const data = await page.evaluate(() => window.tornadoTest.capture());
    writeFileSync('/tmp/rospace-sand-tornado.png', Buffer.from(data.split(',')[1], 'base64'));
  }
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rust-mesa-saves-v2'))[0]);
  expect(saved.tornadoFlight.phase).toBe('slam');
  await page.reload();
  await page.locator('#load-button').click();
  await expect.poll(() => page.evaluate(() => window.tornadoTest.read().health)).toBe(75);
  await expect.poll(() => page.evaluate(() => window.tornadoTest.read().phase)).toBe('idle');
  await expect(page.locator('#health')).toHaveText('75');
  expect(await page.evaluate(() => window.tornadoTest.shelter())).toBe('idle');
  expect(errors).toEqual([]);
});
