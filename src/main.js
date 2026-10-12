import './styles.css';
import * as THREE from 'three';

const canvas = document.querySelector('#game-canvas');
const scoreEl = document.querySelector('#score');
const shieldEl = document.querySelector('#shield');
const bestEl = document.querySelector('#best');
const overlay = document.querySelector('#overlay');
const overlayTitle = document.querySelector('#overlay-title');
const overlayCopy = document.querySelector('#overlay-copy');
const startButton = document.querySelector('#start-button');
const leftControl = document.querySelector('#left-control');
const rightControl = document.querySelector('#right-control');

const lanePositions = [-3.2, 0, 3.2];
const playerDepth = {
  start: 2.15,
  min: -3.2,
  max: 5.2,
  speed: 5.2,
  acceleration: 8.5,
  deceleration: 5.2,
};
const state = {
  running: false,
  lane: 1,
  targetX: 0,
  score: 0,
  best: Number(localStorage.getItem('orbital-drift-best') || 0),
  shield: 100,
  speed: 18,
  elapsed: 0,
  steer: 0,
  depthInput: 0,
  depthVelocity: 0,
  runCycle: 0,
};

bestEl.textContent = String(state.best);

function hash2(x, z) {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function smoothNoise(x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(x0, z0);
  const b = hash2(x0 + 1, z0);
  const c = hash2(x0, z0 + 1);
  const d = hash2(x0 + 1, z0 + 1);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, sx), THREE.MathUtils.lerp(c, d, sx), sz);
}

function fbm(x, z) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 0.055;
  for (let octave = 0; octave < 5; octave += 1) {
    value += (smoothNoise(x * frequency, z * frequency) - 0.5) * amplitude;
    amplitude *= 0.52;
    frequency *= 2.05;
  }
  return value;
}

function erosionMask(x, z) {
  const primary = Math.abs(Math.sin(z * 0.07 + fbm(x * 0.8, z * 0.45) * 5.6));
  const secondary = Math.abs(Math.sin(x * 0.11 - z * 0.035 + fbm(x * 0.35 + 22, z * 0.55 - 9) * 4.2));
  const narrowCuts = 1 - THREE.MathUtils.smoothstep(primary, 0.035, 0.26);
  const crossCuts = 1 - THREE.MathUtils.smoothstep(secondary, 0.02, 0.16);
  return THREE.MathUtils.clamp(narrowCuts * 0.62 + crossCuts * 0.3, 0, 1);
}

function terrainHeight(x, z) {
  const sideRise = Math.pow(Math.abs(x) / 54, 2.1) * 4.8;
  const rollingMesa = Math.sin(x * 0.075 + z * 0.032) * 0.48 + Math.cos(x * 0.043 - z * 0.047) * 0.36;
  const crust = fbm(x, z) * 1.75 + fbm(x + 91, z - 37) * 0.68;
  const wash = erosionMask(x, z);
  const dryBasin = Math.exp(-(x * x) / 150) * 0.42;
  const crackedCrust = (smoothNoise(x * 0.55, z * 0.55) - 0.5) * 0.16;
  const fineRipples = Math.sin(x * 0.52 + fbm(x * 0.3, z * 0.3) * 4.0) * 0.045;
  return sideRise + rollingMesa + crust + crackedCrust + fineRipples - wash * 0.62 - dryBasin - 1.22;
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc9e7);
scene.fog = new THREE.Fog(0xb7c9cc, 42, 168);

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 160);
camera.position.set(0, 6.2, 12);
camera.lookAt(0, 0.6, -24);

const hemi = new THREE.HemisphereLight(0xd8edf7, 0x6d3124, 2.15);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xffcf92, 3.55);
keyLight.position.set(-18, 20, 10);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 80;
keyLight.shadow.camera.left = -38;
keyLight.shadow.camera.right = 38;
keyLight.shadow.camera.top = 38;
keyLight.shadow.camera.bottom = -38;
scene.add(keyLight);

const accentLight = new THREE.PointLight(0xffa067, 26, 44);
accentLight.position.set(8, 5, -14);
scene.add(accentLight);

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(145, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x8fc4ea) },
      horizonColor: { value: new THREE.Color(0xd2e2eb) },
      groundGlow: { value: new THREE.Color(0xd8926c) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 groundGlow;
      void main() {
        float h = normalize(vWorldPosition).y;
        vec3 sky = mix(horizonColor, topColor, smoothstep(0.05, 0.86, h));
        sky = mix(groundGlow, sky, smoothstep(-0.18, 0.18, h));
        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  }),
);
scene.add(skyDome);

const sun = new THREE.Mesh(
  new THREE.SphereGeometry(3.1, 24, 12),
  new THREE.MeshBasicMaterial({ color: 0xffe2a6, transparent: true, opacity: 0.86 }),
);
sun.position.set(-42, 40, -72);
scene.add(sun);

