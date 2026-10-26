import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const baseLocation = { x: 0, z: -32, ground: -1.05 };
export const baseLayout = { scale: 1.5, heightScale: 1.5, halfSize: 9, height: 6.9 };
// A short indoor boom stays within the walls and below the ceiling, even at the doorway.
export function positionBaseCamera(player, yaw, target) {
  const margin = baseLayout.halfSize - 0.4;
  target.set(
    THREE.MathUtils.clamp(player.x - Math.sin(yaw) * 2.6, baseLocation.x - margin, baseLocation.x + margin),
    Math.min(player.y + 1.85, baseLocation.ground + baseLayout.height - 0.45),
    THREE.MathUtils.clamp(player.z - Math.cos(yaw) * 2.6, baseLocation.z - margin, baseLocation.z + margin),
  );
}

export const catalog = [
  { id: 'passkey', name: 'Pass-Key · Verlassenes Gebäude', english: 'Pass key · Abandoned building', stones: 20, crystals: 8 },
  { id: 'wormhorn', name: 'Wurmhorn', english: 'Worm horn', stones: 0, crystals: 30 },
  { id: 'medical', name: 'Medizinpaket · +50 Leben', english: 'Medical kit · +50 health', stones: 5, crystals: 0 },
  { id: 'laser', name: 'Laser-Upgrade · +35 % Schaden', english: 'Laser upgrade · +35% damage', stones: 10, crystals: 3 },
  { id: 'jetpack', name: 'Jetpack-Upgrade · +1 m/s Steiggeschwindigkeit', english: 'Jetpack upgrade · +1 m/s climb speed', stones: 15, crystals: 4 },
  { id: 'scanner', name: 'Scanner-Upgrade · +50 m Reichweite', english: 'Scanner upgrade · +50 m range', stones: 12, crystals: 4 },
];
export function purchase(state, id) {
  const item = catalog.find(item => item.id === id);
  if (!item) return 'invalid';
  if ((id === 'medical' && state.health >= 100) || (id === 'laser' && state.laserLevel >= 3)
    || (id === 'jetpack' && state.jetpackLevel >= 2)
    || (id === 'scanner' && state.scannerLevel >= 3)
    || (id === 'passkey' && state.passKey >= 1)) return 'maximum';
  if (state.stones < item.stones || state.crystals < item.crystals) return 'funds';
  state.stones -= item.stones;
  state.crystals -= item.crystals;
  if (id === 'medical') state.health = Math.min(100, state.health + 50);
  else if (id === 'laser') state.laserLevel = (state.laserLevel || 0) + 1;
  else if (id === 'wormhorn') state.wormHorns = (state.wormHorns || 0) + 1;
  else if (id === 'scanner') state.scannerLevel = (state.scannerLevel || 0) + 1;
  else if (id === 'passkey') state.passKey = 1;
  else state.jetpackLevel = (state.jetpackLevel || 0) + 1;
  return 'success';
}

