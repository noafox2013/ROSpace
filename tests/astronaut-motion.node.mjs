import assert from 'node:assert/strict';
import { sampleAstronautStep } from '../src/astronaut-rig.js';

// The foot must pass through push-off and touchdown without a position or
// velocity discontinuity, including when the cycle wraps to the next step.
const epsilon = 0.00001;
for (const boundary of [0, Math.PI * 2 * 0.6, Math.PI * 2]) {
  for (const field of ['travel', 'lift', 'roll']) {
    const before = sampleAstronautStep(boundary - epsilon, 1, 1)[field];
    const at = sampleAstronautStep(boundary, 1, 1)[field];
    const after = sampleAstronautStep(boundary + epsilon, 1, 1)[field];
    assert.ok(Math.abs(after - before) < 0.0001, `${field}: position jumps at ${boundary}`);
    assert.ok(Math.abs((at - before) / epsilon - (after - at) / epsilon) < 0.002,
      `${field}: velocity jumps at ${boundary}`);
  }
}
for (let frame = 0; frame < 120; frame++) {
  const step = sampleAstronautStep(frame / 120 * Math.PI * 2, 0, 1);
  for (const field of ['travel', 'lift', 'roll']) assert.equal(Math.abs(step[field]), 0);
}
console.log('Astronaut foot motion stays continuous through push-off, touchdown and rest.');