const materials = {
  ship: new THREE.MeshStandardMaterial({
    color: 0xf1f4eb,
    roughness: 0.58,
    metalness: 0.08,
    emissive: 0x141714,
    emissiveIntensity: 0.08,
  }),
  canopy: new THREE.MeshStandardMaterial({
    color: 0xd69b24,
    roughness: 0.12,
    metalness: 0.86,
    emissive: 0x4a2a03,
    emissiveIntensity: 0.26,
  }),
  wing: new THREE.MeshStandardMaterial({
    color: 0xf36e3b,
    roughness: 0.42,
    metalness: 0.2,
    emissive: 0x431004,
    emissiveIntensity: 0.2,
  }),
  suitTrim: new THREE.MeshStandardMaterial({
    color: 0xd8ded2,
    roughness: 0.66,
    metalness: 0.04,
  }),
  suitShadow: new THREE.MeshStandardMaterial({
    color: 0xb8c0b8,
    roughness: 0.82,
    metalness: 0.02,
  }),
  darkSuit: new THREE.MeshStandardMaterial({
    color: 0x2c3135,
    roughness: 0.55,
    metalness: 0.1,
  }),
  rubber: new THREE.MeshStandardMaterial({
    color: 0x15191d,
    roughness: 0.78,
    metalness: 0.02,
  }),
  metalTrim: new THREE.MeshStandardMaterial({
    color: 0xb8c1c0,
    roughness: 0.36,
    metalness: 0.54,
  }),
  backpack: new THREE.MeshStandardMaterial({
    color: 0xc8d0c7,
    roughness: 0.5,
    metalness: 0.22,
  }),
  helmetGlass: new THREE.MeshStandardMaterial({
    color: 0xffd36a,
    roughness: 0.08,
    metalness: 0.72,
    emissive: 0x5b3000,
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0.9,
  }),
  ground: new THREE.MeshStandardMaterial({
    roughness: 0.98,
    metalness: 0,
    vertexColors: true,
  }),
  hill: new THREE.MeshStandardMaterial({
    color: 0xb05a38,
    roughness: 0.98,
    metalness: 0,
    emissive: 0x3a160d,
    emissiveIntensity: 0.08,
  }),
  grass: new THREE.MeshStandardMaterial({
    color: 0x6f552f,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  }),
  grassPale: new THREE.MeshStandardMaterial({
    color: 0x8b7442,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  }),
  grassDark: new THREE.MeshStandardMaterial({
    color: 0x4f452b,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  }),
  rock: new THREE.MeshStandardMaterial({
    color: 0x714634,
    roughness: 0.95,
    metalness: 0.02,
    flatShading: true,
  }),
  rockDark: new THREE.MeshStandardMaterial({
    color: 0x4e2e25,
    roughness: 0.96,
    metalness: 0.02,
    flatShading: true,
  }),
  rockLight: new THREE.MeshStandardMaterial({
    color: 0x8c5d42,
    roughness: 0.94,
    metalness: 0.02,
    flatShading: true,
  }),
  cloud: new THREE.MeshBasicMaterial({
    color: 0xf4fbff,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  }),
  dust: new THREE.MeshStandardMaterial({
    color: 0xd49a65,
    roughness: 0.88,
    metalness: 0,
    transparent: true,
    opacity: 0.32,
  }),
};

const world = new THREE.Group();
scene.add(world);

const rustDark = new THREE.Color(0x743625);
const rustBase = new THREE.Color(0xa84d32);
const rustLight = new THREE.Color(0xc8613a);
const ochre = new THREE.Color(0x9f673f);
const washDark = new THREE.Color(0x8f4730);
const paleDust = new THREE.Color(0xbb7c50);
const terrainTileLength = 120;
const terrainLoopLength = terrainTileLength * 3;
const terrainResetZ = 195;
const terrainReverseResetZ = terrainResetZ - terrainLoopLength;
const terrainTiles = [];

function createTerrainTile(centerZ) {
  const geometry = new THREE.PlaneGeometry(160, terrainTileLength, 152, 96);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = [];

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const localZ = positions.getZ(i);
    const worldZ = localZ + centerZ;
    const height = terrainHeight(x, worldZ);
    const wash = erosionMask(x, worldZ);
    positions.setY(i, height);

    const color = rustBase.clone();
    const mineralNoise = smoothNoise(x * 0.075 + 18, worldZ * 0.075 - 4);
    const surfaceNoise = smoothNoise(x * 0.23, worldZ * 0.23);
    color.lerp(height > 2.2 ? ochre : rustLight, THREE.MathUtils.clamp((height + 1.4) / 9, 0, 0.44));
    color.lerp(rustDark, THREE.MathUtils.clamp((surfaceNoise - 0.32) * 0.48, 0, 0.28));
    color.lerp(paleDust, THREE.MathUtils.clamp((mineralNoise - 0.62) * 0.52, 0, 0.18));
    color.lerp(washDark, wash * 0.18);
    colors.push(color.r, color.g, color.b);
  }

  positions.needsUpdate = true;
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const tile = new THREE.Mesh(geometry, materials.ground);
  tile.position.z = centerZ;
  tile.receiveShadow = true;
  tile.userData.initialZ = centerZ;
  terrainTiles.push(tile);
  world.add(tile);
}

