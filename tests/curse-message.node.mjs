import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCurseMessage } from '../src/curse-message.js';
import { createSandworm } from '../src/sandworm.js';
import * as THREE from 'three';

test('the curse appears once per game and returns for a new game', () => {
  const element = { hidden: true };
  const message = createCurseMessage(element);
  assert(message.showOnce());
  assert.equal(element.hidden, false);
  message.hide();
  assert.equal(message.showOnce(), false);
  assert.equal(element.hidden, true);
  message.reset();
  assert.equal(message.isShown(), false);
  assert(message.showOnce());
  assert.equal(element.hidden, false);
  message.hide();
});

test('loading a save that already showed the curse keeps it remembered', () => {
  const element = { hidden: true };
  const message = createCurseMessage(element);
  message.remember();
  assert.equal(message.showOnce(), false);
  assert.equal(element.hidden, true);
});

test('only winning the fight triggers the message, not restoring a defeated worm', () => {
  let wins = 0;
  const worm = createSandworm(() => 0, () => wins++);
  const player = new THREE.Vector3();
  worm.reset(player, 0);
  const target = worm.object.getObjectByName('sandworm-weak-point');
  worm.hitLaser(target);
  assert.equal(wins, 0);
  worm.hitLaser(target);
  assert.equal(wins, 1);
  worm.hitLaser(target);
  assert.equal(wins, 1);
  worm.reset(player, 0);
  worm.repel(true);
  assert.equal(wins, 1);
});

test('legacy flags that could be set without displaying the message do not suppress it', () => {
  const data = new Map([['rust-mesa-sandworm-curse-shown', 'true']]);
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const element = { hidden: true };
  const message = createCurseMessage(element, storage);
  assert(message.showOnce());
  assert.equal(element.hidden, false);
  message.hide();
  const nextGame = createCurseMessage({ hidden: true }, storage);
  assert(nextGame.showOnce());
  nextGame.hide();
});

test('message history keeps the curse and freedom messages after hiding and loading', () => {
  const element = { hidden: true, textContent: 'Curse' };
  const message = createCurseMessage(element);
  message.showOnce();
  message.show('Freedom');
  message.hide();
  assert.deepEqual(message.getHistory(), ['Curse', 'Freedom']);
  const restored = createCurseMessage({ hidden: true, textContent: 'Freedom' });
  restored.restoreHistory(message.getHistory());
  restored.remember();
  assert.deepEqual(restored.getHistory(), ['Curse', 'Freedom']);
  restored.reset();
  assert.deepEqual(restored.getHistory(), []);
});

test('weather alerts keep their history without suppressing the curse', () => {
  const element = { hidden: true, textContent: 'Curse' };
  const message = createCurseMessage(element);
  message.show('Storm warning');
  assert.equal(message.isShown(), false);
  assert.equal(message.showOnce('Curse'), true);
  assert.equal(element.textContent, 'Curse');
  assert.deepEqual(message.getHistory(), ['Storm warning', 'Curse']);
  message.hide();
});

test('temporary warnings appear without entering message history', () => {
  const element = { hidden: true, textContent: 'Curse' };
  const message = createCurseMessage(element);
  message.showOnce();
  message.show('Storm warning', { keepHistory: false });
  assert.equal(element.hidden, false);
  assert.equal(element.textContent, 'Storm warning');
  assert.deepEqual(message.getHistory(), ['Curse']);
  message.hide();
});
