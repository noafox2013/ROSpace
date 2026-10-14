import './styles.css';
import * as THREE from 'three';

const canvas = document.querySelector('#game-canvas');
const scoreEl = document.querySelector('#score');
const bestEl = document.querySelector('#best');
const overlay = document.querySelector('#overlay');
const overlayTitle = document.querySelector('#overlay-title');
const overlayCopy = document.querySelector('#overlay-copy');
const startButton = document.querySelector('#start-button');
const leftControl = document.querySelector('#left-control');
const rightControl = document.querySelector('#right-control');

const playerMovement = {
  startZ: 2.15,
  lateralSpeed: 8.1,
  depthSpeed: 4.6,
  sprintMultiplier: 1.72,
  jetpackLift: 9.5,
  jetpackGravity: 6.6,
  jetpackMaxHeight: 9.68,
  acceleration: 8.5,
  deceleration: 5.2,
};
const state = {
  running: false,
  score: 0,
  best: Number(localStorage.getItem('orbital-drift-best') || 0),
  speed: 13.5,
  elapsed: 0,
  steer: 0,
  steerVelocity: 0,
  depthInput: 0,
  depthVelocity: 0,
  mouseSteer: 0,
  mouseDepth: 0,
  mouseMoveUntil: 0,
  aimX: 0.5,
  aimY: 0.5,
  sprinting: false,
  laserActive: false,
  weaponMode: 'beam',
  shotCooldown: 0,
  beamHitCooldown: 0,
  jetpackActive: false,
  jetpackBurn: 0,
  flightHeight: 0,
  flightVelocity: 0,
  faceYaw: Math.PI,
  cameraOrbitYaw: Math.PI,
  cameraPitch: 0,
  runCycle: 0,
};
const activeKeys = new Set();
const playerGroundOffset = 1.0;

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
  const broadUndulation = Math.sin(x * 0.035 + z * 0.022) * 0.18 + Math.cos(x * 0.026 - z * 0.031) * 0.14;
  const crust = fbm(x, z) * 0.68 + fbm(x + 91, z - 37) * 0.24;
  const lowHillNoise = smoothNoise(x * 0.012 + 11, z * 0.012 - 17);
  const occasionalHill = Math.pow(THREE.MathUtils.smoothstep(lowHillNoise, 0.64, 0.96), 2.4) * 0.72;
  const crackedCrust = (smoothNoise(x * 0.55, z * 0.55) - 0.5) * 0.16;
  const fineRipples = Math.sin(x * 0.52 + fbm(x * 0.3, z * 0.3) * 4.0) * 0.045;
  const windRipple = Math.sin(x * 1.35 + z * 0.18) * Math.cos(z * 0.92) * 0.018;
  const compactedSoil = (smoothNoise(x * 0.11 - 21, z * 0.11 + 13) - 0.5) * 0.07;
  return broadUndulation + crust + occasionalHill + crackedCrust + fineRipples + windRipple + compactedSoil - 1.05;
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
renderer.toneMappingExposure = 0.92;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa7bfca);
scene.fog = new THREE.Fog(0xb7a89f, 175, 460);

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 720);
camera.position.set(0, 4.7, 12);
camera.lookAt(0, 0.2, -24);

const sunDirection = new THREE.Vector3(0.14, 0.72, -0.68).normalize();
const sunDistance = 122;
const keyLightDistance = 76;

const hemi = new THREE.HemisphereLight(0xc7dbe5, 0x6b3d2b, 1.65);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xf4c086, 2.7);
keyLight.position.copy(sunDirection).multiplyScalar(keyLightDistance);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.00008;
keyLight.shadow.normalBias = 0.035;
keyLight.shadow.radius = 3.2;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 80;
keyLight.shadow.camera.left = -32;
keyLight.shadow.camera.right = 32;
keyLight.shadow.camera.top = 32;
keyLight.shadow.camera.bottom = -32;
scene.add(keyLight);
scene.add(keyLight.target);

const accentLight = new THREE.PointLight(0xffa067, 9, 36);
accentLight.position.set(8, 5, -14);
scene.add(accentLight);