for (const centerZ of [-105, 15, 135]) {
  createTerrainTile(centerZ);
}

const dustGeometry = new THREE.BufferGeometry();
const dustCount = 520;
const dustPositions = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount; i += 1) {
  const x = THREE.MathUtils.randFloatSpread(120);
  const z = THREE.MathUtils.randFloat(-132, 26);
  dustPositions[i * 3] = x;
  dustPositions[i * 3 + 1] = terrainHeight(x, z) + THREE.MathUtils.randFloat(0.45, 3.2);
  dustPositions[i * 3 + 2] = z;
}
dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dust = new THREE.Points(
  dustGeometry,
  new THREE.PointsMaterial({
    color: 0xd89a62,
    size: 0.16,
    transparent: true,
    opacity: 0.4,
  }),
);
scene.add(dust);

const hills = [];
function createHillGeometry(radius, height, seed) {
  const rings = 9;
  const segments = 22;
  const positions = [];
  const indices = [];

  positions.push(0, height, 0);
  for (let ring = 1; ring <= rings; ring += 1) {
    const rNorm = ring / rings;
    const falloff = Math.pow(Math.max(0, 1 - rNorm * rNorm), 1.35);
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const edgeNoise = 1 + (smoothNoise(Math.cos(angle) * 2.3 + seed, Math.sin(angle) * 2.3 - seed) - 0.5) * 0.2;
      const r = radius * rNorm * edgeNoise;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = height * falloff + (smoothNoise(x * 0.18 + seed, z * 0.18 - seed) - 0.5) * height * 0.16 * (1 - rNorm);
      positions.push(x, y, z);
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    indices.push(0, 1 + segment, 1 + ((segment + 1) % segments));
  }

  for (let ring = 1; ring < rings; ring += 1) {
    const current = 1 + (ring - 1) * segments;
    const next = 1 + ring * segments;
    for (let segment = 0; segment < segments; segment += 1) {
      const a = current + segment;
      const b = current + ((segment + 1) % segments);
      const c = next + segment;
      const d = next + ((segment + 1) % segments);
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

for (let i = 0; i < 0; i += 1) {
  const side = i % 2 === 0 ? -1 : 1;
  const x = side * THREE.MathUtils.randFloat(9, 34);
  const z = THREE.MathUtils.randFloat(-104, 20);
  const hill = new THREE.Mesh(
    createHillGeometry(THREE.MathUtils.randFloat(4.2, 10.5), THREE.MathUtils.randFloat(0.8, 2.35), i * 3.17),
    materials.hill,
  );
  hill.rotation.y = THREE.MathUtils.randFloat(0, Math.PI * 2);
  hill.position.set(x, terrainHeight(x, z) + 0.025, z);
  hill.castShadow = false;
  hill.receiveShadow = false;
  hill.userData = { speedFactor: THREE.MathUtils.randFloat(0.45, 0.75) };
  hills.push(hill);
  world.add(hill);
}

const rocks = [];
for (let i = 0; i < 78; i += 1) {
  const side = i % 2 === 0 ? -1 : 1;
  const x = side * THREE.MathUtils.randFloat(4.6, 40);
  const z = THREE.MathUtils.randFloat(-116, 24);
  const rockMaterials = [materials.rock, materials.rockDark, materials.rockLight];
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(0.18, 1.25), i % 3 === 0 ? 0 : 1),
    rockMaterials[i % rockMaterials.length],
  );
  rock.scale.set(THREE.MathUtils.randFloat(1, 2.05), THREE.MathUtils.randFloat(0.34, 0.9), THREE.MathUtils.randFloat(0.75, 1.7));
  rock.rotation.set(THREE.MathUtils.randFloat(0, Math.PI), THREE.MathUtils.randFloat(0, Math.PI), THREE.MathUtils.randFloat(0, Math.PI));
  rock.position.set(x, terrainHeight(x, z) + 0.18, z);
  rock.castShadow = true;
  rock.receiveShadow = true;
  rock.userData = { speedFactor: THREE.MathUtils.randFloat(0.82, 1.04) };
  rocks.push(rock);
  world.add(rock);
}

const clouds = [];
for (let i = 0; i < 8; i += 1) {
  const cloud = new THREE.Group();
  const puffCount = THREE.MathUtils.randInt(3, 5);
  for (let puff = 0; puff < puffCount; puff += 1) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), materials.cloud);
    mesh.scale.set(THREE.MathUtils.randFloat(3.6, 6.2), THREE.MathUtils.randFloat(0.9, 1.7), THREE.MathUtils.randFloat(1.3, 2.4));
    mesh.position.set(puff * 3.6 + THREE.MathUtils.randFloatSpread(1.4), THREE.MathUtils.randFloatSpread(0.45), THREE.MathUtils.randFloatSpread(1.3));
    cloud.add(mesh);
  }
  cloud.position.set(THREE.MathUtils.randFloatSpread(92), THREE.MathUtils.randFloat(22, 34), THREE.MathUtils.randFloat(-118, -30));
  cloud.userData = { speedFactor: THREE.MathUtils.randFloat(0.035, 0.075) };
  clouds.push(cloud);
  scene.add(cloud);
}

