import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpacecraftCollision } from '../src/spacecraft-collision.js';
const resolve = createSpacecraftCollision({ x: 100, z: -38 }, 0, () => 0);

test('walking into the pressure hull from either side stops at its surface', () => {
  for (const side of [-1, 1]) {
    let player = { x: 100 + side * 3.2, y: 1, z: -38 };
    for (let i = 0; i < 30; i++) {
      const previous = { ...player };
      player.x -= side * 0.15;
      resolve(player, 0, previous);
      assert.ok(side * (player.x - 100) > 2.85);
    }
  }
});
test('engine pods and wing surfaces block airborne movement', () => {
  const engine = { x: 105.1, y: 3, z: -42 };
  resolve(engine, 2, { x: 105.8, y: 3, z: -42 });
  assert.ok(engine.x >= 105.59);
  const wing = { x: 106.2, y: 2, z: -43.9 };
  const before = { ...wing };
  resolve(wing, 1, { ...before, z: before.z - 0.5 });
  assert.ok(Math.hypot(wing.x - before.x, wing.z - before.z) > 0.1);
});
test('landing on the hull and striking its underside cannot pass through it', () => {
  const falling = { x: 102, y: 5.6, z: -38 };
  assert.equal(resolve(falling, 4.6, { x: 102, y: 5.9, z: -38 }), 4.75);
  assert.equal(falling.y, 5.75);
  const rising = { x: 104, y: 1.1, z: -42 };
  const height = resolve(rising, 0.1, { x: 104, y: 0.5, z: -42 });
  assert.ok(rising.y + 1.275 < 2.03);
  assert.equal(height, 0);
});
test('boarding approach and space above the craft remain clear', () => {
  for (const player of [{ x: 96.1, y: 1, z: -36 }, { x: 94.35, y: 1, z: -38.8 }, { x: 100, y: 8, z: -38 }]) {
    const original = { ...player };
    resolve(player, player.y - 1, original);
    assert.deepEqual(player, original);
  }
});