function createSunTexture() {
  const size = 512;
  const center = size / 2;
  const canvasTexture = document.createElement('canvas');
  canvasTexture.width = size;
  canvasTexture.height = size;

  const context = canvasTexture.getContext('2d');
  const halo = context.createRadialGradient(center, center, 0, center, center, center);
  halo.addColorStop(0, 'rgba(255, 249, 205, 1)');
  halo.addColorStop(0.1, 'rgba(255, 224, 117, 0.98)');
  halo.addColorStop(0.23, 'rgba(255, 153, 55, 0.58)');
  halo.addColorStop(0.48, 'rgba(255, 113, 41, 0.2)');
  halo.addColorStop(0.8, 'rgba(255, 154, 69, 0.06)');
  halo.addColorStop(1, 'rgba(255, 154, 69, 0)');
  context.fillStyle = halo;
  context.fillRect(0, 0, size, size);

  context.save();
  context.translate(center, center);
  context.globalCompositeOperation = 'screen';
  for (let i = 0; i < 28; i += 1) {
    const angle = (i / 28) * Math.PI * 2;
    const length = 124 + (i % 4) * 18;
    const inner = 46 + (i % 3) * 4;
    context.rotate(angle);
    const ray = context.createLinearGradient(inner, 0, length, 0);
    ray.addColorStop(0, 'rgba(255, 232, 149, 0.32)');
    ray.addColorStop(1, 'rgba(255, 139, 59, 0)');
    context.fillStyle = ray;
    context.beginPath();
    context.moveTo(inner, -4);
    context.lineTo(length, 0);
    context.lineTo(inner, 4);
    context.closePath();
    context.fill();
    context.rotate(-angle);
  }
  context.restore();

  const core = context.createRadialGradient(center - 10, center - 12, 0, center, center, 78);
  core.addColorStop(0, 'rgba(255, 255, 242, 1)');
  core.addColorStop(0.32, 'rgba(255, 228, 118, 1)');
  core.addColorStop(0.72, 'rgba(255, 171, 56, 0.94)');
  core.addColorStop(1, 'rgba(255, 129, 44, 0)');
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = core;
  context.beginPath();
  context.arc(center, center, 82, 0, Math.PI * 2);
  context.fill();

  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(145, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x96b8c8) },
      horizonColor: { value: new THREE.Color(0xc6b5aa) },
      groundGlow: { value: new THREE.Color(0xba8165) },
    },
    vertexShader: `
      varying vec3 vLocalPosition;
      void main() {
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vLocalPosition;
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 groundGlow;
      void main() {
        float h = normalize(vLocalPosition).y;
        vec3 sky = mix(horizonColor, topColor, smoothstep(0.05, 0.86, h));
        sky = mix(groundGlow, sky, smoothstep(-0.18, 0.18, h));
        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  }),
);
skyDome.frustumCulled = false;
scene.add(skyDome);

const sun = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: createSunTexture(),
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }),
);
sun.scale.set(16, 16, 1);
sun.position.copy(camera.position).addScaledVector(sunDirection, sunDistance);
sun.renderOrder = 1;
sun.frustumCulled = false;
scene.add(sun);

function updateSunAndKeyLight() {
  sun.position.copy(camera.position).addScaledVector(sunDirection, sunDistance);
  keyLight.target.position.copy(ship.position);
  keyLight.position.copy(ship.position).addScaledVector(sunDirection, keyLightDistance);
  keyLight.target.updateMatrixWorld();
}

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
    side: THREE.DoubleSide,
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
  suitPanel: new THREE.MeshStandardMaterial({
    color: 0xe4e7df,
    roughness: 0.9,
    metalness: 0.02,
  }),
  suitDust: new THREE.MeshStandardMaterial({
    color: 0xb7835a,
    roughness: 1,
    metalness: 0,
  }),
  suitShadow: new THREE.MeshStandardMaterial({
    color: 0xb8c0b8,
    roughness: 0.82,
    metalness: 0.02,
  }),
  fabricCrease: new THREE.MeshStandardMaterial({
    color: 0x9da49e,
    roughness: 0.96,
    metalness: 0,
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
  bootTread: new THREE.MeshStandardMaterial({
    color: 0x080a0c,
    roughness: 0.88,
    metalness: 0.03,
  }),
  laserGun: new THREE.MeshStandardMaterial({
    color: 0x20262d,
    roughness: 0.46,
    metalness: 0.54,
  }),
  laserEmitter: new THREE.MeshStandardMaterial({
    color: 0x74f5ff,
    roughness: 0.16,
    metalness: 0.22,
    emissive: 0x1fc9ff,
    emissiveIntensity: 1.7,
  }),
  laserBeam: new THREE.MeshBasicMaterial({
    color: 0x72f6ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
  laserShot: new THREE.MeshBasicMaterial({
    color: 0x34a8ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
  laserShotCore: new THREE.MeshBasicMaterial({
    color: 0x0a63ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  }),
  jetpackFlame: new THREE.MeshBasicMaterial({
    color: 0xff8a24,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
  jetpackCore: new THREE.MeshBasicMaterial({
    color: 0xfff0a8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
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
  distantGround: new THREE.MeshStandardMaterial({
    roughness: 0.99,
    metalness: 0,
    vertexColors: true,
    fog: false,
  }),
  hill: new THREE.MeshStandardMaterial({
    color: 0x8e5137,
    roughness: 0.98,
    metalness: 0,
    emissive: 0x3a160d,
    emissiveIntensity: 0.08,
  }),
  grass: new THREE.MeshStandardMaterial({
    color: 0x5d5a36,
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
  }),
  grassPale: new THREE.MeshStandardMaterial({
    color: 0x8a7a4a,
    roughness: 0.97,
    metalness: 0,
    side: THREE.DoubleSide,
  }),
  grassDark: new THREE.MeshStandardMaterial({
    color: 0x3f442c,
    roughness: 0.98,
    metalness: 0,
    side: THREE.DoubleSide,
  }),
  grassSeed: new THREE.MeshStandardMaterial({
    color: 0xb49a68,
    roughness: 0.98,
    metalness: 0,
  }),
  rock: new THREE.MeshStandardMaterial({
    color: 0x684a3a,
    roughness: 0.98,
    metalness: 0.02,
    flatShading: true,
  }),
  rockDark: new THREE.MeshStandardMaterial({
    color: 0x3f3029,
    roughness: 0.99,
    metalness: 0.02,
    flatShading: true,
  }),
  rockLight: new THREE.MeshStandardMaterial({
    color: 0x8a674f,
    roughness: 0.98,
    metalness: 0.02,
    flatShading: true,
  }),
  rockStrata: new THREE.MeshStandardMaterial({
    color: 0xa17655,
    roughness: 0.99,
    metalness: 0.01,
    flatShading: true,
  }),
  mountain: new THREE.MeshStandardMaterial({
    color: 0x8f4a35,
    roughness: 0.99,
    metalness: 0,
    flatShading: true,
    fog: false,
  }),
  mountainDark: new THREE.MeshStandardMaterial({
    color: 0x5f2d22,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    fog: false,
  }),
  scree: new THREE.MeshStandardMaterial({
    color: 0x9b573a,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    fog: false,
  }),
  mesaStrata: new THREE.MeshStandardMaterial({
    color: 0x6d3828,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    fog: false,
  }),
  cloud: new THREE.MeshBasicMaterial({
    color: 0xe7ecea,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
  }),
  cloudShade: new THREE.MeshBasicMaterial({
    color: 0xbec3bf,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  }),
  dust: new THREE.MeshStandardMaterial({
    color: 0xd49a65,
    roughness: 0.88,
    metalness: 0,
    transparent: true,
    opacity: 0.32,
  }),
  footprint: new THREE.MeshBasicMaterial({
    color: 0x3f241a,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  }),
  footDust: new THREE.MeshStandardMaterial({
    color: 0xf1c08c,
    roughness: 0.94,
    metalness: 0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  }),
};

const world = new THREE.Group();
scene.add(world);

const rustDark = new THREE.Color(0x623727);
const rustBase = new THREE.Color(0x9a4e32);
const rustLight = new THREE.Color(0xb76843);
const ochre = new THREE.Color(0x8f7651);
const washDark = new THREE.Color(0x6c3f30);
const paleDust = new THREE.Color(0xc08a5d);
const paleClay = new THREE.Color(0xb99c7a);
const terrainTileSize = 160;
const terrainTileSegments = 96;
const terrainTiles = [];

function updateTerrainTileGeometry(tile, centerX, centerZ) {
  const positions = tile.geometry.attributes.position;
  const colors = tile.geometry.attributes.color;

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const localZ = positions.getZ(i);
    const worldX = x + centerX;
    const worldZ = localZ + centerZ;
    const height = terrainHeight(worldX, worldZ);
    const wash = erosionMask(worldX, worldZ);
    positions.setY(i, height);

    const color = rustBase.clone();
    const mineralNoise = smoothNoise(worldX * 0.075 + 18, worldZ * 0.075 - 4);
    const surfaceNoise = smoothNoise(worldX * 0.23, worldZ * 0.23);
    const saltPatch = smoothNoise(worldX * 0.032 - 8, worldZ * 0.032 + 31);
    const ironBand = Math.abs(Math.sin(worldX * 0.027 + worldZ * 0.019 + fbm(worldX * 0.18, worldZ * 0.18) * 1.8));
    const grit = smoothNoise(worldX * 1.35 + 7, worldZ * 1.35 - 19);
    const mica = smoothNoise(worldX * 0.68 - 23, worldZ * 0.68 + 41);
    color.lerp(height > 0.35 ? ochre : rustLight, THREE.MathUtils.clamp((height + 1.2) / 5.2, 0, 0.26));
    color.lerp(rustDark, THREE.MathUtils.clamp((surfaceNoise - 0.3) * 0.55, 0, 0.34));
    color.lerp(paleDust, THREE.MathUtils.clamp((mineralNoise - 0.54) * 0.44, 0, 0.2));
    color.lerp(paleClay, THREE.MathUtils.clamp((saltPatch - 0.72) * 0.36, 0, 0.12));
    color.lerp(washDark, wash * 0.12 + THREE.MathUtils.clamp((ironBand - 0.78) * 0.16, 0, 0.08));
    color.lerp(rustDark, THREE.MathUtils.clamp((grit - 0.82) * 0.28, 0, 0.08));
    color.lerp(paleClay, THREE.MathUtils.clamp((mica - 0.86) * 0.18, 0, 0.05));
    colors.setXYZ(i, color.r, color.g, color.b);
  }

  positions.needsUpdate = true;
  colors.needsUpdate = true;
  tile.geometry.computeVertexNormals();
  tile.position.set(centerX, 0, centerZ);
  tile.userData.centerX = centerX;
  tile.userData.centerZ = centerZ;
}

function createTerrainTile(offsetX, offsetZ) {
  const geometry = new THREE.PlaneGeometry(terrainTileSize, terrainTileSize, terrainTileSegments, terrainTileSegments);
  geometry.rotateX(-Math.PI / 2);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));

  const tile = new THREE.Mesh(geometry, materials.ground);
  tile.receiveShadow = true;
  tile.userData = { offsetX, offsetZ, centerX: null, centerZ: null };
  terrainTiles.push(tile);
  world.add(tile);
  return tile;
}

for (let offsetX = -3; offsetX <= 3; offsetX += 1) {
  for (let offsetZ = -3; offsetZ <= 3; offsetZ += 1) {
    createTerrainTile(offsetX, offsetZ);
  }
}

function updateTerrainAroundPlayer() {
  const gridX = Math.round(ship.position.x / terrainTileSize);
  const gridZ = Math.round(ship.position.z / terrainTileSize);

  for (const tile of terrainTiles) {
    const centerX = (gridX + tile.userData.offsetX) * terrainTileSize;
    const centerZ = (gridZ + tile.userData.offsetZ) * terrainTileSize;
    if (tile.userData.centerX !== centerX || tile.userData.centerZ !== centerZ) {
      updateTerrainTileGeometry(tile, centerX, centerZ);
    }
  }
}

const dustGeometry = new THREE.BufferGeometry();
const dustCount = 520;
const dustPositions = new Float32Array(dustCount * 3);
const dustDrift = new Float32Array(dustCount * 2);
for (let i = 0; i < dustCount; i += 1) {
  const x = THREE.MathUtils.randFloatSpread(120);
  const z = playerMovement.startZ + THREE.MathUtils.randFloat(-132, 26);
  dustPositions[i * 3] = x;
  dustPositions[i * 3 + 1] = terrainHeight(x, z) + THREE.MathUtils.randFloat(0.45, 3.2);
  dustPositions[i * 3 + 2] = z;
  dustDrift[i * 2] = THREE.MathUtils.randFloat(-0.025, 0.055);
  dustDrift[i * 2 + 1] = THREE.MathUtils.randFloat(0.045, 0.16);
}
dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dust = new THREE.Points(
  dustGeometry,
  new THREE.PointsMaterial({
    color: 0xc58b5d,
    size: 0.105,
    transparent: true,
    opacity: 0.24,
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
  const x = side * THREE.MathUtils.randFloat(18, 54);
  const z = THREE.MathUtils.randFloat(-104, 34);
  const hill = new THREE.Mesh(
    createHillGeometry(THREE.MathUtils.randFloat(3.6, 8.5), THREE.MathUtils.randFloat(0.32, 0.92), i * 3.17),
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

const mountains = [];

function createMountainGeometry(radius, height, seed) {
  const rings = 12;
  const segments = 28;
  const positions = [];
  const indices = [];

  positions.push(0, height * 0.74, 0);
  for (let ring = 1; ring <= rings; ring += 1) {
    const rNorm = ring / rings;
    const shelf = Math.sin(rNorm * Math.PI * 5.5 + seed) * 0.045;
    const plateau = rNorm < 0.24 ? 0.74 : THREE.MathUtils.lerp(0.74, 0, Math.pow((rNorm - 0.24) / 0.76, 0.7));
    const terrace = Math.floor(plateau * 6) / 6;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const ridgeNoise = smoothNoise(Math.cos(angle) * 3.5 + seed, Math.sin(angle) * 3.5 - seed);
      const jagged = 1 + (ridgeNoise - 0.5) * 0.18 + shelf;
      const r = radius * rNorm * jagged * (1.15 + rNorm * 0.42);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const weathering = (smoothNoise(x * 0.08 + seed, z * 0.08 - seed) - 0.5) * height * 0.09;
      const y = height * Math.max(0, terrace) + weathering * Math.max(0.15, 1 - rNorm);
      positions.push(x, Math.max(0, y), z);
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

function createMountainCluster(seed) {
  const group = new THREE.Group();
  const peakCount = THREE.MathUtils.randInt(4, 7);
  const colliders = [];

  for (let peak = 0; peak < peakCount; peak += 1) {
    const radius = THREE.MathUtils.randFloat(14.5, 26.5) * (peak === 0 ? 1.28 : 0.92);
    const height = THREE.MathUtils.randFloat(8.5, 18.5) * (peak === 0 ? 1.18 : 0.9);
    const positionX = (peak - peakCount / 2) * THREE.MathUtils.randFloat(14, 24) + THREE.MathUtils.randFloatSpread(6);
    const positionZ = THREE.MathUtils.randFloatSpread(22);
    const mountain = new THREE.Mesh(
      createMountainGeometry(radius, height, seed + peak * 7.31),
      peak % 2 === 0 ? materials.mountain : materials.mountainDark,
    );
    mountain.position.set(positionX, 0, positionZ);
    mountain.scale.set(1.55 + peak * 0.05, 0.58 + peak * 0.02, 1.2);
    mountain.rotation.y = THREE.MathUtils.randFloat(0, Math.PI * 2);
    mountain.castShadow = true;
    mountain.receiveShadow = true;
    group.add(mountain);
    colliders.push({
      x: positionX,
      z: positionZ,
      radius: radius * 1.08,
    });
  }

  for (let stone = 0; stone < 24; stone += 1) {
    const angle = THREE.MathUtils.randFloat(0, Math.PI * 2);
    const distance = THREE.MathUtils.randFloat(20, 58);
    const scree = new THREE.Mesh(
      new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(0.28, 1.85), stone % 4 === 0 ? 0 : 1),
      materials.scree,
    );
    scree.position.set(Math.cos(angle) * distance, THREE.MathUtils.randFloat(0.04, 0.18), Math.sin(angle) * distance);
    scree.scale.set(THREE.MathUtils.randFloat(1.6, 4.8), THREE.MathUtils.randFloat(0.25, 0.75), THREE.MathUtils.randFloat(1.2, 3.9));
    scree.rotation.set(THREE.MathUtils.randFloat(0, Math.PI), THREE.MathUtils.randFloat(0, Math.PI), THREE.MathUtils.randFloat(0, Math.PI));
    scree.castShadow = true;
    scree.receiveShadow = true;
    group.add(scree);
  }

  group.userData = {
    speedFactor: 1,
    colliders,
  };
  return group;
}

function createMesaRidgeGeometry(width, depth, height, seed) {
  const segments = 28;
  const verticalSegments = 10;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const positions = [];
  const indices = [];
  const topHeights = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const x = THREE.MathUtils.lerp(-halfWidth, halfWidth, t);
    const plateau = Math.floor(smoothNoise(seed + i * 0.39, seed - 4) * 4) / 4;
    const weathering = (smoothNoise(seed - 10 + i * 0.7, seed + i * 0.21) - 0.5) * height * 0.12;
    const edgeDrop = Math.pow(Math.abs(t - 0.5) * 2, 1.7) * height * 0.34;
    topHeights.push(THREE.MathUtils.clamp(height * (0.76 + plateau * 0.1) - edgeDrop + weathering, height * 0.18, height * 0.94));
  }

  function addCliffFace(z, zSign) {
    const start = positions.length / 3;
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const x = THREE.MathUtils.lerp(-halfWidth, halfWidth, t);
      const topY = topHeights[i];
      const cliffCut = (smoothNoise(seed + i * 0.31, seed + zSign * 8.7) - 0.5) * 1.8;
      const edgeSign = t < 0.5 ? -1 : 1;
      const edgeFan = Math.pow(Math.abs(t - 0.5) * 2, 1.55) * width * 0.08 * edgeSign;

      for (let j = 0; j <= verticalSegments; j += 1) {
        const v = j / verticalSegments;
        const skirt = Math.pow(1 - v, 1.35);
        const ledge = Math.sin(v * Math.PI * 9.5 + seed + i * 0.28) * 0.42 * (1 - v * 0.22);
        const faceRelief = (smoothNoise(seed + i * 0.44, seed + j * 0.53 + zSign * 3.2) - 0.5) * 1.1;
        const y = topY * Math.pow(v, 0.86);
        positions.push(
          x + cliffCut * skirt * 0.35 + edgeFan * skirt,
          y,
          z + (ledge + faceRelief + skirt * depth * 0.22) * zSign,
        );
      }
    }

    for (let i = 0; i < segments; i += 1) {
      for (let j = 0; j < verticalSegments; j += 1) {
        const a = start + i * (verticalSegments + 1) + j;
        const b = a + 1;
        const c = start + (i + 1) * (verticalSegments + 1) + j;
        const d = c + 1;
        if (zSign > 0) {
          indices.push(a, c, b, b, c, d);
        } else {
          indices.push(a, b, c, b, d, c);
        }
      }
    }

    return start;
  }

  const frontStart = addCliffFace(halfDepth, 1);
  const backStart = addCliffFace(-halfDepth, -1);

  for (let i = 0; i < segments; i += 1) {
    const frontA = frontStart + i * (verticalSegments + 1) + verticalSegments;
    const frontB = frontStart + (i + 1) * (verticalSegments + 1) + verticalSegments;
    const backA = backStart + i * (verticalSegments + 1) + verticalSegments;
    const backB = backStart + (i + 1) * (verticalSegments + 1) + verticalSegments;
    indices.push(frontA, frontB, backA, frontB, backB, backA);
  }

  const frontLeftBottom = frontStart;
  const frontLeftTop = frontStart + verticalSegments;
  const backLeftBottom = backStart;
  const backLeftTop = backStart + verticalSegments;
  const frontRightBottom = frontStart + segments * (verticalSegments + 1);
  const frontRightTop = frontRightBottom + verticalSegments;
  const backRightBottom = backStart + segments * (verticalSegments + 1);
  const backRightTop = backRightBottom + verticalSegments;
  indices.push(frontLeftBottom, frontLeftTop, backLeftBottom, frontLeftTop, backLeftTop, backLeftBottom);
  indices.push(frontRightBottom, backRightBottom, frontRightTop, frontRightTop, backRightBottom, backRightTop);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createMesaApronGeometry(width, depth, height, seed) {
  const segments = 28;
  const apronRows = 5;
  const halfWidth = width / 2;
  const positions = [];
  const indices = [];

  function addApron(zSign) {
    const start = positions.length / 3;

    for (let row = 0; row <= apronRows; row += 1) {
      const u = row / apronRows;
      const spread = 1 + u * 0.34;
      const z = zSign * (depth / 2 + depth * (0.22 + u * 0.82));
      for (let i = 0; i <= segments; i += 1) {
        const t = i / segments;
        const edgeFade = THREE.MathUtils.smoothstep(Math.min(t, 1 - t), 0.01, 0.12);
        const x = THREE.MathUtils.lerp(-halfWidth, halfWidth, t) * spread;
        const rumple = (smoothNoise(seed + i * 0.43, seed + row * 0.71 + zSign * 12) - 0.5) * height * 0.035;
        const fanHeight = height * 0.105 * Math.pow(1 - u, 1.55) * edgeFade;
        positions.push(x, fanHeight + rumple - u * 0.22, z);
      }
    }

    for (let row = 0; row < apronRows; row += 1) {
      for (let i = 0; i < segments; i += 1) {
        const a = start + row * (segments + 1) + i;
        const b = a + 1;
        const c = start + (row + 1) * (segments + 1) + i;
        const d = c + 1;
        if (zSign > 0) {
          indices.push(a, c, b, b, c, d);
        } else {
          indices.push(a, b, c, b, d, c);
        }
      }
    }
  }

  addApron(1);
  addApron(-1);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createMesaRange(seed, width, depth, height, material) {
  const group = new THREE.Group();
  const main = new THREE.Mesh(createMesaRidgeGeometry(width, depth, height, seed), material);
  main.castShadow = true;
  main.receiveShadow = true;
  group.add(main);

  const apron = new THREE.Mesh(createMesaApronGeometry(width * 1.04, depth, height, seed + 31), materials.scree);
  apron.position.y = -0.12;
  apron.castShadow = false;
  apron.receiveShadow = true;
  group.add(apron);

  const cap = new THREE.Mesh(
    createMesaRidgeGeometry(width * 0.3, depth * 0.48, height * 0.24, seed + 17),
    materials.mountainDark,
  );
  cap.position.set(width * (smoothNoise(seed + 3, seed + 9) - 0.5) * 0.42, height * 0.55, -depth * 0.16);
  cap.scale.y = 0.62;
  cap.castShadow = true;
  cap.receiveShadow = true;
  group.add(cap);

  for (let band = 0; band < 9; band += 1) {
    const bandWidth = width * THREE.MathUtils.randFloat(0.28, 0.86);
    const strata = new THREE.Mesh(new THREE.BoxGeometry(bandWidth, 0.38, 0.26), materials.mesaStrata);
    strata.position.set(
      THREE.MathUtils.randFloatSpread(width * 0.18),
      height * THREE.MathUtils.lerp(0.18, 0.73, band / 8),
      depth / 2 + 0.34 + band * 0.015,
    );
    strata.rotation.z = THREE.MathUtils.randFloatSpread(0.018);
    strata.castShadow = false;
    strata.receiveShadow = true;
    group.add(strata);
  }

  for (let wash = 0; wash < 12; wash += 1) {
    const washHeight = height * THREE.MathUtils.randFloat(0.22, 0.62);
    const ravine = new THREE.Mesh(new THREE.BoxGeometry(THREE.MathUtils.randFloat(0.45, 1.1), washHeight, 0.38), materials.mountainDark);
    ravine.position.set(
      THREE.MathUtils.randFloatSpread(width * 0.78),
      washHeight * 0.46 + height * THREE.MathUtils.randFloat(0.05, 0.16),
      depth / 2 + 0.54,
    );
    ravine.rotation.z = THREE.MathUtils.randFloatSpread(0.18);
    ravine.castShadow = false;
    ravine.receiveShadow = true;
    group.add(ravine);
  }

  for (let toe = 0; toe < 6; toe += 1) {
    const toeWidth = width * THREE.MathUtils.randFloat(0.06, 0.14);
    const toeMesh = new THREE.Mesh(
      createHillGeometry(toeWidth, height * THREE.MathUtils.randFloat(0.055, 0.12), seed + toe * 5.9),
      toe % 2 === 0 ? materials.scree : materials.mountain,
    );
    toeMesh.position.set(
      THREE.MathUtils.randFloatSpread(width * 0.86),
      -0.04,
      depth * THREE.MathUtils.randFloat(0.48, 0.92),
    );
    toeMesh.scale.set(1.8, 0.82, THREE.MathUtils.randFloat(0.5, 0.9));
    toeMesh.rotation.y = THREE.MathUtils.randFloatSpread(0.42);
    toeMesh.castShadow = false;
    toeMesh.receiveShadow = true;
    group.add(toeMesh);
  }

  return group;
}

function createDistantMesaGround(width, depth, centerZ) {
  const geometry = new THREE.PlaneGeometry(width, depth, 64, 14);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);

  for (let i = 0; i < positions.count; i += 1) {
    const worldX = positions.getX(i);
    const worldZ = positions.getZ(i) + centerZ;
    const lowRise = THREE.MathUtils.clamp((fbm(worldX * 0.45 + 11, worldZ * 0.35 - 7) + 0.55) * 0.75, 0, 1);
    positions.setY(i, terrainHeight(worldX, worldZ) - 0.18 + lowRise * 0.42);

    const color = rustBase.clone();
    const mineralNoise = smoothNoise(worldX * 0.04 + 5, worldZ * 0.04 - 12);
    color.lerp(rustLight, THREE.MathUtils.clamp((mineralNoise - 0.3) * 0.28, 0, 0.18));
    color.lerp(washDark, THREE.MathUtils.clamp((1 - mineralNoise) * 0.18, 0, 0.14));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const ground = new THREE.Mesh(geometry, materials.distantGround);
  ground.position.z = centerZ;
  ground.receiveShadow = true;
  return ground;
}

const mesaRangeLayout = [];

for (const [x, z, width, depth, height, seed] of mesaRangeLayout) {
  const mesa = createMesaRange(seed, width, depth, height, materials.mountain);
  mesa.position.set(x, terrainHeight(x, z) - 0.18, z);
  mesa.rotation.y = (smoothNoise(seed, seed + 4) - 0.5) * 0.16;
  world.add(mesa);
}

const rocks = [];
for (let i = 0; i < 150; i += 1) {
  const side = i % 2 === 0 ? -1 : 1;
  const x = side * THREE.MathUtils.randFloat(4.6, 40);
  const z = THREE.MathUtils.randFloat(-116, 24);
  const rockMaterials = [materials.rock, materials.rockDark, materials.rockLight];
  const rockRadius = THREE.MathUtils.randFloat(0.18, 1.25);
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(rockRadius, i % 3 === 0 ? 0 : 1),
    rockMaterials[i % rockMaterials.length],
  );
  rock.scale.set(THREE.MathUtils.randFloat(1, 2.05), THREE.MathUtils.randFloat(0.34, 0.9), THREE.MathUtils.randFloat(0.75, 1.7));
  rock.rotation.set(THREE.MathUtils.randFloat(0, Math.PI), THREE.MathUtils.randFloat(0, Math.PI), THREE.MathUtils.randFloat(0, Math.PI));
  rock.position.set(x, terrainHeight(x, z) + 0.18, z);
  rock.castShadow = true;
  rock.receiveShadow = true;
  rock.userData = {
    speedFactor: THREE.MathUtils.randFloat(0.82, 1.04),
    hitRadius: rockRadius * Math.max(rock.scale.x, rock.scale.y, rock.scale.z) * 1.35,
  };

  const strataCount = i % 4 === 0 ? 2 : 1;
  for (let band = 0; band < strataCount; band += 1) {
    const stratum = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.026, 0.085),
      band % 2 === 0 ? materials.rockStrata : materials.rockLight,
    );
    stratum.position.set(THREE.MathUtils.randFloatSpread(0.08), THREE.MathUtils.randFloat(-0.08, 0.16), THREE.MathUtils.randFloat(0.18, 0.44));
    stratum.rotation.set(THREE.MathUtils.randFloatSpread(0.18), THREE.MathUtils.randFloatSpread(0.3), THREE.MathUtils.randFloatSpread(0.12));
    stratum.scale.set(THREE.MathUtils.randFloat(0.65, 1.15), 1, THREE.MathUtils.randFloat(0.62, 1.05));
    stratum.castShadow = true;
    rock.add(stratum);
  }

  rocks.push(rock);
  world.add(rock);
}

const rockFragments = [];
const rockFragmentGeometry = new THREE.DodecahedronGeometry(0.18, 0);

for (let i = 0; i < 96; i += 1) {
  const fragmentMaterials = [materials.rock, materials.rockDark, materials.rockLight, materials.rockStrata];
  const fragment = new THREE.Mesh(rockFragmentGeometry, fragmentMaterials[i % fragmentMaterials.length]);
  fragment.castShadow = true;
  fragment.receiveShadow = true;
  fragment.visible = false;
  fragment.userData = {
    age: 0,
    lifetime: 0.9,
    velocity: new THREE.Vector3(),
    rotationVelocity: new THREE.Vector3(),
  };
  rockFragments.push(fragment);
  world.add(fragment);
}

const clouds = [];
const cloudPuffGeometry = new THREE.SphereGeometry(1, 18, 10);

function placeCloudAround(cloud, originX, originZ, range = 320) {
  const angle = THREE.MathUtils.randFloat(0, Math.PI * 2);
  const distance = THREE.MathUtils.randFloat(range * 0.25, range);
  cloud.position.x = originX + Math.sin(angle) * distance;
  cloud.position.y = THREE.MathUtils.randFloat(24, 42);
  cloud.position.z = originZ + Math.cos(angle) * distance;
}

for (let i = 0; i < 28; i += 1) {
  const cloud = new THREE.Group();
  const puffCount = THREE.MathUtils.randInt(7, 11);
  for (let puff = 0; puff < puffCount; puff += 1) {
    const row = puff % 2;
    const mesh = new THREE.Mesh(cloudPuffGeometry, materials.cloud);
    mesh.scale.set(
      THREE.MathUtils.randFloat(3.8, 7.6),
      THREE.MathUtils.randFloat(0.42, 1.05),
      THREE.MathUtils.randFloat(1.5, 3.1),
    );
    mesh.position.set(
      puff * THREE.MathUtils.randFloat(1.9, 2.8) + THREE.MathUtils.randFloatSpread(1.2),
      THREE.MathUtils.randFloat(-0.15, 0.55),
      row * THREE.MathUtils.randFloat(1.2, 2.4) + THREE.MathUtils.randFloatSpread(1.2),
    );
    mesh.rotation.y = THREE.MathUtils.randFloat(-0.32, 0.32);
    cloud.add(mesh);

    if (puff % 3 !== 0) {
      const shade = new THREE.Mesh(cloudPuffGeometry, materials.cloudShade);
      shade.scale.copy(mesh.scale).multiply(new THREE.Vector3(0.94, 0.36, 0.9));
      shade.position.set(mesh.position.x + THREE.MathUtils.randFloatSpread(0.5), mesh.position.y - 0.38, mesh.position.z + THREE.MathUtils.randFloatSpread(0.35));
      shade.rotation.y = mesh.rotation.y;
      cloud.add(shade);
    }
  }
  cloud.scale.setScalar(THREE.MathUtils.randFloat(0.78, 1.18));
  cloud.rotation.y = THREE.MathUtils.randFloat(-0.22, 0.22);
  cloud.position.set(THREE.MathUtils.randFloatSpread(260), THREE.MathUtils.randFloat(24, 42), THREE.MathUtils.randFloatSpread(260));
  cloud.userData = { speedFactor: THREE.MathUtils.randFloat(0.025, 0.055) };
  clouds.push(cloud);
  scene.add(cloud);
}

const grassTufts = [];
const grassMaterials = [materials.grass, materials.grassPale, materials.grassDark];
for (let i = 0; i < 330; i += 1) {
  const group = new THREE.Group();
  const side = i % 2 === 0 ? -1 : 1;
  const x = side * THREE.MathUtils.randFloat(3.8, 31);
  const z = THREE.MathUtils.randFloat(-108, 18);

  const bladeCount = THREE.MathUtils.randInt(3, 7);
  for (let blade = 0; blade < bladeCount; blade += 1) {
    const bladeHeight = THREE.MathUtils.randFloat(0.38, 1.12);
    const bladeMesh = new THREE.Mesh(
      new THREE.ConeGeometry(THREE.MathUtils.randFloat(0.018, 0.038), bladeHeight, 4),
      grassMaterials[(i + blade) % grassMaterials.length],
    );
    bladeMesh.position.set(THREE.MathUtils.randFloatSpread(0.34), bladeHeight / 2, THREE.MathUtils.randFloatSpread(0.24));
    bladeMesh.rotation.z = THREE.MathUtils.randFloatSpread(0.58);
    bladeMesh.rotation.y = THREE.MathUtils.randFloat(0, Math.PI);
    group.add(bladeMesh);

    if ((i + blade) % 5 === 0) {
      const seedHead = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.09, 4, 6), materials.grassSeed);
      seedHead.position.set(bladeMesh.position.x, bladeHeight + THREE.MathUtils.randFloat(0.02, 0.08), bladeMesh.position.z);
      seedHead.rotation.set(THREE.MathUtils.randFloat(0.2, 0.75), 0, bladeMesh.rotation.z * 0.7);
      seedHead.castShadow = true;
      group.add(seedHead);
    }
  }

  group.position.set(x, terrainHeight(x, z) + 0.05, z);
  group.userData = { speedFactor: 1 };
  grassTufts.push(group);
  world.add(group);
}

const ship = new THREE.Group();
ship.scale.setScalar(0.8778);
ship.rotation.y = state.faceYaw;

const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.9, 12, 24), materials.ship);
torso.position.set(0, 0.2, 0);
torso.scale.set(0.94, 1.1, 0.68);
torso.castShadow = true;
ship.add(torso);

const waistSeal = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.038, 10, 32), materials.rubber);
waistSeal.position.set(0, -0.28, 0);
waistSeal.rotation.x = Math.PI / 2;
waistSeal.scale.set(1.18, 0.84, 1);
waistSeal.castShadow = true;
ship.add(waistSeal);

for (const side of [-1, 1]) {
  const hipPack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.12), materials.suitPanel);
  hipPack.position.set(side * 0.38, -0.24, 0.05);
  hipPack.rotation.set(0.06, side * -0.22, side * -0.06);
  hipPack.castShadow = true;
  ship.add(hipPack);

  const hipPackLatch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.018), materials.metalTrim);
  hipPackLatch.position.set(side * 0.38, -0.17, 0.12);
  hipPackLatch.rotation.z = side * -0.08;
  hipPackLatch.castShadow = true;
  ship.add(hipPackLatch);
}

const upperTorsoPanel = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.32, 0.035), materials.suitPanel);
upperTorsoPanel.position.set(0, 0.5, 0.285);
upperTorsoPanel.scale.set(1, 1, 0.72);
upperTorsoPanel.castShadow = true;
ship.add(upperTorsoPanel);

const lowerTorsoPanel = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.26, 0.035), materials.suitPanel);
lowerTorsoPanel.position.set(0, -0.05, 0.292);
lowerTorsoPanel.castShadow = true;
ship.add(lowerTorsoPanel);

for (const [x, y, sx, sy] of [
  [-0.23, -0.16, 0.16, 0.055],
  [0.19, 0.02, 0.12, 0.04],
  [-0.08, 0.58, 0.18, 0.035],
]) {
  const dustPatch = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.012), materials.suitDust);
  dustPatch.position.set(x, y, 0.323);
  dustPatch.rotation.z = THREE.MathUtils.randFloatSpread(0.18);
  ship.add(dustPatch);
}

const chestPanel = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.31, 0.07), materials.wing);
chestPanel.position.set(0, 0.3, 0.345);
chestPanel.castShadow = true;
ship.add(chestPanel);

const controlPlate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.035), materials.metalTrim);
controlPlate.position.set(-0.04, 0.32, 0.392);
controlPlate.castShadow = true;
ship.add(controlPlate);

const chestLight = new THREE.Mesh(
  new THREE.SphereGeometry(0.06, 12, 8),
  new THREE.MeshStandardMaterial({ color: 0x77f8ff, emissive: 0x2dd6ff, emissiveIntensity: 1.2, roughness: 0.2 }),
);
chestLight.position.set(0.18, 0.35, 0.42);
ship.add(chestLight);

for (const [x, y, color] of [
  [-0.13, 0.36, 0x2dd6ff],
  [-0.04, 0.36, 0xffb64f],
  [0.05, 0.36, 0xd9fff5],
]) {
  const indicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.018, 0.014),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.42, roughness: 0.25 }),
  );
  indicator.position.set(x, y, 0.432);
  ship.add(indicator);
}

for (const [x, y, width] of [
  [-0.18, 0.52, 0.18],
  [0.18, 0.52, 0.18],
  [-0.2, -0.02, 0.14],
  [0.2, -0.02, 0.14],
]) {
  const softPanel = new THREE.Mesh(new THREE.BoxGeometry(width, 0.03, 0.018), materials.fabricCrease);
  softPanel.position.set(x, y, 0.322);
  softPanel.castShadow = true;
  ship.add(softPanel);
}

for (const x of [-0.12, 0.02, 0.13]) {
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12), materials.darkSuit);
  dial.position.set(x, 0.34 + (x === 0.02 ? -0.04 : 0.035), 0.401);
  dial.rotation.x = Math.PI / 2;
  ship.add(dial);
}

for (const x of [-0.1, 0.04]) {
  const switchToggle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.018, 0.026), materials.rubber);
  switchToggle.position.set(x, 0.26, 0.414);
  switchToggle.rotation.z = x < 0 ? 0.28 : -0.18;
  ship.add(switchToggle);
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
helmet.position.set(0, 1.22, 0.045);
helmet.scale.set(0.98, 1.0, 0.95);
helmet.castShadow = true;
ship.add(helmet);

const helmetBand = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.028, 10, 44), materials.metalTrim);
helmetBand.position.set(0, 1.24, 0.05);
helmetBand.rotation.x = Math.PI / 2;
helmetBand.scale.set(1.08, 0.96, 1);
helmetBand.castShadow = true;
ship.add(helmetBand);

const helmetCrownBand = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.012, 8, 44), materials.suitShadow);
helmetCrownBand.position.set(0, 1.4, 0.025);
helmetCrownBand.rotation.x = Math.PI / 2;
helmetCrownBand.scale.set(1.0, 0.88, 1);
helmetCrownBand.castShadow = true;
ship.add(helmetCrownBand);

const visor = new THREE.Mesh(new THREE.SphereGeometry(0.305, 56, 28, 0, Math.PI, 0, Math.PI), materials.canopy);
visor.position.set(0, 1.24, 0.435);
visor.scale.set(1.04, 1, 0.82);
visor.castShadow = false;
ship.add(visor);

const visorSeal = new THREE.Mesh(new THREE.TorusGeometry(0.322, 0.025, 10, 56), materials.rubber);
visorSeal.position.set(0, 1.24, 0.438);
visorSeal.scale.set(1.04, 1, 1);
visorSeal.castShadow = true;
ship.add(visorSeal);

const visorGlow = new THREE.Mesh(new THREE.TorusGeometry(0.282, 0.012, 8, 48), materials.helmetGlass);
visorGlow.position.set(0, 1.24, 0.465);
visorGlow.scale.set(1.04, 1, 1);
visorGlow.castShadow = false;
ship.add(visorGlow);

const visorReflection = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.022, 0.012), materials.helmetGlass);
visorReflection.position.set(-0.09, 1.37, 0.665);
visorReflection.rotation.z = -0.22;
ship.add(visorReflection);

const visorLowerReflection = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.016, 0.012), materials.helmetGlass);
visorLowerReflection.position.set(0.12, 1.13, 0.658);
visorLowerReflection.rotation.z = -0.14;
ship.add(visorLowerReflection);

const chinVent = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.035), materials.rubber);
chinVent.position.set(0, 1.0, 0.43);
chinVent.castShadow = true;
ship.add(chinVent);

const helmetAnimatedParts = [helmet, helmetBand, helmetCrownBand, visor, visorSeal, visorGlow, visorReflection, visorLowerReflection, chinVent];

for (const side of [-1, 1]) {
  const cheekGuard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.035), materials.suitPanel);
  cheekGuard.position.set(side * 0.24, 1.12, 0.39);
  cheekGuard.rotation.set(0.1, side * 0.28, side * 0.08);
  cheekGuard.castShadow = true;
  ship.add(cheekGuard);
  helmetAnimatedParts.push(cheekGuard);
}

for (const side of [-1, 1]) {
  const helmetLatch = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 16), materials.metalTrim);
  helmetLatch.position.set(side * 0.43, 1.2, 0.18);
  helmetLatch.rotation.z = Math.PI / 2;
  helmetLatch.castShadow = true;
  ship.add(helmetLatch);
  helmetAnimatedParts.push(helmetLatch);

  const sideSensor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 0.055), materials.darkSuit);
  sideSensor.position.set(side * 0.36, 1.42, 0.08);
  sideSensor.rotation.y = side * 0.36;
  sideSensor.castShadow = true;
  ship.add(sideSensor);
  helmetAnimatedParts.push(sideSensor);
}

const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.82, 0.27), materials.backpack);
backpack.position.set(0, 0.3, -0.39);
backpack.castShadow = true;
ship.add(backpack);

const backpackRidge = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.05), materials.metalTrim);
backpackRidge.position.set(0, 0.62, -0.545);
backpackRidge.castShadow = true;
ship.add(backpackRidge);

const backpackAnimatedParts = [backpack, backpackRidge];

for (const [x, y, sx, sy] of [
  [-0.18, 0.42, 0.09, 0.18],
  [0.18, 0.42, 0.09, 0.18],
  [0, 0.04, 0.22, 0.12],
]) {
  const backpackPanel = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.035), materials.suitPanel);
  backpackPanel.position.set(x, y, -0.695);
  backpackPanel.castShadow = true;
  ship.add(backpackPanel);
  backpackAnimatedParts.push(backpackPanel);
}

const jetpackFlames = new THREE.Group();
const jetpackFlameGeometry = new THREE.ConeGeometry(0.09, 1.9, 20, 1, true);
jetpackFlameGeometry.rotateX(-Math.PI / 2);
jetpackFlameGeometry.translate(0, 0, -0.95);
const jetpackCoreGeometry = new THREE.ConeGeometry(0.04, 1.25, 16, 1, true);
jetpackCoreGeometry.rotateX(-Math.PI / 2);
jetpackCoreGeometry.translate(0, 0, -0.625);

for (const side of [-1, 1]) {
  const x = side * 0.36;
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.058, 0.08, 16), materials.rubber);
  nozzle.position.set(x, 0.08, -0.575);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.castShadow = true;
  ship.add(nozzle);

  const flame = new THREE.Group();
  const outer = new THREE.Mesh(jetpackFlameGeometry, materials.jetpackFlame.clone());
  const core = new THREE.Mesh(jetpackCoreGeometry, materials.jetpackCore.clone());
  flame.position.set(x, 0.08, -0.66);
  flame.userData = { outer, core, side };
  flame.visible = false;
  flame.add(outer, core);
  jetpackFlames.add(flame);
}
ship.add(jetpackFlames);

for (const side of [-1, 1]) {
  const oxygenCanister = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.72, 16), materials.metalTrim);
  oxygenCanister.position.set(side * 0.22, 0.28, -0.59);
  oxygenCanister.rotation.x = 0.05;
  oxygenCanister.castShadow = true;
  ship.add(oxygenCanister);

  for (const y of [0.03, 0.53]) {
    const canisterStrap = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 8, 18), materials.rubber);
    canisterStrap.position.set(side * 0.22, y, -0.59);
    canisterStrap.rotation.x = Math.PI / 2;
    canisterStrap.castShadow = true;
    ship.add(canisterStrap);
  }
}

const lifeSupportHose = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.014, 8, 32, Math.PI * 1.22), materials.rubber);
lifeSupportHose.position.set(-0.28, 0.68, -0.24);
lifeSupportHose.rotation.set(0.34, -0.18, 1.78);
lifeSupportHose.castShadow = true;
ship.add(lifeSupportHose);

const secondaryHose = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.011, 8, 32, Math.PI * 1.08), materials.rubber);
secondaryHose.position.set(0.27, 0.51, -0.25);
secondaryHose.rotation.set(0.45, 0.16, -1.65);
secondaryHose.castShadow = true;
ship.add(secondaryHose);

function addRingDetail(parent, radius, y, material, thickness = 0.009) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 8, 24), material);
  ring.position.y = y;
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = true;
  parent.add(ring);
  return ring;
}

const laserBeamGeometry = new THREE.CylinderGeometry(0.03, 0.052, 88, 12, 1, true);
laserBeamGeometry.rotateX(Math.PI / 2);
const laserGlowGeometry = new THREE.CylinderGeometry(0.1, 0.2, 86, 12, 1, true);
laserGlowGeometry.rotateX(Math.PI / 2);
let handLaser = null;
const laserBaseRotation = new THREE.Euler(0.14, -0.06, -0.1);
const laserShotCoreGeometry = new THREE.SphereGeometry(0.17, 18, 12);
const laserShotTrailGeometry = new THREE.CylinderGeometry(0.035, 0.085, 0.85, 12, 1, true);
laserShotTrailGeometry.rotateX(Math.PI / 2);
const laserShots = [];
let laserShotIndex = 0;
const laserMuzzleWorld = new THREE.Vector3();
const laserShotDirection = new THREE.Vector3();
const laserShotTarget = new THREE.Vector3();
const laserForwardLocal = new THREE.Vector3(0, 0, 1);
const laserForwardBasis = new THREE.Vector3(0, 0, 1);
const laserBeamOrigin = new THREE.Vector3();
const laserBeamDirection = new THREE.Vector3();
const rockHitOffset = new THREE.Vector3();
const rockFragmentVelocity = new THREE.Vector3();
let rockFragmentIndex = 0;

for (let i = 0; i < 34; i += 1) {
  const shot = new THREE.Group();
  const core = new THREE.Mesh(laserShotCoreGeometry, materials.laserShotCore.clone());
  const trail = new THREE.Mesh(laserShotTrailGeometry, materials.laserShot.clone());

  core.material.opacity = 0;
  trail.material.opacity = 0;
  trail.position.z = -0.42;
  shot.add(core, trail);
  shot.visible = false;
  shot.userData = {
    age: 0,
    lifetime: 0.78,
    velocity: new THREE.Vector3(),
    core,
    trail,
  };
  laserShots.push(shot);
  scene.add(shot);
}
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
  addRingDetail(upperArm, 0.102, 0.16, materials.fabricCrease, 0.007);
  addRingDetail(upperArm, 0.102, -0.08, materials.fabricCrease, 0.007);

  const upperArmPatch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.018), materials.suitPanel);
  upperArmPatch.position.set(0, 0.06, 0.102);
  upperArmPatch.rotation.z = side * -0.18;
  upperArmPatch.castShadow = true;
  upperArm.add(upperArmPatch);

  const elbowPad = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), materials.suitShadow);
  elbowPad.position.set(0, -0.24, 0.07);
  elbowPad.scale.set(1.2, 0.42, 0.58);
  elbowPad.castShadow = true;
  upperArm.add(elbowPad);

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

  for (const finger of [-0.048, -0.016, 0.016, 0.048]) {
    const gloveFinger = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.09, 5, 8), materials.rubber);
    gloveFinger.position.set(finger * side, -0.035, 0.105);
    gloveFinger.rotation.x = 0.46;
    gloveFinger.castShadow = true;
    glove.add(gloveFinger);
  }

  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.08, 5, 8), materials.rubber);
  thumb.position.set(side * 0.095, -0.01, 0.02);
  thumb.rotation.set(0.32, 0, side * -0.72);
  thumb.castShadow = true;
  glove.add(thumb);

  if (side < 0) {
    const laserGroup = new THREE.Group();
    laserGroup.position.set(-0.035, -0.02, 0.17);
    laserGroup.rotation.copy(laserBaseRotation);
    glove.add(laserGroup);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.16, 0.07), materials.laserGun);
    grip.position.set(0.005, -0.055, -0.015);
    grip.rotation.x = -0.42;
    grip.castShadow = true;
    laserGroup.add(grip);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.32), materials.laserGun);
    body.position.set(0, 0.015, 0.095);
    body.castShadow = true;
    laserGroup.add(body);

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 0.22), materials.metalTrim);
    topRail.position.set(0, 0.07, 0.09);
    topRail.castShadow = true;
    laserGroup.add(topRail);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.34, 16), materials.laserGun);
    barrel.position.set(0, 0.018, 0.32);
    barrel.rotation.x = Math.PI / 2;
    barrel.castShadow = true;
    laserGroup.add(barrel);

    const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.045, 16), materials.laserEmitter);
    emitter.position.set(0, 0.018, 0.515);
    emitter.rotation.x = Math.PI / 2;
    emitter.castShadow = true;
    laserGroup.add(emitter);

    const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 10), materials.laserBeam.clone());
    muzzleFlash.position.set(0, 0.018, 0.545);
    muzzleFlash.visible = false;
    laserGroup.add(muzzleFlash);

    const beam = new THREE.Mesh(laserBeamGeometry, materials.laserBeam.clone());
    beam.position.set(0, 0.018, 44.55);
    beam.visible = false;
    laserGroup.add(beam);

    const glow = new THREE.Mesh(laserGlowGeometry, materials.laserBeam.clone());
    glow.position.set(0, 0.018, 43.8);
    glow.visible = false;
    laserGroup.add(glow);

    handLaser = { group: laserGroup, beam, glow, muzzleFlash, emitter };
  }

  const hip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), materials.suitTrim);
  hip.position.set(side * 0.23, -0.34, 0.02);
  hip.castShadow = true;
  ship.add(hip);

  const thighRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 8, 24), materials.metalTrim);
  thighRing.position.set(side * 0.24, -0.48, 0.04);
  thighRing.rotation.set(Math.PI / 2, 0, side * -0.08);
  thighRing.castShadow = true;
  ship.add(thighRing);

  const upperLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.34, 8, 16), materials.ship);
  upperLeg.position.set(side * 0.24, -0.58, 0.055);
  upperLeg.rotation.z = side * -0.06;
  upperLeg.castShadow = true;
  ship.add(upperLeg);
  addRingDetail(upperLeg, 0.112, 0.12, materials.fabricCrease, 0.007);
  addRingDetail(upperLeg, 0.112, -0.09, materials.fabricCrease, 0.007);

  const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.56, 8, 16), materials.ship);
  leg.position.set(side * 0.24, -0.72, 0.03);
  leg.rotation.z = side * -0.09;
  leg.castShadow = true;
  ship.add(leg);
  addRingDetail(leg, 0.124, 0.18, materials.fabricCrease, 0.008);
  addRingDetail(leg, 0.124, -0.08, materials.fabricCrease, 0.008);

  const shinPlate = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.22, 0.028), materials.suitPanel);
  shinPlate.position.set(0, -0.1, 0.116);
  shinPlate.castShadow = true;
  leg.add(shinPlate);

  const calfHinge = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.19, 10), materials.metalTrim);
  calfHinge.position.set(side * -0.075, -0.08, 0.055);
  calfHinge.rotation.z = Math.PI / 2;
  calfHinge.castShadow = true;
  leg.add(calfHinge);

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
  boot.scale.set(1.05, 0.9, 1.12);
  boot.rotation.z = side * -0.04;
  boot.castShadow = true;
  ship.add(boot);

  const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.38), materials.darkSuit);
  bootSole.position.set(side * 0.25, -1.17, 0.14);
  bootSole.scale.set(1.08, 1, 1.14);
  bootSole.rotation.z = side * -0.04;
  bootSole.castShadow = true;
  ship.add(bootSole);

  for (const z of [-0.11, 0.02, 0.15]) {
    const tread = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.014, 0.032), materials.bootTread);
    tread.position.set(0, -0.028, z);
    tread.castShadow = true;
    bootSole.add(tread);
  }

  const toeCap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.08), materials.metalTrim);
  toeCap.position.set(0, -0.016, 0.195);
  toeCap.castShadow = true;
  boot.add(toeCap);

  const bootDust = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.018, 0.18), materials.suitDust);
  bootDust.position.set(0, 0.046, 0.02);
  bootDust.rotation.x = 0.06;
  bootDust.castShadow = true;
  boot.add(bootDust);

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
    upperLeg,
    leg,
    kneePad,
    ankleRing,
    boot,
    bootSole,
    base: {
      shoulderPosition: shoulder.position.clone(),
      shoulderRingPosition: shoulderRing.position.clone(),
      shoulderRingRotation: shoulderRing.rotation.clone(),
      upperArmPosition: upperArm.position.clone(),
      upperArmRotation: upperArm.rotation.clone(),
      wristRingPosition: wristRing.position.clone(),
      wristRingRotation: wristRing.rotation.clone(),
      glovePosition: glove.position.clone(),
      hipPosition: hip.position.clone(),
      thighRingPosition: thighRing.position.clone(),
      thighRingRotation: thighRing.rotation.clone(),
      upperLegPosition: upperLeg.position.clone(),
      upperLegRotation: upperLeg.rotation.clone(),
      legPosition: leg.position.clone(),
      legRotation: leg.rotation.clone(),
      kneePadPosition: kneePad.position.clone(),
      kneePadRotation: kneePad.rotation.clone(),
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

const bodyRig = {
  torso: {
    mesh: torso,
    position: torso.position.clone(),
    rotation: torso.rotation.clone(),
  },
  waistSeal: {
    mesh: waistSeal,
    position: waistSeal.position.clone(),
    rotation: waistSeal.rotation.clone(),
  },
  backpackParts: backpackAnimatedParts.map((mesh) => ({
    mesh,
    position: mesh.position.clone(),
    rotation: mesh.rotation.clone(),
  })),
  headParts: [...helmetAnimatedParts, antenna, antennaTip].map((mesh) => ({
    mesh,
    position: mesh.position.clone(),
    rotation: mesh.rotation.clone(),
  })),
};

ship.position.set(0, terrainHeight(0, playerMovement.startZ) + playerGroundOffset, playerMovement.startZ);
scene.add(ship);
updateTerrainAroundPlayer();

const footprintGeometry = new THREE.CircleGeometry(1, 24);
footprintGeometry.rotateX(-Math.PI / 2);
const footprintPool = [];
let footprintIndex = 0;

for (let i = 0; i < 80; i += 1) {
  const group = new THREE.Group();
  const heelMaterial = materials.footprint.clone();
  const toeMaterial = materials.footprint.clone();
  const heel = new THREE.Mesh(footprintGeometry, heelMaterial);
  const toe = new THREE.Mesh(footprintGeometry, toeMaterial);

  heel.scale.set(0.105, 1, 0.15);
  heel.position.z = -0.075;
  toe.scale.set(0.13, 1, 0.18);
  toe.position.z = 0.11;
  group.add(heel, toe);
  group.visible = false;
  group.userData = {
    age: 0,
    lifetime: 9,
    marks: [heel, toe],
  };
  footprintPool.push(group);
  world.add(group);
}

const footDustGeometry = new THREE.SphereGeometry(1, 8, 6);
const footDustPuffs = [];
let footDustIndex = 0;

for (let i = 0; i < 72; i += 1) {
  const material = materials.footDust.clone();
  const puff = new THREE.Mesh(footDustGeometry, material);
  puff.visible = false;
  puff.userData = {
    age: 0,
    lifetime: 0.72,
    velocity: new THREE.Vector3(),
    startScale: 0.12,
    endScale: 0.7,
  };
  footDustPuffs.push(puff);
  scene.add(puff);
}

const footWorldPosition = new THREE.Vector3();
const stepBackVector = new THREE.Vector3();
const stepDustVelocity = new THREE.Vector3();

function resetFootEffects() {
  footprintIndex = 0;
  footDustIndex = 0;
  for (const rig of limbRig) {
    rig.wasFootPlanted = false;
  }
  for (const footprint of footprintPool) {
    footprint.visible = false;
    footprint.userData.age = 0;
  }
  for (const puff of footDustPuffs) {
    puff.visible = false;
    puff.userData.age = 0;
    puff.material.opacity = 0;
  }
}

function shatterRock(rock, impactPosition) {
  const fragmentCount = THREE.MathUtils.randInt(6, 10);
  const baseRadius = rock.userData.hitRadius || 1;

  for (let i = 0; i < fragmentCount; i += 1) {
    const fragment = rockFragments[rockFragmentIndex];
    rockFragmentIndex = (rockFragmentIndex + 1) % rockFragments.length;
    const angle = THREE.MathUtils.randFloat(0, Math.PI * 2);
    const lift = THREE.MathUtils.randFloat(1.1, 2.7);
    const spread = THREE.MathUtils.randFloat(1.8, 4.8);

    fragment.position.set(
      impactPosition.x + THREE.MathUtils.randFloatSpread(baseRadius * 0.45),
      terrainHeight(impactPosition.x, impactPosition.z) + THREE.MathUtils.randFloat(0.18, 0.58),
      impactPosition.z + THREE.MathUtils.randFloatSpread(baseRadius * 0.45),
    );
    fragment.rotation.set(THREE.MathUtils.randFloat(0, Math.PI), THREE.MathUtils.randFloat(0, Math.PI), THREE.MathUtils.randFloat(0, Math.PI));
    fragment.scale.setScalar(THREE.MathUtils.randFloat(0.45, 1.25) * Math.min(1.8, baseRadius));
    fragment.visible = true;
    fragment.userData.age = 0;
    fragment.userData.lifetime = THREE.MathUtils.randFloat(0.72, 1.05);
    fragment.userData.velocity.set(Math.cos(angle) * spread, lift, Math.sin(angle) * spread);
    fragment.userData.rotationVelocity.set(
      THREE.MathUtils.randFloatSpread(4.8),
      THREE.MathUtils.randFloatSpread(5.8),
      THREE.MathUtils.randFloatSpread(4.8),
    );
  }

  placeGroundObjectAroundPlayer(rock, 0.18, 152, 36);
}

function findRockHitByPoint(position, extraRadius = 0.25) {
  for (const rock of rocks) {
    const dx = position.x - rock.position.x;
    const dz = position.z - rock.position.z;
    const horizontalDistance = Math.hypot(dx, dz);
    const radius = (rock.userData.hitRadius || 1) + extraRadius;
    if (horizontalDistance > radius) continue;

    const rockSurfaceY = terrainHeight(rock.position.x, rock.position.z) + 1.35;
    if (Math.abs(position.y - rockSurfaceY) > 2.2) continue;
    return rock;
  }

  return null;
}

function findRockHitByRay(origin, direction, maxDistance = 28) {
  let closestRock = null;
  let closestDistance = maxDistance;
  const directionLengthSq = direction.x * direction.x + direction.z * direction.z;
  if (directionLengthSq <= 0.0001) return null;

  for (const rock of rocks) {
    rockHitOffset.subVectors(rock.position, origin);
    const along = THREE.MathUtils.clamp((rockHitOffset.x * direction.x + rockHitOffset.z * direction.z) / directionLengthSq, 0, maxDistance);
    if (along >= closestDistance) continue;

    const closestX = origin.x + direction.x * along;
    const closestZ = origin.z + direction.z * along;
    const horizontalDistance = Math.hypot(rock.position.x - closestX, rock.position.z - closestZ);
    if (horizontalDistance > (rock.userData.hitRadius || 1) + 0.2) continue;

    const beamY = origin.y + direction.y * along;
    const rockSurfaceY = terrainHeight(rock.position.x, rock.position.z) + 1.35;
    if (Math.abs(beamY - rockSurfaceY) > 2.6) continue;

    closestRock = rock;
    closestDistance = along;
  }

  return closestRock;
}

function updateRockFragments(delta) {
  for (const fragment of rockFragments) {
    if (!fragment.visible) continue;
    fragment.userData.age += delta;
    fragment.position.addScaledVector(fragment.userData.velocity, delta);
    fragment.userData.velocity.y -= 6.2 * delta;
    fragment.rotation.x += fragment.userData.rotationVelocity.x * delta;
    fragment.rotation.y += fragment.userData.rotationVelocity.y * delta;
    fragment.rotation.z += fragment.userData.rotationVelocity.z * delta;

    const groundY = terrainHeight(fragment.position.x, fragment.position.z) + 0.08;
    if (fragment.position.y < groundY) {
      fragment.position.y = groundY;
      fragment.userData.velocity.y *= -0.24;
      fragment.userData.velocity.x *= 0.76;
      fragment.userData.velocity.z *= 0.76;
    }

    const progress = THREE.MathUtils.clamp(fragment.userData.age / fragment.userData.lifetime, 0, 1);
    fragment.scale.multiplyScalar(1 - progress * 0.02);
    if (progress >= 1) {
      fragment.visible = false;
    }
  }
}

function updateLaser(delta) {
  if (!handLaser) return;
  const targetPitch = laserBaseRotation.x + (0.5 - state.aimY) * 0.78;
  const targetYaw = laserBaseRotation.y - (state.aimX - 0.5) * 1.28;
  handLaser.group.rotation.x = THREE.MathUtils.damp(handLaser.group.rotation.x, targetPitch, 14, delta);
  handLaser.group.rotation.y = THREE.MathUtils.damp(handLaser.group.rotation.y, targetYaw, 14, delta);
  handLaser.group.rotation.z = laserBaseRotation.z;

  const targetOpacity = state.running && state.laserActive && state.weaponMode === 'beam' ? 0.84 : 0;
  const currentOpacity = handLaser.beam.material.opacity;
  const nextOpacity = THREE.MathUtils.damp(currentOpacity, targetOpacity, 24, delta);
  const pulse = targetOpacity > 0 ? 0.82 + Math.sin(clock.elapsedTime * 32) * 0.18 : 0;

  handLaser.beam.visible = nextOpacity > 0.02;
  handLaser.glow.visible = nextOpacity > 0.02;
  handLaser.muzzleFlash.visible = nextOpacity > 0.02;
  handLaser.beam.material.opacity = nextOpacity * pulse;
  handLaser.glow.material.opacity = nextOpacity * 0.32 * pulse;
  handLaser.muzzleFlash.material.opacity = nextOpacity * 0.72 * pulse;
  handLaser.beam.scale.set(1 + pulse * 0.18, 1, 1);
  handLaser.glow.scale.set(1 + pulse * 0.14, 1, 1);
  handLaser.muzzleFlash.scale.setScalar(0.78 + pulse * 0.45);
  handLaser.emitter.material.emissiveIntensity = 1.5 + nextOpacity * 3.8 + (state.weaponMode === 'shots' && state.laserActive ? 1.4 : 0);

  if (state.beamHitCooldown > 0) {
    state.beamHitCooldown -= delta;
  }

  if (state.running && state.laserActive && state.weaponMode === 'beam' && state.beamHitCooldown <= 0) {
    handLaser.group.updateMatrixWorld(true);
    handLaser.group.localToWorld(laserBeamOrigin.set(0, 0.018, 0.58));
    laserBeamDirection.copy(laserForwardLocal).transformDirection(handLaser.group.matrixWorld).normalize();
    const rock = findRockHitByRay(laserBeamOrigin, laserBeamDirection, 96);
    if (rock) {
      shatterRock(rock, rock.position);
      state.beamHitCooldown = 0.18;
    }
  }
}

function emitLaserShot() {
  if (!handLaser) return;
  handLaser.group.updateMatrixWorld(true);
  handLaser.group.localToWorld(laserMuzzleWorld.set(0, 0.018, 0.58));
  laserShotDirection.copy(laserForwardLocal).transformDirection(handLaser.group.matrixWorld).normalize();
  laserShotDirection.y = Math.max(laserShotDirection.y, 0.035);
  laserShotDirection.normalize();

  const shot = laserShots[laserShotIndex];
  laserShotIndex = (laserShotIndex + 1) % laserShots.length;
  shot.position.copy(laserMuzzleWorld);
  shot.quaternion.setFromUnitVectors(laserForwardBasis, laserShotDirection);
  shot.visible = true;
  shot.userData.age = 0;
  shot.userData.lifetime = 5.4;
  shot.userData.velocity.copy(laserShotDirection).multiplyScalar(34);
  shot.userData.core.material.opacity = 1;
  shot.userData.trail.material.opacity = 0.58;
  shot.scale.setScalar(1);
}

function updateLaserShots(delta) {
  if (state.running && state.laserActive && state.weaponMode === 'shots') {
    state.shotCooldown -= delta;
    if (state.shotCooldown <= 0) {
      emitLaserShot();
      state.shotCooldown = 0.12;
    }
  } else {
    state.shotCooldown = Math.min(state.shotCooldown, 0.02);
  }

  for (const shot of laserShots) {
    if (!shot.visible) continue;
    shot.userData.age += delta;
    const progress = THREE.MathUtils.clamp(shot.userData.age / shot.userData.lifetime, 0, 1);
    shot.position.addScaledVector(shot.userData.velocity, delta);
    laserShotTarget.copy(shot.userData.velocity).normalize();
    shot.quaternion.setFromUnitVectors(laserForwardBasis, laserShotTarget);
    shot.scale.setScalar(1 + progress * 0.55);
    shot.userData.core.material.opacity = 1 * (1 - progress);
    shot.userData.trail.material.opacity = 0.58 * (1 - progress);
    const rock = findRockHitByPoint(shot.position, 0.42);
    if (rock) {
      shatterRock(rock, rock.position);
      shot.visible = false;
      continue;
    }
    if (progress >= 1) {
      shot.visible = false;
    }
  }
}

function emitFootprint(position, yaw) {
  const footprint = footprintPool[footprintIndex];
  footprintIndex = (footprintIndex + 1) % footprintPool.length;

  footprint.position.set(position.x, terrainHeight(position.x, position.z) + 0.028, position.z);
  footprint.rotation.set(0, yaw, 0);
  footprint.visible = true;
  footprint.userData.age = 0;

  for (const mark of footprint.userData.marks) {
    mark.material.opacity = 0.34;
  }
}

function emitFootDust(position, movementAmount) {
  const puffCount = movementAmount > 0.72 ? 2 : 1;
  for (let i = 0; i < puffCount; i += 1) {
    const puff = footDustPuffs[footDustIndex];
    footDustIndex = (footDustIndex + 1) % footDustPuffs.length;

    const spread = 0.1 + movementAmount * 0.14;
    puff.position.set(
      position.x + THREE.MathUtils.randFloatSpread(spread),
      terrainHeight(position.x, position.z) + THREE.MathUtils.randFloat(0.08, 0.2),
      position.z + THREE.MathUtils.randFloatSpread(spread),
    );
    puff.scale.setScalar(0.075 + movementAmount * 0.04);
    puff.material.opacity = 0.34;
    puff.visible = true;
    puff.userData.age = 0;
    puff.userData.lifetime = THREE.MathUtils.randFloat(0.48, 0.72);
    puff.userData.startScale = puff.scale.x;
    puff.userData.endScale = THREE.MathUtils.randFloat(0.38, 0.68);
    stepDustVelocity.set(
      -Math.sin(state.faceYaw) * THREE.MathUtils.randFloat(0.45, 1.0) + THREE.MathUtils.randFloatSpread(0.32),
      THREE.MathUtils.randFloat(0.18, 0.52),
      -Math.cos(state.faceYaw) * THREE.MathUtils.randFloat(0.45, 1.0) + THREE.MathUtils.randFloatSpread(0.32),
    );
    puff.userData.velocity.copy(stepDustVelocity);
  }
}

function emitStepEffects(movementAmount) {
  if (movementAmount < 0.16 || isPlayerStandingStill()) return;

  ship.updateMatrixWorld(true);
  stepBackVector.set(-Math.sin(state.faceYaw) * 0.12, 0, -Math.cos(state.faceYaw) * 0.12);

  for (const rig of limbRig) {
    if (rig.isFootPlanted && !rig.wasFootPlanted) {
      rig.bootSole.localToWorld(footWorldPosition.set(0, -0.03, 0.09));
      footWorldPosition.add(stepBackVector);
      emitFootprint(footWorldPosition, state.faceYaw);
      emitFootDust(footWorldPosition, movementAmount);
    }
    rig.wasFootPlanted = rig.isFootPlanted;
  }
}

function updateFootEffects(delta) {
  for (const footprint of footprintPool) {
    if (!footprint.visible) continue;
    footprint.userData.age += delta;
    const fade = 1 - THREE.MathUtils.smoothstep(footprint.userData.age, footprint.userData.lifetime * 0.62, footprint.userData.lifetime);
    for (const mark of footprint.userData.marks) {
      mark.material.opacity = 0.34 * fade;
    }
    if (footprint.userData.age >= footprint.userData.lifetime) {
      footprint.visible = false;
    }
  }

  for (const puff of footDustPuffs) {
    if (!puff.visible) continue;
    puff.userData.age += delta;
    const progress = THREE.MathUtils.clamp(puff.userData.age / puff.userData.lifetime, 0, 1);
    puff.position.addScaledVector(puff.userData.velocity, delta);
    puff.userData.velocity.y += delta * 0.12;
    puff.scale.setScalar(THREE.MathUtils.lerp(puff.userData.startScale, puff.userData.endScale, progress));
    puff.material.opacity = 0.34 * (1 - progress);
    if (progress >= 1) {
      puff.visible = false;
    }
  }
}

const clock = new THREE.Clock();

function resetGame() {
  state.running = true;
  state.score = 0;
  state.speed = 13.5;
  state.elapsed = 0;
  state.steer = 0;
  state.steerVelocity = 0;
  state.depthInput = 0;
  state.depthVelocity = 0;
  state.mouseSteer = 0;
  state.mouseDepth = 0;
  state.mouseMoveUntil = 0;
  state.aimX = 0.5;
  state.aimY = 0.5;
  state.sprinting = false;
  state.laserActive = false;
  state.shotCooldown = 0;
  state.beamHitCooldown = 0;
  state.jetpackActive = false;
  state.jetpackBurn = 0;
  state.flightHeight = 0;
  state.flightVelocity = 0;
  state.faceYaw = Math.PI;
  state.cameraOrbitYaw = Math.PI;
  state.cameraPitch = 0;
  state.runCycle = 0;
  activeKeys.clear();
  ship.position.x = 0;
  ship.position.z = playerMovement.startZ;
  ship.position.y = terrainHeight(0, ship.position.z) + playerGroundOffset;
  ship.rotation.y = state.faceYaw;
  updateTerrainAroundPlayer();
  resetSceneryAroundPlayer();
  resetFootEffects();
  overlayTitle.textContent = 'Rust Mesa';
  overlayCopy.textContent = 'Roam across rust-red terrain, dry grass, weathered rocks, low hills, and eroded desert washes.';
  startButton.textContent = 'Start run';
  overlay.classList.remove('visible');
  updateHud();
}

function gameOver() {
  state.running = false;
  state.best = Math.max(state.best, Math.floor(state.score));
  localStorage.setItem('orbital-drift-best', String(state.best));
  overlayTitle.textContent = 'Run ended';
  overlayCopy.textContent = `Score ${Math.floor(state.score)}. Launch again and push the run further.`;
  startButton.textContent = 'Restart';
  overlay.classList.add('visible');
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(Math.floor(state.score));
  bestEl.textContent = String(state.best);
}

function updateJetpack(delta) {
  const thrusting = state.running && state.jetpackActive;
  const targetBurn = thrusting ? 1 : 0;
  state.jetpackBurn = THREE.MathUtils.damp(state.jetpackBurn, targetBurn, thrusting ? 18 : 10, delta);
  const movementThrust = THREE.MathUtils.clamp(Math.hypot(state.depthVelocity, state.steerVelocity), 0, 1);
  const verticalThrust = state.jetpackBurn * (1 - movementThrust);

  for (const flame of jetpackFlames.children) {
    const flicker = 0.86 + Math.sin(clock.elapsedTime * 42 + flame.position.x * 19) * 0.14;
    const outwardAngle = 0.22 + Math.sin(clock.elapsedTime * 29 + flame.position.x * 7) * 0.04;
    const directionalSpread = state.jetpackBurn * (1 - verticalThrust * 0.86);
    flame.visible = state.jetpackBurn > 0.025;
    flame.scale.set(
      0.82 + state.jetpackBurn * 0.42 * flicker,
      0.82 + state.jetpackBurn * 0.26,
      0.74 + state.jetpackBurn * 2.0 * flicker,
    );
    flame.rotation.x = THREE.MathUtils.lerp(-0.18 * state.jetpackBurn, -Math.PI / 2, verticalThrust);
    flame.rotation.y = -flame.userData.side * outwardAngle * directionalSpread;
    flame.rotation.z = Math.sin(clock.elapsedTime * 34 + flame.position.x * 11) * 0.08 * directionalSpread;
    flame.userData.outer.material.opacity = state.jetpackBurn * 0.88;
    flame.userData.core.material.opacity = state.jetpackBurn * 0.9;
  }

  if (!state.running) {
    state.flightHeight = THREE.MathUtils.damp(state.flightHeight, 0, 8, delta);
    state.flightVelocity = 0;
    return;
  }

  if (thrusting) {
    state.flightVelocity += playerMovement.jetpackLift * delta;
  } else {
    state.flightVelocity -= playerMovement.jetpackGravity * delta;
  }

  state.flightVelocity = THREE.MathUtils.clamp(state.flightVelocity, -5.8, 5.2);
  state.flightHeight += state.flightVelocity * delta;

  if (state.flightHeight <= 0) {
    state.flightHeight = 0;
    state.flightVelocity = Math.max(0, state.flightVelocity);
  } else if (state.flightHeight >= playerMovement.jetpackMaxHeight) {
    state.flightHeight = playerMovement.jetpackMaxHeight;
    state.flightVelocity = Math.min(0, state.flightVelocity);
  }
}

function setDefaultCameraPerspective() {
  const isStandingStill = isPlayerStandingStill();
  const cameraYaw = isStandingStill ? state.cameraOrbitYaw : state.faceYaw;
  const followDistance = innerWidth < 720 ? 14.5 : 12;
  const lookAhead = isStandingStill ? 0 : innerWidth < 720 ? 9 : 10;
  const height = (innerWidth < 720 ? 6.1 : 5.3) + state.flightHeight * 0.45;
  const forwardX = Math.sin(cameraYaw);
  const forwardZ = Math.cos(cameraYaw);
  const horizontalLookAhead = lookAhead * Math.cos(state.cameraPitch * 0.65);
  const verticalLook = Math.sin(state.cameraPitch) * 22;

  camera.position.x = ship.position.x - forwardX * followDistance;
  camera.position.z = ship.position.z - forwardZ * followDistance;
  camera.position.y = height;
  camera.lookAt(
    ship.position.x + forwardX * horizontalLookAhead,
    ship.position.y + 0.55 + verticalLook,
    ship.position.z + forwardZ * horizontalLookAhead,
  );
}

function isPlayerStandingStill() {
  return Math.abs(state.depthInput) + Math.abs(state.steer) + Math.abs(state.depthVelocity) + Math.abs(state.steerVelocity) < 0.04;
}

function updateMovementInputs() {
  if (!state.running) return;
  const forward = activeKeys.has('w') || activeKeys.has('arrowup');
  const backward = activeKeys.has('s') || activeKeys.has('arrowdown');
  const left = activeKeys.has('a') || activeKeys.has('arrowleft');
  const right = activeKeys.has('d') || activeKeys.has('arrowright');
  const sprint = activeKeys.has('shift');
  const jetpack = activeKeys.has('space');

  state.depthInput = THREE.MathUtils.clamp((forward ? 1 : 0) + (backward ? -1 : 0), -1, 1);
  state.steer = THREE.MathUtils.clamp((right ? 1 : 0) + (left ? -1 : 0), -1, 1);
  state.sprinting = forward && !backward && sprint;
  state.jetpackActive = jetpack;
}

function moveWithMouse(event) {
  updateAimFromPointer(event);
  if (state.laserActive) return;
  if (!state.running || event.pointerType === 'touch') return;
  const movementX = event.movementX || 0;
  const movementY = event.movementY || 0;
  if (Math.abs(movementX) + Math.abs(movementY) < 0.5) return;

  const isStandingStill = isPlayerStandingStill();
  if (isStandingStill) {
    state.cameraOrbitYaw -= movementX * 0.006;
  } else {
    state.faceYaw -= movementX * 0.006;
    state.cameraOrbitYaw = state.faceYaw;
  }
  if (isStandingStill) {
    state.cameraPitch = THREE.MathUtils.clamp(state.cameraPitch - movementY * 0.0045, -0.55, 1.05);
  }
  state.mouseSteer = 0;
  state.mouseDepth = 0;
  state.mouseMoveUntil = performance.now() + 140;
  updateMovementInputs();
}

function setTouchSteer(direction) {
  if (!state.running) return;
  state.steer = direction;
}

function updateAimFromPointer(event) {
  if (event.pointerType === 'touch') return;
  state.aimX = THREE.MathUtils.clamp(event.clientX / Math.max(1, innerWidth), 0, 1);
  state.aimY = THREE.MathUtils.clamp(event.clientY / Math.max(1, innerHeight), 0, 1);
}

function setLaserActive(event, active) {
  if (event.button !== 0 || event.pointerType === 'touch') return;
  updateAimFromPointer(event);
  state.laserActive = active && state.running;
  if (state.laserActive && isPlayerStandingStill()) {
    state.faceYaw = state.cameraOrbitYaw;
  }
}

function getScatterPositionAroundPlayer(range = 128, minDistance = 12) {
  let x = ship.position.x;
  let z = ship.position.z;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    x = ship.position.x + THREE.MathUtils.randFloatSpread(range * 2);
    z = ship.position.z + THREE.MathUtils.randFloatSpread(range * 2);
    if (Math.hypot(x - ship.position.x, z - ship.position.z) >= minDistance) break;
  }

  return { x, z };
}

function placeGroundObjectAroundPlayer(object, yOffset, range = 128, minDistance = 12) {
  const { x, z } = getScatterPositionAroundPlayer(range, minDistance);
  object.position.x = x;
  object.position.z = z;
  object.position.y = terrainHeight(x, z) + yOffset;
}

function recycleGroundObjectAroundPlayer(object, yOffset, range = 136, minDistance = 24) {
  if (Math.abs(object.position.x - ship.position.x) > range || Math.abs(object.position.z - ship.position.z) > range) {
    placeGroundObjectAroundPlayer(object, yOffset, range, minDistance);
  }
}

function resolveMountainCollisions() {
  const playerRadius = 0.85;
  const localShipPosition = new THREE.Vector3();
  const localResolvedPosition = new THREE.Vector3();

  for (const mountain of mountains) {
    localShipPosition.copy(ship.position);
    mountain.worldToLocal(localShipPosition);
    localResolvedPosition.copy(localShipPosition);

    for (const collider of mountain.userData.colliders) {
      const radius = collider.radius + playerRadius / mountain.scale.x;
      const dx = localResolvedPosition.x - collider.x;
      const dz = localResolvedPosition.z - collider.z;
      const distance = Math.hypot(dx, dz);
      if (distance >= radius) continue;

      const pushX = distance > 0.001 ? dx / distance : Math.sin(state.faceYaw + Math.PI);
      const pushZ = distance > 0.001 ? dz / distance : Math.cos(state.faceYaw + Math.PI);
      localResolvedPosition.x = collider.x + pushX * radius;
      localResolvedPosition.z = collider.z + pushZ * radius;
    }

    if (!localResolvedPosition.equals(localShipPosition)) {
      mountain.localToWorld(localResolvedPosition);
      ship.position.x = localResolvedPosition.x;
      ship.position.z = localResolvedPosition.z;
    }
  }
}

function placeDustParticleAroundPlayer(index, range = 158) {
  const x = ship.position.x + THREE.MathUtils.randFloatSpread(range * 2);
  const z = ship.position.z + THREE.MathUtils.randFloatSpread(range * 2);
  const offset = index * 3;
  dustPositions[offset] = x;
  dustPositions[offset + 1] = terrainHeight(x, z) + THREE.MathUtils.randFloat(0.45, 3.2);
  dustPositions[offset + 2] = z;
}

function resetDustAroundPlayer() {
  dust.position.set(0, 0, 0);
  for (let i = 0; i < dustCount; i += 1) {
    placeDustParticleAroundPlayer(i, 158);
  }
  dust.geometry.attributes.position.needsUpdate = true;
}

function updateDust(delta) {
  for (let i = 0; i < dustCount; i += 1) {
    const offset = i * 3;
    dustPositions[offset] += dustDrift[i * 2] * delta * 60;
    dustPositions[offset + 1] += Math.sin(clock.elapsedTime * 0.8 + i * 0.37) * 0.002;
    dustPositions[offset + 2] += dustDrift[i * 2 + 1] * delta * 60;

    if (Math.abs(dustPositions[offset] - ship.position.x) > 132 || Math.abs(dustPositions[offset + 2] - ship.position.z) > 132) {
      placeDustParticleAroundPlayer(i, 164);
    }
  }
  dust.geometry.attributes.position.needsUpdate = true;
}

function resetSceneryAroundPlayer() {
  resetDustAroundPlayer();

  for (const tuft of grassTufts) {
    placeGroundObjectAroundPlayer(tuft, 0.05, 132, 12);
  }
  for (const hill of hills) {
    placeGroundObjectAroundPlayer(hill, 0.025, 158, 32);
  }
  for (const mountain of mountains) {
    placeGroundObjectAroundPlayer(mountain, 0.02, 940, 520);
  }
  for (const rock of rocks) {
    placeGroundObjectAroundPlayer(rock, 0.18, 146, 14);
  }
  for (const cloud of clouds) {
    placeCloudAround(cloud, ship.position.x, ship.position.z, 320);
  }
}

function updateRunAnimation(delta, movementAmount, movementDirection, sprintAmount) {
  const flightAmount = THREE.MathUtils.clamp(state.flightHeight * 0.7 + state.jetpackBurn, 0, 1);
  const groundedAmount = 1 - flightAmount;
  const runAmount = Math.min(1, movementAmount) * groundedAmount;
  const gaitAmount = THREE.MathUtils.smoothstep(runAmount, 0, 1);
  if (runAmount > 0.001) {
    state.runCycle += delta * (3.65 + runAmount * 3.15) * movementDirection * (1 + sprintAmount * 0.45);
  }

  const bodyPhase = state.runCycle;
  const bodySway = Math.sin(bodyPhase) * runAmount;
  const bodyRise = Math.max(0, -Math.cos(bodyPhase * 2)) * runAmount;
  const suitCompression = Math.max(0, Math.cos(bodyPhase * 2)) * runAmount;
  const breathing = Math.sin(clock.elapsedTime * 1.55) * 0.006 * (1 - runAmount);
  const steeringLean = THREE.MathUtils.clamp(state.steerVelocity, -1, 1) * 0.08;
  const sprintLean = sprintAmount * runAmount;

  bodyRig.torso.mesh.position.copy(bodyRig.torso.position);
  bodyRig.torso.mesh.position.y += bodyRise * 0.022 - suitCompression * 0.016 + breathing;
  bodyRig.torso.mesh.position.x += bodySway * 0.012;
  bodyRig.torso.mesh.position.z += sprintLean * 0.12;
  bodyRig.torso.mesh.rotation.copy(bodyRig.torso.rotation);
  bodyRig.torso.mesh.rotation.x += runAmount * 0.035 + sprintLean * 0.42 + flightAmount * 0.16;
  bodyRig.torso.mesh.rotation.y += bodySway * -0.055;
  bodyRig.torso.mesh.rotation.z += steeringLean + bodySway * -0.035;

  bodyRig.waistSeal.mesh.position.copy(bodyRig.waistSeal.position);
  bodyRig.waistSeal.mesh.position.y += bodyRise * 0.014 - suitCompression * 0.018;
  bodyRig.waistSeal.mesh.position.z += sprintLean * 0.052;
  bodyRig.waistSeal.mesh.rotation.copy(bodyRig.waistSeal.rotation);
  bodyRig.waistSeal.mesh.rotation.x += sprintLean * 0.22;
  bodyRig.waistSeal.mesh.rotation.y += bodySway * 0.045;
  bodyRig.waistSeal.mesh.rotation.z += steeringLean * 0.45;

  for (const part of bodyRig.backpackParts) {
    part.mesh.position.copy(part.position);
    part.mesh.position.y += bodyRise * 0.018 + flightAmount * 0.035;
    part.mesh.position.z -= flightAmount * 0.06 + sprintLean * 0.075;
    part.mesh.rotation.copy(part.rotation);
    part.mesh.rotation.x += sprintLean * 0.32 - flightAmount * 0.16;
    part.mesh.rotation.z += bodySway * -0.025 + steeringLean * 0.6;
  }

  for (const part of bodyRig.headParts) {
    part.mesh.position.copy(part.position);
    part.mesh.position.x += bodySway * 0.008;
    part.mesh.position.y += bodyRise * 0.012 + breathing * 0.4 - flightAmount * 0.018;
    part.mesh.position.z += runAmount * 0.012 + sprintLean * 0.115 - flightAmount * 0.035;
    part.mesh.rotation.copy(part.rotation);
    part.mesh.rotation.x += sprintLean * 0.28 - bodyRise * 0.018 - flightAmount * 0.1;
    part.mesh.rotation.y += bodySway * -0.038;
    part.mesh.rotation.z += bodySway * -0.022 + steeringLean * 0.35;
  }

  for (const rig of limbRig) {
    const phase = state.runCycle + (rig.side < 0 ? 0 : Math.PI);
    const phaseSin = Math.sin(phase);
    const phaseCos = Math.cos(phase);
    const stride = phaseSin * runAmount;
    const forwardStride = Math.max(0, stride);
    const backwardStride = Math.min(0, stride);
    const thighStride = forwardStride + backwardStride * 0.42;
    const lowerLegStride = forwardStride + backwardStride * 0.32;
    const hipSocketDrop = gaitAmount * 0.035;
    const rearLegTuck = Math.max(0, -backwardStride);
    const footLift = Math.pow(Math.max(0, phaseCos), 0.72) * runAmount;
    const footPlant = Math.pow(Math.max(0, -phaseCos), 2.2) * runAmount;
    const stepEase = Math.sin(phase + Math.PI * 0.18) * runAmount;
    const kneeSwing = Math.max(0, Math.sin(phase + Math.PI * 0.36)) * runAmount;
    const heelStrike = Math.max(0, -Math.sin(phase - Math.PI * 0.16)) * runAmount;
    const toePush = Math.max(0, Math.sin(phase - Math.PI * 0.38)) * runAmount;
    const footRoll = heelStrike * 0.18 - toePush * 0.28;
    const legLateralSway = Math.sin(phase + Math.PI * 0.5) * runAmount * 0.018;
    const armStride = -phaseSin * runAmount * (0.92 + sprintAmount * 0.12);
    const armLift = Math.pow(Math.max(0, -phaseCos), 0.78) * runAmount;
    const kneeBend = (footLift * 0.5 + kneeSwing * 0.28 + footPlant * 0.08) * gaitAmount;
    const kneeFlex = THREE.MathUtils.clamp(kneeBend * 1.45 + toePush * 0.18 - footPlant * 0.06, 0, 0.78);
    const groundSettle = footPlant * 0.035;
    const flightFlutter = Math.sin(clock.elapsedTime * 7 + rig.side * 0.8) * flightAmount;
    const { base } = rig;

    rig.shoulder.position.copy(base.shoulderPosition);
    rig.shoulder.position.y += armLift * 0.018 - gaitAmount * 0.01 - flightAmount * 0.035;
    rig.shoulder.position.z += armStride * 0.038 - flightAmount * 0.08;
    rig.shoulder.position.x += rig.side * (bodySway * -0.008 + flightAmount * 0.012);

    rig.shoulderRing.position.copy(base.shoulderRingPosition);
    rig.shoulderRing.position.y += armLift * 0.018 - gaitAmount * 0.01 - flightAmount * 0.035;
    rig.shoulderRing.position.z += armStride * 0.04 - flightAmount * 0.08;
    rig.shoulderRing.position.x += rig.side * (bodySway * -0.008 + flightAmount * 0.012);
    rig.shoulderRing.rotation.copy(base.shoulderRingRotation);
    rig.shoulderRing.rotation.x += armStride * 0.22 - flightAmount * 0.12;
    rig.shoulderRing.rotation.z += rig.side * (bodySway * 0.025 + flightAmount * 0.06);

    rig.upperArm.position.copy(base.upperArmPosition);
    rig.upperArm.position.x += rig.side * flightAmount * 0.015;
    rig.upperArm.position.y += armLift * 0.05 - gaitAmount * 0.012;
    rig.upperArm.position.y -= flightAmount * 0.035;
    rig.upperArm.position.z += armStride * 0.15 - flightAmount * 0.18;
    rig.upperArm.rotation.copy(base.upperArmRotation);
    rig.upperArm.rotation.x += armStride * (0.78 + sprintAmount * 0.16);
    rig.upperArm.rotation.z += rig.side * (runAmount * (0.06 + sprintAmount * 0.02) - footPlant * 0.035);
    rig.upperArm.rotation.x -= flightAmount * (0.68 + flightFlutter * 0.05);
    rig.upperArm.rotation.z += rig.side * flightAmount * 0.06;

    rig.wristRing.position.copy(base.wristRingPosition);
    rig.wristRing.position.x -= rig.side * flightAmount * 0.02;
    rig.wristRing.position.y += armLift * 0.062 - gaitAmount * 0.018;
    rig.wristRing.position.y -= flightAmount * 0.05;
    rig.wristRing.position.z += armStride * 0.24 - flightAmount * 0.34;
    rig.wristRing.rotation.copy(base.wristRingRotation);
    rig.wristRing.rotation.x += armStride * 0.54;
    rig.wristRing.rotation.x -= flightAmount * 0.34;

    rig.glove.position.copy(base.glovePosition);
    rig.glove.position.x -= rig.side * flightAmount * 0.045;
    rig.glove.position.y += armLift * 0.074 - gaitAmount * 0.02;
    rig.glove.position.y -= flightAmount * 0.08;
    rig.glove.position.z += armStride * 0.36 - flightAmount * 0.48;

    rig.hip.position.copy(base.hipPosition);
    rig.hip.position.x += rig.side * (bodySway * 0.012 + legLateralSway * 0.4 - flightAmount * 0.01);
    rig.hip.position.y += bodyRise * 0.02 - suitCompression * 0.018 - hipSocketDrop * 0.35 + flightAmount * 0.045;
    rig.hip.position.z += thighStride * 0.012 - rearLegTuck * 0.018 - flightAmount * 0.08;

    rig.thighRing.position.copy(base.thighRingPosition);
    rig.thighRing.position.x += rig.side * (legLateralSway * 0.35 - flightAmount * 0.015);
    rig.thighRing.position.y += footLift * 0.04 - groundSettle * 0.45 - hipSocketDrop;
    rig.thighRing.position.y += flightAmount * 0.06;
    rig.thighRing.position.z += thighStride * 0.064 - rearLegTuck * 0.026 - footPlant * 0.012 + stepEase * 0.012 - flightAmount * 0.1;
    rig.thighRing.rotation.copy(base.thighRingRotation);
    rig.thighRing.rotation.x += thighStride * 0.25 + kneeSwing * 0.05 - footPlant * 0.055;
    rig.thighRing.rotation.z += rig.side * legLateralSway * 0.5;
    rig.thighRing.rotation.x -= flightAmount * 0.18;

    rig.upperLeg.position.copy(base.upperLegPosition);
    rig.upperLeg.position.x += rig.side * (legLateralSway * 0.55 - flightAmount * 0.018);
    rig.upperLeg.position.y += footLift * 0.055 - groundSettle * 0.62 - hipSocketDrop * 0.92 + flightAmount * 0.08;
    rig.upperLeg.position.z += thighStride * 0.082 - rearLegTuck * 0.026 + kneeFlex * 0.028 - footPlant * 0.012 - flightAmount * 0.14;
    rig.upperLeg.rotation.copy(base.upperLegRotation);
    rig.upperLeg.rotation.x += thighStride * 0.42 - kneeFlex * 0.16 - footPlant * 0.05 - flightAmount * 0.36;
    rig.upperLeg.rotation.z += rig.side * (legLateralSway * 0.65 - footPlant * 0.012);

    rig.leg.position.copy(base.legPosition);
    rig.leg.position.x += rig.side * (legLateralSway * 0.7 - flightAmount * 0.025);
    rig.leg.position.y += footLift * 0.095 + kneeSwing * 0.028 - kneeFlex * 0.018 - groundSettle - hipSocketDrop;
    rig.leg.position.y += flightAmount * 0.12;
    rig.leg.position.z += thighStride * (0.098 + sprintAmount * 0.022) - rearLegTuck * 0.034 - footPlant * 0.018 - kneeSwing * 0.02 + kneeFlex * 0.065 + stepEase * 0.012 - flightAmount * 0.22;
    rig.leg.rotation.copy(base.legRotation);
    rig.leg.rotation.x += thighStride * (0.42 + sprintAmount * 0.08) - kneeFlex * 0.72 + toePush * 0.1 + heelStrike * 0.05;
    rig.leg.rotation.z += rig.side * (runAmount * 0.026 + legLateralSway * 0.8 - footPlant * 0.018);
    rig.leg.rotation.x -= flightAmount * (0.95 + flightFlutter * 0.06);
    rig.leg.rotation.z -= rig.side * flightAmount * 0.03;

    rig.kneePad.position.copy(base.kneePadPosition);
    rig.kneePad.position.x += rig.side * (legLateralSway * 0.8 - flightAmount * 0.025);
    rig.kneePad.position.y += footLift * 0.102 + kneeFlex * 0.055 - groundSettle - hipSocketDrop;
    rig.kneePad.position.y += flightAmount * 0.13;
    rig.kneePad.position.z += thighStride * 0.088 - rearLegTuck * 0.035 + kneeFlex * 0.11 - footPlant * 0.018 + stepEase * 0.01 - flightAmount * 0.28;
    rig.kneePad.rotation.copy(base.kneePadRotation);
    rig.kneePad.rotation.x += kneeFlex * 0.46 - footPlant * 0.08;

    rig.ankleRing.position.copy(base.ankleRingPosition);
    rig.ankleRing.position.x += rig.side * (legLateralSway - flightAmount * 0.03);
    rig.ankleRing.position.y += footLift * 0.132 + kneeSwing * 0.018 - kneeFlex * 0.04 - groundSettle * 1.1 - hipSocketDrop * 0.7;
    rig.ankleRing.position.y += flightAmount * 0.12;
    rig.ankleRing.position.z += lowerLegStride * 0.118 - rearLegTuck * 0.044 + kneeFlex * 0.035 - footPlant * 0.03 + toePush * 0.018 - flightAmount * 0.34;
    rig.ankleRing.rotation.copy(base.ankleRingRotation);
    rig.ankleRing.rotation.x += lowerLegStride * 0.26 - kneeFlex * 0.18 - footLift * 0.1 + footPlant * 0.08 + footRoll;
    rig.ankleRing.rotation.z += rig.side * (legLateralSway * 0.9 + heelStrike * 0.035);
    rig.ankleRing.rotation.x -= flightAmount * 0.58;

    rig.boot.position.copy(base.bootPosition);
    rig.boot.position.x += rig.side * (legLateralSway * 1.15 - flightAmount * 0.035);
    rig.boot.position.y += footLift * 0.15 + kneeSwing * 0.012 - kneeFlex * 0.035 - groundSettle * 1.35 - hipSocketDrop * 0.55;
    rig.boot.position.y += flightAmount * 0.1;
    rig.boot.position.z += lowerLegStride * (0.13 + sprintAmount * 0.028) - rearLegTuck * 0.052 + kneeFlex * 0.04 - footPlant * 0.04 + toePush * 0.02 - flightAmount * 0.44;
    rig.boot.rotation.copy(base.bootRotation);
    rig.boot.rotation.x += lowerLegStride * 0.2 - kneeFlex * 0.22 - footLift * 0.15 + footPlant * 0.1 + footRoll;
    rig.boot.rotation.z += rig.side * (legLateralSway * 1.1 + heelStrike * 0.04);
    rig.boot.rotation.x -= flightAmount * 1.04;

    rig.bootSole.position.copy(base.bootSolePosition);
    rig.bootSole.position.x += rig.side * (legLateralSway * 1.15 - flightAmount * 0.035);
    rig.bootSole.position.y += footLift * 0.15 + kneeSwing * 0.012 - kneeFlex * 0.035 - groundSettle * 1.35 - hipSocketDrop * 0.55;
    rig.bootSole.position.y += flightAmount * 0.1;
    rig.bootSole.position.z += lowerLegStride * (0.13 + sprintAmount * 0.028) - rearLegTuck * 0.052 + kneeFlex * 0.04 - footPlant * 0.04 + toePush * 0.02 - flightAmount * 0.44;
    rig.bootSole.rotation.copy(base.bootSoleRotation);
    rig.bootSole.rotation.x += lowerLegStride * 0.2 - kneeFlex * 0.22 - footLift * 0.15 + footPlant * 0.1 + footRoll;
    rig.bootSole.rotation.z += rig.side * (legLateralSway * 1.1 + heelStrike * 0.04);
    rig.bootSole.rotation.x -= flightAmount * 1.04;
    rig.isFootPlanted = flightAmount < 0.08 && runAmount > 0.18 && footLift < 0.035;
  }
}

function dampAngle(current, target, lambda, delta) {
  const angleDelta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + angleDelta * (1 - Math.exp(-lambda * delta));
}

function updateGame(delta) {
  if (!state.running) {
    ship.rotation.z = Math.sin(clock.elapsedTime * 1.4) * 0.035;
    updateJetpack(delta);
    updateLaser(delta);
    updateLaserShots(delta);
    updateRockFragments(delta);
    return;
  }

  if (state.mouseMoveUntil > 0 && performance.now() > state.mouseMoveUntil) {
    state.mouseSteer = 0;
    state.mouseDepth = 0;
    state.mouseMoveUntil = 0;
    updateMovementInputs();
  }

  const depthVelocityStep = state.depthInput === 0 ? playerMovement.deceleration : playerMovement.acceleration;
  const steerVelocityStep = state.steer === 0 ? playerMovement.deceleration : playerMovement.acceleration;
  state.depthVelocity = THREE.MathUtils.damp(state.depthVelocity, state.depthInput, depthVelocityStep, delta);
  state.steerVelocity = THREE.MathUtils.damp(state.steerVelocity, state.steer, steerVelocityStep, delta);
  if (Math.abs(state.depthVelocity) < 0.01 && state.depthInput === 0) {
    state.depthVelocity = 0;
  }
  if (Math.abs(state.steerVelocity) < 0.01 && state.steer === 0) {
    state.steerVelocity = 0;
  }

  const movementVectorLength = Math.hypot(state.depthVelocity, state.steerVelocity);
  const movementScale = movementVectorLength > 1 ? 1 / movementVectorLength : 1;
  const movementAmount = Math.min(1, movementVectorLength);
  const movementDirection = state.depthVelocity < -0.01 ? -1 : 1;
  const sprintAmount = state.sprinting && state.depthVelocity > 0.12 ? 1 : 0;
  const isMoving = movementAmount > 0.001;
  if (isMoving) {
    state.cameraPitch = THREE.MathUtils.damp(state.cameraPitch, 0, 8, delta);
    state.cameraOrbitYaw = state.faceYaw;
  }
  updateJetpack(delta);
  updateRunAnimation(delta, movementAmount, movementDirection, sprintAmount);

  state.elapsed += isMoving ? delta : 0;
  state.speed = Math.min(25.5, 13.5 + state.elapsed * 0.26 + sprintAmount * 4.8);
  if (isMoving) {
    state.score += delta * (10 + state.speed * 0.65) * (1 + sprintAmount * 0.22);
  }

  const forwardX = Math.sin(state.faceYaw);
  const forwardZ = Math.cos(state.faceYaw);
  const rightX = Math.sin(state.faceYaw - Math.PI / 2);
  const rightZ = Math.cos(state.faceYaw - Math.PI / 2);
  const forwardSpeed = playerMovement.depthSpeed * (1 + sprintAmount * (playerMovement.sprintMultiplier - 1));
  const moveX = forwardX * state.depthVelocity * forwardSpeed + rightX * state.steerVelocity * playerMovement.lateralSpeed;
  const moveZ = forwardZ * state.depthVelocity * forwardSpeed + rightZ * state.steerVelocity * playerMovement.lateralSpeed;

  ship.position.x += moveX * movementScale * delta;
  ship.position.z += moveZ * movementScale * delta;
  resolveMountainCollisions();
  const groundedMovement = state.flightHeight <= 0.02 ? movementAmount : 0;
  const stepBob = Math.max(0, Math.sin(state.runCycle * 2 + 0.35)) * groundedMovement * 0.055;
  const weightSettle = Math.max(0, -Math.cos(state.runCycle * 2)) * groundedMovement * 0.026;
  const gaitSway = Math.sin(state.runCycle) * groundedMovement * 0.04;
  ship.position.y = terrainHeight(ship.position.x, ship.position.z) + playerGroundOffset + state.flightHeight + stepBob - weightSettle;
  ship.rotation.y = state.faceYaw;
  ship.rotation.z = THREE.MathUtils.clamp(state.steerVelocity * -0.28 - gaitSway, -0.38, 0.38);
  ship.rotation.x = Math.sin(state.elapsed * 3.2) * 0.018 + THREE.MathUtils.clamp(state.depthVelocity * (0.075 + sprintAmount * 0.055), -0.09, 0.16) - weightSettle * 0.8 - state.jetpackBurn * 0.24;
  if (state.flightHeight <= 0.08 && state.flightVelocity <= 0.4) {
    emitStepEffects(movementAmount);
  }

  updateTerrainAroundPlayer();

  updateDust(delta);
  updateFootEffects(delta);
  updateLaser(delta);
  updateLaserShots(delta);
  updateRockFragments(delta);

  for (const tuft of grassTufts) {
    recycleGroundObjectAroundPlayer(tuft, 0.05, 142);
  }

  for (const hill of hills) {
    recycleGroundObjectAroundPlayer(hill, 0.025, 164);
  }

  for (const mountain of mountains) {
    recycleGroundObjectAroundPlayer(mountain, 0.02, 1040, 520);
  }

  for (const rock of rocks) {
    recycleGroundObjectAroundPlayer(rock, 0.18, 152);
  }

  for (const cloud of clouds) {
    cloud.position.x += delta * 0.22;
    if (Math.abs(cloud.position.x - ship.position.x) > 350 || Math.abs(cloud.position.z - ship.position.z) > 350) {
      placeCloudAround(cloud, ship.position.x, ship.position.z, 320);
    }
  }

  updateHud();
}

function resize() {
  const { innerWidth, innerHeight } = window;
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  setDefaultCameraPerspective();
  camera.updateProjectionMatrix();
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.04);
  updateGame(delta);
  setDefaultCameraPerspective();
  skyDome.position.copy(camera.position);
  updateSunAndKeyLight();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);
window.addEventListener('pointermove', moveWithMouse);
window.addEventListener('pointerdown', (event) => setLaserActive(event, true));
window.addEventListener('pointerup', (event) => setLaserActive(event, false));
window.addEventListener('pointercancel', (event) => setLaserActive(event, false));
window.addEventListener('blur', () => {
  state.laserActive = false;
  state.jetpackActive = false;
  activeKeys.clear();
});
window.addEventListener('keydown', (event) => {
  const key = event.code === 'Space' ? 'space' : event.key.toLowerCase();
  if (key === 'space') {
    event.preventDefault();
  }
  if (key === 'space' || event.key === 'Enter') {
    if (!state.running) resetGame();
  }
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', 'shift', 'space'].includes(key)) {
    activeKeys.add(key);
    updateMovementInputs();
  }
  if (key === 'g' && !event.repeat) {
    state.weaponMode = state.weaponMode === 'beam' ? 'shots' : 'beam';
    state.shotCooldown = 0;
  }
});
window.addEventListener('keyup', (event) => {
  const key = event.code === 'Space' ? 'space' : event.key.toLowerCase();
  if (key === 'space') {
    event.preventDefault();
  }
  if (activeKeys.delete(key)) {
    updateMovementInputs();
  }
});

leftControl.addEventListener('pointerdown', () => setTouchSteer(-1));
rightControl.addEventListener('pointerdown', () => setTouchSteer(1));
for (const control of [leftControl, rightControl]) {
  control.addEventListener('pointerup', () => setTouchSteer(0));
  control.addEventListener('pointerleave', () => setTouchSteer(0));
  control.addEventListener('pointercancel', () => setTouchSteer(0));
}
startButton.addEventListener('click', resetGame);

resize();
overlay.classList.add('visible');
animate();
