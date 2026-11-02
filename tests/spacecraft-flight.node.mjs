import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpacecraftFlight } from '../src/spacecraft-flight.js';

const ready = { occupied: true, canopyClosed: true };
function advance(flight, seconds, controls = {}, fps = 60) {
  for (let frame = 0; frame < Math.round(seconds * fps); frame++) flight.update(1 / fps, { ...ready, ...controls });
}
function takeOff(flight) {
  advance(flight, 1 / 60, { up: true });
  advance(flight, 4);
  assert.equal(flight.state.phase, 'hover');
}

test('first W press spools up a gradual takeoff; holding it never starts forward flight', () => {
  const flight = createSpacecraftFlight();
  advance(flight, 1 / 60, { up: true });
  assert.equal(flight.state.phase, 'lifting');
  assert.ok(flight.state.altitude > 0 && flight.state.altitude < 0.01);
  assert.ok(flight.state.velocity <= 3 / 60 + 1e-8);
  advance(flight, 8, { up: true });
  assert.equal(flight.state.phase, 'hover');
  assert.equal(flight.state.altitude, 1.8);
  assert.equal(flight.state.forwardDistance, 0);
  assert.equal(flight.isLanded(), false);
  advance(flight, 3);
  assert.equal(flight.state.altitude, 1.8);
  assert.equal(flight.state.forwardSpeed, 0);
});

test('thrust builds gradually and releasing W stops the craft within a second', () => {
  const flight = createSpacecraftFlight();
  takeOff(flight);
  advance(flight, 1 / 60, { up: true });
  assert.ok(flight.state.forwardSpeed > 0 && flight.state.forwardSpeed < 0.01);
  advance(flight, 2, { up: true });
  assert.equal(flight.state.phase, 'flying');
  assert.ok(flight.state.forwardSpeed > 12 && flight.state.forwardSpeed < 16);
  assert.ok(flight.state.forwardDistance > 10);
  const speed = flight.state.forwardSpeed, distance = flight.state.forwardDistance;
  advance(flight, 0.1);
  assert.equal(flight.state.phase, 'hover');
  assert.ok(flight.state.forwardSpeed > 0 && flight.state.forwardSpeed < speed * 0.8);
  advance(flight, 0.7);
  assert.equal(flight.state.forwardSpeed, 0);
  assert.ok(flight.state.forwardDistance > distance);
  assert.ok(flight.state.forwardDistance - distance < 5, 'releasing W must not produce a long slide');
  const stoppedAt = flight.state.forwardDistance;
  advance(flight, 2);
  assert.equal(flight.state.forwardDistance, stoppedAt);
});

test('Space counter-thrust brakes faster than coasting and overrides held W', () => {
  const coast = createSpacecraftFlight(), brake = createSpacecraftFlight();
  for (const flight of [coast, brake]) { takeOff(flight); advance(flight, 4, { up: true }); }
  const initial = brake.state.forwardSpeed;
  advance(brake, 1 / 60, { brake: true, up: true });
  assert.ok(brake.state.forwardSpeed > initial * 0.9);
  advance(brake, 0.2, { brake: true, up: true });
  advance(coast, 0.2);
  assert.ok(brake.state.forwardSpeed < coast.state.forwardSpeed - 2);
  advance(brake, 0.3, { brake: true, up: true });
  assert.equal(brake.state.forwardSpeed, 0);
  advance(brake, 1, { up: true });
  assert.ok(brake.state.forwardSpeed > 1);
});

test('S brakes before descending, lands softly and takes priority over W', () => {
  const flight = createSpacecraftFlight();
  takeOff(flight);
  advance(flight, 3, { up: true });
  const height = flight.state.altitude;
  advance(flight, 1 / 60, { down: true, up: true });
  assert.equal(flight.state.phase, 'landing');
  advance(flight, 0.2);
  assert.equal(flight.state.altitude, height);
  assert.ok(flight.state.forwardSpeed > 1);
  let touchdownSpeed = null;
  for (let frame = 0; frame < 600 && !flight.isLanded(); frame++) {
    const before = flight.state.velocity;
    advance(flight, 1 / 60);
    if (flight.isLanded()) touchdownSpeed = Math.abs(before);
  }
  assert.equal(flight.isLanded(), true);
  assert.ok(touchdownSpeed < 0.03);
  assert.equal(flight.state.altitude, 0);
  assert.equal(flight.state.velocity, 0);
  assert.equal(flight.state.forwardSpeed, 0);
  advance(flight, 1 / 60, { up: true });
  assert.equal(flight.state.phase, 'lifting');
});

test('boarding and canopy interlocks require a fresh W press after controls become available', () => {
  for (const blocked of [{ occupied: false }, { canopyClosed: false }, { exitPending: true }]) {
    const flight = createSpacecraftFlight();
    advance(flight, 1, { ...blocked, up: true });
    advance(flight, 1, { up: true });
    assert.equal(flight.isLanded(), true);
    advance(flight, 1 / 60);
    advance(flight, 4, { up: true });
    assert.equal(flight.state.phase, 'hover');
  }
});

test('pausing freezes all momentum and reset clears flight and attitude state', () => {
  const flight = createSpacecraftFlight();
  takeOff(flight);
  advance(flight, 2, { up: true });
  flight.steer(0.8, 0.3);
  advance(flight, 0.5, { up: true });
  const paused = { ...flight.state };
  flight.update(0, { ...ready, down: true });
  assert.deepEqual(flight.state, paused);
  flight.reset();
  assert.equal(flight.isLanded(), true);
  for (const [key, value] of Object.entries(flight.state)) if (key !== 'phase') assert.equal(value, 0, key);
  advance(flight, 4, { up: true });
  assert.equal(flight.state.phase, 'hover');
  assert.equal(flight.state.forwardDistance, 0);
});

