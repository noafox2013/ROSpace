import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// 180² + 240² = 300² from the starting position.
export const abandonedLocation = { x: 180, z: 2.15 - 240, ground: -1.05 };
export function createAbandonedBuilding(scene) {
  const group = new THREE.Group(); group.name = 'abandoned-building';
  group.position.set(abandonedLocation.x, abandonedLocation.ground, abandonedLocation.z);
  scene.add(group);
  // Fine deterministic surface wear breaks up reflections without external textures.
  const pixels = new Uint8Array(128 * 128 * 4);
  let seed = 37;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const grain = 166 + (seed >>> 26);
    const scratch = x % 31 === 0 && y % 19 < 12 ? 42 : 0;
    const index = (y * 128 + x) * 4;
    pixels[index] = pixels[index + 1] = pixels[index + 2] = grain - scratch;
    pixels[index + 3] = 255;
  }
  const wear = new THREE.DataTexture(pixels, 128, 128);
  wear.wrapS = wear.wrapT = THREE.RepeatWrapping; wear.repeat.set(3, 3); wear.needsUpdate = true;
  const concrete = new THREE.MeshStandardMaterial({ color: 0x909a96, metalness: 0.52, roughness: 0.78, map: wear, bumpMap: wear, bumpScale: 0.018 });
  const rust = new THREE.MeshStandardMaterial({ color: 0x654432, metalness: 0.35, roughness: 0.94, map: wear });
  const dark = new THREE.MeshStandardMaterial({ color: 0x202b30, metalness: 0.7, roughness: 0.6, map: wear });
  const trim = new THREE.MeshStandardMaterial({ color: 0xbaa574, metalness: 0.4, roughness: 0.85, map: wear });
  const pale = new THREE.MeshStandardMaterial({ color: 0xb7beb8, metalness: 0.5, roughness: 0.67, map: wear });
  const glass = new THREE.MeshStandardMaterial({ color: 0x17333d, metalness: 0.8, roughness: 0.26 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x72b6b3, emissive: 0x376767, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.5 });
  const walls = [];
  function box(x, y, z, w, h, d, material = concrete, collides = false) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 1, Math.min(0.08, w / 5, h / 5, d / 5)), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    if (collides) walls.push({ x, z, w, d, bottom: y - h / 2, top: y + h / 2, mesh });
    return mesh;
  }
  box(0, -0.18, 0, 13, 0.36, 17);
  box(-6, 3.5, 0, 0.6, 7, 16, concrete, true);
  box(6, 3.5, 0, 0.6, 7, 16, concrete, true);
  box(0, 3.5, -8, 12, 7, 0.6, concrete, true);
  box(-3.8, 3.5, 8, 4.4, 7, 0.6, concrete, true);
  box(3.8, 3.5, 8, 4.4, 7, 0.6, concrete, true);
  box(0, 5.5, 8, 3.2, 3, 0.6, concrete, true);
  const door = box(0, 2, 8, 3.2, 4, 0.4, rust, true);
  box(0, 7.15, 0, 12.8, 0.5, 16.8, dark);
  // Layered pressure hull: recessed seams, armored ribs and sand-stained lower skirt.
  for (const side of [-1, 1]) {
    box(side * 6.18, 0.48, 0, 0.7, 0.9, 16.5, rust);
    for (let bay = 0; bay < 4; bay++) {
      const z = -6 + bay * 4;
      box(side * 6.34, 3.75, z, 0.22, 5.8, 3.65, bay % 3 === 0 ? pale : concrete);
      box(side * 6.48, 3.8, z, 0.12, 1.35, 2.65, dark);
      box(side * 6.56, 3.8, z, 0.08, 1.03, 2.28, glass);
      box(side * 6.61, 3.8, z, 0.08, 1.2, 0.08, pale);
      box(side * 6.55, 1.25, z, 0.12, 0.12, 2.9, trim);
      for (let rivet = 0; rivet < 3; rivet++) {
        box(side * 6.51, 5.8, z - 1 + rivet, 0.09, 0.09, 0.09, dark);
      }
    }
    for (let z = -8; z <= 8; z += 4) {
      box(side * 6.52, 3.45, z, 0.65, 6.9, 0.35, dark);
      const brace = box(side * 6.75, 1.3, z, 0.35, 2.9, 0.5, pale);
      brace.rotation.z = side * 0.2;
    }
    box(side * 6.45, 6.65, 0, 0.3, 0.22, 16.4, pale);
    // Exposed coolant pipe, elbow joints and service brackets.
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 15, 10), rust);
    pipe.rotation.x = Math.PI / 2; pipe.position.set(side * 6.75, 2.3, 0); group.add(pipe);
    for (const z of [-6, -2, 2, 6]) box(side * 6.75, 2.3, z, 0.42, 0.42, 0.12, dark);
  }
  // A heavy recessed airlock with raised frame and individual locking hardware.
  for (const side of [-1, 1]) {
    box(side * 2.03, 2.3, 8.5, 0.65, 4.6, 0.9, dark);
    box(side * 1.98, 2.3, 9, 0.18, 4.4, 0.13, pale);
    box(side * 4.15, 3.6, 8.38, 2.8, 5.7, 0.18, concrete);
    box(side * 4.1, 1.05, 8.52, 2.7, 0.42, 0.14, trim);
    box(side * 4.1, 5.7, 8.55, 2.1, 0.09, 0.12, cyan);
    for (let i = 0; i < 5; i++) box(side * 4.1, 2.2 + i * 0.2, 8.52, 1.6, 0.08, 0.12, dark);
  }
  box(0, 4.55, 8.55, 4.65, 0.65, 1.1, dark);
  box(0, 4.3, 9.08, 3, 0.08, 0.1, cyan);
  box(0, 0.02, 9, 4.4, 0.08, 2, dark);
  for (let i = -3; i <= 3; i++) box(i * 0.5, 0.07, 9.4, 0.23, 0.02, 0.6, trim);
  // Door ornaments are children, so all disappear together when the key unlocks it.
  function doorDetail(x, y, z, w, h, d, material) {
    const part = box(x, y, z, w, h, d, material);
    door.attach(part);
    return part;
  }
  for (const side of [-1, 1]) {
    doorDetail(side * 0.78, 2.05, 8.26, 1.43, 3.7, 0.15, dark);
    doorDetail(side * 0.78, 2.12, 8.36, 1.12, 2.9, 0.12, pale);
    for (const y of [0.7, 3.35]) doorDetail(side * 0.8, y, 8.45, 1.18, 0.16, 0.12, rust);
    doorDetail(side * 0.18, 2, 8.48, 0.12, 0.65, 0.15, dark);
  }
  box(2.5, 2.1, 9.05, 0.6, 0.9, 0.18, dark);
  const lamp = box(2.5, 2.25, 9.17, 0.27, 0.32, 0.04, new THREE.MeshStandardMaterial({ color: 0xff7355, emissive: 0xff3a15, emissiveIntensity: 0.7 }));
  // Roof equipment: radiator bank, damaged solar arrays and long-range antenna.
  box(-2.7, 7.65, -2, 3.8, 0.6, 6, dark);
  for (let i = 0; i < 12; i++) box(-2.7, 8.02, -4.7 + i * 0.48, 3.5, 0.3, 0.08, pale);
  const solarMaterial = new THREE.MeshStandardMaterial({ color: 0x1d3449, metalness: 0.65, roughness: 0.35, map: wear });
  for (let bay = 0; bay < 2; bay++) {
    const panel = new THREE.Group(); panel.position.set(3, 7.85, -3 + bay * 6); panel.rotation.z = bay ? -0.18 : 0.14;
    const frame = new THREE.Mesh(new RoundedBoxGeometry(4, 0.15, 4.8, 1, 0.04), dark); panel.add(frame);
    for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
      if (bay === 1 && row + column > 5) continue;
      const cell = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 1.08), solarMaterial);
      cell.position.set(-1.43 + column * 0.95, 0.1, -1.72 + row * 1.14); panel.add(cell);
    }
    group.add(panel);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.13, 4.8, 10), dark);
  mast.position.set(-4.4, 9.8, -6); mast.rotation.z = 0.12; group.add(mast);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.8), pale);
  dish.material = pale.clone(); dish.material.side = THREE.DoubleSide;
  dish.position.set(-4.7, 10.5, -6); dish.rotation.z = -0.8; group.add(dish);
  box(-4.7, 10.8, -6, 2.6, 0.07, 0.07, dark);
  // Cargo racks and a dead control console give the interior a clear purpose.
  for (const side of [-1, 1]) {
    box(side * 4.65, 1.9, -3.8, 0.12, 3.8, 4.6, dark);
    for (const y of [0.2, 1.7, 3.3]) box(side * 4.1, y, -3.8, 1.25, 0.1, 4.6, dark);
    for (let i = 0; i < 3; i++) {
      box(side * 4.1, 0.85, -5.2 + i * 1.4, 1.05, 1.1, 1.15, trim);
      box(side * 4.1, 0.9, -4.61 + i * 1.4, 0.5, 0.18, 0.03, dark);
    }
  }
  // Rugged workstation: recessed display, sloped controls and an open power bay.
  box(0, 0.15, -6, 3.45, 0.3, 1.25, dark);
  box(0, 1.05, -6.15, 3.1, 1.9, 0.85, concrete, true);
  // Offset the monitor housing from the cabinet face to avoid coplanar surfaces.
  box(0, 2.1, -5.94, 3.3, 1.4, 0.55, dark);
  box(0, 2.12, -5.69, 2.95, 1.08, 0.11, pale);
  box(0, 2.12, -5.61, 2.64, 0.82, 0.055, glass);
  const screenMaterial = new THREE.MeshStandardMaterial({ color: 0x193d38, emissive: 0x75c9ab, emissiveIntensity: 0.5, roughness: 0.45, metalness: 0.2 });
  const brokenScreen = box(0, 2.12, -5.57, 2.52, 0.72, 0.025, screenMaterial);
  if (typeof document !== 'undefined') {
    const display = document.createElement('canvas'); display.width = 1024; display.height = 256;
    const ctx = display.getContext('2d');
    ctx.fillStyle = '#071912'; ctx.fillRect(0, 0, 1024, 256);
    ctx.font = 'bold 30px monospace'; ctx.fillStyle = '#83bda1'; ctx.fillText('KEPLER / 07   EMERGENCY ARCHIVE', 24, 42);
    ctx.font = '22px monospace';
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i === 2 ? '#c18d52' : '#4e8a70';
      ctx.fillText(['> MAIN POWER ........ OFFLINE', '> CREW STATUS ....... EVACUATED', '! COOLANT SYSTEM FAILURE', '> RECOVERING LOG 184 ...', '> DATA INTEGRITY: 12%', '> LOCAL ARCHIVE AVAILABLE'][i], 24, 82 + i * 27);
    }
    ctx.fillStyle = '#b5e2c210'; for (let y = 0; y < 256; y += 4) ctx.fillRect(0, y, 1024, 1);
    const texture = new THREE.CanvasTexture(display); texture.colorSpace = THREE.SRGBColorSpace;
    screenMaterial.map = texture; screenMaterial.emissiveMap = texture;
  }
  for (let i = 0; i < 5; i++) {
    const crack = box(-0.4 + i * 0.17, 2.15, -5.54, 0.018, 0.5 + i * 0.035, 0.012, dark);
    crack.rotation.z = -0.8 + i * 0.4;
  }
  const controls = box(0, 1.3, -5.3, 3.1, 0.16, 0.85, dark); controls.rotation.x = 0.16;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 11; col++) {
    const key = box(0, 0, 0, 0.13, 0.045, 0.12, col % 7 === 0 ? trim : pale);
    controls.add(key);
    key.position.set(-1.05 + col * 0.18, 0.115, -0.2 + row * 0.18);
  }
  for (const x of [-1.42, 1.42]) for (const y of [1.62, 2.65]) box(x, y, -5.62, 0.06, 0.06, 0.04, rust);
  box(1.1, 0.75, -5.7, 0.65, 0.7, 0.1, dark);
  box(1.1, 0.75, -5.63, 0.5, 0.5, 0.03, rust);
  for (let i = 0; i < 3; i++) box(0.93 + i * 0.16, 0.78, -5.59, 0.06, 0.3, 0.04, trim);
  const cover = box(1.5, 0.48, -5.27, 0.55, 0.64, 0.045, concrete); cover.rotation.set(0.3, -0.6, 0.25);
  for (let i = 0; i < 3; i++) {
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(1 + i * 0.1, 0.85, -5.57), new THREE.Vector3(1.25 + i * 0.13, 0.55, -5.25), new THREE.Vector3(1.1 + i * 0.15, 0.24, -5.3)
    ]), 12, 0.025, 5, false), i === 1 ? rust : dark);
    group.add(cable);
  }
  // Reuse a small particle pool for irregular electrical bursts from one exposed connector.
  const sparkOrigin = new THREE.Vector3(1.1, 0.78, -5.54);
  const sparks = Array.from({ length: 32 }, () => ({ position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, duration: 1 }));
  const sparkPositions = new Float32Array(sparks.length * 6);
  const sparkColors = new Float32Array(sparks.length * 6);
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3).setUsage(THREE.DynamicDrawUsage));
  sparkGeometry.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3).setUsage(THREE.DynamicDrawUsage));
  const sparkMesh = new THREE.LineSegments(sparkGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  sparkMesh.name = 'terminal-sparks'; sparkMesh.frustumCulled = false; group.add(sparkMesh);
  const sparkLight = new THREE.PointLight(0xffbc68, 0, 3, 2); sparkLight.position.copy(sparkOrigin); group.add(sparkLight);
  let sparkWait = 0.15;
  let terminalTime = 0;
  for (const x of [-4.7, 4.7]) box(x, 6.65, 0, 0.08, 0.06, 13.5, cyan);
  // Localized rust leaks rather than uniformly brown walls.
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? -1 : 1;
    box(side * 6.49, 5.2 - i % 3 * 0.4, -6.5 + (i * 2.3) % 13, 0.035, 0.6 + i % 4 * 0.24, 0.06 + i % 3 * 0.06, rust);
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#202b30'; context.fillRect(0, 0, 1024, 256);
    context.fillStyle = '#c5c5ad'; context.font = 'bold 94px monospace'; context.textAlign = 'center';
    context.fillText('KEPLER / 07', 512, 112);
    context.fillStyle = '#c8945e'; context.font = '32px monospace'; context.fillText('REMOTE SURVEY OUTPOST · OFFLINE', 512, 184);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    // Mount the plaque ahead of the raised door and its locking hardware.
    box(0, 5.85, 8.65, 5.25, 1.45, 0.12, dark);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 }));
    sign.position.set(0, 5.85, 8.73); group.add(sign);
  }
  const interiorLight = new THREE.PointLight(0x9bb8b2, 15, 15, 2); interiorLight.position.set(0, 5.5, 0); group.add(interiorLight);
  function inside(player) {
    return Math.abs(player.x - group.position.x) < 5.7 && Math.abs(player.z - group.position.z) < 7.7;
  }
  function nearDoor(player) { return Math.hypot(player.x - group.position.x, player.z - group.position.z - 8) < 5 && player.y - abandonedLocation.ground < 4; }
  let unlockedTarget = false;
  let opening = 0;
  function setUnlocked(unlocked) {
    unlockedTarget = unlocked;
    if (!unlocked) { opening = 0; door.position.y = 2; }
    lamp.material.color.set(unlocked ? 0x77ffb8 : 0xff7355);
    lamp.material.emissive.set(unlocked ? 0x33bb77 : 0xff3a15);
  }
  function update(delta) {
    if (unlockedTarget) opening = Math.min(1, opening + delta / 3);
    door.position.y = 2 + THREE.MathUtils.smoothstep(opening, 0, 1) * 3.3;
    terminalTime += delta;
    brokenScreen.material.emissiveIntensity = 0.45 + Math.sin(terminalTime * 21) * 0.035 + Math.sin(terminalTime * 7.3) * 0.04;
    sparkWait -= delta;
    if (sparkWait <= 0) {
      sparkWait = 0.9 + Math.random() * 2;
      for (const spark of sparks) {
        spark.position.copy(sparkOrigin);
        spark.velocity.set((Math.random() - 0.4) * 2.3, 0.4 + Math.random() * 2.1, 0.8 + Math.random() * 2);
        spark.life = spark.duration = 0.18 + Math.random() * 0.48;
      }
    }
    let count = 0;
    let flash = 0;
    for (const spark of sparks) {
      spark.life -= delta;
      if (spark.life <= 0) continue;
      spark.velocity.y -= delta * 7;
      spark.position.addScaledVector(spark.velocity, delta);
      if (spark.position.y < 0.04) { spark.life = 0; continue; }
      const fade = spark.life / spark.duration;
      flash = Math.max(flash, fade);
      const offset = count++ * 6;
      sparkPositions.set([spark.position.x, spark.position.y, spark.position.z,
        spark.position.x - spark.velocity.x * 0.035, spark.position.y - spark.velocity.y * 0.035, spark.position.z - spark.velocity.z * 0.035], offset);
      sparkColors.set([2 * fade, 1.25 * fade, 0.4 * fade, 0.65 * fade, 0.2 * fade, 0.03 * fade], offset);
    }
    sparkGeometry.setDrawRange(0, count * 2);
    sparkGeometry.attributes.position.needsUpdate = true;
    sparkGeometry.attributes.color.needsUpdate = true;
    sparkLight.intensity = flash * 3;

  }
  function nearTerminal(player) {
    return inside(player) && Math.hypot(player.x - group.position.x, player.z - group.position.z + 5.6) < 2.8
      && player.y < abandonedLocation.ground + 3;
  }
  function resolve(player, flightHeight, previousFlightHeight, unlocked) {
    setUnlocked(unlocked);
    const foot = player.y - 1 - abandonedLocation.ground;
    for (const wall of walls) {
      const bottom = wall.mesh === door ? door.position.y - 2 : wall.bottom;
      const top = wall.mesh === door ? door.position.y + 2 : wall.top;
      if (foot > top || foot + 2 < bottom) continue;
      const minX = group.position.x + wall.x - wall.w / 2 - 0.4;
      const maxX = group.position.x + wall.x + wall.w / 2 + 0.4;
      const minZ = group.position.z + wall.z - wall.d / 2 - 0.4;
      const maxZ = group.position.z + wall.z + wall.d / 2 + 0.4;
      if (player.x <= minX || player.x >= maxX || player.z <= minZ || player.z >= maxZ) continue;
      const edges = [[player.x - minX, 'x', minX], [maxX - player.x, 'x', maxX], [player.z - minZ, 'z', minZ], [maxZ - player.z, 'z', maxZ]];
      edges.sort((a, b) => a[0] - b[0]); player[edges[0][1]] = edges[0][2];
    }
    if (inside(player)) {
      if (previousFlightHeight >= 7.4 && flightHeight < 7.4) return 7.4;
      if (previousFlightHeight < 7.4 && flightHeight > 4.7 && flightHeight < 7.4) return 4.7;
    }
    return flightHeight;
  }
  return { group, inside, nearDoor, nearTerminal, setUnlocked, update, resolve };
}
