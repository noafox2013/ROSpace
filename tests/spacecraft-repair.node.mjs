import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateArchive, recoverFuelTank, repairSpacecraft } from '../src/spacecraft-repair.js';
const fresh = () => ({ archiveActivated: 1, archiveRead: 0, fuelTank: 0, landingStrut: 1, spacecraftRepaired: 0, crystals: 60, blueCrystals: 35 });

test('the archive yields one tank and cannot be farmed before or after repairs', () => {
  const state = fresh();
  assert(recoverFuelTank(state)); assert.equal(state.fuelTank, 1); assert.equal(state.archiveRead, 1);
  assert.equal(recoverFuelTank(state), false); assert.equal(state.fuelTank, 1);
  assert.equal(repairSpacecraft(state), 'success');
  assert.equal(recoverFuelTank(state), false); assert.equal(state.fuelTank, 0);
});
test('repair requires a tank, 30 crystals and 20 additional blue crystals and never spends on a failed attempt', () => {
  const state = fresh(), before = { ...state };
  assert.equal(repairSpacecraft(state), 'tank'); assert.deepEqual(state, before);
  recoverFuelTank(state); state.crystals = 29; state.blueCrystals = 29;
  const poor = { ...state };
  assert.equal(repairSpacecraft(state), 'crystals'); assert.deepEqual(state, poor);
});
test('repair consumes the tank and exactly 50 crystals including 20 reserved blue crystals, preserving remaining blue counts', () => {
  const state = fresh(); recoverFuelTank(state);
  assert.equal(repairSpacecraft(state), 'success');
  assert.equal(state.fuelTank, 0); assert.equal(state.crystals, 10);
  assert.equal(state.landingStrut, 0);
  assert.equal(state.blueCrystals, 10); assert.equal(state.spacecraftRepaired, 1);
  const repaired = { ...state };
  assert.equal(repairSpacecraft(state), 'repaired'); assert.deepEqual(state, repaired);
});

test('a landing strut is mandatory and missing gear never spends fuel or crystals', () => {
  const state = { ...fresh(), fuelTank: 1, landingStrut: 0 };
  const before = { ...state };
  assert.equal(repairSpacecraft(state), 'landing-strut');
  assert.deepEqual(state, before);
});

test('20 blue crystals are additional and all requirements are checked before spending', () => {
  for (const [crystals, blueCrystals, result] of [[60, 19, 'blue-crystals'], [49, 20, 'crystals'], [30, 30, 'crystals']]) {
    const state = { ...fresh(), fuelTank: 1, crystals, blueCrystals };
    const before = { ...state };
    assert.equal(repairSpacecraft(state), result);
    assert.deepEqual(state, before);
  }
});
test('50 blue crystals can cover both costs while exactly 30 purple and 20 blue also suffice', () => {
  for (const blueCrystals of [20, 50]) {
    const state = { ...fresh(), fuelTank: 1, crystals: 50, blueCrystals };
    assert.equal(repairSpacecraft(state), 'success');
    assert.equal(state.crystals, 0); assert.equal(state.blueCrystals, 0);
  }
});

test('the archive costs 50 Cors once and blocks reading and tank recovery without activation', () => {
  const state = { ...fresh(), archiveActivated: 0, cors: 49 };
  const before = { ...state };
  assert.equal(activateArchive(state), 'funds');
  assert.equal(recoverFuelTank(state), false);
  assert.deepEqual(state, before);
  state.cors = 70;
  assert.equal(activateArchive(state), 'success');
  assert.equal(state.cors, 20); assert.equal(state.archiveActivated, 1);
  assert.equal(activateArchive(state), 'active'); assert.equal(state.cors, 20);
  assert(recoverFuelTank(state));
});