const grassTufts = [];
const grassMaterials = [materials.grass, materials.grassPale, materials.grassDark];
for (let i = 0; i < 190; i += 1) {
  const group = new THREE.Group();
  const side = i % 2 === 0 ? -1 : 1;
  const x = side * THREE.MathUtils.randFloat(3.8, 31);
  const z = THREE.MathUtils.randFloat(-108, 18);

  const bladeCount = THREE.MathUtils.randInt(3, 7);
  for (let blade = 0; blade < bladeCount; blade += 1) {
    const bladeMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, THREE.MathUtils.randFloat(0.35, 1.0), 4),
      grassMaterials[(i + blade) % grassMaterials.length],
    );
    bladeMesh.position.set(THREE.MathUtils.randFloatSpread(0.34), bladeMesh.geometry.parameters.height / 2, THREE.MathUtils.randFloatSpread(0.24));
    bladeMesh.rotation.z = THREE.MathUtils.randFloatSpread(0.58);
    bladeMesh.rotation.y = THREE.MathUtils.randFloat(0, Math.PI);
    group.add(bladeMesh);
  }

  group.position.set(x, terrainHeight(x, z) + 0.05, z);
  group.userData = { speedFactor: 1 };
  grassTufts.push(group);
  world.add(group);
}

const ship = new THREE.Group();
ship.scale.setScalar(0.76);
ship.rotation.y = Math.PI;
let cameraViewAngle = 0;
let cameraInspectActive = false;

const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.9, 12, 24), materials.ship);
torso.position.set(0, 0.22, 0);
torso.scale.set(1.0, 1.04, 0.72);
torso.castShadow = true;
ship.add(torso);

const waistSeal = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.038, 10, 32), materials.rubber);
waistSeal.position.set(0, -0.26, 0);
waistSeal.rotation.x = Math.PI / 2;
waistSeal.scale.set(1.18, 0.84, 1);
waistSeal.castShadow = true;
ship.add(waistSeal);

const chestPanel = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.31, 0.07), materials.wing);
chestPanel.position.set(0, 0.31, 0.33);
chestPanel.castShadow = true;
ship.add(chestPanel);

const controlPlate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.035), materials.metalTrim);
controlPlate.position.set(-0.04, 0.33, 0.375);
controlPlate.castShadow = true;
ship.add(controlPlate);

const chestLight = new THREE.Mesh(
  new THREE.SphereGeometry(0.06, 12, 8),
  new THREE.MeshStandardMaterial({ color: 0x77f8ff, emissive: 0x2dd6ff, emissiveIntensity: 1.2, roughness: 0.2 }),
);
chestLight.position.set(0.18, 0.35, 0.42);
ship.add(chestLight);

for (const x of [-0.12, 0.02, 0.13]) {
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12), materials.darkSuit);
  dial.position.set(x, 0.34 + (x === 0.02 ? -0.04 : 0.035), 0.401);
  dial.rotation.x = Math.PI / 2;
  ship.add(dial);
}

for (const side of [-1, 1]) {
  const torsoSeam = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.72, 8), materials.suitShadow);
  torsoSeam.position.set(side * 0.31, 0.22, 0.22);
  torsoSeam.rotation.x = 0.18;
  torsoSeam.castShadow = true;
  ship.add(torsoSeam);
}

const neckRing = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.055, 12, 36), materials.metalTrim);
neckRing.position.set(0, 0.86, 0);
neckRing.rotation.x = Math.PI / 2;
neckRing.castShadow = true;
ship.add(neckRing);

const lowerNeckSeal = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.025, 8, 32), materials.rubber);
lowerNeckSeal.position.set(0, 0.78, 0);
lowerNeckSeal.rotation.x = Math.PI / 2;
lowerNeckSeal.castShadow = true;
ship.add(lowerNeckSeal);

const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.49, 40, 24), materials.ship);
helmet.position.set(0, 1.24, 0.05);
helmet.scale.set(1.04, 1.03, 0.98);
helmet.castShadow = true;
ship.add(helmet);

