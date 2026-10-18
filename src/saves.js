export const SAVE_LIMIT = 10;
const key = 'rust-mesa-saves-v2';

export function readSaves(storage) {
  const raw = storage.getItem(key);
  if (raw !== null) {
    const saves = JSON.parse(raw);
    if (!Array.isArray(saves)) throw new Error('Invalid saves');
    return Array.from({ length: SAVE_LIMIT }, (_, index) => saves[index] ?? null);
  }
  const legacy = JSON.parse(storage.getItem('rust-mesa-save-v1') || 'null');
  return Array.from({ length: SAVE_LIMIT }, (_, index) => index === 0 ? legacy : null);
}

export function writeSave(storage, slot, save) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SAVE_LIMIT) throw new Error('Invalid slot');
  const saves = readSaves(storage);
  saves[slot] = save;
  storage.setItem(key, JSON.stringify(saves));
}

export function deleteSave(storage, slot) {
  // Persist an empty slot even for legacy saves so deleted saves never reappear.
  writeSave(storage, slot, null);
}
