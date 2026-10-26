import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { abandonedLocation, createAbandonedBuilding } from '../src/abandoned-building.js';
import { purchase } from '../src/base.js';

test('abandoned building is 300 metres from spawn', () => {
  assert.equal(Math.hypot(abandonedLocation.x, abandonedLocation.z - 2.15), 300);
});
test('pass key costs resources only once and unlocks the entrance', () => {
  const state = { stones: 30, crystals: 10, passKey: 0 };
  assert.equal(purchase(state, 'passkey'), 'success');
  assert.deepEqual(state, { stones: 10, crystals: 2, passKey: 1 });
  assert.equal(purchase(state, 'passkey'), 'maximum');
  assert.equal(state.stones, 10);
  const building = createAbandonedBuilding(new THREE.Scene());
  const player = new THREE.Vector3(abandonedLocation.x, abandonedLocation.ground + 1, abandonedLocation.z + 8.1);
  const original = player.clone();
  building.resolve(player, 0, 0, false);
  assert.ok(player.distanceTo(original) > 0.1);
  player.copy(original);
  building.setUnlocked(true);
  building.update(0.5);
  building.resolve(player, 0, 0, true);
  assert.ok(player.distanceTo(original) > 0.1, 'door still blocks while it begins opening');
  building.update(2.5);
  player.copy(original);
  building.resolve(player, 0, 0, true);
  assert.equal(player.distanceTo(original), 0);
  player.set(abandonedLocation.x + 6, abandonedLocation.ground + 1, abandonedLocation.z);
  building.resolve(player, 0, 0, true);
  assert.notEqual(player.x, abandonedLocation.x + 6);
  player.set(abandonedLocation.x, abandonedLocation.ground + 8, abandonedLocation.z);
  assert.equal(building.resolve(player, 7.2, 7.5, false), 7.4);
});