const helmetBand = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.028, 10, 44), materials.metalTrim);
helmetBand.position.set(0, 1.25, 0.05);
helmetBand.rotation.x = Math.PI / 2;
helmetBand.scale.set(1.08, 0.96, 1);
helmetBand.castShadow = true;
ship.add(helmetBand);

const visor = new THREE.Mesh(new THREE.SphereGeometry(0.37, 48, 24), materials.canopy);
visor.position.set(0, 1.22, 0.415);
visor.scale.set(1.2, 0.68, 0.22);
visor.castShadow = true;
ship.add(visor);

const visorSeal = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.025, 10, 40), materials.rubber);
visorSeal.position.set(0, 1.22, 0.447);
visorSeal.scale.set(1.31, 0.67, 0.18);
visorSeal.castShadow = true;
ship.add(visorSeal);

const visorGlow = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.013, 8, 36), materials.helmetGlass);
visorGlow.position.set(0, 1.22, 0.468);
visorGlow.scale.set(1.29, 0.62, 0.16);
visorGlow.castShadow = true;
ship.add(visorGlow);

const visorReflection = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.022, 0.012), materials.helmetGlass);
visorReflection.position.set(-0.09, 1.36, 0.53);
visorReflection.rotation.z = -0.22;
ship.add(visorReflection);

const visorLowerReflection = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.016, 0.012), materials.helmetGlass);
visorLowerReflection.position.set(0.12, 1.12, 0.528);
visorLowerReflection.rotation.z = -0.14;
ship.add(visorLowerReflection);

const chinVent = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.035), materials.rubber);
chinVent.position.set(0, 1.0, 0.43);
chinVent.castShadow = true;
ship.add(chinVent);

const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.82, 0.27), materials.backpack);
backpack.position.set(0, 0.3, -0.39);
backpack.castShadow = true;
ship.add(backpack);

const backpackRidge = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.05), materials.metalTrim);
backpackRidge.position.set(0, 0.62, -0.545);
backpackRidge.castShadow = true;
ship.add(backpackRidge);

const lifeSupportHose = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.014, 8, 32, Math.PI * 1.22), materials.rubber);
lifeSupportHose.position.set(-0.28, 0.68, -0.24);
lifeSupportHose.rotation.set(0.34, -0.18, 1.78);
lifeSupportHose.castShadow = true;
ship.add(lifeSupportHose);

const limbRig = [];

for (const side of [-1, 1]) {
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12), materials.suitTrim);
  shoulder.position.set(side * 0.53, 0.64, 0.02);
  shoulder.scale.set(1.08, 0.9, 1);
  shoulder.castShadow = true;
  ship.add(shoulder);

  const shoulderRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.017, 8, 24), materials.metalTrim);
  shoulderRing.position.set(side * 0.54, 0.61, 0.04);
  shoulderRing.rotation.set(Math.PI / 2, 0, side * 0.46);
  shoulderRing.castShadow = true;
  ship.add(shoulderRing);

  const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.5, 8, 16), materials.ship);
  upperArm.position.set(side * 0.65, 0.34, 0.08);
  upperArm.rotation.z = side * 0.35;
  upperArm.castShadow = true;
  ship.add(upperArm);

  const wristRing = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.014, 8, 20), materials.metalTrim);
  wristRing.position.set(side * 0.74, 0.12, 0.12);
  wristRing.rotation.set(Math.PI / 2, 0, side * 0.25);
  wristRing.castShadow = true;
  ship.add(wristRing);

  const glove = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12), materials.rubber);
  glove.position.set(side * 0.76, 0.03, 0.14);
  glove.scale.set(1.06, 0.9, 1.12);
  glove.castShadow = true;
  ship.add(glove);

  const hip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), materials.suitTrim);
  hip.position.set(side * 0.23, -0.34, 0.02);
  hip.castShadow = true;
  ship.add(hip);

  const thighRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 8, 24), materials.metalTrim);
  thighRing.position.set(side * 0.24, -0.48, 0.04);
  thighRing.rotation.set(Math.PI / 2, 0, side * -0.08);
  thighRing.castShadow = true;
  ship.add(thighRing);

  const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.56, 8, 16), materials.ship);
  leg.position.set(side * 0.24, -0.72, 0.03);
  leg.rotation.z = side * -0.09;
  leg.castShadow = true;
  ship.add(leg);

  const kneePad = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 8), materials.suitShadow);
  kneePad.position.set(side * 0.25, -0.75, 0.17);
  kneePad.scale.set(1.05, 0.58, 0.42);
  kneePad.castShadow = true;
  ship.add(kneePad);

  const ankleRing = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.014, 8, 22), materials.metalTrim);
  ankleRing.position.set(side * 0.25, -0.99, 0.04);
  ankleRing.rotation.set(Math.PI / 2, 0, side * -0.06);
  ankleRing.castShadow = true;
  ship.add(ankleRing);

  const boot = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.16, 0.35), materials.rubber);
  boot.position.set(side * 0.25, -1.08, 0.12);
  boot.rotation.z = side * -0.04;
  boot.castShadow = true;
  ship.add(boot);

  const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.38), materials.darkSuit);
  bootSole.position.set(side * 0.25, -1.17, 0.14);
  bootSole.rotation.z = side * -0.04;
  bootSole.castShadow = true;
  ship.add(bootSole);

  const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.18, 16), materials.rubber);
  thruster.position.set(side * 0.2, 0.0, -0.58);
  thruster.rotation.x = Math.PI / 2;
  thruster.castShadow = true;
  ship.add(thruster);

  const thrusterRing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 8, 20), materials.metalTrim);
  thrusterRing.position.set(side * 0.2, 0.0, -0.67);
  thrusterRing.rotation.x = Math.PI / 2;
  ship.add(thrusterRing);

  limbRig.push({
    side,
    shoulder,
    shoulderRing,
    upperArm,
    wristRing,
    glove,
    hip,
    thighRing,
    leg,
    kneePad,
    ankleRing,
    boot,
    bootSole,
    base: {
      shoulderPosition: shoulder.position.clone(),
      shoulderRingPosition: shoulderRing.position.clone(),
      upperArmPosition: upperArm.position.clone(),
      upperArmRotation: upperArm.rotation.clone(),
      wristRingPosition: wristRing.position.clone(),
      wristRingRotation: wristRing.rotation.clone(),
      glovePosition: glove.position.clone(),
      hipPosition: hip.position.clone(),
      thighRingPosition: thighRing.position.clone(),
      thighRingRotation: thighRing.rotation.clone(),
      legPosition: leg.position.clone(),
      legRotation: leg.rotation.clone(),
      kneePadPosition: kneePad.position.clone(),
      ankleRingPosition: ankleRing.position.clone(),
      ankleRingRotation: ankleRing.rotation.clone(),
      bootPosition: boot.position.clone(),
      bootRotation: boot.rotation.clone(),
      bootSolePosition: bootSole.position.clone(),
      bootSoleRotation: bootSole.rotation.clone(),
    },
  });
}

