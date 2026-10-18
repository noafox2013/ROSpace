import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchase, positionBaseCamera, baseLocation, baseLayout } from '../src/base.js';
const fresh = () => ({ stones: 50, crystals: 20, health: 40, laserLevel: 0, jetpackLevel: 0 });
test('purchases charge exactly once and apply health and permanent upgrades', () => {
  const state = fresh();
  for (const id of ['medical', 'laser', 'jetpack']) assert.equal(purchase(state, id), 'success');
  assert.deepEqual(state, { stones: 20, crystals: 13, health: 90, laserLevel: 1, jetpackLevel: 1 });
});
test('insufficient resources and capped upgrades do not spend resources', () => {
  const state = { ...fresh(), stones: 0 };
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
