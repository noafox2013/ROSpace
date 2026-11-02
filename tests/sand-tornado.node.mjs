import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTornadoFlight } from '../src/sand-tornado.js';

const hazard = [{ x: 0, z: 0, radius: 6, height: 34 }];
const fresh = () => ({ health: 100, flightHeight: 0, flightVelocity: 0 });
function step(flight, state, position, hazards = hazard, sheltered = false) {
  const active = flight.update(0.04, state, position, hazards, sheltered);
  if (active) state.flightHeight = Math.max(0, state.flightHeight + state.flightVelocity * 0.04);
  return active;
}

test('a funnel throws the explorer high up, slams down and deals exactly 25 damage once', () => {
  const flight = createTornadoFlight(), state = fresh(), position = { x: 2, z: 0 };
  let peak = 0, impacts = 0, moved = false;
  for (let i = 0; i < 90; i++) {
    step(flight, state, position);
    peak = Math.max(peak, state.flightHeight);
    moved ||= position.z !== 0;
    if (flight.isSlamming() && state.flightHeight === 0) flight.land(state, () => impacts++);
  }
  assert(peak > 25); assert(moved);
  assert.equal(state.health, 75); assert.equal(impacts, 1);
  assert.equal(flight.land(state, () => impacts++), false);
  assert.equal(step(flight, state, position), false);
});

test('no funnel, distant funnels, high flight and shelter cannot start an attack', () => {
  for (const [hazards, position, height, sheltered] of [
    [[], { x: 0, z: 0 }, 0, false], [hazard, { x: 10, z: 0 }, 0, false],
    [hazard, { x: 0, z: 0 }, 40, false], [hazard, { x: 0, z: 0 }, 0, true],
  ]) {
    const flight = createTornadoFlight(), state = { ...fresh(), flightHeight: height };
    assert.equal(step(flight, state, position, hazards, sheltered), false);
    assert.equal(state.health, 100);
  }
});

test('suction draws an explorer outside the core into the funnel before lifting them', () => {
  const flight = createTornadoFlight(), state = fresh(), position = { x: 18, z: 0 };
  assert.equal(step(flight, state, position), false);
  assert(position.x < 18 && position.x > 6);
  assert.equal(state.flightHeight, 0);
  for (let i = 0; i < 180 && flight.snapshot().phase === 'idle'; i++) step(flight, state, position);
  assert.equal(flight.snapshot().phase, 'lift');
  assert(Math.hypot(position.x, position.z) < 6);
  assert(state.flightHeight > 0);
  assert.equal(state.health, 100);
});

test('suction grows stronger near the core and respects shelter, height, distance and pause', () => {
  const pulled = distance => {
    const position = { x: distance, z: 0 };
    step(createTornadoFlight(), fresh(), position);
    return distance - position.x;
  };
  assert(pulled(10) > pulled(20));
  for (const [distance, height, sheltered, delta] of [
    [25, 0, false, 0.04], [18, 40, false, 0.04], [18, 0, true, 0.04], [18, 0, false, 0],
  ]) {
    const position = { x: distance, z: 0 }, state = { ...fresh(), flightHeight: height };
    createTornadoFlight().update(delta, state, position, hazard, sheltered);
    assert.deepEqual(position, { x: distance, z: 0 });
    assert.equal(state.health, 100);
  }
});

test('pause freezes the attack and save/load preserves an in-progress slam', () => {
  const flight = createTornadoFlight(), state = fresh(), position = { x: 0, z: 0 };
  for (let i = 0; i < 35; i++) step(flight, state, position);
  const saved = flight.snapshot(), before = { ...state };
  assert.equal(flight.update(0, state, position, [], false), true);
  assert.deepEqual(flight.snapshot(), saved); assert.deepEqual(state, before);
  const loaded = createTornadoFlight(); loaded.restore(saved);
  assert(loaded.isSlamming());
  state.health = 20;
  assert(loaded.land(state, () => {})); assert.equal(state.health, 0);
  loaded.reset(); assert.equal(loaded.isSlamming(), false);
});

test('a thrown explorer still lands after the storm ends; reaching shelter cancels the attack', () => {
  const flight = createTornadoFlight(), state = fresh(), position = { x: 0, z: 0 };
  step(flight, state, position);
  for (let i = 0; i < 35; i++) assert(step(flight, state, position, []));
  assert(flight.isSlamming());
  assert.equal(step(flight, state, position, [], true), false);
  assert.equal(flight.land(state, () => {}), false);
  assert.equal(state.health, 100);
});