const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.46, 8), materials.rubber);
antenna.position.set(0.24, 1.64, -0.02);
antenna.rotation.z = -0.45;
ship.add(antenna);

const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), materials.wing);
antennaTip.position.set(0.39, 1.82, -0.02);
ship.add(antennaTip);

ship.position.set(0, terrainHeight(0, playerDepth.start) + 1.24, playerDepth.start);
scene.add(ship);

const clock = new THREE.Clock();

function resetGame() {
  state.running = true;
  state.lane = 1;
  state.targetX = 0;
  state.score = 0;
  state.shield = 100;
  state.speed = 18;
  state.elapsed = 0;
  state.depthInput = 0;
  state.depthVelocity = 0;
  state.runCycle = 0;
  ship.position.x = 0;
  ship.position.z = playerDepth.start;
  ship.position.y = terrainHeight(0, ship.position.z) + 1.24;
  overlayTitle.textContent = 'Rust Mesa';
  overlayCopy.textContent = 'Drift over rust-red terrain, dry grass, weathered rocks, low hills, and eroded desert washes.';
  startButton.textContent = 'Start run';
  overlay.classList.remove('visible');
  updateHud();
}

function gameOver() {
  state.running = false;
  state.best = Math.max(state.best, Math.floor(state.score));
  localStorage.setItem('orbital-drift-best', String(state.best));
  overlayTitle.textContent = 'Run ended';
  overlayCopy.textContent = `Score ${Math.floor(state.score)}. Repair the shield and launch again.`;
  startButton.textContent = 'Restart';
  overlay.classList.add('visible');
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(Math.floor(state.score));
  shieldEl.textContent = String(Math.max(0, Math.floor(state.shield)));
  bestEl.textContent = String(state.best);
}

function moveLane(direction) {
  if (!state.running) return;
  state.lane = THREE.MathUtils.clamp(state.lane + direction, 0, lanePositions.length - 1);
  state.targetX = lanePositions[state.lane];
}

function setDefaultCameraPerspective() {
  camera.position.x = 0;
  camera.position.z = innerWidth < 720 ? 14.5 : 12;
  camera.position.y = innerWidth < 720 ? 7.1 : 6.2;
  camera.lookAt(0, 0.6, -24);
}

function updateInspectCameraPerspective() {
  const radius = innerWidth < 720 ? 12.2 : 10.2;
  const height = innerWidth < 720 ? 7.1 : 6.2;
  const targetX = ship.position.x;
  const targetY = ship.position.y + 0.24;
  const targetZ = ship.position.z;

  camera.position.set(
    targetX + Math.sin(cameraViewAngle) * radius,
    height,
    targetZ + Math.cos(cameraViewAngle) * radius,
  );
  camera.lookAt(targetX, targetY, targetZ);
}