test('attitude has limited angular acceleration and rate; stationary yaw does not translate the craft', () => {
  for (const direction of [-1, 1]) {
    const flight = createSpacecraftFlight();
    takeOff(flight);
    flight.steer(direction * Math.PI / 2, 0);
    advance(flight, 1 / 60);
    assert.ok(Math.abs(flight.state.yaw) < 0.005);
    assert.ok(Math.abs(flight.state.yawVelocity) < 0.25);
    advance(flight, 0.5);
    assert.ok(Math.abs(flight.state.yawVelocity) <= 2.2);
    advance(flight, 4);
    assert.equal(flight.state.forwardDistance, 0);
    assert.ok(Math.abs(flight.state.yaw - direction * Math.PI / 2) < 0.00001);
    advance(flight, 3, { up: true });
    assert.ok(direction * flight.state.offsetX > 25);
    assert.ok(Math.abs(flight.state.offsetZ) < 0.001);
  }
});

test('flight assist follows turns promptly without a long sideways slide and banks the hull', () => {
  for (const direction of [-1, 1]) {
    const flight = createSpacecraftFlight();
    takeOff(flight);
    advance(flight, 3, { up: true });
    const previousZ = flight.state.velocityZ;
    flight.steer(direction * Math.PI / 2, 0);
    advance(flight, 1 / 60, { up: true });
    assert.ok(flight.state.velocityZ > previousZ * 0.95, 'turning must remain smooth on the first frame');
    advance(flight, 1, { up: true });
    assert.ok(direction * flight.state.yaw > 1.5);
    assert.ok(direction * flight.state.velocityX > 0);
    const velocityYaw = Math.atan2(flight.state.velocityX, flight.state.velocityZ);
    assert.ok(Math.abs(flight.state.yaw - velocityYaw) < 0.06, 'velocity must follow the nose through the turn');
    assert.ok(direction * flight.state.roll < -0.02);
    advance(flight, 8, { brake: true });
    assert.equal(flight.state.forwardSpeed, 0);
    assert.ok(Math.abs(flight.state.roll) < 0.001);
  }
});

test('pitch changes redirect vertical motion promptly; braking stabilizes altitude', () => {
  const flight = createSpacecraftFlight();
  takeOff(flight);
  flight.steer(0, 0.5);
  advance(flight, 5, { up: true });
  assert.ok(flight.state.altitude > 20);
  assert.ok(flight.state.velocity > 0);
  flight.steer(0, -1);
  advance(flight, 1 / 60, { up: true });
  assert.ok(flight.state.velocity > 0, 'pitching down must not instantly reverse the climb');
  advance(flight, 1, { up: true });
  assert.ok(flight.state.pitch < -0.4);
  assert.ok(flight.state.velocity < -1);
  advance(flight, 4, { brake: true });
  const hoverAltitude = flight.state.altitude;
  advance(flight, 4);
  assert.ok(Math.abs(flight.state.altitude - hoverAltitude) < 1e-8);
  advance(flight, 1 / 60, { down: true });
  flight.steer(0, 0.6);
  advance(flight, 40);
  assert.equal(flight.isLanded(), true);
  assert.equal(flight.state.pitch, 0);
});

test('pitch limits allow vertical flight without horizontal drift and protect terrain clearance', () => {
  for (const yaw of [0, 0.8, -2.4]) {
    const flight = createSpacecraftFlight();
    flight.steer(1, 1);
    advance(flight, 1 / 60, { up: true });
    flight.steer(1, 1);
    advance(flight, 4);
    assert.equal(flight.state.yaw, 0);
    assert.equal(flight.state.pitch, 0);
    flight.steer(yaw, 10);
    advance(flight, 6);
    assert.equal(flight.state.pitch, Math.PI / 2);
    advance(flight, 20, { up: true });
    assert.equal(flight.state.altitude, 120);
    assert.ok(Math.hypot(flight.state.offsetX, flight.state.offsetZ) < 1e-8);
    advance(flight, 3, { brake: true });
    flight.steer(0, -20);
    advance(flight, 6);
    assert.equal(flight.state.pitch, -Math.PI / 2);
    advance(flight, 20, { up: true });
    assert.equal(flight.state.altitude, 1.8);
    assert.ok(Math.hypot(flight.state.offsetX, flight.state.offsetZ) < 1e-8);
  }
});

test('flying above lower terrain preserves world height instead of snapping down with the terrain', () => {
  let ground = 10;
  const flight = createSpacecraftFlight({ groundHeight: () => ground });
  takeOff(flight);
  const height = flight.state.height;
  ground = -10;
  advance(flight, 2);
  assert.equal(flight.state.height, height);
  assert.equal(flight.state.altitude, height + 10);
  advance(flight, 30, { down: true });
  assert.equal(flight.isLanded(), true);
  assert.equal(flight.state.height, -10);
  assert.equal(flight.state.altitude, 0);
});

test('flight physics agrees at 30, 60 and 120 FPS', () => {
  const snapshots = [30, 60, 120].map(fps => {
    const flight = createSpacecraftFlight();
    advance(flight, 4, { up: true }, fps);
    advance(flight, 0.1, {}, fps);
    advance(flight, 3, { up: true }, fps);
    flight.steer(0.9, 0.4);
    advance(flight, 2, { up: true }, fps);
    advance(flight, 0.5, {}, fps);
    advance(flight, 1, { brake: true }, fps);
    return flight.state;
  });
  for (const state of snapshots.slice(1)) {
    for (const key of ['offsetX', 'offsetZ', 'height', 'velocityX', 'velocityZ', 'velocity', 'yaw', 'pitch', 'roll']) {
      assert.ok(Math.abs(state[key] - snapshots[0][key]) < 1e-8, key);
    }
  }
});
