import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSaves, writeSave, deleteSave } from '../src/saves.js';
const storage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
test('ten independent saves persist and overwriting preserves the other slots', () => {
  const store = storage();
  for (let i = 0; i < 10; i++) writeSave(store, i, { name: `Save ${i}`, state: { score: i } });
  assert.equal(readSaves(store).length, 10);
  writeSave(store, 4, { name: 'Updated' });
  assert.equal(readSaves(store)[4].name, 'Updated');
  assert.equal(readSaves(store)[9].state.score, 9);
  assert.throws(() => writeSave(store, 10, {}));
  assert.throws(() => writeSave(store, -1, {}));
});
test('legacy save survives migration and adding another save', () => {
  const store = storage();
  store.setItem('rust-mesa-save-v1', JSON.stringify({ name: 'Original' }));
  assert.equal(readSaves(store)[0].name, 'Original');
  writeSave(store, 1, { name: 'Second' });
  assert.equal(readSaves(store)[0].name, 'Original');
  assert.equal(readSaves(store)[1].name, 'Second');
});

test('deleting a legacy save does not resurrect it and preserves other slots', () => {
  const store = storage();
  store.setItem('rust-mesa-save-v1', JSON.stringify({ name: 'Original' }));
  writeSave(store, 9, { name: 'Keep me' });
  deleteSave(store, 0);
  assert.equal(readSaves(store)[0], null);
  assert.equal(readSaves(store)[9].name, 'Keep me');
  deleteSave(store, 9);
  assert(readSaves(store).every(save => save === null));
});