function inspectCamera(event) {
  if (!event.metaKey || event.pointerType === 'touch') return;
  cameraInspectActive = true;
  cameraViewAngle = THREE.MathUtils.clamp(cameraViewAngle + event.movementX * 0.012, -Math.PI, Math.PI);
  updateInspectCameraPerspective();
}

function updateRunAnimation(delta, movementDirection, isMoving) {
  const runAmount = Math.min(1, Math.abs(movementDirection));
  if (isMoving) {
    state.runCycle += delta * (5.4 + runAmount * 4.8) * Math.sign(movementDirection);
  }

  for (const rig of limbRig) {
    const phase = state.runCycle + (rig.side < 0 ? 0 : Math.PI);
    const stride = Math.sin(phase) * runAmount;
    const footLift = Math.max(0, Math.cos(phase)) * runAmount;
    const armStride = -stride;
    const armLift = Math.max(0, Math.cos(phase + Math.PI)) * runAmount;
    const { base } = rig;

    rig.upperArm.position.copy(base.upperArmPosition);
    rig.upperArm.position.y += armLift * 0.035;
    rig.upperArm.position.z += armStride * 0.1;
    rig.upperArm.rotation.copy(base.upperArmRotation);
    rig.upperArm.rotation.x += armStride * 0.58;
    rig.upperArm.rotation.z += rig.side * runAmount * 0.08;

    rig.wristRing.position.copy(base.wristRingPosition);
    rig.wristRing.position.y += armLift * 0.05;
    rig.wristRing.position.z += armStride * 0.18;
    rig.wristRing.rotation.copy(base.wristRingRotation);
    rig.wristRing.rotation.x += armStride * 0.42;

    rig.glove.position.copy(base.glovePosition);
    rig.glove.position.y += armLift * 0.06;
    rig.glove.position.z += armStride * 0.23;

    rig.thighRing.position.copy(base.thighRingPosition);
    rig.thighRing.position.y += footLift * 0.04;
    rig.thighRing.position.z += stride * 0.08;
    rig.thighRing.rotation.copy(base.thighRingRotation);
    rig.thighRing.rotation.x += stride * 0.28;

    rig.leg.position.copy(base.legPosition);
    rig.leg.position.y += footLift * 0.08;
    rig.leg.position.z += stride * 0.13;
    rig.leg.rotation.copy(base.legRotation);
    rig.leg.rotation.x += stride * 0.62;
    rig.leg.rotation.z += rig.side * runAmount * 0.04;

    rig.kneePad.position.copy(base.kneePadPosition);
    rig.kneePad.position.y += footLift * 0.09;
    rig.kneePad.position.z += stride * 0.16;

    rig.ankleRing.position.copy(base.ankleRingPosition);
    rig.ankleRing.position.y += footLift * 0.1;
    rig.ankleRing.position.z += stride * 0.2;
    rig.ankleRing.rotation.copy(base.ankleRingRotation);
    rig.ankleRing.rotation.x += stride * 0.42;

    rig.boot.position.copy(base.bootPosition);
    rig.boot.position.y += footLift * 0.12;
    rig.boot.position.z += stride * 0.24;
    rig.boot.rotation.copy(base.bootRotation);
    rig.boot.rotation.x += stride * 0.34 - footLift * 0.16;

    rig.bootSole.position.copy(base.bootSolePosition);
    rig.bootSole.position.y += footLift * 0.12;
    rig.bootSole.position.z += stride * 0.24;
    rig.bootSole.rotation.copy(base.bootSoleRotation);
    rig.bootSole.rotation.x += stride * 0.34 - footLift * 0.16;
  }
}

