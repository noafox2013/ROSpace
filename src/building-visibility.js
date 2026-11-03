import * as THREE from 'three';
import { TERRAIN_FADE_END } from './planet-horizon.js';

// Measure to the building's bounds, so a large building or tall tower remains
// visible while any part is nearby. A small margin prevents boundary flicker.
export function createBuildingVisibility(buildings, range = TERRAIN_FADE_END) {
  const entries = buildings.map(group => ({ group, bounds: new THREE.Box3().setFromObject(group) }));
  return cameraPosition => {
    for (const { group, bounds } of entries) {
      const distance = bounds.distanceToPoint(cameraPosition);
      if (distance > range) group.visible = false;
      else if (distance < range - 20) group.visible = true;
    }
  };
}
