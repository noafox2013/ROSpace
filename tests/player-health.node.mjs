import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFallDamage, damageHealth, updateHealthRecovery } from '../src/player-health.js';
const fresh = () => ({ running:true, health:100, healthRecoveryDelay:0, fallDistance:0 });

test('a hard fall above 8 metres deals exactly 10 health once, while short and cushioned falls are safe', () => {
  for (const [height, velocity, damage] of [[7,-10,false], [8,-10,false], [12,-10,true], [12,-3,false]]) {
    const state = fresh();
    applyFallDamage(state, height, height/2, velocity, false);
    assert.equal(state.health, 100);
    assert.equal(applyFallDamage(state, height/2, 0, velocity, true), damage);
    assert.equal(state.health, damage ? 90 : 100);
    assert.equal(applyFallDamage(state, 0, 0, -10, true), false);
  }
});
test('tornado impacts keep their own damage and landing on a roof resets fall distance', () => {
  const state = fresh(); damageHealth(state, 25);
  assert.equal(applyFallDamage(state, 30, 0, -40, true, true), false);
  assert.equal(state.health, 75);
  applyFallDamage(state, 20, 14, -10, false);
  assert.equal(applyFallDamage(state, 14, 12, -10, true), false);
  assert.equal(state.fallDistance, 0);
});
test('healing starts after 25 seconds without damage, gradually caps at 100 and restarts its delay after another hit', () => {
  const state = fresh(); damageHealth(state, 10);
  updateHealthRecovery(state,24.9); assert.equal(state.health,90);
  updateHealthRecovery(state,0.2); assert(Math.abs(state.health - 90.5) < 0.00001);
  damageHealth(state,10);
  updateHealthRecovery(state,25); assert(Math.abs(state.health - 80.5) < 0.00001);
  updateHealthRecovery(state,5); assert.equal(state.health,100);
});
test('death and stopped gameplay never heal; recovery and mid-fall progress survive a serialized save', () => {
  for (const state of [{...fresh(), health:0}, {...fresh(), running:false, health:80}]) {
    const before = {...state}; updateHealthRecovery(state,60); assert.deepEqual(state,before);
  }
  const state = fresh(); damageHealth(state,10); updateHealthRecovery(state,10);
  applyFallDamage(state,20,9,-10,false);
  const loaded = JSON.parse(JSON.stringify(state));
  assert.equal(loaded.healthRecoveryDelay,15);
  assert(applyFallDamage(loaded,9,0,-10,true));
  assert.equal(loaded.health,80); assert.equal(loaded.healthRecoveryDelay,25);
});