function updateGame(delta) {
  if (!state.running) {
    ship.rotation.z = Math.sin(clock.elapsedTime * 1.4) * 0.035;
    return;
  }

  const velocityStep = state.depthInput === 0 ? playerDepth.deceleration : playerDepth.acceleration;
  state.depthVelocity = THREE.MathUtils.damp(state.depthVelocity, state.depthInput, velocityStep, delta);
  if (Math.abs(state.depthVelocity) < 0.01 && state.depthInput === 0) {
    state.depthVelocity = 0;
  }

  const movementDirection = state.depthVelocity;
  const isMoving = Math.abs(movementDirection) > 0.001;
  const worldStep = state.speed * delta * movementDirection;
  updateRunAnimation(delta, movementDirection, isMoving);

  state.elapsed += isMoving ? delta : 0;
  state.speed = Math.min(34, 18 + state.elapsed * 0.34);
  if (isMoving) {
    state.score += delta * (10 + state.speed * 0.65);
    state.shield -= delta * 1.4;
  }

  ship.position.x = THREE.MathUtils.lerp(ship.position.x, state.targetX, 1 - Math.pow(0.0008, delta));
  ship.position.z = THREE.MathUtils.clamp(
    ship.position.z - movementDirection * playerDepth.speed * delta,
    playerDepth.min,
    playerDepth.max,
  );
  ship.position.y = terrainHeight(ship.position.x, ship.position.z) + 1.24 + Math.abs(Math.sin(state.runCycle * 2)) * Math.min(1, Math.abs(movementDirection)) * 0.08;
  ship.rotation.z = THREE.MathUtils.clamp((state.targetX - ship.position.x) * -0.14, -0.38, 0.38);
  ship.rotation.x = Math.sin(state.elapsed * 3.2) * 0.025;

  for (const tile of terrainTiles) {
    tile.position.z += worldStep;
    if (tile.position.z > terrainResetZ) {
      tile.position.z -= terrainLoopLength;
    } else if (tile.position.z < terrainReverseResetZ) {
      tile.position.z += terrainLoopLength;
    }
  }

  dust.rotation.y += isMoving ? delta * 0.004 * movementDirection : 0;
  dust.position.z += worldStep * 0.12;
  if (dust.position.z > 8) {
    dust.position.z = -8;
  } else if (dust.position.z < -8) {
    dust.position.z = 8;
  }

  for (const tuft of grassTufts) {
    tuft.position.z += worldStep;
    if (tuft.position.z > 18) {
      tuft.position.z -= 136;
      tuft.position.x = (tuft.position.x < 0 ? -1 : 1) * THREE.MathUtils.randFloat(3.8, 31);
      tuft.position.y = terrainHeight(tuft.position.x, tuft.position.z) + 0.05;
    } else if (tuft.position.z < -118) {
      tuft.position.z += 136;
      tuft.position.x = (tuft.position.x < 0 ? -1 : 1) * THREE.MathUtils.randFloat(3.8, 31);
      tuft.position.y = terrainHeight(tuft.position.x, tuft.position.z) + 0.05;
    }
  }

  for (const hill of hills) {
    hill.position.z += worldStep * hill.userData.speedFactor;
    if (hill.position.z > 28) {
      hill.position.z -= 150;
      hill.position.x = (hill.position.x < 0 ? -1 : 1) * THREE.MathUtils.randFloat(9, 34);
      hill.position.y = terrainHeight(hill.position.x, hill.position.z) + 0.025;
    } else if (hill.position.z < -122) {
      hill.position.z += 150;
      hill.position.x = (hill.position.x < 0 ? -1 : 1) * THREE.MathUtils.randFloat(9, 34);
      hill.position.y = terrainHeight(hill.position.x, hill.position.z) + 0.025;
    }
  }

  for (const rock of rocks) {
    rock.position.z += worldStep * rock.userData.speedFactor;
    if (rock.position.z > 22) {
      rock.position.z -= 142;
      rock.position.x = (rock.position.x < 0 ? -1 : 1) * THREE.MathUtils.randFloat(4.6, 40);
      rock.position.y = terrainHeight(rock.position.x, rock.position.z) + 0.18;
    } else if (rock.position.z < -120) {
      rock.position.z += 142;
      rock.position.x = (rock.position.x < 0 ? -1 : 1) * THREE.MathUtils.randFloat(4.6, 40);
      rock.position.y = terrainHeight(rock.position.x, rock.position.z) + 0.18;
    }
  }

  for (const cloud of clouds) {
    cloud.position.x += worldStep * cloud.userData.speedFactor;
    if (cloud.position.x > 62) {
      cloud.position.x = -62;
      cloud.position.z = THREE.MathUtils.randFloat(-118, -30);
    } else if (cloud.position.x < -62) {
      cloud.position.x = 62;
      cloud.position.z = THREE.MathUtils.randFloat(-118, -30);
    }
  }

  if (state.shield <= 0) {
    gameOver();
  } else {
    updateHud();
  }
}

function resize() {
  const { innerWidth, innerHeight } = window;
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  if (cameraInspectActive) {
    updateInspectCameraPerspective();
  } else {
    setDefaultCameraPerspective();
  }
  camera.updateProjectionMatrix();
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.04);
  updateGame(delta);
  if (cameraInspectActive) updateInspectCameraPerspective();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);
window.addEventListener('pointermove', inspectCamera);
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'w') {
    state.depthInput = 1;
  }
  if (key === 's') {
    state.depthInput = -1;
  }
  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
    moveLane(-1);
  }
  if (event.key === 'ArrowRight' || key === 'd') {
    moveLane(1);
  }
  if (event.key === ' ' || event.key === 'Enter') {
    if (!state.running) resetGame();
  }
});
window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if ((key === 'w' && state.depthInput === 1) || (key === 's' && state.depthInput === -1)) {
    state.depthInput = 0;
  }
});

leftControl.addEventListener('pointerdown', () => moveLane(-1));
rightControl.addEventListener('pointerdown', () => moveLane(1));
startButton.addEventListener('click', resetGame);

resize();
overlay.classList.add('visible');
animate();
