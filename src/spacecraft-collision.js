// Convex footprints keep the tapered nose and swept wings accessible up close.
export function createSpacecraftCollision(location, ground, terrainHeight) {
  const volumes = [];
  function volume(points, bottom, top) {
    const area = points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0);
    if (area < 0) points.reverse();
    const planes = points.map((p, i) => {
      const q = points[(i + 1) % points.length], dx = q[0] - p[0], dz = q[1] - p[1], length = Math.hypot(dx, dz);
      return { x: dz / length, z: -dx / length, px: p[0], pz: p[1] };
    });
    volumes.push({ planes, bottom: ground + bottom, top: ground + top });
  }
  function box(x, z, w, d, bottom, top) {
    volume([[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]], bottom, top);
  }
  const sections = [[-7, 1.7], [-6.5, 2.15], [-4.5, 2.65], [-1, 2.6], [1.7, 2.5], [3.8, 2.03], [5.6, 1.25], [7.6, 0.18], [8, 0.045]];
  volume([...sections.map(([z, w]) => [w, z]), ...sections.slice().reverse().map(([z, w]) => [-w, z])], 1.45, 4.75);
  volume(Array.from({ length: 20 }, (_, i) => [Math.cos(i * Math.PI / 10) * 1.8, 2 + Math.sin(i * Math.PI / 10) * 2.25]), 4.1, 5.82);
  for (const side of [-1, 1]) {
    box(side * 4.15, -4.35, 2.1, 7.8, 2.03, 4.2);
    volume([[side * 2, 2], [side * 7, -4], [side * 7, -6], [side * 2, -5]], 2.4, 2.95);
    box(side * 2.65, -4.8, 0.5, 0.65, -0.5, 2.1);
  }
  box(0, 4.8, 0.5, 0.8, -0.5, 2.1);
  box(-2.95, 2, 0.16, 0.9, terrainHeight(location.x - 2.95, location.z + 2) - ground, 4.7);

  return function resolve(player, flightHeight, previous) {
    const radius = 0.4, headOffset = 1.275;
    let correctedHeight = flightHeight;
    // Repeat to resolve contacts where the wing, engine and hull overlap.
    for (let pass = 0; pass < 3; pass++) for (const shape of volumes) {
      const foot = player.y - 1, head = player.y + headOffset;
      if (foot > shape.top + 0.001 || head < shape.bottom) continue;
      let nearest = null, distance = -Infinity, outside = false;
      for (const plane of shape.planes) {
        const d = plane.x * (player.x - location.x - plane.px) + plane.z * (player.z - location.z - plane.pz);
        if (d >= radius) { outside = true; break; }
        if (d > distance) { distance = d; nearest = plane; }
      }
      if (outside) continue;
      if (previous.y - 1 >= shape.top - 0.015 && foot <= shape.top) {
        player.y = shape.top + 1;
        correctedHeight = Math.max(0, shape.top - terrainHeight(player.x, player.z));
      } else if (previous.y + headOffset <= shape.bottom + 0.015 && head >= shape.bottom) {
        player.y = shape.bottom - headOffset - 0.001;
        correctedHeight = Math.max(0, player.y - 1 - terrainHeight(player.x, player.z));
      } else {
        player.x += nearest.x * (radius - distance + 0.001);
        player.z += nearest.z * (radius - distance + 0.001);
      }
    }
    return correctedHeight;
  };
}
