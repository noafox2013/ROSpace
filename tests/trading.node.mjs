import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchase, sellResource, positionBaseCamera, baseLocation, baseLayout } from '../src/base.js';
const fresh = () => ({ cors: 150, stones: 50, crystals: 20, health: 40, laserLevel: 0, jetpackLevel: 0 });
test('purchases use Cors and preserve every resource count', () => {
  const state = { ...fresh(), crystals: 7, blueCrystals: 5 };
  assert.equal(purchase(state, 'laser'), 'success');
  assert.equal(purchase(state, 'scanner'), 'success');
  assert.equal(state.cors, 93);
  assert.equal(state.stones, 50); assert.equal(state.crystals, 7); assert.equal(state.blueCrystals, 5);
});
test('selling crystals distinguishes purple and blue, and selling stones pays Cors', () => {
  const state = { ...fresh(), cors: 0, stones: 2, crystals: 7, blueCrystals: 5 };
  assert.equal(sellResource(state, 'stone', 2), 'success');
  assert.equal(sellResource(state, 'crystal', 2), 'success');
  assert.equal(state.crystals, 5); assert.equal(state.blueCrystals, 5);
  assert.equal(sellResource(state, 'crystal'), 'funds');
  assert.equal(sellResource(state, 'blue-crystal', 5), 'success');
  assert.equal(state.cors, 37); assert.equal(state.crystals, 0); assert.equal(state.blueCrystals, 0);
  const before = { ...state };
  for (const amount of [0, -1, 1.5, NaN]) assert.equal(sellResource(state, 'stone', amount), 'invalid');
  assert.equal(sellResource(state, 'stone'), 'funds');
  assert.equal(sellResource(state, 'unknown'), 'invalid');
  assert.deepEqual(state, before);
});
test('legacy saves without Cors must sell resources before buying', () => {
  const state = { stones: 5, crystals: 0, health: 40 };
  assert.equal(purchase(state, 'medical'), 'funds');
  assert.equal(sellResource(state, 'stone', 5), 'success');
  assert.equal(purchase(state, 'medical'), 'success');
  assert.equal(state.cors, 0); assert.equal(state.health, 90);
});
test('purchases charge exactly once and apply health and permanent upgrades', () => {
  const state = fresh();
  for (const id of ['medical', 'laser', 'jetpack']) assert.equal(purchase(state, id), 'success');
  assert.deepEqual(state, { cors: 85, stones: 50, crystals: 20, health: 90, laserLevel: 1, jetpackLevel: 1 });
});
test('insufficient resources and capped upgrades do not spend resources', () => {
  const state = { ...fresh(), cors: 0 };
  const before = { ...state };
  assert.equal(purchase(state, 'laser'), 'funds'); assert.deepEqual(state, before);
  state.health = 100; state.laserLevel = 3; state.jetpackLevel = 2;
  const capped = { ...state };
  for (const id of ['medical', 'laser', 'jetpack']) assert.equal(purchase(state, id), 'maximum');
  assert.deepEqual(state, capped);
  assert.equal(purchase(state, 'unknown'), 'invalid');
});

test('base doorway is passable, walls block, and the roof supports landing', async () => {
  const THREE = await import('three');
  const { createPlanetaryBase } = await import('../src/base.js');
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, fillText() {} }) }) };
  try {
    const base = createPlanetaryBase(new THREE.Scene());
    assert.equal(base.benches.length, 2);
    assert.equal(base.nearestBench(base.benches[0].stand), base.benches[0]);
    assert.equal(base.nearestBench(new THREE.Vector3(0, -0.05, -32)), null);
    const doorway = new THREE.Vector3(0, -0.05, -22.5);
    base.resolve(doorway, 0);
    assert.equal(doorway.z, -22.5);
    const wall = new THREE.Vector3(6, -0.05, -22.5);
    base.resolve(wall, 0);
    assert(wall.z > -22.5);
    assert.equal(base.canTrade(new THREE.Vector3(0, -0.05, -37)), true);
    assert.equal(base.canTrade(new THREE.Vector3(0, -0.05, -21)), false);
    const interior = new THREE.Vector3(2, 3, -32);
    assert.equal(base.resolve(interior, 5, 4), 4.575 * baseLayout.heightScale - 2.275);
    assert.equal(base.resolve(interior, 7.2, 7.5), 4.925 * baseLayout.heightScale);
  } finally { globalThis.document = original; }
});

test('third-person camera stays inside the base at doors, corners and all headings', async () => {
  const { Vector3 } = await import('three');
  for (const [x, z] of [[0, -23.3], [8.5, -40.5], [-8.5, -23.5], [0, -32]]) {
    for (const yaw of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const camera = new Vector3();
      positionBaseCamera(new Vector3(x, -0.05, z), yaw, camera);
      assert(Math.abs(camera.x - baseLocation.x) < baseLayout.halfSize - 0.2);
      assert(Math.abs(camera.z - baseLocation.z) < baseLayout.halfSize - 0.2);
      assert(camera.y < baseLocation.ground + 4.575 * baseLayout.heightScale);
      assert(camera.y > baseLocation.ground + 1);
    }
  }
});

test('worm horns cost 150 Cors each and cannot be bought without funds', () => {
  const state = { ...fresh(), cors: 300, stones: 0, crystals: 60, wormHorns: 0 };
  assert.equal(purchase(state, 'wormhorn'), 'success');
  assert.equal(state.cors, 150);
  assert.equal(state.wormHorns, 1);
  assert.equal(state.jetpackLevel, 0);
  assert.equal(purchase(state, 'wormhorn'), 'success');
  assert.equal(state.cors, 0);
  assert.equal(state.wormHorns, 2);
  assert.equal(purchase(state, 'wormhorn'), 'funds');
  assert.equal(state.wormHorns, 2);
  assert.equal(state.stones, 0);
});

test('scanner upgrades charge resources, cap at three, and leave jetpack unchanged', () => {
  const state = { cors: 96, stones: 50, crystals: 20, scannerLevel: 0, jetpackLevel: 0 };
  for (let level = 1; level <= 3; level++) {
    assert.equal(purchase(state, 'scanner'), 'success');
    assert.equal(state.scannerLevel, level);
  }
  assert.equal(state.cors, 0);
  assert.equal(state.stones, 50);
  assert.equal(state.crystals, 20);
  assert.equal(state.jetpackLevel, 0);
  const before = { ...state };
  assert.equal(purchase(state, 'scanner'), 'maximum');
  assert.deepEqual(state, before);
  const poor = { stones: 0, crystals: 0, scannerLevel: 0 };
  assert.equal(purchase(poor, 'scanner'), 'funds');
  assert.equal(poor.scannerLevel, 0);
});