export function createPlanetaryBase(scene) {
  const group = new THREE.Group();
  group.name = 'planetary-base';
  group.scale.set(baseLayout.scale, baseLayout.heightScale, baseLayout.scale);
  group.position.set(baseLocation.x, baseLocation.ground, baseLocation.z);
  scene.add(group);
  function panelTexture(floor = false) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = floor ? '#475052' : '#a9afaa'; ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 128) for (let x = 0; x < 512; x += 128) {
      ctx.fillStyle = floor ? '#242e30' : '#65716d';
      ctx.fillRect(x, y, 128, 3); ctx.fillRect(x, y, 3, 128);
      ctx.fillStyle = floor ? '#657171' : '#d3d7cc';
      ctx.fillRect(x + 5, y + 5, 120, 1);
      for (const dx of [10, 116]) for (const dy of [10, 116]) {
        ctx.fillStyle = '#56605b'; ctx.fillRect(x + dx, y + dy, 3, 3);
      }
    }
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff06' : '#00000008';
      ctx.fillRect((i * 137) % 512, (i * 79 + Math.floor(i / 7)) % 512, 2, 1);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const wallTexture = panelTexture();
  const floorTexture = panelTexture(true); floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping; floorTexture.repeat.set(3, 3);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xadb6b2, map: floorTexture, roughness: 0.82, metalness: 0.25 });
  const shell = new THREE.MeshStandardMaterial({ color: 0xd0d0bf, map: wallTexture, roughness: 0.8, metalness: 0.22 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x263339, roughness: 0.6, metalness: 0.5 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xd18d42, roughness: 0.5, metalness: 0.4 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x78ffe4, emissive: 0x36dfc6, emissiveIntensity: 1.4 });
  const walls = [];
  let furnitureHeight = false;
  function box(w, h, d, x, y, z, material, collision = false) {
    if (furnitureHeight) { h /= baseLayout.heightScale; y /= baseLayout.heightScale; }
    // Small trim stays lightweight; only substantial housings need beveled edges.
    const geometry = Math.min(w, h, d) > 0.22
      ? new RoundedBoxGeometry(w, h, d, 1, Math.min(0.045, w / 5, h / 5, d / 5))
      : new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    if (collision) walls.push({ x, z, w, d, top: y + h / 2, bottom: y - h / 2 });
    return mesh;
  }
  box(12, 0.16, 12, 0, -0.08, 0, floorMaterial);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x8fbbc2, roughness: 0.12, metalness: 0.15,
    transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const x = side * 6;
    box(0.4, 1.8, 12, x, 0.9, 0, shell, true);
    box(0.4, 1.1, 12, x, 4.05, 0, shell, true);
    for (const z of [-4, 4]) box(0.4, 1.7, 4, x, 2.65, z, shell, true);
    const pane = box(0.045, 1.7, 4, x, 2.65, 0, glass, true); pane.castShadow = false;
    for (const z of [-2, 0, 2]) box(0.55, 1.85, 0.08, x, 2.65, z, dark);
    for (const y of [1.78, 3.52]) box(0.55, 0.09, 4.2, x, y, 0, dark);
  }
  box(12, 4.6, 0.4, 0, 2.3, -6, shell, true);
  box(4, 4.6, 0.4, -4, 2.3, 6, shell, true);
  box(4, 4.6, 0.4, 4, 2.3, 6, shell, true);
  const lintel = box(4, 1.1, 0.4, 0, 4.05, 6, dark);
  const roof = box(12.6, 0.35, 12.6, 0, 4.75, 0, shell);
  const rooftop = new THREE.Group(); group.add(rooftop);
  const panel = box(7, 0.12, 4, 0, 5, -1, dark); rooftop.attach(panel);
  const solar = new THREE.MeshStandardMaterial({ color: 0x152b48, metalness: 0.65, roughness: 0.28 });
  const cells = box(6.8, 0.035, 3.8, 0, 5.08, -1, solar); rooftop.attach(cells);
  for (let x = -3.3; x <= 3.4; x += 0.55) {
    const line = box(0.018, 0.012, 3.8, x, 5.11, -1, shell); rooftop.attach(line);
  }
  for (let z = -2.8; z < 1; z += 0.55) {
    const line = box(6.8, 0.012, 0.018, 0, 5.11, z, shell); rooftop.attach(line);
  }
  box(0.12, 2.2, 0.12, 4.8, 5.8, -4.7, trim);
  box(0.22, 0.22, 0.22, 4.8, 6.95, -4.7, glow);
  for (const x of [-2.1, 2.1]) box(0.12, 3.5, 0.16, x, 1.75, 6.25, glow);
  for (const x of [-5.7, 5.7]) box(0.06, 0.12, 10, x, 0.15, 0, glow);
  for (const x of [-1.25, 1.25]) for (let z = -3; z < 6; z += 1.2) box(0.045, 0.012, 0.6, x, 0.014, z, trim);
  // Furniture stays at human height while the building gains headroom.
  furnitureHeight = true;
  // Terminal inside, facing the open doorway.
  box(1.9, 1.15, 0.9, 0, 0.575, -3.8, dark, true);
  box(2, 0.16, 1, 0, 1.2, -3.8, trim);
  box(1.9, 1.1, 0.18, 0, 1.9, -4.1, dark);
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 512; screenCanvas.height = 256;
  const screenContext = screenCanvas.getContext('2d');
  screenContext.fillStyle = '#0c2426'; screenContext.fillRect(0, 0, 512, 256);
  screenContext.fillStyle = '#78e9c4'; screenContext.font = 'bold 29px monospace';
  screenContext.fillText('MESA TRADE NETWORK', 24, 48);
  screenContext.fillStyle = '#b3c7bb'; screenContext.font = '19px monospace';
  screenContext.fillText('SUPPLIES / EQUIPMENT', 24, 94);
  screenContext.fillText('LOCAL EXCHANGE  //  ONLINE', 24, 132);
  screenContext.fillStyle = '#2e7667'; screenContext.fillRect(24, 164, 464, 2);
  screenContext.fillStyle = '#78e9c4'; screenContext.fillText('[F] CONNECT TO TERMINAL', 24, 216);
  const screenTexture = new THREE.CanvasTexture(screenCanvas); screenTexture.colorSpace = THREE.SRGBColorSpace;
  box(1.65, 0.85, 0.025, 0, 1.9, -3.995, new THREE.MeshBasicMaterial({ map: screenTexture }));
  const keyboard = box(1.4, 0.045, 0.4, 0, 1.31, -3.55, dark); keyboard.rotation.x = 0.12;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 12; col++) box(0.075, 0.015, 0.065, -0.55 + col * 0.1, 1.35, -3.42 - row * 0.1, shell);
  furnitureHeight = false;
  // Recessed structural frames, door guides and a sheltered entrance.
  for (const x of [-6.12, -2.15, 2.15, 6.12]) box(0.18, 4.6, 0.3, x, 2.3, 6.16, dark);
  for (const side of [-1, 1]) {
    for (const z of [-5.7, -2.5, 2.5, 5.7]) box(0.18, 4.6, 0.2, side * 6.26, 2.3, z, dark);
    box(0.18, 0.25, 12, side * 6.25, 0.18, 0, trim);
    box(3.6, 0.2, 0.25, side * 4, 0.17, 6.25, trim);
    const door = box(0.14, 3.3, 0.26, side * 2.23, 1.7, 6.22, shell);
    for (let y = 0.3; y < 3.3; y += 0.45) box(0.2, 0.04, 0.28, side * 2.23, y, 6.23, dark);
  }
  const canopy = box(5.1, 0.18, 1.6, 0, 3.55, 6.65, shell); rooftop.attach(canopy);
  for (const x of [-1.8, 1.8]) {
    const lamp = box(0.55, 0.045, 0.18, x, 3.43, 6.5, glow); rooftop.attach(lamp);
  }
  // Exterior life-support canisters with protective hoops and connecting pipes.
  for (const z of [-2.4, 0.3]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 2.7, 24), shell);
    tank.position.set(7.35, 1.5, z); tank.castShadow = true; group.add(tank);
    walls.push({ x: 7.35, z, w: 1.6, d: 1.6, top: 3, bottom: 0 });
    for (const y of [0.25, 2.75]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.65, 20, 12), dark);
      cap.scale.y = 0.35; cap.position.set(7.35, y, z); group.add(cap);
    }
    for (const y of [0.6, 2.4]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.67, 0.045, 8, 24), trim);
      hoop.rotation.x = Math.PI / 2; hoop.position.set(7.35, y, z); group.add(hoop);
    }
    box(0.08, 0.08, 1.2, 6.6, 2.8, z, dark);
  }
  const ventUnit = box(1.5, 0.8, 1.7, -4.6, 5.3, -3.7, dark); rooftop.attach(ventUnit);
  for (let z = -4.4; z < -3; z += 0.16) {
    const vane = box(1.35, 0.035, 0.04, -4.6, 5.72, z, shell); rooftop.attach(vane);
  }
  // Interior lockers, workbench, storage and ceiling light fixtures.
  furnitureHeight = true;
  for (const x of [-4.7, -3.6]) {
    box(0.95, 2.5, 0.75, x, 1.25, -5.35, dark, true);
    box(0.85, 2.3, 0.04, x, 1.25, -4.94, shell);
    box(0.06, 0.35, 0.05, x + 0.26, 1.25, -4.9, trim);
    for (let i = 0; i < 4; i++) box(0.5, 0.025, 0.012, x, 2.15 - i * 0.085, -4.91, dark);
  }
  box(2.4, 0.12, 1.0, 4.3, 1.05, -4.5, shell, true);
  for (const x of [3.3, 5.3]) box(0.1, 1, 0.8, x, 0.5, -4.5, dark, true);
  for (const x of [3.5, 4.8]) {
    box(0.95, 0.75, 0.85, x, 0.375, 3.8, dark, true);
    box(0.95, 0.08, 0.9, x, 0.79, 3.8, trim);
    for (const dx of [-0.32, 0.32]) box(0.065, 0.7, 0.91, x + dx, 0.4, 3.8, shell);
  }
  const benches = [];
  for (const side of [-1, 1]) {
    const x = side * 4.9;
    box(0.9, 0.14, 2.7, x, 0.51, 1, dark, true);
    box(0.82, 0.08, 2.6, x, 0.6, 1, shell);
    box(0.12, 0.85, 2.7, x + side * 0.43, 1.0, 1, shell, true);
    for (const z of [-0.1, 2.1]) box(0.65, 0.45, 0.12, x, 0.225, z, dark);
    benches.push({
      seat: new THREE.Vector3(x * baseLayout.scale - side * 0.4, baseLocation.ground + 1.03, baseLocation.z + baseLayout.scale),
      stand: new THREE.Vector3(x * baseLayout.scale - side * 1.6, baseLocation.ground + 1, baseLocation.z + baseLayout.scale),
      marker: new THREE.Vector3(x * baseLayout.scale, baseLocation.ground + 2.1, baseLocation.z + baseLayout.scale),
      yaw: -side * Math.PI / 2,
    });
  }
  furnitureHeight = false;
  for (const x of [-3.5, 3.5]) for (const z of [-2, 2]) {
    const fixture = box(1.5, 0.12, 0.32, x, 4.52, z, dark); rooftop.attach(fixture);
    const diffuser = box(1.3, 0.025, 0.2, x, 4.44, z, glow); rooftop.attach(diffuser);
  }
  const labelCanvas = document.createElement('canvas'); labelCanvas.width = 512; labelCanvas.height = 128;
  const ctx = labelCanvas.getContext('2d'); ctx.fillStyle = '#142328'; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#83ffe2'; ctx.font = 'bold 42px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MESA · TRADING', 256, 79);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(labelCanvas) }));
  label.position.set(0, 3.95, 6.23); group.add(label);
  const light = new THREE.PointLight(0xd2e4d8, 90, 26, 2); light.position.set(0, 3.8, 0); group.add(light);
  // Batch static construction by material; keep the cutaway roof and glass separate.
  for (const parent of [group, rooftop]) {
    const batches = new Map();
    for (const mesh of [...parent.children]) {
      if (!mesh.isMesh || mesh === roof || mesh === lintel || mesh.material.transparent) continue;
      const key = `${mesh.material.uuid}:${mesh.castShadow}:${mesh.receiveShadow}`;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(mesh);
    }
    for (const meshes of batches.values()) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map(mesh => {
        mesh.updateMatrix();
        const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        return geometry.applyMatrix4(mesh.matrix);
      });
      const geometry = mergeGeometries(geometries);
      for (const item of geometries) item.dispose();
      if (!geometry) continue;
      const merged = new THREE.Mesh(geometry, meshes[0].material);
      merged.castShadow = meshes[0].castShadow; merged.receiveShadow = meshes[0].receiveShadow;
      for (const mesh of meshes) { parent.remove(mesh); mesh.geometry.dispose(); }
      parent.add(merged);
    }
  }
  const terminalPosition = new THREE.Vector3(0, baseLocation.ground + 1, baseLocation.z - 3.8 * baseLayout.scale);
  function inside(player) { return Math.abs(player.x - baseLocation.x) < baseLayout.halfSize - 0.2
    && Math.abs(player.z - baseLocation.z) < baseLayout.halfSize - 0.2; }
  return {
    group, terminalPosition, benches,
    nearestBench(player) {
      if (!inside(player) || Math.abs(player.y - (baseLocation.ground + 1)) > 1) return null;
      return benches.find(bench => Math.hypot(player.x - bench.seat.x, player.z - bench.seat.z) < 2.6) || null;
    },
    inside,
    canTrade: player => Math.hypot(player.x, player.z - terminalPosition.z) < 2.6
      && Math.abs(player.y - terminalPosition.y) < 2 && inside(player),
    resolve(player, flightHeight, previousFlightHeight = flightHeight) {
      const foot = player.y - 1 - baseLocation.ground;
      for (const wall of walls) {
        if (foot > wall.top * baseLayout.heightScale || foot + 2 < wall.bottom * baseLayout.heightScale) continue;
        const minX = baseLocation.x + (wall.x - wall.w / 2) * baseLayout.scale - 0.4;
        const maxX = baseLocation.x + (wall.x + wall.w / 2) * baseLayout.scale + 0.4;
        const minZ = baseLocation.z + (wall.z - wall.d / 2) * baseLayout.scale - 0.4;
        const maxZ = baseLocation.z + (wall.z + wall.d / 2) * baseLayout.scale + 0.4;
        if (player.x <= minX || player.x >= maxX || player.z <= minZ || player.z >= maxZ) continue;
        const edges = [ [player.x - minX, 'x', minX], [maxX - player.x, 'x', maxX],
          [player.z - minZ, 'z', minZ], [maxZ - player.z, 'z', maxZ] ];
        edges.sort((a, b) => a[0] - b[0]); player[edges[0][1]] = edges[0][2];
      }
      if (inside(player)) {
        const roofTop = 4.925 * baseLayout.heightScale;
        const ceilingLimit = 4.575 * baseLayout.heightScale - 2.275;
        if (previousFlightHeight >= roofTop - 0.001 && flightHeight < roofTop) return roofTop;
        if (previousFlightHeight < roofTop && flightHeight > ceilingLimit && flightHeight < roofTop) return ceilingLimit;
      }
      return flightHeight;
    },
  };
}
