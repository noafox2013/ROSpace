import { baseLocation } from './base.js';
import { abandonedLocation } from './abandoned-building.js';

// Stable random cells extend across the entire explorable world.
const cellSize = 560;
const cells = new Map();
function random(x, z, seed) {
  const value = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

function duneInCell(x, z) {
  const key = `${x},${z}`;
  if (cells.has(key)) return cells.get(key);
  const angle = -0.2 + (random(x, z, 1) - 0.5) * 0.5;
  const height = 27 + random(x, z, 2) * 17;
  const dune = {
    x: (x + (random(x, z, 3) - 0.5) * 0.55) * cellSize,
    z: (z + (random(x, z, 4) - 0.5) * 0.55) * cellSize,
    height,
    length: 120 + random(x, z, 5) * 60,
    windward: height * (4.5 + random(x, z, 6)),
    lee: height * (2.8 + random(x, z, 7) * 0.4),
    phase: random(x, z, 8) * Math.PI * 2,
    cos: Math.cos(angle), sin: Math.sin(angle),
  };
  const radius = Math.hypot(dune.windward + 34, dune.length);
  const nearBuilding = [baseLocation, abandonedLocation].some(location =>
    Math.hypot(dune.x - location.x, dune.z - location.z) < radius + 35);
  const result = nearBuilding || random(x, z, 9) < 0.18 ? null : dune;
  // Bound memory while travelling; evicted cells regenerate identically.
  if (cells.size >= 256) cells.delete(cells.keys().next().value);
  cells.set(key, result);
  return result;
}

export function duneHeight(x, z) {
  let height = 0;
  const cellX = Math.round(x / cellSize);
  const cellZ = Math.round(z / cellSize);
  for (let iz = cellZ - 1; iz <= cellZ + 1; iz += 1) {
    for (let ix = cellX - 1; ix <= cellX + 1; ix += 1) {
      const dune = duneInCell(ix, iz);
      if (!dune) continue;
      const dx = x - dune.x;
      const dz = z - dune.z;
      const along = (dz * dune.cos - dx * dune.sin) / dune.length;
      if (Math.abs(along) >= 1) continue;
      // The crest bows downwind at the ends, with small, non-repeating bends.
      const crest = along * along * 26 + Math.sin(along * 4 + dune.phase) * 7;
      const across = dx * dune.cos + dz * dune.sin - crest;
      const width = across < 0 ? dune.windward : dune.lee;
      const t = Math.abs(across) / width;
      if (t >= 1) continue;
      const envelope = Math.cos(along * Math.PI / 2) ** 2;
      const profile = across < 0
        ? (1 - t * t) ** 2
        : (1 - t) ** 1.15 * (1 - t * t);
      // A maximum avoids unnaturally steep slopes where neighbouring dunes meet.
      height = Math.max(height, dune.height * envelope * profile);
    }
  }
  return height;
}
