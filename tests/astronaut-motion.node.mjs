import assert from 'node:assert/strict';
import { sampleAstronautStep, sampleAstronautFlight } from '../src/astronaut-rig.js';

// The foot must pass through push-off and touchdown without a position or
// velocity discontinuity, including when the cycle wraps to the next step.
const epsilon = 0.00001;
for (const sprint of [0, 0.5, 1]) {
  for (const boundary of [0, Math.PI * 2 * sampleAstronautStep(0, 1, sprint).stance, Math.PI * 2]) {
    for (const field of ['travel', 'lift', 'roll']) {
      const before = sampleAstronautStep(boundary - epsilon, 1, sprint)[field];
      const at = sampleAstronautStep(boundary, 1, sprint)[field];
      const after = sampleAstronautStep(boundary + epsilon, 1, sprint)[field];
      assert.ok(Math.abs(after - before) < 0.0001, `${field}: position jumps at ${boundary}`);
      assert.ok(Math.abs((at - before) / epsilon - (after - at) / epsilon) < 0.002,
        `${field}: velocity jumps at ${boundary}`);
    }
  }
}
for (let frame = 0; frame < 120; frame++) {
  const step = sampleAstronautStep(frame / 120 * Math.PI * 2, 0, 1);
  for (const field of ['travel', 'lift', 'roll']) assert.equal(Math.abs(step[field]), 0);
}

// A sprint has an airborne interval with neither foot on the ground.
for (const sprint of [0, 1]) {
  let bothAirborne = 0, maximumLift = 0;
  for (let frame = 0; frame < 240; frame++) {
    const phase = frame / 240 * Math.PI * 2;
    const left = sampleAstronautStep(phase, 1, sprint);
    const right = sampleAstronautStep(phase + Math.PI, 1, sprint);
    if (left.swinging && right.swinging) bothAirborne++;
    maximumLift = Math.max(maximumLift, left.lift);
  }
  assert.equal(bothAirborne > 0, sprint === 1);
  assert.ok(maximumLift > (sprint ? 0.35 : 0.15));
}
const powered = sampleAstronautFlight(4, 3, 1);
const falling = sampleAstronautFlight(4, -5, 0);
const landing = sampleAstronautFlight(0.1, -5, 0);
assert.ok(powered.trail > falling.trail);
assert.ok(falling.armSpread > powered.armSpread);
assert.ok(landing.tuck < falling.tuck * 0.3);
assert.ok(landing.landing > 0.9);
for (const height of [0, 0.1, 1, 10]) {
  for (const velocity of [-10, 0, 5]) {
    assert.ok(Object.values(sampleAstronautFlight(height, velocity, 0.5)).every(Number.isFinite));
  }
}
console.log('Walking and sprint contacts stay continuous; flight poses respond to thrust, falling and landing.');
