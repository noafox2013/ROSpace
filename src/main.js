import './styles.css';
import { duneHeight } from './dunes.js';
import { createBuildingVisibility } from './building-visibility.js';
import { createSandstorm } from './sandstorm.js';
import { createTornadoFlight } from './sand-tornado.js';
import { damageHealth, updateHealthRecovery, applyFallDamage, HEALTH_RECOVERY_DELAY } from './player-health.js';
import { activateArchive, recoverFuelTank, repairSpacecraft } from './spacecraft-repair.js';

const tornadoFlight = createTornadoFlight();
import { abandonedLocation, createAbandonedBuilding } from './abandoned-building.js';
import { createScanner } from './scanner.js';
import { createSpacecraft } from './spacecraft.js';
import { createWatchtower, watchtowerLocation } from './watchtower.js';
import { createSpaceTreasure, treasureLocation } from './space-treasure.js';
import { positionWaypoint } from './waypoint.js';
import { solarLighting, createDesertEnvironment, SUN_ANGULAR_DIAMETER } from './solar-lighting.js';
import { createGameAudio } from './audio.js';
const audio = createGameAudio();
for (const event of ['pointerdown', 'keydown']) document.addEventListener(event, () => audio.unlock(), { capture: true });
document.addEventListener('click', event => { if (event.target.closest('button')) audio.play('ui'); });
const soundToggle = document.querySelector('#sound-toggle');
soundToggle.checked = localStorage.getItem('rust-mesa-muted') !== 'true';
audio.setMuted(!soundToggle.checked);
soundToggle.addEventListener('change', () => {
  audio.setMuted(!soundToggle.checked);
  localStorage.setItem('rust-mesa-muted', String(!soundToggle.checked));
});
import { baseLocation, baseLayout, createPlanetaryBase, catalog, purchase, resourceMarket, resourceAmount, sellResource, positionBaseCamera } from './base.js';
import { readSaves, writeSave, deleteSave } from './saves.js';
import { setupLanguage } from './language.js';
setupLanguage();
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createSandworm } from './sandworm.js';
import { createCurseMessage, isCurseMessage } from './curse-message.js';
import { createNaturalStoneGeometry, createNaturalStoneMaterial, stoneSupportHeight } from './natural-stone.js';
import { createTerrainSurfaceMaterial } from './terrain-surface.js';
import { installPlanetHorizon, cameraDrawDistance, TERRAIN_TILE_SIZE, CLEAR_FOG_NEAR, CLEAR_FOG_FAR } from './planet-horizon.js';
import { astronautAnatomy, sampleAstronautStep, sampleAstronautFlight, smoothMinimum, solveLimbJoint, alignLimb, poseAstronautArms, poseAstronautHand } from './astronaut-rig.js';
import { createEquipmentMaterials, createAstronautBoot, createChestConsole, createLifeSupportPack } from './astronaut-equipment.js';
import { createSuitFabric, createClothCapsule, createPaddedPanel, addFabricSeam } from './suit-fabric.js';

const canvas = document.querySelector('#game-canvas');
const archiveMenu = document.querySelector('#archive-menu');
const towerMenu = document.querySelector('#watchtower-menu');
let screenshotMode = false;
let screenshotPending = false;
const screenshotHint = document.querySelector('#screenshot-hint');
function setScreenshotMode(active) {
  if (active === screenshotMode) return;
  if (active) {
    pausedAt = performance.now();
    state.jetpackActive = false;
    activeKeys.clear();
    updateMovementInputs();
    audio.silence();
  } else {
    if (pausedAt !== null) dayStartedAt += performance.now() - pausedAt;
    pausedAt = null;
  }
  screenshotMode = active;
  document.querySelector('#app').classList.toggle('screenshot-mode', active);
  screenshotHint.hidden = !active;
  screenshotHint.textContent = 'Screenshotmodus · Linksklick: Bild speichern · O: Zurück';
  state.laserActive = false;
}
function saveGameScreenshot() {
  if (screenshotPending) return;
  screenshotPending = true;
  try {
    renderer.render(scene, camera);
    canvas.toBlob(blob => {
      screenshotPending = false;
      if (!blob) { screenshotHint.textContent = 'Screenshot konnte nicht gespeichert werden.'; return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Rust-Mesa-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      screenshotHint.textContent = 'Screenshot gespeichert.';
    }, 'image/png');
  } catch {
    screenshotPending = false;
    screenshotHint.textContent = 'Screenshot konnte nicht gespeichert werden.';
  }
}
const firstPersonCrosshair = document.querySelector('#first-person-crosshair');
const rockProgress = document.querySelector('#rock-progress');
const rockTime = document.querySelector('#rock-time');
const rockDamage = document.querySelector('#rock-damage');
const rockDestructionTime = 1.5;
const laserRange = 320;
const laserShotSpeed = 34;
const laserShotDamage = 0.06;
const laserShotInterval = 0.12;
const spacecraftShotSpeed = 100;
const spacecraftShotInterval = 0.2;
const spacecraftShotDamage = 0.3;
let damagedRock = null;
let lastRockHitTime = 0;
const rockProgressBounds = new THREE.Box3();
const rockProgressPosition = new THREE.Vector3();
const scoreEl = document.querySelector('#score');
const bestEl = document.querySelector('#best');
const healthEl = document.querySelector('#health');
const healthBar = document.querySelector('#health-bar');
const overlay = document.querySelector('#overlay');
const overlayTitle = document.querySelector('#overlay-title');
const overlayCopy = document.querySelector('#overlay-copy');
const startButton = document.querySelector('#start-button');
const leftControl = document.querySelector('#left-control');
const rightControl = document.querySelector('#right-control');
const inventory = document.querySelector('#inventory');
const pauseMenu = document.querySelector('#pause-menu');
const tradeMenu = document.querySelector('#trade-menu');
const sellMenu = document.querySelector('#sell-menu');
const terminalHint = document.querySelector('#terminal-hint');
const loadButton = document.querySelector('#load-button');
const saveMessage = document.querySelector('#save-message');
const saveNameInput = document.querySelector('#save-name');
const saveSlot = document.querySelector('#save-slot');
const loadSlot = document.querySelector('#load-slot');
const deleteDialog = document.querySelector('#delete-save-dialog');
let pendingDeleteSlot = null;
let activeSaveSlot = 0;
let currentRunHasSave = false;
let restartAfterDeath = false;
let deathRespawn = null;
let seatedBench = null;
let isSleeping = false;
let sleepTimer = null;
let sleepFade = null;
const sleepOverlay = document.querySelector('#sleep-overlay');
const curseMessage = createCurseMessage(document.querySelector('#curse-message'));
const curseWarningText = document.querySelector('#curse-message').textContent;
const stormWarningText = 'HEFTIGER SANDSTURM NÄHERT SICH, BITTE SOFORT SCHUTZ FINDEN!!!';
const freedomMessageText = 'DU HAST DEN FLUCH ÜDERWUNDEN UND HAST DEN SANDWURM VERJAGT, DU BIST FREI';
let pausedAt = null;

function openPauseMenu() {
  if (!state.running || pauseMenu.open || isSleeping) return;
  if (screenshotMode) setScreenshotMode(false);
  pausedAt = performance.now();
  state.laserActive = false;
  state.jetpackActive = false;
  state.mouseSteer = 0;
  state.mouseDepth = 0;
  state.mouseMoveUntil = 0;
  activeKeys.clear();
  updateMovementInputs();
  const messageList = document.querySelector('#game-message-list');
  messageList.replaceChildren();
  const messages = curseMessage.getHistory();
  const hasMessage = messages.length > 0;
  document.querySelector('#game-messages-empty').hidden = hasMessage;
  for (const message of messages) {
    const entry = document.createElement('li');
    entry.textContent = message;
    entry.classList.toggle('is-curse', isCurseMessage(message));
    messageList.append(entry);
  }
  audio.silence(); audio.play('ui');
  pauseMenu.showModal();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

function refreshLoadButton() {
  try {
    const saves = readSaves(localStorage);
    const previousLoad = loadSlot.value;
    const previousSave = saveSlot.value;
    saveSlot.replaceChildren();
    loadSlot.replaceChildren();
    saves.forEach((saved, index) => {
      const label = `${index + 1} · ${saved?.name || (document.documentElement.lang === 'en' ? 'Empty' : 'Leer')}`;
      saveSlot.add(new Option(label, String(index)));
      if (saved) loadSlot.add(new Option(label, String(index)));
    });
    if (previousSave !== '') saveSlot.value = previousSave;
    if (previousLoad !== '' && saves[Number(previousLoad)]) loadSlot.value = previousLoad;
    loadButton.hidden = loadSlot.hidden = !saves.some(Boolean);
    document.querySelector('#load-slot-label').hidden = loadSlot.hidden;
    document.querySelector('#load-delete-hint').hidden = loadSlot.hidden;
    updateLoadButton();
  } catch {
    loadButton.hidden = loadSlot.hidden = true;
    document.querySelector('#load-slot-label').hidden = true;
  }
}

function updateLoadButton() {
  const saved = readSaves(localStorage)[Number(loadSlot.value)];
  loadButton.textContent = saved ? `Spielstand laden: ${saved.name}` : 'Spielstand laden';
}

function saveGame() {
  try {
    const name = saveNameInput.value.trim().slice(0, 60) || 'Mein Spielstand';
    saveNameInput.value = name;
    const savedState = {};
    for (const key of ['health', 'healthRecoveryDelay', 'fallDistance', 'score', 'cors', 'stones', 'crystals', 'blueCrystals', 'laserLevel', 'jetpackLevel', 'scannerLevel', 'passKey', 'abandonedUnlocked', 'archiveActivated', 'archiveRead', 'fuelTank', 'landingStrut', 'treasureScanned', 'treasureExcavated', 'treasureOpened', 'spacecraftRepaired', 'wormHorns', 'elapsed', 'flightHeight', 'flightVelocity',
      'faceYaw', 'cameraOrbitYaw', 'cameraPitch', 'firstPerson', 'weaponMode']) savedState[key] = state[key];
    const selectedSlot = activeSaveSlot;
    writeSave(localStorage, selectedSlot, {
      version: 1,
      name,
      state: savedState,
      sandwormRepelled: sandworm.isRepelled(),
      curseMessageSeen: curseMessage.isShown(),
      gameMessages: curseMessage.getHistory(),
      sandstorm: sandstorm.snapshot(),
      tornadoFlight: tornadoFlight.snapshot(),
      towerLift: watchtower.lift.snapshot(),
      curseLifted: state.curseLifted,
      sandwormWeakPoint: sandworm.getWeakPointProgress(),
      position: (seatedBench ? seatedBench.stand : ship.position).toArray(),
      dayElapsed: ((pausedAt ?? performance.now()) - dayStartedAt) / 1000,
      rocks: rocks.map((rock) => ({ position: rock.position.toArray(), damage: rock.userData.laserDamage || 0,
        ...(rock.userData.isBlueCrystal ? { visible: rock.visible } : {}) })),
    });
    audio.play('buy');
    currentRunHasSave = true;
    refreshLoadButton();
    saveSlot.value = String(selectedSlot);
    loadSlot.value = String(selectedSlot);
    updateLoadButton();
    saveMessage.textContent = 'Spiel gespeichert.';
    return true;
  } catch {
    saveMessage.textContent = 'Speichern fehlgeschlagen. Bitte erlaube dem Browser das Speichern lokaler Daten.';
    return false;
  }
}

function loadGame() {
  try {
    const selectedSlot = Number(loadSlot.value);
    const saved = readSaves(localStorage)[selectedSlot];
    if (saved?.version !== 1 || !saved.state || !Array.isArray(saved.position)
      || saved.position.length !== 3 || !saved.position.every(Number.isFinite)
      || !Number.isFinite(saved.dayElapsed)) throw new Error('Invalid save');
    resetGame();
    activeSaveSlot = selectedSlot;
    currentRunHasSave = true;
    saveSlot.value = String(selectedSlot);
    saveNameInput.value = typeof saved.name === 'string' ? saved.name.slice(0, 60) : 'Mein Spielstand';
    for (const key of ['health', 'healthRecoveryDelay', 'fallDistance', 'score', 'cors', 'stones', 'crystals', 'blueCrystals', 'laserLevel', 'jetpackLevel', 'scannerLevel', 'passKey', 'abandonedUnlocked', 'archiveActivated', 'archiveRead', 'fuelTank', 'landingStrut', 'treasureScanned', 'treasureExcavated', 'treasureOpened', 'spacecraftRepaired', 'wormHorns', 'elapsed', 'flightHeight', 'flightVelocity',
      'faceYaw', 'cameraOrbitYaw', 'cameraPitch']) {
      if (Number.isFinite(saved.state[key])) state[key] = saved.state[key];
    }
    state.blueCrystals = Math.floor(THREE.MathUtils.clamp(state.blueCrystals, 0, state.crystals));
    // Preserve currency earned before the name changed to Cors.
    if (!Number.isFinite(saved.state.cors) && Number.isFinite(saved.state.gors)) state.cors = saved.state.gors;
    state.cors = Math.max(0, Math.floor(state.cors));
    state.health = THREE.MathUtils.clamp(state.health, 1, 100);
    state.healthRecoveryDelay = Number.isFinite(saved.state.healthRecoveryDelay)
      ? THREE.MathUtils.clamp(state.healthRecoveryDelay, 0, HEALTH_RECOVERY_DELAY)
      : state.health < 100 ? HEALTH_RECOVERY_DELAY : 0;
    state.fallDistance = Math.max(0, state.fallDistance);
    state.laserLevel = Math.floor(THREE.MathUtils.clamp(state.laserLevel, 0, 3));
    state.jetpackLevel = Math.floor(THREE.MathUtils.clamp(state.jetpackLevel, 0, 2));
    state.passKey = state.passKey >= 1 ? 1 : 0;
    state.abandonedUnlocked = state.passKey && state.abandonedUnlocked >= 1 ? 1 : 0;
    state.archiveRead = state.archiveRead >= 1 ? 1 : 0;
    state.archiveActivated = state.archiveActivated >= 1 || state.archiveRead ? 1 : 0;
    state.spacecraftRepaired = state.spacecraftRepaired >= 1 ? 1 : 0;
    state.fuelTank = !state.spacecraftRepaired && state.fuelTank >= 1 ? 1 : 0;
    state.landingStrut = !state.spacecraftRepaired && state.landingStrut >= 1 ? 1 : 0;
    state.treasureOpened = state.treasureOpened >= 1 || state.spacecraftRepaired || state.landingStrut ? 1 : 0;
    state.treasureExcavated = state.treasureExcavated >= 1 || state.treasureOpened ? 1 : 0;
    state.treasureScanned = state.treasureScanned >= 1 || state.treasureExcavated ? 1 : 0;
    spaceTreasure.restore(state);
    spacecraft.setDamaged(!state.spacecraftRepaired);
    state.scannerLevel = Math.floor(THREE.MathUtils.clamp(state.scannerLevel, 0, 3));
    state.wormHorns = Math.max(0, Math.floor(state.wormHorns));
    state.firstPerson = saved.state.firstPerson === true;
    state.weaponMode = saved.state.weaponMode === 'shots' ? 'shots' : 'beam';
    ship.position.fromArray(saved.position);
    watchtower.lift.restore(saved.towerLift,ship.position);
    ship.rotation.y = state.faceYaw;
    astronautPreviousYaw = state.faceYaw;
    dayStartedAt = performance.now() - saved.dayElapsed * 1000;
    updateTerrainAroundPlayer();
    resetSceneryAroundPlayer();
    sandstorm.restore(saved.sandstorm);
    tornadoFlight.restore(saved.tornadoFlight);
    sandworm.restoreWeakPointProgress(saved.sandwormWeakPoint);
    state.curseLifted = saved.curseLifted === true;
    if (state.curseLifted) document.querySelector('#curse-message').textContent = freedomMessageText;
    curseMessage.restoreHistory(Array.isArray(saved.gameMessages) ? saved.gameMessages.filter(text => text !== stormWarningText && text !== 'SEVERE SANDSTORM APPROACHING, FIND SHELTER IMMEDIATELY!!!') : []);
    if (saved.curseMessageSeen === true) curseMessage.remember();
    if (saved.sandwormRepelled === true) {
      sandworm.repel(true);
      curseMessage.showOnce(state.curseLifted ? freedomMessageText : curseWarningText);
    }
    saved.rocks?.forEach((entry, index) => {
      if (rocks[index] && Array.isArray(entry.position) && entry.position.every(Number.isFinite)) {
        rocks[index].position.fromArray(entry.position);
        if (!rocks[index].userData.isCrystal) {
          const rock = rocks[index];
          rock.position.y = footprintGroundHeight(rock.position.x,rock.position.z) + rock.userData.groundOffset;
        }
        rocks[index].userData.laserDamage = Number.isFinite(entry.damage) ? entry.damage : 0;
        if (rocks[index].userData.isBlueCrystal) rocks[index].visible = entry.visible !== false;
      }
    });
    restoreBlueCrystalGroups();
    updateInventoryResources();
    document.querySelector('#app').classList.toggle('is-first-person', state.firstPerson);
    updateHud();
  } catch {
    overlayCopy.textContent = 'Dieser Spielstand konnte nicht geladen werden.';
  }
}

const playerMovement = {
  startZ: 2.15,
  lateralSpeed: 4.8,
  depthSpeed: 3.6,
  sprintMultiplier: 2.6,
  jetpackLift: 9.5,
  jetpackGravity: 17.82,
  acceleration: 3.6,
  deceleration: 4.8,
};
const state = {
  running: false,
  health: 100,
  healthRecoveryDelay: 0,
  fallDistance: 0,
  hurtCooldown: 0,
  hurtFlash: 0,
  score: 0,
  cors: 0,
  stones: 0,
  crystals: 0,
  blueCrystals: 0,
  laserLevel: 0,
  jetpackLevel: 0,
  scannerLevel: 0,
  passKey: 0,
  abandonedUnlocked: 0,
  archiveActivated: 0,
  archiveRead: 0,
  fuelTank: 0,
  landingStrut: 0,
  treasureScanned: 0,
  treasureExcavated: 0,
  treasureOpened: 0,
  spacecraftRepaired: 0,
  wormHorns: 0,
  curseLifted: false,
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
  firstPerson: false,
  runCycle: 0,
  gaitBlend: 0,
  sprintBlend: 0,
};
const activeKeys = new Set();
const playerGroundOffset = 1.0;
let watchtowerGrounded = false;

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
  const compactedSoil = (smoothNoise(x * 0.11 - 21, z * 0.11 + 13) - 0.5) * 0.07;
  const sandHeight = duneHeight(x, z);
  const sandCover = THREE.MathUtils.smoothstep(sandHeight, 0, 2);
  const naturalHeight = broadUndulation + (crust + occasionalHill + crackedCrust + compactedSoil) * (1 - sandCover * 0.92)
    + sandHeight - 1.05;
  const baseBlend = 1 - THREE.MathUtils.smoothstep(Math.hypot(x - baseLocation.x, z - baseLocation.z), 10 * baseLayout.scale, 18 * baseLayout.scale);
  const abandonedBlend = 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(x - abandonedLocation.x) / 9, Math.abs(z - abandonedLocation.z) / 11), 1, 1.65);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(naturalHeight, baseLocation.ground, baseBlend), abandonedLocation.ground, abandonedBlend);
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
renderer.toneMappingExposure = 0.95;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa7bfca);
scene.fog = new THREE.Fog(0xb7a89f, CLEAR_FOG_NEAR, CLEAR_FOG_FAR);
const desertEnvironment = createDesertEnvironment(renderer);
scene.environment = desertEnvironment.texture;
scene.environmentIntensity = 0.65;
function showWeatherNotice(text) {
  curseMessage.show(text, { keepHistory: false });
  document.querySelector('#curse-message').classList.add('storm-warning');
  audio.play('message');
}
const sandstorm = createSandstorm(scene,
  () => showWeatherNotice(stormWarningText),
  () => showWeatherNotice('DER SANDSTURM HAT SICH VERZOGEN'), terrainHeight);

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 720);
scene.add(camera);
camera.position.set(0, 4.7, 12);
camera.lookAt(0, 0.2, -24);

const sunDirection = new THREE.Vector3(0.14, 0.72, -0.68).normalize();
// Twelve real minutes per cycle: seven minutes of daylight and five of night.
const dayDuration = 720;
const nightDuration = 300;
const daylightDuration = dayDuration - nightDuration;
const initialSunAngle = 0;
let dayStartedAt = performance.now();
const sunHorizontalDirection = new THREE.Vector3(sunDirection.x, 0, sunDirection.z).normalize();
const daylightColors = {
  nightSky: new THREE.Color(0x0a1328),
  nightAmbient: new THREE.Color(0x7387ad),
  nightCloud: new THREE.Color(0x293449),
  dayCloud: new THREE.Color(0xffffff),
  twilightCloud: new THREE.Color(0xe9a08c),
  daySky: new THREE.Color(0x729fc7),
  dayAmbient: new THREE.Color(0xc7dbea),
  groundBounce: new THREE.Color(0xa18469),
  nightHorizon: new THREE.Color(0x252c40),
  dayHorizon: new THREE.Color(0xc7c7bc),
  sunset: new THREE.Color(0xe99261),
  nightGround: new THREE.Color(0x292639),
  dayGround: new THREE.Color(0xba8165),
  warmSun: new THREE.Color(0xffa05b),
  noonSun: new THREE.Color(0xfff4e6),
};
const keyLightDistance = 76;

const hemi = new THREE.HemisphereLight(0xc7dbe5, 0x6b3d2b, 1.65);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xf4c086, 2.7);
keyLight.position.copy(sunDirection).multiplyScalar(keyLightDistance);
keyLight.castShadow = true;
// Thin grass blades need finer shadow texels to avoid disappearing between samples.
keyLight.shadow.mapSize.set(4096, 4096);
keyLight.shadow.bias = -0.000025;
keyLight.shadow.normalBias = 0.018;
keyLight.shadow.radius = 3.2;
keyLight.shadow.camera.near = 0.5;
// Include nearby ground in the player's shadow coverage.
keyLight.shadow.camera.far = keyLightDistance + 48;
keyLight.shadow.camera.left = -32;
keyLight.shadow.camera.right = 32;
keyLight.shadow.camera.top = 32;
keyLight.shadow.camera.bottom = -32;
scene.add(keyLight);
scene.add(keyLight.target);
const shadowRight=new THREE.Vector3().crossVectors(sunHorizontalDirection,new THREE.Vector3(0,1,0)).normalize();
const shadowUp=new THREE.Vector3();

const accentLight = new THREE.PointLight(0xffa067, 9, 36);
accentLight.position.set(8, 5, -14);
scene.add(accentLight);

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(145, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x96b8c8) },
      horizonColor: { value: new THREE.Color(0xc6b5aa) },
      groundGlow: { value: new THREE.Color(0xba8165) },
      nightStrength: { value: 0 },
      starTime: { value: 0 },
      starAngle: { value: 0 },
      sunDirection: { value: sunDirection },
      dawnStrength: { value: 0 },
      stormStrength: { value: 0 },
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
      uniform float nightStrength;
      uniform float starTime;
      uniform float starAngle;
      uniform vec3 sunDirection;
      uniform float dawnStrength;
      uniform float stormStrength;
      float starHash(vec2 cell) {
        return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
      }
      float stormHash(vec2 p) {
        vec3 v = fract(vec3(p.xyx) * 0.1031);
        v += dot(v, v.yzx + 33.33);
        return fract((v.x + v.y) * v.z);
      }
      float stormNoise(vec2 p) {
        vec2 cell = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(stormHash(cell), stormHash(cell + vec2(1.0, 0.0)), f.x),
          mix(stormHash(cell + vec2(0.0, 1.0)), stormHash(cell + vec2(1.0)), f.x), f.y);
      }
      float stormBillows(vec2 p) {
        float value = 0.0, amplitude = 0.55;
        for (int octave = 0; octave < 4; octave++) {
          value += stormNoise(p) * amplitude;
          p = mat2(1.6, -1.2, 1.2, 1.6) * p + vec2(13.7, 7.1);
          amplitude *= 0.48;
        }
        return value;
      }
      void main() {
        vec3 direction = normalize(vLocalPosition);
        float h = direction.y;
        vec3 sky = mix(horizonColor, topColor, smoothstep(0.05, 0.86, h));
        sky = mix(groundGlow, sky, smoothstep(-0.18, 0.18, h));
        float sunAlignment = clamp(dot(direction, sunDirection), -1.0, 1.0);
        float sunAngle = acos(sunAlignment);
        // Atmospheric paths grow toward the horizon; warmth spreads in azimuth
        // while the zenith stays blue and the opposite horizon turns mauve.
        vec2 horizonSun = sunDirection.xz / max(length(sunDirection.xz), 0.0001);
        vec2 horizonView = direction.xz / max(length(direction.xz), 0.0001);
        float azimuth = dot(horizonSun, horizonView);
        float sunSide = pow(max(azimuth * 0.5 + 0.5, 0.0), 3.0);
        float horizonBand = exp(-pow((h - 0.025) / 0.14, 2.0));
        float sunsetHaze = horizonBand * sunSide * dawnStrength * (1.0 - stormStrength);
        sky = mix(sky, vec3(0.68, 0.24, 0.085), sunsetHaze * 0.64);
        float dawnGlow = exp(-sunAngle * sunAngle / 0.13)
          * exp(-abs(h) * 9.0) * dawnStrength * (1.0 - stormStrength);
        sky += vec3(0.34, 0.115, 0.028) * dawnGlow;
        float opposite = pow(max(-azimuth, 0.0), 2.0) * dawnStrength;
        float twilightBelt = exp(-pow((h - 0.10) / 0.065, 2.0));
        sky = mix(sky, vec3(0.24, 0.15, 0.23), opposite * twilightBelt * 0.3);
        // Forward scattering in dusty air: a soft aureole, without painted rays.
        float solarVisibility = smoothstep(-0.025, 0.06, sunDirection.y);
        float aureole = pow(max(sunAlignment, 0.0), 96.0) * 0.13
          + pow(max(sunAlignment, 0.0), 8.0) * 0.025;
        sky += mix(vec3(1.0, 0.48, 0.19), vec3(1.0, 0.94, 0.79),
          smoothstep(0.0, 0.5, sunDirection.y)) * aureole * solarVisibility * (1.0 - stormStrength);
        // Rotate the celestial sphere with the day/night cycle around a tilted pole.
        // Only the stars move; the horizon and dawn glow stay in world coordinates.
        vec3 pole = vec3(0.0, 0.8, 0.6);
        float c = cos(starAngle);
        float s = sin(starAngle);
        vec3 starDirection = direction * c + cross(pole, direction) * s
          + pole * dot(pole, direction) * (1.0 - c);
        vec2 starGrid = vec2(
          atan(starDirection.z, starDirection.x) / 6.2831853 + 0.5,
          asin(clamp(starDirection.y, -1.0, 1.0)) / 3.1415927 + 0.5
        ) * vec2(360.0, 180.0);
        vec2 cell = floor(starGrid);
        float seed = starHash(cell);
        float latitudeScale = max(0.04, sqrt(max(0.0, 1.0 - starDirection.y * starDirection.y)));
        vec2 center = vec2(starHash(cell + 17.0), starHash(cell + 43.0)) * 0.76 + 0.12;
        // Correct longitude compression and density towards the celestial poles.
        vec2 offset = (fract(starGrid) - center) * vec2(latitudeScale, 1.0);
        float distanceToStar = length(offset);
        float magnitude = pow(starHash(cell + 71.0), 8.0);
        float radius = mix(0.018, 0.075, magnitude);
        // Pixel filtering keeps tiny stars stable instead of flickering during camera motion.
        vec2 footprint = fwidth(starGrid) * vec2(latitudeScale, 1.0);
        float pixelWidth = max(0.012, max(footprint.x, footprint.y));
        float apparentRadius = max(radius, pixelWidth * 0.6);
        float core = exp(-distanceToStar * distanceToStar / (apparentRadius * apparentRadius));
        core *= min(1.0, radius * radius / (apparentRadius * apparentRadius));
        float glow = exp(-distanceToStar * distanceToStar / (radius * radius * 5.0)) * magnitude * 0.07;
        float atmosphere = smoothstep(0.0, 0.32, h);
        float twinkleAmount = mix(0.12, 0.025, atmosphere);
        float twinkle = 1.0 + twinkleAmount * sin(starTime * (1.1 + seed * 1.7) + seed * 90.0)
          * sin(starTime * 0.73 + seed * 37.0);
        float stars = (core + glow) * step(1.0 - 0.065 * latitudeScale, seed)
          * mix(0.35, 3.0, magnitude) * twinkle * atmosphere * nightStrength;
        float temperature = starHash(cell + 91.0);
        vec3 starColor = temperature < 0.22
          ? mix(vec3(1.0, 0.78, 0.57), vec3(1.0, 0.94, 0.86), temperature / 0.22)
          : mix(vec3(1.0, 0.98, 0.94), vec3(0.76, 0.86, 1.0), (temperature - 0.22) / 0.78);
        sky += starColor * stars * 2.5;
        if (stormStrength > 0.001) {
          // Project onto a broad ceiling: no spherical seams or isolated sprite puffs.
          vec2 ceiling = direction.xz / max(0.16, direction.y + 0.22) * 2.2;
          vec2 drift = vec2(starTime * 0.027, starTime * 0.011);
          vec2 warp = vec2(stormNoise(ceiling * 0.7 + drift), stormNoise(ceiling * 0.7 - drift + 34.0));
          float density = stormBillows(ceiling + warp * 1.5 + drift);
          float underlayer = stormBillows(ceiling * 2.1 - drift * 1.4 + 71.0);
          float litDensity = stormBillows(ceiling + warp * 1.5 + drift + sunDirection.xz * 0.35);
          float daylight = smoothstep(-0.2, 0.3, sunDirection.y);
          vec3 underside = mix(vec3(0.075, 0.085, 0.11), vec3(0.21, 0.20, 0.185), daylight);
          vec3 dustLight = mix(vec3(0.16, 0.15, 0.14), vec3(0.48, 0.40, 0.31), daylight);
          float relief = clamp(0.45 + (litDensity - density) * 3.2 + underlayer * 0.25, 0.05, 0.95);
          vec3 overcast = mix(underside, dustLight, relief);
          overcast *= 0.82 + density * 0.28;
          // At the horizon the cloud ceiling merges into the airborne sand wall.
          overcast = mix(dustLight * 0.83, overcast, smoothstep(-0.08, 0.25, h));
          float closing = smoothstep(0.0, 0.85, stormStrength);
          float rollingEdge = smoothstep(0.14, 0.7, stormStrength + density * 0.42);
          sky = mix(sky, overcast, mix(rollingEdge, 1.0, closing) * smoothstep(0.0, 0.4, stormStrength));
        }
        gl_FragColor = vec4(sky, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }),
);
installPlanetHorizon(skyDome,terrainHeight);
skyDome.frustumCulled = false;
scene.add(skyDome);

function createSunTexture() {
  const size=512,center=size/2,textureCanvas=document.createElement('canvas');
  textureCanvas.width=textureCanvas.height=size;
  const context=textureCanvas.getContext('2d');
  const halo=context.createRadialGradient(center,center,62,center,center,center);
  halo.addColorStop(0,'rgba(255,248,230,0.24)');
  halo.addColorStop(0.15,'rgba(255,239,210,0.08)');
  halo.addColorStop(0.5,'rgba(255,231,195,0.018)');
  halo.addColorStop(1,'rgba(255,231,195,0)');
  context.fillStyle=halo;context.fillRect(0,0,size,size);
  const disc=context.createRadialGradient(center,center,0,center,center,65);
  disc.addColorStop(0,'rgba(255,255,250,1)');
  disc.addColorStop(0.8,'rgba(255,252,239,1)');
  disc.addColorStop(0.97,'rgba(255,244,219,1)');
  disc.addColorStop(1,'rgba(255,244,219,0)');
  context.fillStyle=disc;context.beginPath();context.arc(center,center,65,0,Math.PI*2);context.fill();
  const texture=new THREE.CanvasTexture(textureCanvas);texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

const sunDistance = 600;
const sun = new THREE.Sprite(new THREE.SpriteMaterial({
  map: createSunTexture(),
  color: 0xffffff,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
}));
// The disc occupies one quarter of the texture; scale it for a clearly visible sun.
const sunSize = 2 * sunDistance * Math.tan(THREE.MathUtils.degToRad(SUN_ANGULAR_DIAMETER) / 2) / 0.25;
sun.scale.set(sunSize, sunSize, 1);
sun.renderOrder = 1;
sun.frustumCulled = false;
scene.add(sun);

function updateSunAndKeyLight() {
  // Use real elapsed time, independent of movement and the capped physics delta.
  // Expensive terrain updates must not slow down the sun when the player walks.
  const elapsedSeconds = state.running ? ((pausedAt ?? performance.now()) - dayStartedAt) / 1000 : 0;
  const cycleSeconds = (initialSunAngle / Math.PI * daylightDuration + elapsedSeconds) % dayDuration;
  // Repeat sunrise → daylight → sunset → a shorter night → sunrise.
  const sunAngle = cycleSeconds < daylightDuration
    ? cycleSeconds / daylightDuration * Math.PI
    : Math.PI + (cycleSeconds - daylightDuration) / nightDuration * Math.PI;
  sunDirection.copy(sunHorizontalDirection).multiplyScalar(Math.cos(sunAngle));
  sunDirection.y = Math.sin(sunAngle);
  const daylight = THREE.MathUtils.smoothstep(sunDirection.y, -0.18, 0.4);
  const upperSkyDaylight = THREE.MathUtils.smoothstep(sunDirection.y, -0.04, 0.45);

  const sunset = (1 - THREE.MathUtils.smoothstep(Math.abs(sunDirection.y + 0.025), 0, 0.3)) * THREE.MathUtils.smoothstep(sunDirection.y, -0.2, 0.02);
  const colors = daylightColors;
  const sky = skyDome.material.uniforms;
  sky.nightStrength.value = 1 - THREE.MathUtils.smoothstep(sunDirection.y, -0.25, 0.02);
  sky.starTime.value = elapsedSeconds;
  const stormCover = sandstorm.getIntensity();
  const lighting = solarLighting(sunDirection.y,stormCover);
  sky.stormStrength.value = stormCover;
  sky.starAngle.value = sunAngle;
  visorMaterial.envMapIntensity = THREE.MathUtils.lerp(0.85, 0.4, sky.nightStrength.value);
  sky.dawnStrength.value = sunset;
  sky.topColor.value.copy(colors.nightSky).lerp(colors.daySky, upperSkyDaylight)
    .multiplyScalar(THREE.MathUtils.lerp(1,0.88,upperSkyDaylight));
  sky.horizonColor.value.copy(colors.nightHorizon).lerp(colors.dayHorizon, daylight)
    .multiplyScalar(THREE.MathUtils.lerp(1,0.9,daylight));
  sky.groundGlow.value.copy(colors.nightGround).lerp(colors.dayGround, daylight);
  scene.fog.color.copy(sky.horizonColor.value);
  scene.background.copy(sky.topColor.value);
  hemi.intensity = lighting.ambient;
  hemi.color.copy(colors.nightAmbient).lerp(colors.dayAmbient, daylight);
  hemi.groundColor.copy(colors.nightGround).lerp(colors.groundBounce,daylight);
  renderer.toneMappingExposure = lighting.exposure;
  scene.environmentIntensity = lighting.environment;
  for (const material of cloudMaterials) {
    material.opacity = 0.64 * (1 - stormCover);
    material.color.copy(colors.nightCloud).lerp(colors.dayCloud, daylight)
      .lerp(colors.twilightCloud, sunset * 0.65);
  }
  crystalMaterial.emissiveIntensity = THREE.MathUtils.lerp(5.5, 0.4, daylight);
  blueCrystalMaterial.emissiveIntensity = THREE.MathUtils.lerp(3.5, 0.35, daylight);
  for (const material of [...crystalDebrisMaterials, ...blueCrystalDebrisMaterials]) {
    material.emissiveIntensity = THREE.MathUtils.lerp(1.4, 0.15, daylight);
  }
  keyLight.intensity = lighting.direct;
  keyLight.color.copy(colors.warmSun).lerp(colors.noonSun,lighting.warmth);
  sun.material.color.copy(keyLight.color);
  sun.material.opacity = lighting.sunOpacity;
  sun.visible = sun.material.opacity > 0;
  sun.position.copy(camera.position).addScaledVector(sunDirection, sunDistance);
  // Stabilize the shadow map in light space as the explorer walks.
  shadowUp.crossVectors(shadowRight,sunDirection).normalize();
  const texel=64/keyLight.shadow.mapSize.x;
  keyLight.target.position.copy(ship.position);
  for(const axis of [shadowRight,shadowUp]) {
    const coordinate=ship.position.dot(axis);
    keyLight.target.position.addScaledVector(axis,Math.round(coordinate/texel)*texel-coordinate);
  }
  keyLight.position.copy(keyLight.target.position).addScaledVector(sunDirection,keyLightDistance);
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
    color: 0x58ff63,
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
    color: 0xd4f5ff,
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
  ground: createTerrainSurfaceMaterial(),
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
const planetaryBase = createPlanetaryBase(scene);
const spacecraft = createSpacecraft(scene, terrainHeight);
spacecraft.setDamaged(true);
const previousSpacecraftPosition = new THREE.Vector3();
let aboardSpacecraft = false;
let spacecraftThirdPerson = false;
let spacecraftExitRequested = false;
let spacecraftView = null;
const spacecraftHint = document.createElement('button');
spacecraftHint.id = 'spacecraft-hint';
spacecraftHint.type = 'button';
spacecraftHint.hidden = true;
document.querySelector('#app').append(spacecraftHint);
spacecraftHint.addEventListener('click', toggleSpacecraft);

function toggleSpacecraft() {
  if (!state.running || inventory.open || pauseMenu.open || tradeMenu.open || archiveMenu.open || towerMenu.open) return;
  if (aboardSpacecraft) {
    if (!spacecraft.isLanded()) return;
    if (!spacecraftExitRequested) {
      spacecraftExitRequested = true;
      state.laserActive = false;
      spacecraft.setBoarded(false);
      audio.play('canopy');
    }
    return;
  }
  if (!spacecraft.nearEntrance(ship.position) || seatedBench) return;
  if (!state.spacecraftRepaired) {
    const result = repairSpacecraft(state);
    if (result === 'success') {
      spacecraft.setDamaged(false);
      audio.play('buy');
      curseMessage.show('Raumschiff repariert · Bereit zum Abheben');
      updateInventoryResources();
    } else {
      audio.play('ui');
      curseMessage.show(result === 'tank' ? 'Lies das Notfallarchiv im verlassenen Gebäude und berge den Treibstofftank.'
        : result === 'landing-strut' ? 'Nutze Trasure Scan im Wachturm und berge die Landestütze aus der Space-Schatztruhe.'
        : 'Für die Reparatur brauchst du 30 Kristalle plus 20 blaue Kristalle.');
    }
    return;
  }
  aboardSpacecraft = true;
  spacecraftThirdPerson = false;
  spacecraft.setBoarded(aboardSpacecraft);
  audio.play('canopy');
  if (aboardSpacecraft) {
    spacecraftView = { firstPerson: state.firstPerson, yaw: state.faceYaw, orbit: state.cameraOrbitYaw, pitch: state.cameraPitch };
    ship.position.copy(spacecraft.exit);
    state.faceYaw = state.cameraOrbitYaw = 0;
    state.cameraPitch = 0;
  }
  state.depthVelocity = state.steerVelocity = state.flightHeight = state.flightVelocity = 0;
  state.laserActive = state.jetpackActive = false;
  if (aboardSpacecraft) {
    state.jetpackBurn = 0;
    for (const flame of jetpackFlames.children) flame.visible = false;
    applySeatedPose();
    ship.rotation.set(0, 0, 0);
  }
  activeKeys.clear();
  updateMovementInputs();
  setDefaultCameraPerspective();
  captureGameMouse();
}
function completeSpacecraftExit() {
  aboardSpacecraft = false;
  spacecraftThirdPerson = false;
  spacecraftExitRequested = false;
  audio.setCockpit(false);
  ship.position.copy(spacecraft.exit);
  state.firstPerson = spacecraftView.firstPerson;
  state.faceYaw = spacecraftView.yaw;
  state.cameraOrbitYaw = spacecraftView.orbit;
  state.cameraPitch = spacecraftView.pitch;
  activeKeys.clear();
  updateMovementInputs();
  setDefaultCameraPerspective();
  captureGameMouse();
}
const abandonedBuilding = createAbandonedBuilding(scene);
const watchtower = createWatchtower(scene,terrainHeight);
const spaceTreasure = createSpaceTreasure(scene,terrainHeight);
const updateBuildingVisibility = createBuildingVisibility([
  planetaryBase.group, abandonedBuilding.group, watchtower.group,
]);
const wormBuildingBounds = [planetaryBase.group, abandonedBuilding.group, watchtower.group].map(building => new THREE.Box3().setFromObject(building));
const sandworm = createSandworm(terrainHeight, () => { if (curseMessage.showOnce(curseWarningText)) audio.play('message'); }, wormBuildingBounds);
world.add(sandworm.object);

const rustDark = new THREE.Color(0x623727);
const rustBase = new THREE.Color(0x9a4e32);
const rustLight = new THREE.Color(0xb76843);
const ochre = new THREE.Color(0x8f7651);
const washDark = new THREE.Color(0x6c3f30);
const paleDust = new THREE.Color(0xc08a5d);
const paleClay = new THREE.Color(0xb99c7a);
const terrainTileSize = TERRAIN_TILE_SIZE;
const terrainTileSegments = 128;
const terrainTiles = [];

function updateTerrainTileGeometry(tile, centerX, centerZ) {
  const positions = tile.geometry.attributes.position;
  const colors = tile.geometry.attributes.color;

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const localZ = positions.getZ(i);
    const worldX = x + centerX;
    const worldZ = localZ + centerZ;
    // Keep terrain below building floors; include a margin for terrain triangles.
    // Walking height stays on the floor through terrainHeight().
    const baseEdge = Math.max(Math.abs(worldX - baseLocation.x), Math.abs(worldZ - baseLocation.z));
    const floorClearance = 0.12 * (1 - THREE.MathUtils.smoothstep(baseEdge, 6.1 * baseLayout.scale, 7.1 * baseLayout.scale));
    const abandonedEdge = Math.max(Math.abs(worldX - abandonedLocation.x) / 8.5, Math.abs(worldZ - abandonedLocation.z) / 10.5);
    const abandonedClearance = 0.16 * (1 - THREE.MathUtils.smoothstep(abandonedEdge, 1, 1.25));
    const height = terrainHeight(worldX, worldZ) - Math.max(floorClearance, abandonedClearance);
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
  tile.geometry.computeBoundingBox();
  tile.geometry.computeBoundingSphere();
  tile.position.set(centerX, 0, centerZ);
  tile.userData.centerX = centerX;
  tile.userData.centerZ = centerZ;
}

function createTerrainTile(offsetX, offsetZ) {
  const geometry = new THREE.PlaneGeometry(terrainTileSize, terrainTileSize, terrainTileSegments, terrainTileSegments);
  geometry.rotateX(-Math.PI / 2);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));

  const tile = new THREE.Mesh(geometry, materials.ground);
  // Blend terrain before dust and other transparent effects; keep ground depth.
  tile.renderOrder = -1;
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

const naturalRockMaterials = [materials.rock, materials.rockDark, materials.rockLight]
  .map((base,index) => createNaturalStoneMaterial(base,index));

const rocks = [];
for (let i = 0; i < 150; i += 1) {
  const side = i % 2 === 0 ? -1 : 1;
  const x = side * THREE.MathUtils.randFloat(4.6, 40);
  const z = THREE.MathUtils.randFloat(-116, 24);
  const rockRadius = THREE.MathUtils.randFloat(0.18, 1.25);
  const geometry = createNaturalStoneGeometry(i * 7.13,rockRadius);
  const rock = new THREE.Mesh(geometry, naturalRockMaterials[i % naturalRockMaterials.length]);
  rock.scale.set(THREE.MathUtils.randFloat(1, 1.85), THREE.MathUtils.randFloat(i % 5 === 0 ? 0.42 : 0.7, i % 5 === 0 ? 0.7 : 1.3), THREE.MathUtils.randFloat(0.75, 1.7));
  rock.rotation.set(THREE.MathUtils.randFloatSpread(0.2), THREE.MathUtils.randFloat(0, Math.PI * 2), THREE.MathUtils.randFloatSpread(0.2));
  rock.updateMatrix();
  const groundOffset = stoneSupportHeight(geometry,rock.matrix) - Math.min(0.08,rockRadius * 0.15);
  rock.position.set(x,footprintGroundHeight(x,z)+groundOffset,z);
  rock.castShadow = true;
  rock.receiveShadow = true;
  rock.userData = {
    speedFactor: THREE.MathUtils.randFloat(0.82, 1.04),
    hitRadius: rockRadius * Math.max(rock.scale.x, rock.scale.y, rock.scale.z) * 1.35,
    groundOffset,
    stoneMaterialIndex: i % naturalRockMaterials.length,
  };


  rocks.push(rock);
  world.add(rock);
}

// One rare violet deposit shares the area with ordinary rocks and small blue crystals.
const crystalMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xc3a0e8, emissive: 0x351452, emissiveIntensity: 0.4,
  roughness: 0.22, metalness: 0, flatShading: true,
  clearcoat: 0.65, clearcoatRoughness: 0.16,
  ior: 1.54, specularIntensity: 1, vertexColors: true,
});
// Preserve mineral variations in the glow instead of washing out the facets at night.
crystalMaterial.onBeforeCompile = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>
    #ifdef USE_COLOR
      totalEmissiveRadiance *= mix(vec3(0.55), vColor.rgb, 0.65);
    #endif`,
  );
};

function createCrystalGeometry(seed, height, radius, tint = 0x7945ae, highlight = 0xe5d9f0) {
  const positions = [];
  const colors = [];
  const rings = [];
  const faceColor = new THREE.Color();
  const mineral = new THREE.Color(tint);
  const quartz = new THREE.Color(highlight);
  const radii = Array.from({ length: 6 }, (_, side) => radius * (0.83 + hash2(seed, side) * 0.27));
  for (let ring = 0; ring < 4; ring += 1) {
    rings.push(Array.from({ length: 6 }, (_, side) => {
      const angle = side / 6 * Math.PI * 2;
      const taper = [0.8, 1, 0.94, 0.72][ring];
      const y = [0, height * 0.12, height * 0.78, height * 0.91][ring];
      return new THREE.Vector3(
        Math.cos(angle) * radii[side] * taper + ring * radius * 0.025,
        y + (ring > 1 ? (hash2(seed + ring, side) - 0.5) * height * 0.065 : 0),
        Math.sin(angle) * radii[side] * taper,
      );
    }));
  }
  function triangle(a, b, c, side, ring) {
    for (const vertex of [a, b, c]) {
      positions.push(vertex.x, vertex.y, vertex.z);
      const inclusion = smoothNoise(vertex.x * 13 + seed, vertex.y * 8 + vertex.z * 5);
      const band = Math.pow(0.5 + 0.5 * Math.sin(vertex.y * 24 + seed), 12) * 0.12;
      faceColor.copy(mineral).lerp(quartz, 0.12 + inclusion * 0.36 + band + (ring === 3 ? 0.12 : 0));
      faceColor.multiplyScalar(0.66 + hash2(seed + 31, side) * 0.52);
      colors.push(faceColor.r, faceColor.g, faceColor.b);
    }
  }
  for (let side = 0; side < 6; side += 1) {
    const next = (side + 1) % 6;
    for (let ring = 0; ring < 3; ring += 1) {
      triangle(rings[ring][side], rings[ring + 1][side], rings[ring][next], side, ring);
      triangle(rings[ring][next], rings[ring + 1][side], rings[ring + 1][next], side, ring);
    }
    triangle(rings[3][side], new THREE.Vector3(radius * 0.12, height * 1.12, -radius * 0.08), rings[3][next], side, 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const crystals = [];
for (let i = 0; i < 1; i += 1) {
  const deposit = new THREE.Group();
  const matrix = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 1), naturalRockMaterials[0]);
  matrix.scale.set(1.3, 0.32, 1.1);
  matrix.position.y = 0.03;
  matrix.castShadow = matrix.receiveShadow = true;
  deposit.add(matrix);
  for (let shard = 0; shard < 13; shard += 1) {
    const seed = 43 + shard * 7.3;
    const height = shard === 0 ? 3.8 : 0.55 + hash2(seed, 2) * 2.15;
    const radius = shard === 0 ? 0.47 : 0.15 + hash2(seed, 5) * 0.23;
    const crystal = new THREE.Mesh(createCrystalGeometry(seed, height, radius), crystalMaterial);
    const angle = shard * 2.39996;
    if (shard > 0) {
      const spread = 0.45 + hash2(seed, 9) * 0.65;
      crystal.position.set(Math.cos(angle) * spread, 0, Math.sin(angle) * spread);
      crystal.rotation.set(Math.sin(angle) * 0.32, angle, -Math.cos(angle) * 0.32);
    }
    crystal.castShadow = crystal.receiveShadow = true;
    deposit.add(crystal);
  }
  const angle = i * 2.4;
  deposit.position.set(Math.cos(angle) * (45 + i * 18), 0, Math.sin(angle) * (45 + i * 18));
  deposit.position.y = terrainHeight(deposit.position.x, deposit.position.z) + 0.18;
  deposit.userData = { isCrystal: true, hitRadius: 1.8, speedFactor: 1 };
  crystals.push(deposit);
  rocks.push(deposit);
  world.add(deposit);
}

const blueCrystalMaterial = crystalMaterial.clone();
blueCrystalMaterial.color.setHex(0x92dfff);
blueCrystalMaterial.emissive.setHex(0x0b438a);
blueCrystalMaterial.onBeforeCompile = crystalMaterial.onBeforeCompile;
const blueCrystalGroups = [];
for (let index = 0; index < 8; index++) {
  const cluster = { x: 0, z: 0, placed: false, members: [] };
  blueCrystalGroups.push(cluster);
  const count = 5 + Math.floor(hash2(index + 71, 13) * 4);
  for (let member = 0; member < count; member++) {
    // Stable member counts and shapes preserve the object order in saved games.
    const seed = 801 + index * 37 + member * 5.7;
    const height = 0.38 + hash2(seed, 2) * 0.5;
    const radius = 0.1 + hash2(seed, 5) * 0.1;
    const crystal = new THREE.Mesh(createCrystalGeometry(seed, height, radius, 0x197fdf, 0xc5f1ff), blueCrystalMaterial);
    const angle = member * 2.39996 + hash2(index, 43) * Math.PI * 2;
    const spread = Math.sqrt((member + 0.5) / count) * 2.4;
    crystal.rotation.set((hash2(seed, 7) - 0.5) * 0.2, angle, (hash2(seed, 9) - 0.5) * 0.2);
    crystal.castShadow = crystal.receiveShadow = true;
    crystal.userData = { isCrystal: true, isBlueCrystal: true, cluster: index, hitRadius: radius * 1.4,
      offsetX: Math.cos(angle) * spread, offsetZ: Math.sin(angle) * spread };
    cluster.members.push(crystal);
    rocks.push(crystal);
    world.add(crystal);
  }
}

function placeBlueCrystalGroup(cluster, origin, range = 146, minDistance = 18) {
  // Keep a nearby group discoverable; spread the others across the surrounding world.
  const scatterRange = cluster === blueCrystalGroups[0] ? Math.min(range, 48) : range;
  for (let attempt = 0; attempt < 120; attempt++) {
    const px = origin.x + THREE.MathUtils.randFloatSpread(scatterRange * 2);
    const pz = origin.z + THREE.MathUtils.randFloatSpread(scatterRange * 2);
    if (Math.hypot(px - origin.x, pz - origin.z) < minDistance) continue;
    if (blueCrystalGroups.some(other => other !== cluster && other.placed && Math.hypot(px - other.x, pz - other.z) < 10)) continue;
    const blocked = cluster.members.some(crystal => {
      const cx = px + crystal.userData.offsetX, cz = pz + crystal.userData.offsetZ;
      return (Math.abs(cx - baseLocation.x) < 12 * baseLayout.scale + 3 && Math.abs(cz - baseLocation.z) < 12 * baseLayout.scale + 3)
        || (Math.abs(cx - abandonedLocation.x) < 14 && Math.abs(cz - abandonedLocation.z) < 17)
        || Math.hypot(cx - spacecraft.group.position.x, cz - spacecraft.group.position.z) < 12
        || Math.hypot(cx-watchtowerLocation.x,cz-watchtowerLocation.z)<8
        || Math.hypot(cx-treasureLocation.x,cz-treasureLocation.z)<4
        || rocks.some(rock => !rock.userData.isBlueCrystal && rock.visible
          && Math.hypot(cx - rock.position.x, cz - rock.position.z) < (rock.userData.hitRadius || 1) + 0.5);
    });
    if (blocked) continue;
    cluster.x = px; cluster.z = pz; cluster.placed = true;
    for (const crystal of cluster.members) {
      const cx = px + crystal.userData.offsetX, cz = pz + crystal.userData.offsetZ;
      crystal.position.set(cx, terrainHeight(cx, cz) + 0.04, cz);
      crystal.visible = true;
      crystal.userData.laserDamage = 0;
      if (damagedRock === crystal) damagedRock = null;
    }
    return;
  }
}

function resetBlueCrystalGroups(origin) {
  for (const cluster of blueCrystalGroups) cluster.placed = false;
  for (const cluster of blueCrystalGroups) placeBlueCrystalGroup(cluster, origin);
}

function restoreBlueCrystalGroups() {
  for (const cluster of blueCrystalGroups) {
    cluster.x = cluster.members.reduce((sum, crystal) => sum + crystal.position.x - crystal.userData.offsetX, 0) / cluster.members.length;
    cluster.z = cluster.members.reduce((sum, crystal) => sum + crystal.position.z - crystal.userData.offsetZ, 0) / cluster.members.length;
    cluster.placed = true;
  }
}
resetBlueCrystalGroups({ x: 0, z: playerMovement.startZ });

// Render the inventory thumbnail from the same geometry and material as the world.
const inventoryImages = new Map();
function getStoneInventoryImage(kind = 'stone') {
  if (inventoryImages.has(kind)) return inventoryImages.get(kind);
  const previewRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  previewRenderer.setSize(192, 144);
  previewRenderer.outputColorSpace = renderer.outputColorSpace;
  previewRenderer.toneMapping = renderer.toneMapping;
  previewRenderer.toneMappingExposure = renderer.toneMappingExposure;
  const previewScene = new THREE.Scene();
  const previewRock = (kind === 'blue-crystal' ? blueCrystalGroups[0].members[0] : kind === 'crystal' ? crystals[0] : rocks[2]).clone();
  previewRock.visible = true;
  previewRock.position.set(0, 0, 0);
  const bounds = new THREE.Box3().setFromObject(previewRock);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const scale = 2 / Math.max(size.x, size.y, size.z);
  previewRock.scale.multiplyScalar(scale);
  previewRock.position.copy(center).multiplyScalar(-scale);
  previewScene.add(previewRock);
  previewScene.add(new THREE.HemisphereLight(0xffe9cf, 0x5c3927, 2));
  const light = new THREE.DirectionalLight(0xffeed8, 3);
  light.position.set(-3, 5, 4);
  previewScene.add(light);
  const previewCamera = new THREE.PerspectiveCamera(35, 192 / 144, 0.1, 20);
  previewCamera.position.set(2.5, 1.8, 3.5);
  previewCamera.lookAt(0, 0, 0);
  previewRenderer.render(previewScene, previewCamera);
  const image = previewRenderer.domElement.toDataURL('image/png');
  inventoryImages.set(kind, image);
  previewRenderer.dispose();
  return image;
}

const rockFragments = [];
const rockFragmentGeometry = new THREE.DodecahedronGeometry(0.18, 0);
const stoneFragmentGeometries = Array.from({length:12},(_,i) => createNaturalStoneGeometry(317+i*17,0.18,true));
const stoneFragmentMaterials = [materials.rock,materials.rockDark,materials.rockLight]
  .map((material,i) => createNaturalStoneMaterial(material,i,true));
const crystalFragmentGeometry = new THREE.OctahedronGeometry(0.18, 0);
const blackCrystalDebrisMaterial = new THREE.MeshStandardMaterial({
  color: 0x15121a, roughness: 0.72, metalness: 0.05, flatShading: true,
});
const crystalDebrisMaterials = [0x8a42c9, 0xad66df, 0x6930a2].map((color) =>
  new THREE.MeshPhysicalMaterial({
    color, emissive: 0x52127d, emissiveIntensity: 0.15,
    roughness: 0.24, metalness: 0, clearcoat: 0.6, flatShading: true,
  }),
);
const blueCrystalDebrisMaterials = [0x168ee0, 0x63d6ff, 0x2466c4].map(color => {
  const material = crystalDebrisMaterials[0].clone();
  material.color.setHex(color);
  material.emissive.setHex(0x0b438a);
  return material;
});

for (let i = 0; i < 512; i += 1) {
  const fragment = new THREE.Mesh(stoneFragmentGeometries[i % stoneFragmentGeometries.length],stoneFragmentMaterials[i % stoneFragmentMaterials.length]);
  fragment.castShadow = true;
  fragment.receiveShadow = true;
  fragment.visible = false;
  fragment.userData = {
    stoneMaterial: fragment.material,
    stoneGeometry: fragment.geometry,
    stoneDebris: true,
    age: 0,
    lifetime: 0.9,
    velocity: new THREE.Vector3(),
    rotationVelocity: new THREE.Vector3(),
  };
  rockFragments.push(fragment);
  world.add(fragment);
}

const impactSparks = [];
const sparkGeometry = new THREE.SphereGeometry(0.018, 6, 4);
for (let i = 0; i < 96; i += 1) {
  const spark = new THREE.Mesh(sparkGeometry, new THREE.MeshBasicMaterial({
    color: 0xffc65a, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  spark.visible = false;
  spark.userData = { age: 0, lifetime: 0.4, velocity: new THREE.Vector3() };
  impactSparks.push(spark);
  scene.add(spark);
}
let impactSparkIndex = 0;
const rockImpactRay = new THREE.Raycaster();
const rockImpactNormal = new THREE.Vector3();
const rockImpactNormalMatrix = new THREE.Matrix3();
const impactFlightDirection = new THREE.Vector3();
const shotPreviousPosition = new THREE.Vector3();

function findWeaponSurfaceHit(origin, direction, distance) {
  rockImpactRay.set(origin, direction);
  rockImpactRay.far = distance;
  for (const rock of rocks) rock.updateWorldMatrix(true, true);
  for (const tile of terrainTiles) tile.updateWorldMatrix(true, false);
  sandworm.object.updateWorldMatrix(true, true);
  planetaryBase.group.updateWorldMatrix(true, true);
  const wormTargets = sandworm.getLaserTargets();
  const hit = rockImpactRay.intersectObjects([...rocks.filter(rock => rock.visible), ...terrainTiles, ...mountains, planetaryBase.group, abandonedBuilding.group, watchtower.group, ...(state.treasureExcavated?[spaceTreasure.body]:[]), ...wormTargets], true)[0];
  if (!hit) return null;
  let ancestor = hit.object;
  while (ancestor && ancestor !== sandworm.object) ancestor = ancestor.parent;
  hit.worm = ancestor === sandworm.object;
  let rock = hit.object;
  while (rock.parent && !rocks.includes(rock)) rock = rock.parent;
  hit.rock = rocks.includes(rock) ? rock : null;
  rockImpactNormalMatrix.getNormalMatrix(hit.object.matrixWorld);
  rockImpactNormal.copy(hit.face.normal).applyMatrix3(rockImpactNormalMatrix).normalize();
  if (rockImpactNormal.dot(direction) > 0) rockImpactNormal.negate();
  return hit;
}

function emitRockImpact(hit) {
  audio.play(terrainTiles.includes(hit.object) ? 'groundImpact' : 'impact', 1, hit.point);
  for (let i = 0; i < 2; i += 1) {
    const chip = rockFragments[rockFragmentIndex];
    rockFragmentIndex = (rockFragmentIndex + 1) % rockFragments.length;
    const isCrystal = hit.rock?.userData.isCrystal === true;
    const crystalPalette = hit.rock?.userData.isBlueCrystal ? blueCrystalDebrisMaterials : crystalDebrisMaterials;
    chip.material = isCrystal ? crystalPalette[rockFragmentIndex % crystalPalette.length]
      : hit.rock ? stoneFragmentMaterials[hit.rock.userData.stoneMaterialIndex ?? 0] : chip.userData.stoneMaterial;
    chip.geometry = isCrystal ? crystalFragmentGeometry : chip.userData.stoneGeometry;
    chip.userData.stoneDebris = !isCrystal;
    if (!hit.rock) {
      if (!chip.userData.soilMaterial) {
        chip.userData.soilMaterial = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true });
      }
      chip.material = chip.userData.soilMaterial;
      const colors = hit.object.geometry.attributes.color;
      const { a, b, c } = hit.face;
      if (colors) chip.material.color.setRGB(
        (colors.getX(a) + colors.getX(b) + colors.getX(c)) / 3,
        (colors.getY(a) + colors.getY(b) + colors.getY(c)) / 3,
        (colors.getZ(a) + colors.getZ(b) + colors.getZ(c)) / 3,
      );
      else chip.material.color.copy(hit.object.material.color || rustBase);
    }
    chip.position.copy(hit.point).addScaledVector(rockImpactNormal, 0.025);
    chip.scale.setScalar(THREE.MathUtils.randFloat(0.12, 0.3));
    chip.visible = true;
    chip.userData.age = 0;
    chip.userData.lifetime = hit.rock ? THREE.MathUtils.randFloat(8, 12) : 1.5;
    chip.userData.velocity.copy(rockImpactNormal).multiplyScalar(THREE.MathUtils.randFloat(0.8, 2));
    chip.userData.velocity.x += THREE.MathUtils.randFloatSpread(1.2);
    chip.userData.velocity.y += THREE.MathUtils.randFloat(0.5, 1.8);
    chip.userData.velocity.z += THREE.MathUtils.randFloatSpread(1.2);
    chip.userData.rotationVelocity.set(Math.random() * 7, Math.random() * 9, Math.random() * 7);
  }
  for (let i = 0; i < 9; i += 1) {
    const spark = impactSparks[impactSparkIndex];
    impactSparkIndex = (impactSparkIndex + 1) % impactSparks.length;
    spark.position.copy(hit.point).addScaledVector(rockImpactNormal, 0.035);
    spark.visible = true;
    spark.userData.age = 0;
    spark.userData.lifetime = THREE.MathUtils.randFloat(0.18, 0.45);
    spark.userData.velocity.set(THREE.MathUtils.randFloatSpread(4), THREE.MathUtils.randFloat(0.3, 3.2), THREE.MathUtils.randFloatSpread(4));
    spark.userData.velocity.addScaledVector(rockImpactNormal, 2.5);
    spark.material.opacity = 1;
  }
}

function updateImpactSparks(delta) {
  for (const spark of impactSparks) {
    if (!spark.visible) continue;
    spark.userData.age += delta;
    const progress = spark.userData.age / spark.userData.lifetime;
    if (progress >= 1) { spark.visible = false; continue; }
    spark.position.addScaledVector(spark.userData.velocity, delta);
    spark.userData.velocity.y -= 5 * delta;
    impactFlightDirection.copy(spark.userData.velocity).normalize();
    spark.quaternion.setFromUnitVectors(laserForwardLocal, impactFlightDirection);
    spark.scale.set(1 - progress * 0.7, 1 - progress * 0.7, 3 + spark.userData.velocity.length() * 0.7);
    spark.material.opacity = (1 - progress) * (1 - progress);
    spark.material.color.setRGB(1, 0.8 - progress * 0.5, 0.15 * (1 - progress));
  }
}

const clouds = [];
// Soft density textures give the billows wispy edges instead of solid ellipsoids.
function createCloudMaterial(seed) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x / (size - 1) - 0.5) * 2;
      const v = (y / (size - 1) - 0.5) * 2;
      const coarse = smoothNoise(u * 3.8 + seed, v * 3.8 + seed * 2);
      const detail = smoothNoise(u * 12 + seed, v * 12 - seed);
      const fine = smoothNoise(u * 29 - seed, v * 29 + seed);
      const radius = Math.sqrt(u * u + v * v);
      const density = 1 - THREE.MathUtils.smoothstep(radius + (coarse - 0.5) * 0.32, 0.38, 0.97);
      const alpha = density * (0.66 + coarse * 0.22 + detail * 0.09 + fine * 0.03);
      // Warm sunlit crowns and cooler, denser undersides.
      const light = THREE.MathUtils.clamp(0.73 - v * 0.2 + (coarse - 0.5) * 0.18 + (detail - 0.5) * 0.055, 0, 1);
      const index = (y * size + x) * 4;
      pixels.data[index] = 172 + light * 79;
      pixels.data[index + 1] = 185 + light * 67;
      pixels.data[index + 2] = 194 + light * 59;
      pixels.data[index + 3] = alpha * 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map, transparent: true, opacity: 0.64, depthWrite: false, fog: true });
}

const cloudMaterials = [11, 37, 83].map(createCloudMaterial);

function placeCloudAround(cloud, originX, originZ, range = 320) {
  const angle = THREE.MathUtils.randFloat(0, Math.PI * 2);
  const distance = THREE.MathUtils.randFloat(range * 0.25, range);
  cloud.position.x = originX + Math.sin(angle) * distance;
  cloud.position.y = THREE.MathUtils.randFloat(95, 125);
  cloud.position.z = originZ + Math.cos(angle) * distance;
}

for (let i = 0; i < 56; i += 1) {
  const cloud = new THREE.Group();
  const width = THREE.MathUtils.randFloat(16, 31);
  const depth = THREE.MathUtils.randFloat(4, 9);
  const puffCount = THREE.MathUtils.randInt(9, 14);
  for (let puff = 0; puff < puffCount; puff += 1) {
    const t = puff / (puffCount - 1);
    const crown = Math.sin(t * Math.PI);
    const billow = new THREE.Sprite(cloudMaterials[(i + puff) % cloudMaterials.length]);
    const size = THREE.MathUtils.randFloat(5, 8) * (0.65 + crown * 0.65);
    billow.scale.set(size * THREE.MathUtils.randFloat(1.15, 1.65), size * THREE.MathUtils.randFloat(0.65, 1), 1);
    billow.position.set(
      (t - 0.5) * width + THREE.MathUtils.randFloatSpread(2),
      crown * THREE.MathUtils.randFloat(1.8, 4) + THREE.MathUtils.randFloatSpread(0.8),
      THREE.MathUtils.randFloatSpread(depth),
    );
    cloud.add(billow);
  }
  // Thin, broad wisps tie the billows into a continuous, flatter cloud base.
  for (let wisp = 0; wisp < 3; wisp += 1) {
    const base = new THREE.Sprite(cloudMaterials[(i + wisp) % cloudMaterials.length]);
    base.scale.set(width * 0.7, 2.6, 1);
    base.position.set((wisp - 1) * width * 0.22, -0.5, wisp - 1);
    cloud.add(base);
  }
  cloud.scale.setScalar(THREE.MathUtils.randFloat(0.78, 1.18));
  cloud.rotation.y = THREE.MathUtils.randFloat(-0.22, 0.22);
  cloud.position.set(THREE.MathUtils.randFloatSpread(260), THREE.MathUtils.randFloat(95, 125), THREE.MathUtils.randFloatSpread(260));
  cloud.userData = { speedFactor: THREE.MathUtils.randFloat(0.025, 0.055) };
  clouds.push(cloud);
  scene.add(cloud);
}

const grassTufts = [];
const grassWindTime = { value: 0 };
const naturalGrassMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.94, metalness: 0, side: THREE.DoubleSide,
});
// Use the same wind deformation for visible blades and their shadow silhouettes.
function applyGrassWind(shader) {
  shader.uniforms.grassWindTime = grassWindTime;
  shader.vertexShader = `uniform float grassWindTime;
${shader.vertexShader}`.replace(
    '#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 grassWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      float flexibility = pow(clamp(position.y / 1.2, 0.0, 1.0), 2.0);
      float gust = sin(grassWorld.x * 0.19 + grassWorld.z * 0.13 - grassWindTime * 1.7);
      float flutter = sin(grassWorld.x * 1.3 + grassWorld.z * 0.7 + grassWindTime * 3.2);
      transformed.x += (gust * 0.07 + flutter * 0.018) * flexibility;
      transformed.z += gust * 0.035 * flexibility;
    `,
  );
}
naturalGrassMaterial.onBeforeCompile = applyGrassWind;
const grassDepthMaterial = new THREE.MeshDepthMaterial({
  depthPacking: THREE.RGBADepthPacking,
  side: THREE.DoubleSide,
});
grassDepthMaterial.onBeforeCompile = applyGrassWind;

for (let i = 0; i < 660; i += 1) {
  const positions = [];
  const colors = [];
  const indices = [];
  const bladeCount = THREE.MathUtils.randInt(11, 18);
  const tuftHeight = THREE.MathUtils.randFloat(0.5, 1.05);
  const rootColor = new THREE.Color(0x333c20);
  const green = new THREE.Color(0x737b42);
  const straw = new THREE.Color(0xb5a16a);
  for (let blade = 0; blade < bladeCount; blade += 1) {
    const angle = Math.random() * Math.PI * 2;
    const outwardX = Math.sin(angle);
    const outwardZ = Math.cos(angle);
    const rootX = THREE.MathUtils.randFloatSpread(0.22);
    const rootZ = THREE.MathUtils.randFloatSpread(0.22);
    const height = tuftHeight * THREE.MathUtils.randFloat(0.45, 1.25);
    const width = THREE.MathUtils.randFloat(0.018, 0.038);
    const bend = THREE.MathUtils.randFloat(0.14, 0.46);
    const tipColor = green.clone().lerp(straw, THREE.MathUtils.randFloat(0.1, 0.95));
    const start = positions.length / 3;
    // Folded, tapered ribbons curve outward from a tightly rooted crown.
    for (let segment = 0; segment <= 6; segment += 1) {
      const t = segment / 6;
      const spread = bend * t * t;
      const halfWidth = width * Math.pow(1 - t, 0.8) * 0.5;
      const color = rootColor.clone().lerp(tipColor, Math.pow(t, 0.65));
      for (let edge = -1; edge <= 1; edge += 1) {
        const ridge = edge === 0 ? width * 0.22 * Math.sin(t * Math.PI) : 0;
        positions.push(
          rootX + outwardX * spread + outwardZ * halfWidth * edge,
          height * (t - 0.12 * t * t * t) + ridge,
          rootZ + outwardZ * spread - outwardX * halfWidth * edge,
        );
        colors.push(color.r, color.g, color.b);
      }
      if (segment < 6) {
        for (let strip = 0; strip < 2; strip += 1) {
          const v = start + segment * 3 + strip;
          indices.push(v, v + 3, v + 1, v + 1, v + 3, v + 4);
        }
      }
    }
    // Sparse seed barbs at the tips break up the silhouette of the tallest stems.
    if (blade % 6 === 0) {
      for (let seed = 0; seed < 4; seed += 1) {
        const t = 0.78 + seed * 0.045;
        const x = rootX + outwardX * bend * t * t;
        const z = rootZ + outwardZ * bend * t * t;
        const y = height * (t - 0.12 * t * t * t);
        const side = seed % 2 ? 1 : -1;
        const v = positions.length / 3;
        positions.push(x, y, z, x + outwardZ * side * 0.045, y + 0.025, z - outwardX * side * 0.045, x, y + 0.04, z);
        for (let c = 0; c < 3; c += 1) colors.push(straw.r, straw.g, straw.b);
        indices.push(v, v + 1, v + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += 0.12;
  const tuft = new THREE.Mesh(geometry, naturalGrassMaterial);
  const x = THREE.MathUtils.randFloatSpread(150);
  const z = THREE.MathUtils.randFloatSpread(190);
  tuft.position.set(x, terrainHeight(x, z) + 0.015, z);
  tuft.rotation.y = Math.random() * Math.PI * 2;
  tuft.castShadow = true;
  // Folded, wind-deformed ribbons otherwise shadow themselves with unstable
  // depth comparisons. Keep their cast shadows on the terrain instead.
  tuft.receiveShadow = false;
  tuft.customDepthMaterial = grassDepthMaterial;
  grassTufts.push(tuft);
  world.add(tuft);
}

const suitFabric = createSuitFabric(renderer);
const equipment = createEquipmentMaterials(renderer);
materials.ship = suitFabric.shell;
materials.suitTrim = suitFabric.panel;
materials.suitPanel = suitFabric.panel;
materials.suitShadow = suitFabric.reinforcement;

const helmetShellMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xdedfd5, roughness: 0.42, metalness: 0.04,
  bumpMap: equipment.shell.bumpMap, bumpScale: 0.00012,
  clearcoat: 0.28, clearcoatRoughness: 0.34,
});
const visorCanvas = document.createElement('canvas');
visorCanvas.width = 512;
visorCanvas.height = 256;
const visorContext = visorCanvas.getContext('2d');
const visorSky = visorContext.createLinearGradient(0, 0, 0, 256);
visorSky.addColorStop(0, '#20364c');
visorSky.addColorStop(0.44, '#b9cfdb');
visorSky.addColorStop(0.5, '#e3c7a2');
visorSky.addColorStop(0.54, '#82533a');
visorSky.addColorStop(1, '#261c17');
visorContext.fillStyle = visorSky;
visorContext.fillRect(0, 0, 512, 256);
const reflection = visorContext.createRadialGradient(160, 76, 2, 160, 76, 55);
reflection.addColorStop(0, '#fff5d5');
reflection.addColorStop(0.1, '#fff0bc');
reflection.addColorStop(1, 'rgba(255,240,188,0)');
visorContext.fillStyle = reflection;
visorContext.fillRect(0, 0, 512, 256);
const visorEnvironment = new THREE.CanvasTexture(visorCanvas);
visorEnvironment.colorSpace = THREE.SRGBColorSpace;
visorEnvironment.mapping = THREE.EquirectangularReflectionMapping;
const visorMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xd4a24d, metalness: 0.88, roughness: 0.16,
  clearcoat: 1, clearcoatRoughness: 0.09,
  envMap: visorEnvironment, envMapIntensity: 0.85,
});


// Sample the same moving star field as the sky using the visor's reflected view.
visorMaterial.onBeforeCompile = (shader) => {
  const sky = skyDome.material.uniforms;
  shader.uniforms.nightStrength = sky.nightStrength;
  shader.uniforms.starTime = sky.starTime;
  shader.uniforms.starAngle = sky.starAngle;
  shader.uniforms.stormStrength = sky.stormStrength;
  const skySource = skyDome.material.fragmentShader;
  const starField = skySource.slice(skySource.indexOf('// Rotate the celestial sphere'),
    skySource.indexOf('        sky += starColor'));
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
    #include <common>
    uniform float nightStrength;
    uniform float stormStrength;
    uniform float starTime;
    uniform float starAngle;
    float starHash(vec2 cell) {
      return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
    }
  `).replace('#include <emissivemap_fragment>', `
    #include <emissivemap_fragment>
    {
      vec3 direction = inverseTransformDirection(reflect(-normalize(vViewPosition), normal), viewMatrix);
      float h = direction.y;
      ${starField}
      totalEmissiveRadiance += starColor * stars * 3.5 * (1.0 - stormStrength);
    }
  `);
};
visorMaterial.customProgramCacheKey = () => 'visor-moving-star-reflection-v3';

const ship = new THREE.Group();
// Apply lean and banking in the explorer's heading, rather than world axes.
ship.rotation.order = 'YXZ';
ship.scale.setScalar(0.8778);
ship.rotation.y = state.faceYaw;

const torso = new THREE.Mesh(createClothCapsule(0.36, 0.45, 1, { lower: 0.88, upper: 1.02 }), materials.ship);
torso.position.set(0, 0.55, 0);
torso.scale.set(0.94, 0.9, 0.68);
torso.castShadow = true;
ship.add(torso);

const waistSeal = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.038, 10, 32), materials.rubber);
waistSeal.position.set(0, -0.28, 0);
waistSeal.rotation.x = Math.PI / 2;
waistSeal.scale.set(1.18, 0.84, 1);
waistSeal.castShadow = true;
ship.add(waistSeal);

for (const side of [-1, 1]) {
  const hipPack = createPaddedPanel(0.16, 0.22, 0.12, suitFabric);
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

const upperTorsoPanel = createPaddedPanel(0.62, 0.32, 0.045, suitFabric);
upperTorsoPanel.position.set(0, 0.5, 0.285);
upperTorsoPanel.scale.set(1, 1, 0.72);
upperTorsoPanel.castShadow = true;
ship.add(upperTorsoPanel);

const lowerTorsoPanel = createPaddedPanel(0.48, 0.26, 0.045, suitFabric);
lowerTorsoPanel.position.set(0, -0.05, 0.292);
lowerTorsoPanel.castShadow = true;
ship.add(lowerTorsoPanel);

const { root: chestPanel, flashlight: chestFlashlight, lensMaterial: flashlightLensMaterial } = createChestConsole(equipment);
chestPanel.position.set(0, 0.3, 0.345);
ship.add(chestPanel);
// Keep the light outside the body so it also works with the hidden first-person suit.
const chestFlashlightBeam = new THREE.SpotLight(0xffedcc, 0, 65, Math.PI / 7, 0.65, 2);
scene.add(chestFlashlightBeam, chestFlashlightBeam.target);
// Soft spill from the chest lamp lights the nearby weapon as well as the ground.
const chestFlashlightSpill = new THREE.PointLight(0xffedcc, 0, 2.5, 2);
scene.add(chestFlashlightSpill);
const flashlightForward = new THREE.Vector3();

function updateChestFlashlight() {
  const darkness = skyDome.material.uniforms.nightStrength.value;
  const brightness = state.running ? THREE.MathUtils.smoothstep(darkness, 0.1, 0.7) : 0;
  chestFlashlightBeam.intensity = brightness * 500;
  chestFlashlightSpill.intensity = brightness * 2.5;
  flashlightLensMaterial.emissiveIntensity = brightness * 2.5;
  if (brightness === 0) return;
  chestFlashlight.updateWorldMatrix(true, false);
  chestFlashlight.localToWorld(chestFlashlightBeam.position.set(0, 0, 0.09));
  flashlightForward.set(Math.sin(state.faceYaw), 0, Math.cos(state.faceYaw));
  chestFlashlightBeam.target.position.copy(chestFlashlightBeam.position).addScaledVector(flashlightForward, 24);
  const target = chestFlashlightBeam.target.position;
  // Aim relative to the lamp so the beam rises with the explorer in flight.
  target.y = chestFlashlightBeam.position.y - 1.2;
  if (state.firstPerson) {
    chestFlashlightBeam.position.addScaledVector(flashlightForward, -2.0);
  }
  chestFlashlightSpill.position.copy(chestFlashlightBeam.position);
  chestFlashlightBeam.target.updateMatrixWorld();
}

// Tailored side seams sit on the moving torso; doubled stitches catch the light.
for (const side of [-1, 1]) {
  for (const offset of [-0.007, 0.007]) {
    addFabricSeam(torso, [
      [side * (0.25 + offset), -0.33, 0.245],
      [side * (0.28 + offset), -0.12, 0.228],
      [side * (0.28 + offset), 0.12, 0.228],
      [side * (0.24 + offset), 0.34, 0.253],
    ], suitFabric);
  }
}

// Fit the chest equipment and belt to the shorter torso before the head and
// limbs are added. Their sizes and attachment points change together.
for (const part of ship.children) {
  if (part === torso) continue;
  part.position.multiply(new THREE.Vector3(0.87, 0.8, 0.9));
  part.position.y += 0.4;
  part.scale.multiply(new THREE.Vector3(0.87, 0.8, 0.9));
}
const pelvis = new THREE.Mesh(createClothCapsule(0.24, 0.08, 6), suitFabric.shell);
pelvis.scale.set(1.15, 0.6, 1);
pelvis.castShadow = true;
ship.add(pelvis);

const neckRing = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.055, 12, 36), materials.metalTrim);
neckRing.position.set(0, 0.98, 0);
neckRing.scale.setScalar(0.74);
neckRing.rotation.x = Math.PI / 2;
neckRing.castShadow = true;
ship.add(neckRing);

const upperNeckRing = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.035, 12, 36), materials.metalTrim);
upperNeckRing.position.copy(neckRing.position).y += 0.12;
upperNeckRing.scale.copy(neckRing.scale);
upperNeckRing.rotation.copy(neckRing.rotation);
upperNeckRing.castShadow = true;
ship.add(upperNeckRing);

const neckHeight = upperNeckRing.position.y - neckRing.position.y;
const neckGeometry = new THREE.CylinderGeometry(0.15, 0.17, neckHeight, 40, 12);
const neckPositions = neckGeometry.attributes.position;
const neckUV = neckGeometry.attributes.uv;
for (let vertex = 0; vertex < neckPositions.count; vertex += 1) {
  const x = neckPositions.getX(vertex), y = neckPositions.getY(vertex), z = neckPositions.getZ(vertex);
  const height = (y + neckHeight / 2) / neckHeight;
  const angle = Math.atan2(z, x);
  const fold = 1 + Math.sin(height * Math.PI * 6 + Math.cos(angle * 2) * 0.5)
    * Math.sin(height * Math.PI) * 0.015;
  neckPositions.setXYZ(vertex, x * fold, y, z * fold);
  neckUV.setXY(vertex, neckUV.getX(vertex) * Math.PI * 2 * 0.16, height * neckHeight);
}
neckGeometry.computeVertexNormals();
const neck = new THREE.Mesh(neckGeometry, suitFabric.reinforcement);
neck.position.copy(neckRing.position).y += neckHeight / 2;
neck.castShadow = neck.receiveShadow = true;
ship.add(neck);

const lowerNeckSeal = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.025, 8, 32), materials.rubber);
lowerNeckSeal.position.set(0, 0.925, 0);
lowerNeckSeal.scale.setScalar(0.78);
lowerNeckSeal.rotation.x = Math.PI / 2;
lowerNeckSeal.castShadow = true;
ship.add(lowerNeckSeal);

const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.46, 48, 32), helmetShellMaterial);
helmet.position.set(0, 1.22, 0.045);
helmet.scale.set(0.96, 1.04, 1.0);
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

const visor = new THREE.Mesh(new THREE.SphereGeometry(0.305, 56, 28, 0, Math.PI, 0, Math.PI), visorMaterial);
visor.position.set(0, 1.24, 0.375);
visor.scale.set(1.13, 0.9, 0.82);
visor.castShadow = false;
ship.add(visor);

const visorSeal = new THREE.Mesh(new THREE.TorusGeometry(0.322, 0.025, 10, 56), materials.rubber);
visorSeal.position.set(0, 1.24, 0.378);
visorSeal.scale.set(1.13, 0.9, 1);
visorSeal.castShadow = true;
ship.add(visorSeal);

const visorGlow = new THREE.Mesh(new THREE.TorusGeometry(0.282, 0.012, 8, 48), materials.helmetGlass);
visorGlow.position.set(0, 1.24, 0.405);
visorGlow.scale.set(1.13, 0.9, 1);
visorGlow.castShadow = false;
ship.add(visorGlow);

const visorReflection = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.022, 0.012), materials.helmetGlass);
visorReflection.position.set(-0.09, 1.37, 0.665);
visorReflection.rotation.z = -0.22;


const visorLowerReflection = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.016, 0.012), materials.helmetGlass);
visorLowerReflection.position.set(0.12, 1.13, 0.658);
visorLowerReflection.rotation.z = -0.14;


const chinVent = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.035), materials.rubber);
chinVent.position.set(0, 1.0, 0.43);
chinVent.castShadow = true;
ship.add(chinVent);

const helmetAnimatedParts = [helmet, helmetBand, helmetCrownBand, visor, visorSeal, visorGlow, chinVent];

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

const backpackRig = new THREE.Group();
backpackRig.position.copy(torso.position);
ship.add(backpackRig);

const { root: backpack, nozzles: jetpackNozzles } = createLifeSupportPack(equipment);
backpack.position.set(0, 0.3, -0.4);
backpackRig.add(backpack);

const jetpackFlames = new THREE.Group();
const jetpackExhaustPoint = new THREE.Vector3();
const jetpackExhaustDirection = new THREE.Vector3();
const jetpackRearAxis = new THREE.Vector3(0, 0, -1);
const jetpackTargetRotation = new THREE.Quaternion();
function createExhaustMaterial(core, side) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { time: { value: 0 }, burn: { value: 0 }, core: { value: core ? 1 : 0 }, seed: { value: side * 3.7 } },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      uniform float time;
      uniform float seed;
      void main() {
        vUv = uv;
        vec3 p = position;
        float travel = uv.y;
        float turbulence = sin(travel * 23.0 - time * 19.0 + seed)
          * sin(uv.x * 18.8496 + time * 7.0) * travel;
        p.xy *= 1.0 + turbulence * 0.13;
        p.x += sin(travel * 14.0 - time * 16.0 + seed) * travel * travel * 0.009;
        vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = -viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      uniform float time;
      uniform float burn;
      uniform float core;
      uniform float seed;
      void main() {
        float t = vUv.y;
        float edge = pow(abs(dot(normalize(vNormal), normalize(vView))), 0.7);
        float turbulence = 0.82 + 0.12 * sin(t * 47.0 - time * 31.0 + seed)
          + 0.06 * sin(vUv.x * 31.0 + t * 81.0 - time * 23.0);
        float diamonds = pow(0.5 + 0.5 * cos(t * 38.0 - 0.4), 6.0) * exp(-t * 3.0);
        vec3 color = mix(vec3(0.3, 0.6, 1.0), vec3(1.0, 0.38, 0.08), smoothstep(0.16, 0.8, t));
        color = mix(color, vec3(0.85, 0.94, 1.0), core * (1.0 - smoothstep(0.0, 0.8, t)));
        float fade = (1.0 - smoothstep(0.25, 1.0, t)) * smoothstep(0.0, 0.035, t);
        float alpha = burn * fade * edge * turbulence * mix(0.55, 0.85, core);
        gl_FragColor = vec4(color * (1.2 + core + diamonds * 0.7), alpha);
      }
    `,
  });
}
const jetpackFlameGeometry = new THREE.CylinderGeometry(0.006, 0.06, 1.3, 24, 24, true);
jetpackFlameGeometry.rotateX(-Math.PI / 2);
jetpackFlameGeometry.translate(0, 0, -0.65);
const jetpackCoreGeometry = new THREE.CylinderGeometry(0.002, 0.033, 0.7, 20, 16, true);
jetpackCoreGeometry.rotateX(-Math.PI / 2);
jetpackCoreGeometry.translate(0, 0, -0.35);

for (const side of [-1, 1]) {
  const x = side * 0.36;
  const flame = new THREE.Group();
  const outer = new THREE.Mesh(jetpackFlameGeometry, createExhaustMaterial(false, side));
  const core = new THREE.Mesh(jetpackCoreGeometry, createExhaustMaterial(true, side));
  flame.position.set(x, 0.08, -0.66);
  const glow = new THREE.PointLight(0x82baff, 0, 2.5, 2);
  glow.position.z = -0.12;
  flame.add(glow);
  flame.userData = { outer, core, side, glow };
  flame.visible = false;
  flame.add(outer, core);
  jetpackFlames.add(flame);
}
backpackRig.add(jetpackFlames);

// Preserve the resting positions while moving every component around one pivot.
for (const part of backpackRig.children) {
  part.position.multiply(new THREE.Vector3(0.87, 0.8, 0.9));
  part.position.y += 0.4;
  part.scale.multiply(new THREE.Vector3(0.87, 0.8, 0.9));
  part.position.sub(backpackRig.position);
}

const laserBeamGeometry = new THREE.CylinderGeometry(0.031185, 0.054054, laserRange, 32, 1, false);
laserBeamGeometry.rotateX(Math.PI / 2);
let handLaser = null;
const laserBaseRotation = new THREE.Euler(0.14, -0.06, -0.1);
const laserShotCoreGeometry = new THREE.SphereGeometry(0.075, 20, 14);
const laserShotTrailGeometry = new THREE.CylinderGeometry(0.06, 0.001, 1.2, 20, 1, true);
laserShotTrailGeometry.rotateX(Math.PI / 2);
const laserShots = [];
let laserShotIndex = 0;
const laserMuzzleWorld = new THREE.Vector3();
const laserShotDirection = new THREE.Vector3();
const laserShotTarget = new THREE.Vector3();
const spacecraftShotDirection = new THREE.Vector3();
const laserForwardLocal = new THREE.Vector3(0, 0, 1);
const laserForwardBasis = new THREE.Vector3(0, 0, 1);
const laserBeamOrigin = new THREE.Vector3();
const laserBeamDirection = new THREE.Vector3();
const laserAimRay = new THREE.Raycaster();
laserAimRay.far = laserRange;
const laserAimScreen = new THREE.Vector2();
const laserAimTarget = new THREE.Vector3();
const laserAimLocal = new THREE.Vector3();
const laserRestQuaternion = new THREE.Quaternion();
const laserRestEuler = new THREE.Euler();
const rockHitOffset = new THREE.Vector3();
const rockFragmentVelocity = new THREE.Vector3();
let rockFragmentIndex = 0;

for (let i = 0; i < Math.ceil(laserRange / laserShotSpeed / laserShotInterval) + 2; i += 1) {
  const shot = new THREE.Group();
  const core = new THREE.Mesh(laserShotCoreGeometry, materials.laserShotCore.clone());
  const trail = new THREE.Mesh(laserShotTrailGeometry, materials.laserShot.clone());
  const halo = new THREE.Mesh(laserShotCoreGeometry, materials.laserShot.clone());
  core.scale.set(0.8, 0.8, 2.1);
  halo.scale.set(1.7, 1.7, 2.8);
  halo.material.opacity = 0;
  trail.material.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying float vTrailFade;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nvTrailFade = uv.y;',
    );
    shader.fragmentShader = `varying float vTrailFade;\n${shader.fragmentShader}`.replace(
      '#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= smoothstep(0.0, 0.8, vTrailFade);',
    );
  };

  core.material.opacity = 0;
  trail.material.opacity = 0;
  trail.position.z = -0.6;
  shot.add(core, trail, halo);
  shot.visible = false;
  shot.userData = {
    age: 0,
    lifetime: 0.78,
    velocity: new THREE.Vector3(),
    core,
    trail,
    halo,
  };
  laserShots.push(shot);
  scene.add(shot);
}
const limbRig = [];

for (const side of [-1, 1]) {
  const shoulder = new THREE.Mesh(createClothCapsule(0.14, 0, side), materials.suitTrim);
  shoulder.position.set(side * 0.38, 0.84, 0.02);
  shoulder.scale.set(1, 0.9, 1);
  shoulder.castShadow = true;
  ship.add(shoulder);

  const shoulderRing = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.014, 8, 24), materials.metalTrim);
  shoulderRing.position.set(side * 0.39, 0.8, 0.04);
  shoulderRing.rotation.set(Math.PI / 2, 0, side * 0.46);
  shoulderRing.castShadow = true;
  ship.add(shoulderRing);

  const upperArm = new THREE.Mesh(createClothCapsule(0.105, 0.19, side * 2, { lower: 0.92, upper: 1.04 }), materials.ship);
  upperArm.position.set(side * 0.42, 0.655, 0.02);
  upperArm.rotation.z = side * 0.35;
  upperArm.castShadow = true;
  ship.add(upperArm);

  const upperArmPatch = createPaddedPanel(0.08, 0.16, 0.025, suitFabric);
  upperArmPatch.position.set(0, 0.04, 0.1);
  upperArmPatch.rotation.z = side * -0.18;
  upperArmPatch.castShadow = true;
  upperArm.add(upperArmPatch);

  const elbowPad = createPaddedPanel(0.15, 0.09, 0.035, suitFabric, suitFabric.reinforcement);
  elbowPad.position.set(0, -0.15, -0.085);
  elbowPad.rotation.y = Math.PI;
  elbowPad.scale.set(1.2, 1, 1);
  elbowPad.castShadow = true;
  upperArm.add(elbowPad);

  const forearm = new THREE.Mesh(createClothCapsule(0.098, 0.18, side * 7, { lower: 0.84, upper: 1.02 }), materials.ship);
  forearm.position.set(side * 0.47, 0.33, 0.05);
  forearm.castShadow = true;
  ship.add(forearm);

  const elbow = new THREE.Mesh(createClothCapsule(0.098, 0, side * 9), materials.ship);
  elbow.scale.y = 0.92;
  elbow.castShadow = true;
  ship.add(elbow);

  const wristRing = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.014, 8, 20), materials.metalTrim);
  wristRing.position.set(side * 0.48, 0.17, 0.12);
  wristRing.rotation.set(Math.PI / 2, 0, side * 0.25);
  wristRing.castShadow = true;
  ship.add(wristRing);

  // A flattened palm and individually curled fingers replace the round mitten.
  const palmGeometry = new THREE.SphereGeometry(0.105, 24, 18);
  palmGeometry.scale(0.87, 0.91, 0.64);
  const glove = new THREE.Mesh(palmGeometry, equipment.rubber);
  glove.position.set(side * 0.49, 0.08, 0.14);
  glove.castShadow = glove.receiveShadow = true;
  ship.add(glove);
  const fingerLengths = [0.105, 0.12, 0.112, 0.085];
  const fingerRig = [];
  for (let finger = 0; finger < 4; finger++) {
    const x = (finger - 1.5) * 0.036 * side;
    const length = fingerLengths[finger];
    const joints = [new THREE.Vector3(x, -0.045, 0.018),
      new THREE.Vector3(x, -0.045 - length * 0.48, 0.028),
      new THREE.Vector3(x, -0.045 - length * 0.82, 0.052),
      new THREE.Vector3(x, -0.045 - length * 0.94, 0.075)];
    const pivots = [];
    let parent = glove;
    for (let segment = 0; segment < 3; segment++) {
      const start = joints[segment], end = joints[segment + 1];
      const pivot = new THREE.Group();
      pivot.position.copy(start);
      if (segment > 0) pivot.position.sub(joints[segment - 1]);
      parent.add(pivot);
      parent = pivot;
      pivots.push(pivot);
      const radius = 0.018 - segment * 0.002;
      const part = new THREE.Mesh(new THREE.CapsuleGeometry(radius,
        Math.max(0.001, start.distanceTo(end) - radius), 5, 10), equipment.rubber);
      part.position.copy(end).sub(start).multiplyScalar(0.5);
      part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
      part.castShadow = part.receiveShadow = true;
      pivot.add(part);
    }
    fingerRig.push(pivots);
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), suitFabric.reinforcement);
    knuckle.scale.set(1, 0.8, 0.45);
    knuckle.position.set(x, -0.04, -0.054);
    glove.add(knuckle);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.065, 6, 12), equipment.rubber);
  thumb.position.set(side * 0.075, -0.025, 0.045);
  thumb.rotation.set(-0.5, 0, side * -0.55);
  thumb.castShadow = true;
  glove.add(thumb);

  if (side < 0) {
    const laserGroup = new THREE.Group();
    laserGroup.position.set(-0.035, -0.02, 0.17);
    laserGroup.rotation.copy(laserBaseRotation);
    glove.add(laserGroup);

    const gunMetal = new THREE.MeshStandardMaterial({ color: 0x59636d, roughness: 0.38, metalness: 0.72 });
    const gunGreen = new THREE.MeshStandardMaterial({ color: 0x527342, roughness: 0.6, metalness: 0.28 });
    const gripRubber = new THREE.MeshStandardMaterial({ color: 0x242930, roughness: 0.92, metalness: 0.04 });
    const barrelMetal = new THREE.MeshStandardMaterial({ color: 0x303a43, roughness: 0.3, metalness: 0.8 });
    function gunBox(width, height, depth, x, y, z, material, bevel = 0.006) {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 2, bevel), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      laserGroup.add(mesh);
      return mesh;
    }
    function gunCylinder(radius, length, z, material, innerRadius = radius) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, innerRadius, length, 24), material);
      mesh.position.set(0, 0.018, z);
      mesh.rotation.x = Math.PI / 2;
      mesh.castShadow = true;
      laserGroup.add(mesh);
      return mesh;
    }

    const grip = gunBox(0.072, 0.17, 0.085, 0, -0.075, -0.005, gripRubber, 0.012);
    grip.rotation.x = -0.32;
    gunBox(0.085, 0.022, 0.095, 0, -0.15, -0.028, barrelMetal);
    // Beveled receiver, separate slide and rear end cap catch the sunlight.
    gunBox(0.13, 0.092, 0.3, 0, 0.015, 0.095, gunGreen, 0.014);
    gunBox(0.108, 0.032, 0.27, 0, 0.068, 0.105, barrelMetal);
    gunBox(0.112, 0.065, 0.018, 0, 0.02, -0.061, barrelMetal);
    gunBox(0.095, 0.052, 0.12, 0, -0.04, 0.2, gripRubber);

    // Raised grip texture, inset side panels and small fasteners.
    for (const side of [-1, 1]) {
      gunBox(0.008, 0.052, 0.14, side * 0.065, 0.012, 0.085, gunGreen, 0.003);
      for (let rib = 0; rib < 6; rib += 1) {
        if (side < 0) {
          const texture = gunBox(0.077, 0.007, 0.068, 0, -0.045 - rib * 0.016, 0.005 - rib * 0.005, gunMetal, 0.002);
          texture.rotation.x = -0.32;
        }
        gunBox(0.006, 0.035, 0.006, side * 0.071, 0.022, 0.12 + rib * 0.014, gripRubber, 0.002);
      }
      for (const z of [0.025, 0.14]) {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.004, 12), materials.metalTrim);
        screw.rotation.z = Math.PI / 2;
        screw.position.set(side * 0.072, 0.012, z);
        laserGroup.add(screw);
        gunBox(0.005, 0.002, 0.009, side * 0.075, 0.012, z, gripRubber, 0.0005);
      }
    }
    // Open trigger guard and curved trigger below the receiver.
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 8, 24), barrelMetal);
    guard.rotation.y = Math.PI / 2;
    guard.scale.set(1.15, 0.75, 1);
    guard.position.set(0, -0.055, 0.085);
    laserGroup.add(guard);
    const trigger = gunBox(0.012, 0.035, 0.012, 0, -0.047, 0.075, gunMetal, 0.004);
    trigger.rotation.x = -0.35;

    gunCylinder(0.031, 0.28, 0.36, barrelMetal);
    for (const z of [0.255, 0.3, 0.345, 0.39, 0.435]) {
      gunCylinder(0.04, 0.014, z, gunMetal);
    }
    gunCylinder(0.045, 0.042, 0.492, barrelMetal);
    gunCylinder(0.035, 0.006, 0.516, gripRubber);
    const emitter = gunCylinder(0.023, 0.008, 0.522, materials.laserEmitter);

    // Paired rear sight blades leave a clear notch aligned with the front post.
    for (const side of [-1, 1]) {
      gunBox(0.018, 0.024, 0.024, side * 0.035, 0.094, -0.018, barrelMetal, 0.003);
      gunBox(0.006, 0.006, 0.004, side * 0.035, 0.098, -0.032, materials.laserEmitter, 0.001);
    }
    gunBox(0.015, 0.025, 0.025, 0, 0.087, 0.218, barrelMetal, 0.003);
    gunBox(0.005, 0.006, 0.005, 0, 0.1, 0.207, materials.laserEmitter, 0.001);

    const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.038, 24, 16), materials.laserBeam.clone());
    muzzleFlash.position.set(0, 0.018, 0.545);
    muzzleFlash.visible = false;
    laserGroup.add(muzzleFlash);

    const beam = new THREE.Mesh(laserBeamGeometry, materials.laserBeam.clone());
    beam.material.blending = THREE.NormalBlending;
    beam.material.side = THREE.DoubleSide;
    beam.material.forceSinglePass = true;
    beam.material.depthWrite = true;
    const beamTime = { value: 0 };
    // Shade inside the existing beam silhouette; no separate outer glow shell.
    beam.material.onBeforeCompile = (shader) => {
      shader.uniforms.laserTime = beamTime;
      shader.vertexShader = `varying float vLaserLength;
        varying vec3 vLaserNormal;
        varying vec3 vLaserAxis;
        varying vec3 vLaserView;
        ${shader.vertexShader}`.replace('#include <project_vertex>', `
          #include <project_vertex>
          vLaserLength = position.z;
          vLaserNormal = normalize(normalMatrix * normal);
          vLaserAxis = normalize(mat3(modelViewMatrix) * vec3(0.0, 0.0, 1.0));
          vLaserView = -mvPosition.xyz;
        `);
      shader.fragmentShader = `uniform float laserTime;
        varying float vLaserLength;
        varying vec3 vLaserNormal;
        varying vec3 vLaserAxis;
        varying vec3 vLaserView;
        ${shader.fragmentShader}`.replace('#include <color_fragment>', `
          #include <color_fragment>
          float shimmer = 0.9 + 0.09 * sin(vLaserLength * 7.0 - laserTime * 19.0)
            + 0.06 * sin(vLaserLength * 17.0 + laserTime * 27.0);
          vec3 axis = normalize(vLaserAxis);
          vec3 view = normalize(vLaserView);
          vec3 radialView = view - axis * dot(view, axis);
          float facing = abs(dot(normalize(vLaserNormal), radialView / max(length(radialView), 0.0001)));
          float radialDistance = sqrt(max(0.0, 1.0 - facing * facing));
          float narrowedFacing = sqrt(max(0.0, 1.0 - pow(radialDistance / 0.9, 2.0)));
          float core = pow(smoothstep(0.0, 1.0, narrowedFacing), 2.0);
          diffuseColor.rgb = mix(vec3(0.07, 0.74, 0.12), vec3(0.78, 1.0, 0.7), core) * shimmer;
        `);
    };
    beam.position.set(0, 0.018, 44.55);
    beam.visible = false;
    laserGroup.add(beam);

    handLaser = {
      group: laserGroup, beam, muzzleFlash, emitter, beamTime,
      parent: glove,
      restingPosition: laserGroup.position.clone(),
      raiseAmount: 0,
      visibleUntil: 0,
    };
  }

  const hip = new THREE.Mesh(createClothCapsule(0.14, 0, side * 4), materials.suitTrim);
  hip.position.set(side * 0.18, 0.02, 0.02);
  hip.castShadow = true;
  ship.add(hip);

  const thighRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 8, 24), materials.metalTrim);
  thighRing.position.set(side * 0.18, -0.08, 0.04);
  thighRing.rotation.set(Math.PI / 2, 0, side * -0.08);
  thighRing.castShadow = true;
  ship.add(thighRing);

  const upperLeg = new THREE.Mesh(createClothCapsule(0.13, 0.3, side * 3, { lower: 0.88, upper: 1.08 }), materials.ship);
  upperLeg.position.set(side * 0.18, -0.25, 0.055);
  upperLeg.rotation.z = side * -0.06;
  upperLeg.castShadow = true;
  ship.add(upperLeg);

  const leg = new THREE.Mesh(createClothCapsule(0.11, 0.3, side * 5, { lower: 0.83, upper: 1.06 }), materials.ship);
  leg.position.set(side * 0.19, -0.76, 0.03);
  leg.rotation.z = side * -0.09;
  leg.castShadow = true;
  ship.add(leg);

  const shinPlate = createPaddedPanel(0.15, 0.22, 0.035, suitFabric);
  shinPlate.position.set(0, -0.04, 0.108);
  shinPlate.castShadow = true;
  leg.add(shinPlate);

  const calfHinge = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.19, 10), materials.metalTrim);
  calfHinge.position.set(side * -0.075, -0.08, 0.055);
  calfHinge.rotation.z = Math.PI / 2;
  calfHinge.castShadow = true;
  leg.add(calfHinge);

  const kneePad = createPaddedPanel(0.18, 0.11, 0.035, suitFabric, suitFabric.reinforcement);
  kneePad.position.set(side * 0.19, -0.5, 0.17);
  kneePad.scale.set(1.05, 1, 1);
  kneePad.castShadow = true;
  ship.add(kneePad);

  const knee = new THREE.Mesh(createClothCapsule(0.108, 0, side * 11), materials.ship);
  knee.castShadow = true;
  ship.add(knee);

  const ankleRing = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.014, 8, 22), materials.metalTrim);
  ankleRing.position.set(side * 0.2, -0.99, 0.04);
  ankleRing.rotation.set(Math.PI / 2, 0, side * -0.06);
  ankleRing.castShadow = true;
  ship.add(ankleRing);

  const { boot, sole: bootSole } = createAstronautBoot(side, equipment, suitFabric);
  boot.position.set(side * 0.2, -1.08, 0.12);
  boot.rotation.z = side * -0.04;
  ship.add(boot);
  bootSole.position.set(side * 0.2, -1.17, 0.14);
  bootSole.rotation.z = side * -0.04;
  ship.add(bootSole);

  limbRig.push({
    side,
    shoulder,
    shoulderRing,
    upperArm,
    forearm,
    elbow,
    wristRing,
    glove,
    fingers: fingerRig,
    thumb,
    thumbRestPosition: thumb.position.clone(),
    thumbRestRotation: thumb.rotation.clone(),
    handGrip: 0,
    hip,
    thighRing,
    upperLeg,
    leg,
    kneePad,
    knee,
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

// Longitudinal seams follow the animated sleeves and trouser legs.
for (const rig of limbRig) {
  for (const [part, radius, bottom, top] of [
    [rig.upperArm, 0.108, -0.095, 0.095],
    [rig.forearm, 0.101, -0.09, 0.09],
    [rig.upperLeg, 0.133, -0.15, 0.15],
    [rig.leg, 0.113, -0.15, 0.15],
  ]) {
    for (const sign of [-1, 1]) {
      addFabricSeam(part, [
        [sign * radius * 0.72, bottom, radius * 0.73],
        [sign * radius * 0.74, (bottom + top) * 0.5, radius * 0.72],
        [sign * radius * 0.72, top, radius * 0.73],
      ], suitFabric, 0.0012);
    }
  }
  const wristCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.094, 0.06, 24), materials.suitTrim);
  wristCuff.position.set(0, 0.08, 0);
  rig.glove.add(wristCuff);
  const knucklePad = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.06, 0.02, 2, 0.012), materials.suitTrim);
  knucklePad.position.set(0, 0.015, -0.064);
  rig.glove.add(knucklePad);
}
for (const side of [-1, 1]) {
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.067, 0.067, 0.025, 24), materials.metalTrim);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(side * 0.438, 1.23, 0.13);
  ship.add(hinge);
  helmetAnimatedParts.push(hinge);
  for (let vent = 0; vent < 4; vent += 1) {
    const slit = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.009, 0.012, 1, 0.003), materials.rubber);
    slit.position.set(side * 0.27, 1.03 + vent * 0.023, 0.34);
    slit.rotation.y = side * 0.35;
    ship.add(slit);
    helmetAnimatedParts.push(slit);
  }
}

const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.46, 8), materials.rubber);
antenna.position.set(0.24, 1.64, -0.02);
antenna.rotation.z = -0.45;
ship.add(antenna);

const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), materials.wing);
antennaTip.position.set(0.39, 1.82, -0.02);
ship.add(antennaTip);

for (const part of [...helmetAnimatedParts, antenna, antennaTip]) {
  part.position.sub(new THREE.Vector3(0, 0.86, 0)).multiplyScalar(0.68);
  part.position.y += 1.08;
  part.scale.multiplyScalar(0.68);
}

// A seated pose lowers the complete upper body onto the bench together.
const upperBody = new THREE.Group();
const limbParts = new Set(limbRig.flatMap(rig => [rig.shoulder, rig.shoulderRing,
  rig.upperArm, rig.forearm, rig.elbow, rig.wristRing, rig.glove, rig.hip, rig.thighRing,
  rig.upperLeg, rig.leg, rig.kneePad, rig.knee, rig.ankleRing, rig.boot, rig.bootSole]));
for (const part of [...ship.children]) {
  if (!limbParts.has(part)) upperBody.add(part);
}
ship.add(upperBody);
for (const rig of limbRig) poseAstronautArms(rig);

// Keep the suit, chest equipment and backpack together as the spine turns.
const chestRig = new THREE.Group();
chestRig.position.copy(torso.position);
const chestRestPosition = chestRig.position.clone();
for (const part of [...upperBody.children]) {
  if (part === pelvis || part === waistSeal || part.position.y < 0.25) continue;
  part.position.sub(chestRig.position);
  chestRig.add(part);
}
upperBody.add(chestRig);
const headRig = new THREE.Group();
headRig.position.set(0, 1.08 - chestRestPosition.y, 0);
for (const part of [...helmetAnimatedParts, antenna, antennaTip]) {
  part.position.sub(headRig.position);
  headRig.add(part);
}
chestRig.add(headRig);
let astronautMotionTime = 0;
let astronautFlightBlend = 0;
const astronautFlightDirection = new THREE.Vector2();
let astronautPreviousYaw = state.faceYaw;
const astronautFlightPose = { tuck: 0, trail: 0, armSpread: 0, landing: 0, thrust: 0 };
const astronautGroundDirection = new THREE.Vector2(1, 0);
let astronautPreviousForward = 0;
let astronautAccelerationLean = 0;
let astronautPreviousFlight = 0;
let astronautLandingCompression = 0;

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
  headParts: [...helmetAnimatedParts, antenna, antennaTip].map((mesh) => ({
    mesh,
    position: mesh.position.clone(),
    rotation: mesh.rotation.clone(),
  })),
};

function placePlayerAtSpacecraft() {
  ship.position.copy(spacecraft.exit);
  ship.position.y = terrainHeight(ship.position.x, ship.position.z) + playerGroundOffset;
  astronautPreviousYaw = state.faceYaw;
  ship.rotation.set(0, state.faceYaw, 0);
}
placePlayerAtSpacecraft();
scene.add(ship);
materials.ground.userData.viewOrigin.value=ship.position;
updateTerrainAroundPlayer();

// A shared dust mask keeps the pooled prints inexpensive while showing boot tread.
const soleCanvas = document.createElement('canvas');
soleCanvas.width = 128;
soleCanvas.height = 256;
const soleContext = soleCanvas.getContext('2d');
let soleSeed = 731;
function soleRandom() {
  soleSeed = (soleSeed * 1664525 + 1013904223) >>> 0;
  return soleSeed / 4294967296;
}
soleContext.fillStyle = 'rgba(255,255,255,0.22)';
soleContext.beginPath();
soleContext.moveTo(29, 153);
soleContext.bezierCurveTo(13, 103, 12, 35, 34, 17);
soleContext.bezierCurveTo(50, 4, 87, 4, 101, 23);
soleContext.bezierCurveTo(118, 55, 111, 119, 95, 153);
soleContext.closePath();
soleContext.fill();
soleContext.fillRect(30, 173, 65, 66);
soleContext.fillStyle = 'rgba(255,255,255,0.85)';
for (let row = 0; row < 7; row += 1) {
  const y = 28 + row * 17;
  const inset = row === 0 ? 9 : 0;
  for (const side of [-1, 1]) {
    soleContext.beginPath();
    soleContext.moveTo(64 + side * 5, y + 9);
    soleContext.lineTo(64 + side * (43 - inset), y);
    soleContext.lineTo(64 + side * (41 - inset), y + 9);
    soleContext.lineTo(64 + side * 5, y + 18);
    soleContext.closePath();
    soleContext.fill();
  }
}
for (let row = 0; row < 4; row += 1) {
  soleContext.fillRect(34, 177 + row * 15, 25, 9);
  soleContext.fillRect(68, 177 + row * 15, 23, 9);
}
// Break up the impression with fine regolith grains, including its outer edge.
soleContext.globalCompositeOperation = 'destination-out';
for (let i = 0; i < 2200; i += 1) {
  soleContext.globalAlpha = 0.2 + soleRandom() * 0.65;
  soleContext.fillRect(soleRandom() * 128, soleRandom() * 256, 1 + soleRandom() * 2, 1 + soleRandom() * 3);
}
const soleTexture = new THREE.CanvasTexture(soleCanvas);
// The canvas stores the tread in its alpha channel, not in the green channel.
materials.footprint.map = soleTexture;
materials.footprint.alphaMap = null;
const footprintGeometry = new THREE.PlaneGeometry(0.24, 0.40, 8, 14);
footprintGeometry.rotateX(-Math.PI / 2);
// Canvas top is the toe; the astronaut's toes point along local +Z.
footprintGeometry.rotateY(Math.PI);
const footprintPool = [];
let footprintIndex = 0;

for (let i = 0; i < 120; i += 1) {
  const group = new THREE.Group();
  const mark = new THREE.Mesh(footprintGeometry.clone(), materials.footprint.clone());
  group.add(mark);
  group.visible = false;
  group.userData = { age: 0, lifetime: 45, marks: [mark], strength: 0.65 };
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
const footForward = new THREE.Vector3();
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

function getSpacecraftObjective() {
  const english = document.documentElement.lang === 'en';
  if (state.spacecraftRepaired) return english ? 'Spacecraft repaired · Ready for takeoff' : 'Raumschiff repariert · Bereit zum Abheben';
  const tank = state.fuelTank
    ? (english ? 'Fuel tank recovered' : 'Treibstofftank geborgen')
    : (english ? 'Recover a fuel tank after reading the archive in the abandoned building' : 'Notfallarchiv im verlassenen Gebäude lesen und Treibstofftank bergen');
  const otherCrystals = state.crystals - Math.min(state.blueCrystals, 20);
  const strut = state.landingStrut
    ? (english ? 'Landing strut recovered' : 'Landestütze geborgen')
    : (english ? 'Watchtower: Trasure Scan → excavate space treasure chest → recover landing strut' : 'Wachturm: Trasure Scan → Space-Schatztruhe ausgraben → Landestütze bergen');
  return english
    ? `Crashed spacecraft · ${tank} · ${strut} · ${otherCrystals}/30 other crystals + ${state.blueCrystals}/20 blue crystals`
    : `Raumschiff abgestürzt · ${tank} · ${strut} · ${otherCrystals}/30 weitere Kristalle + ${state.blueCrystals}/20 blaue Kristalle`;
}

function updateInventoryResources() {
  document.querySelector('#inventory-cors').textContent = `${state.cors} Cors`;
  document.querySelector('#worm-horn').hidden = state.wormHorns === 0;
  document.querySelector('#worm-horn-count').textContent = `${state.wormHorns} Stück`;
  document.querySelector('#fuel-tank').hidden = state.fuelTank === 0;
  document.querySelector('#landing-strut').hidden = state.landingStrut === 0;
  document.querySelector('#equipment-title span').textContent = `${3 + (state.wormHorns > 0 ? 1 : 0) + state.fuelTank + state.landingStrut} Gegenstände`;
  document.querySelector('#spacecraft-objective').textContent = getSpacecraftObjective();
  for (const [kind, count, label] of [
    ['stone', state.stones, 'Stein'],
    ['crystal', state.crystals - state.blueCrystals, 'Violetter Kristall'],
    ['blue-crystal', state.blueCrystals, 'Blauer Kristall'],
  ]) {
    const id = `inventory-${kind}`;
    const slot = document.getElementById(id);
    slot.classList.toggle('empty', count === 0);
    if (!slot.querySelector('img')) {
      slot.innerHTML = '<span class="resource-kind"></span><img class="stone-thumbnail"><strong></strong><small></small>';
      slot.querySelector('img').src = getStoneInventoryImage(kind);
      slot.querySelector('img').alt = label;
      slot.querySelector('strong').textContent = label;
      slot.querySelector('.resource-kind').textContent = kind === 'stone' ? 'Mineral' : 'Selten';
    }
    slot.querySelector('small').textContent = count > 0 ? `${count} Stück` : 'Noch nicht gesammelt';
  }
  document.querySelector('#inventory-total').textContent = `${state.stones + state.crystals} gesammelt`;
}

function getRockDestructionTime(rock) {
  return rockDestructionTime * Math.max(1, rock.userData.hitRadius || 1);
}

function getRockStoneYield(rock) {
  return THREE.MathUtils.clamp(Math.round((rock.userData.hitRadius || 1) * 2), 1, 5);
}

function damageRock(rock, amount) {
  amount *= 1 + state.laserLevel * 0.35;
  const duration = getRockDestructionTime(rock);
  rock.userData.laserDamage = Math.min(duration, (rock.userData.laserDamage || 0) + amount);
  damagedRock = rock;
  lastRockHitTime = performance.now();
  if (rock.userData.laserDamage >= duration - 0.00001) {
    const isCrystal = rock.userData.isCrystal === true;
    if (isCrystal) {
      state.crystals += 1;
      if (rock.userData.isBlueCrystal) state.blueCrystals += 1;
      sandworm.awaken(state.crystals, ship.position, state.faceYaw);
    }
    else state.stones += getRockStoneYield(rock);
    updateInventoryResources();
    shatterRock(rock, rock.position);
    damagedRock = null;
  }
}

function updateRockProgress() {
  rockProgress.hidden = !state.running || !damagedRock || performance.now() - lastRockHitTime > 1000;
  if (rockProgress.hidden) return;
  rockProgress.querySelector('span').textContent = damagedRock.userData.isCrystal ? 'Kristall abbauen' : 'Stein zerstören';
  damagedRock.updateWorldMatrix(true, true);
  rockProgressBounds.setFromObject(damagedRock);
  rockProgressBounds.getCenter(rockProgressPosition);
  rockProgressPosition.y = rockProgressBounds.max.y + 0.35;
  camera.updateMatrixWorld(true);
  rockProgressPosition.project(camera);
  if (Math.abs(rockProgressPosition.x) > 1 || Math.abs(rockProgressPosition.y) > 1
      || rockProgressPosition.z < -1 || rockProgressPosition.z > 1) {
    rockProgress.hidden = true;
    return;
  }
  rockProgress.style.left = `${(rockProgressPosition.x * 0.5 + 0.5) * innerWidth}px`;
  rockProgress.style.top = `${(0.5 - rockProgressPosition.y * 0.5) * innerHeight}px`;
  const damage = damagedRock.userData.laserDamage || 0;
  const rate = (aboardSpacecraft ? 2 * spacecraftShotDamage / spacecraftShotInterval
    : state.weaponMode === 'shots' ? laserShotDamage / laserShotInterval : 1) * (1 + state.laserLevel * 0.35);
  const duration = getRockDestructionTime(damagedRock);
  const remaining = Math.max(0, duration - damage) / rate;
  rockTime.textContent = `${remaining.toFixed(1).replace('.', ',')} s`;
  rockDamage.max = duration;
  rockDamage.value = damage;
}

function shatterRock(rock, impactPosition) {
  const isCrystal = rock.userData.isCrystal === true;
  const isBlueCrystal = rock.userData.isBlueCrystal === true;
  const crystalPalette = isBlueCrystal ? blueCrystalDebrisMaterials : crystalDebrisMaterials;
  audio.play(isCrystal ? 'crystal' : 'rock', 1, impactPosition, rock.userData.hitRadius || 1);
  const fragmentCount = isBlueCrystal ? 12 : isCrystal ? 30 : getRockStoneYield(rock);
  const baseRadius = rock.userData.hitRadius || 1;

  for (let i = 0; i < fragmentCount; i += 1) {
    const fragment = rockFragments[rockFragmentIndex];
    rockFragmentIndex = (rockFragmentIndex + 1) % rockFragments.length;
    fragment.material = isCrystal
      ? (i % 5 === 0 ? blackCrystalDebrisMaterial : crystalPalette[i % crystalPalette.length])
      : stoneFragmentMaterials[rock.userData.stoneMaterialIndex ?? 0];
    fragment.geometry = isCrystal ? (i >= 8 ? crystalFragmentGeometry : rockFragmentGeometry) : fragment.userData.stoneGeometry;
    fragment.userData.stoneDebris = !isCrystal;
    const angle = THREE.MathUtils.randFloat(0, Math.PI * 2);
    const lift = THREE.MathUtils.randFloat(1.1, 2.7);
    const spread = THREE.MathUtils.randFloat(1.8, 4.8);

    fragment.position.set(
      impactPosition.x + THREE.MathUtils.randFloatSpread(baseRadius * 0.45),
      terrainHeight(impactPosition.x, impactPosition.z) + THREE.MathUtils.randFloat(0.18, isBlueCrystal ? 0.9 : isCrystal ? 2.8 : 0.58),
      impactPosition.z + THREE.MathUtils.randFloatSpread(baseRadius * 0.45),
    );
    fragment.rotation.set(THREE.MathUtils.randFloat(0, Math.PI), THREE.MathUtils.randFloat(0, Math.PI), THREE.MathUtils.randFloat(0, Math.PI));
    fragment.scale.setScalar(THREE.MathUtils.randFloat(0.45, 1.25) * Math.min(1.8, baseRadius));
    if (isCrystal) {
      const size = i < 8 ? THREE.MathUtils.randFloat(0.9, 1.8) : THREE.MathUtils.randFloat(0.18, 0.65);
      fragment.scale.set(size, size * THREE.MathUtils.randFloat(1.1, 2), size * 0.8);
      if (isBlueCrystal) fragment.scale.multiplyScalar(0.4);
    }
    fragment.visible = true;
    fragment.userData.age = 0;
    fragment.userData.lifetime = THREE.MathUtils.randFloat(10, 15);
    fragment.userData.velocity.set(Math.cos(angle) * spread, lift, Math.sin(angle) * spread);
    fragment.userData.rotationVelocity.set(
      THREE.MathUtils.randFloatSpread(4.8),
      THREE.MathUtils.randFloatSpread(5.8),
      THREE.MathUtils.randFloatSpread(4.8),
    );
  }

  if (isBlueCrystal) {
    rock.visible = false;
    rock.userData.laserDamage = 0;
  } else placeGroundObjectAroundPlayer(rock, 0.18, 152, 36);
}

function findRockHitByPoint(position, extraRadius = 0.25) {
  for (const rock of rocks) {
    if (!rock.visible) continue;
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
    if (!rock.visible) continue;
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
  updateImpactSparks(delta);
  for (const fragment of rockFragments) {
    if (!fragment.visible) continue;
    fragment.userData.age += delta;
    fragment.position.addScaledVector(fragment.userData.velocity, delta);
    fragment.userData.velocity.y -= 6.2 * delta;
    fragment.rotation.x += fragment.userData.rotationVelocity.x * delta;
    fragment.rotation.y += fragment.userData.rotationVelocity.y * delta;
    fragment.rotation.z += fragment.userData.rotationVelocity.z * delta;

    fragment.updateMatrix();
    const support = fragment.userData.stoneDebris ? Math.max(0.015,stoneSupportHeight(fragment.geometry,fragment.matrix)-0.015) : 0.08;
    const groundY = footprintGroundHeight(fragment.position.x, fragment.position.z) + support;
    if (fragment.position.y < groundY) {
      fragment.position.y = groundY;
      fragment.userData.velocity.y = Math.abs(fragment.userData.velocity.y) < 0.45 ? 0 : fragment.userData.velocity.y * -0.24;
      fragment.userData.velocity.x *= 0.76;
      fragment.userData.velocity.z *= 0.76;
      fragment.userData.rotationVelocity.multiplyScalar(Math.exp(-10 * delta));
    }

    const progress = THREE.MathUtils.clamp(fragment.userData.age / fragment.userData.lifetime, 0, 1);
    if (progress > 0.9) fragment.scale.multiplyScalar(Math.exp(-3 * delta));
    if (progress >= 1) {
      fragment.visible = false;
    }
  }
}

function isInsideBaseBuilding() {
  return planetaryBase.inside(ship.position) && ship.position.y < baseLocation.ground + baseLayout.height;
}

function updateLaser(delta) {
  if (!handLaser) return;
  const indoors = aboardSpacecraft || isInsideBaseBuilding() || watchtower.inside(ship.position);
  if (indoors) {
    if (!aboardSpacecraft) state.laserActive = false;
    handLaser.visibleUntil = 0;
    handLaser.beam.visible = handLaser.muzzleFlash.visible = false;
    handLaser.beam.material.opacity = 0;
  }
  const now = performance.now();
  if (aboardSpacecraft || !state.firstPerson || !state.running) handLaser.visibleUntil = 0;
  else if (state.laserActive) handLaser.visibleUntil = now + 5000;
  const raisingWeapon = !aboardSpacecraft && state.firstPerson && state.running && (state.laserActive || now < handLaser.visibleUntil);
  handLaser.raiseAmount = THREE.MathUtils.damp(
    handLaser.raiseAmount, raisingWeapon ? 1 : 0, raisingWeapon ? 12 : 7, delta,
  );
  if (aboardSpacecraft || !state.firstPerson || !state.running || (!raisingWeapon && handLaser.raiseAmount < 0.002)) {
    handLaser.raiseAmount = 0;
  }
  const firstPersonWeapon = state.firstPerson && state.running && (raisingWeapon || handLaser.raiseAmount > 0);
  const movementSway = firstPersonWeapon
    ? Math.min(1, Math.hypot(state.depthVelocity, state.steerVelocity))
      * (1 - THREE.MathUtils.smoothstep(state.flightHeight, 0.02, 0.25))
      * (state.sprinting ? 1.9 : 1)
    : 0;
  const weaponSway = Math.sin(state.runCycle) * movementSway;
  const weaponBob = Math.sin(state.runCycle * 2) * movementSway;
  const weaponParent = firstPersonWeapon ? camera : handLaser.parent;
  if (handLaser.group.parent !== weaponParent) {
    weaponParent.add(handLaser.group);
    handLaser.group.position.copy(handLaser.restingPosition);
    handLaser.group.rotation.copy(laserBaseRotation);
    if (firstPersonWeapon) handLaser.group.rotation.set(0, Math.PI, 0);
  }
  if (firstPersonWeapon) {
    camera.updateMatrixWorld(true);
    // Keep the actual firing weapon in view, so beams and shots leave its muzzle.
    const loweredAmount = 1 - handLaser.raiseAmount;
    handLaser.group.position.set(0.24 + loweredAmount * 0.08, -0.2 - loweredAmount * 1.1, -0.48);
    handLaser.group.position.x += weaponSway * 0.012;
    handLaser.group.position.y += weaponBob * 0.009;
  }
  if (firstPersonWeapon) handLaser.group.rotation.set(0, Math.PI, 0);
  else handLaser.group.rotation.copy(laserBaseRotation);

  handLaser.canFire = !indoors;
  let beamLength = laserRange;
  if (state.running && state.laserActive && handLaser.canFire) {
    camera.updateMatrixWorld(true);
    laserAimScreen.set(state.aimX * 2 - 1, 1 - state.aimY * 2);
    laserAimRay.setFromCamera(laserAimScreen, camera);
    world.updateMatrixWorld(true);
    const hits = laserAimRay.intersectObjects([...terrainTiles, ...rocks.filter(rock => rock.visible), ...mountains, planetaryBase.group, abandonedBuilding.group, watchtower.group, ...(state.treasureExcavated?[spaceTreasure.body]:[]), ...sandworm.getLaserTargets()], true);
    if (hits.length) laserAimTarget.copy(hits[0].point);
    else laserAimRay.ray.at(laserRange, laserAimTarget);

    // Only the beam aims at the crosshair; the weapon keeps its resting orientation.
    handLaser.group.updateWorldMatrix(true, false);
    laserAimLocal.copy(laserAimTarget);
    handLaser.group.worldToLocal(laserAimLocal);
    laserAimLocal.sub(new THREE.Vector3(0, 0.018, 0.55));
    beamLength = Math.max(0.01, laserAimLocal.length());
  }

  const targetOpacity = state.running && state.laserActive && handLaser.canFire && state.weaponMode === 'beam' ? 0.98 : 0;
  const currentOpacity = handLaser.beam.material.opacity;
  const nextOpacity = THREE.MathUtils.damp(currentOpacity, targetOpacity, 24, delta);
  const pulse = targetOpacity > 0 ? 0.82 + Math.sin(clock.elapsedTime * 32) * 0.18 : 0;

  handLaser.beam.visible = nextOpacity > 0.02;
  handLaser.muzzleFlash.visible = nextOpacity > 0.02;
  handLaser.beam.material.opacity = nextOpacity;
  handLaser.beamTime.value = clock.elapsedTime;
  handLaser.muzzleFlash.material.opacity = nextOpacity * 0.72 * pulse;
  // Preserve the last beam transform while fading out or aiming behind the player.
  // Resetting it here used to visibly snap the beam back to the barrel axis.
  if (state.running && state.laserActive && handLaser.canFire) {
    handLaser.beam.scale.set(1, 1, beamLength / laserRange);
    laserAimLocal.normalize();
    handLaser.beam.quaternion.setFromUnitVectors(laserForwardLocal, laserAimLocal);
    handLaser.beam.position.set(0, 0.018, 0.55).addScaledVector(laserAimLocal, beamLength / 2);
  }
  handLaser.muzzleFlash.scale.setScalar(0.78 + pulse * 0.45);
  handLaser.emitter.material.emissiveIntensity = 1.5 + nextOpacity * 3.8 + (state.weaponMode === 'shots' && state.laserActive ? 1.4 : 0);

  if (state.beamHitCooldown > 0) {
    state.beamHitCooldown -= delta;
  }

  if (state.running && state.laserActive && handLaser.canFire && state.weaponMode === 'beam') {
    handLaser.group.updateMatrixWorld(true);
    handLaser.group.localToWorld(laserBeamOrigin.set(0, 0.018, 0.58));
    laserBeamDirection.copy(laserForwardLocal).transformDirection(handLaser.group.matrixWorld).normalize();
    laserBeamDirection.copy(laserAimTarget).sub(laserBeamOrigin).normalize();
    const hit = findWeaponSurfaceHit(laserBeamOrigin, laserBeamDirection, laserRange);
    if (hit) {
      if (state.beamHitCooldown <= 0 && !hit.worm) {
        emitRockImpact(hit);
        state.beamHitCooldown = 0.065;
      }
      // End the visible beam on the surface, where the fragments and sparks start.
      laserAimLocal.copy(hit.point);
      handLaser.group.worldToLocal(laserAimLocal);
      laserAimLocal.sub(new THREE.Vector3(0, 0.018, 0.55));
      const length = laserAimLocal.length();
      laserAimLocal.normalize();
      handLaser.beam.quaternion.setFromUnitVectors(laserForwardLocal, laserAimLocal);
      handLaser.beam.scale.z = length / laserRange;
      handLaser.beam.position.set(0, 0.018, 0.55).addScaledVector(laserAimLocal, length / 2);
      if (hit.worm) sandworm.hitLaser(hit.object, 'beam');
      if (hit.rock) damageRock(hit.rock, delta);
    }
  }
}

function emitLaserShot() {
  if (!handLaser || !handLaser.canFire || isInsideBaseBuilding() || watchtower.inside(ship.position)) return;
  audio.play('shot');
  handLaser.group.updateMatrixWorld(true);
  handLaser.group.localToWorld(laserMuzzleWorld.set(0, 0.018, 0.58));
  laserShotDirection.copy(laserForwardLocal).transformDirection(handLaser.group.matrixWorld).normalize();
  laserShotDirection.copy(laserAimTarget).sub(laserMuzzleWorld).normalize();
  laserShotDirection.normalize();

  spawnLaserShot(laserMuzzleWorld, laserShotDirection);
}

function spawnLaserShot(origin, direction, speed = laserShotSpeed, damage = laserShotDamage, scale = 1, source = 'hand') {
  const shot = laserShots[laserShotIndex];
  laserShotIndex = (laserShotIndex + 1) % laserShots.length;
  shot.position.copy(origin);
  shot.quaternion.setFromUnitVectors(laserForwardBasis, direction);
  shot.visible = true;
  shot.userData.age = 0;
  shot.userData.lifetime = laserRange / speed;
  shot.userData.velocity.copy(direction).multiplyScalar(speed);
  shot.userData.damage = damage;
  shot.userData.source = source;
  shot.userData.core.material.opacity = 1;
  shot.userData.trail.material.opacity = 0.58;
  shot.userData.halo.material.opacity = 0.18;
  shot.scale.setScalar(scale);
}

function emitSpacecraftShots() {
  spacecraftShotDirection.copy(laserForwardLocal).applyQuaternion(spacecraft.group.quaternion);
  for (const muzzle of spacecraft.weaponMuzzles) {
    spawnLaserShot(muzzle, spacecraftShotDirection, spacecraftShotSpeed, spacecraftShotDamage, 2.4, 'spacecraft');
  }
  spacecraft.flashWeapons();
  audio.play('shot', 1.3, spacecraft.group.position);
}

function updateLaserShots(delta) {
  const spacecraftCanFire = aboardSpacecraft && !spacecraftExitRequested;
  if (state.running && state.laserActive && (spacecraftCanFire || (!aboardSpacecraft && handLaser?.canFire && state.weaponMode === 'shots'))) {
    state.shotCooldown -= delta;
    if (state.shotCooldown <= 0) {
      if (spacecraftCanFire) emitSpacecraftShots();
      else emitLaserShot();
      state.shotCooldown = spacecraftCanFire ? spacecraftShotInterval : laserShotInterval;
    }
  } else {
    state.shotCooldown = Math.min(state.shotCooldown, 0.02);
  }

  for (const shot of laserShots) {
    if (!shot.visible) continue;
    shot.userData.age += delta;
    const progress = THREE.MathUtils.clamp(shot.userData.age / shot.userData.lifetime, 0, 1);
    shotPreviousPosition.copy(shot.position);
    shot.position.addScaledVector(shot.userData.velocity, delta);
    laserShotTarget.copy(shot.userData.velocity).normalize();
    shot.quaternion.setFromUnitVectors(laserForwardBasis, laserShotTarget);
    const fade = 1 - THREE.MathUtils.smoothstep(progress, 0.65, 1);
    const pulse = 0.94 + Math.sin(shot.userData.age * 48) * 0.06;
    shot.userData.core.material.opacity = fade;
    shot.userData.trail.material.opacity = 0.6 * fade * pulse;
    shot.userData.halo.material.opacity = 0.18 * fade * pulse;
    const hit = findWeaponSurfaceHit(shotPreviousPosition, laserShotTarget, shot.userData.velocity.length() * delta);
    if (hit) {
      if (hit.worm) sandworm.hitLaser(hit.object);
      else emitRockImpact(hit);
      if (hit.rock) damageRock(hit.rock, shot.userData.damage);
      shot.visible = false;
      continue;
    }
    if (progress >= 1) {
      shot.visible = false;
    }
  }
}

function footprintGroundHeight(x, z) {
  // Match the rendered terrain triangles instead of the unsampled noise surface.
  const spacing = terrainTileSize / terrainTileSegments;
  const halfTile = terrainTileSize / 2;
  const x0 = Math.floor((x + halfTile) / spacing) * spacing - halfTile;
  const z0 = Math.floor((z + halfTile) / spacing) * spacing - halfTile;
  const u = (x - x0) / spacing;
  const v = (z - z0) / spacing;
  const a = terrainHeight(x0, z0);
  const b = terrainHeight(x0, z0 + spacing);
  const c = terrainHeight(x0 + spacing, z0 + spacing);
  const d = terrainHeight(x0 + spacing, z0);
  return u + v <= 1 ? a + (d - a) * u + (b - a) * v
    : c + (b - c) * (1 - u) + (d - c) * (1 - v);
}

function emitFootprint(position, yaw, side) {
  const footprint = footprintPool[footprintIndex];
  footprintIndex = (footprintIndex + 1) % footprintPool.length;

  footprint.position.set(position.x, terrainHeight(position.x, position.z) + 0.028, position.z);
  footprint.rotation.set(0, yaw, 0);
  footprint.userData.strength = 0.62 + Math.random() * 0.1;
  footprint.visible = true;
  footprint.userData.age = 0;

  for (const mark of footprint.userData.marks) {
    mark.material.opacity = footprint.userData.strength;
    const vertices = mark.geometry.attributes.position;
    const uv = mark.geometry.attributes.uv;
    const baseUv = footprintGeometry.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) {
      uv.setX(i, side < 0 ? 1 - baseUv.getX(i) : baseUv.getX(i));
    }
    uv.needsUpdate = true;
    const angle = footprint.rotation.y;
    for (let i = 0; i < vertices.count; i += 1) {
      const x = vertices.getX(i);
      const z = vertices.getZ(i);
      const worldX = position.x + x * Math.cos(angle) + z * Math.sin(angle);
      const worldZ = position.z - x * Math.sin(angle) + z * Math.cos(angle);
      vertices.setY(i, footprintGroundHeight(worldX, worldZ) + 0.025 - footprint.position.y);
    }
    vertices.needsUpdate = true;
    mark.geometry.computeBoundingSphere();
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
  if (movementAmount < 0.16 || isPlayerStandingStill() || watchtowerGrounded) return;

  ship.updateMatrixWorld(true);

  for (const rig of limbRig) {
    if (rig.isFootPlanted && !rig.wasFootPlanted) {
      rig.bootSole.localToWorld(footWorldPosition.set(0, -0.03, 0));
      rig.bootSole.getWorldDirection(footForward);
      emitFootprint(footWorldPosition, Math.atan2(footForward.x, footForward.z), rig.side);
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
      mark.material.opacity = footprint.userData.strength * fade;
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

function resetGame({ preserveSlot = false } = {}) {
  aboardSpacecraft = false;
  spacecraftThirdPerson = false;
  spacecraftExitRequested = false;
  spacecraft.setBoarded(false, true);
  spacecraft.resetFlight();
  audio.setCockpit(false);
  restartAfterDeath = false;
  deathRespawn = null;
  if (!preserveSlot) currentRunHasSave = false;
  clearTimeout(sleepTimer);
  sleepTimer = null;
  sleepFade?.cancel();
  sleepFade = null;
  isSleeping = false;
  sleepOverlay.hidden = true;
  seatedBench = null;
  curseMessage.reset();
  sandstorm.reset();
  tornadoFlight.reset();
  state.health = 100;
  state.healthRecoveryDelay = state.fallDistance = 0;
  state.hurtCooldown = 0;
  state.hurtFlash = 0;
  document.querySelector('#app').style.setProperty('--hurt-opacity', 0);
  if (!preserveSlot) saveNameInput.value = 'Mein Spielstand';
  refreshLoadButton();
  try {
    if (!preserveSlot) {
      const emptySlot = readSaves(localStorage).findIndex((saved) => !saved);
      activeSaveSlot = emptySlot < 0 ? 0 : emptySlot;
    }
    saveSlot.value = String(activeSaveSlot);
  } catch { /* Saving reports storage errors in the pause menu. */ }
  dayStartedAt = performance.now();
  state.cors = 0;
  state.stones = 0;
  state.crystals = 0;
  state.blueCrystals = 0;
  state.laserLevel = 0;
  state.jetpackLevel = 0;
  state.scannerLevel = 0;
  state.passKey = 0;
  state.abandonedUnlocked = 0;
  state.archiveActivated = state.archiveRead = state.fuelTank = state.spacecraftRepaired = 0;
  state.landingStrut = state.treasureScanned = state.treasureExcavated = state.treasureOpened = 0;
  watchtowerGrounded = false;
  watchtower.lift.reset();
  spaceTreasure.restore(state);
  spacecraft.setDamaged(true);
  state.wormHorns = 0;
  state.curseLifted = false;
  document.querySelector('#curse-message').textContent = curseWarningText;
  updateInventoryResources();
  damagedRock = null;
  for (const shot of laserShots) shot.visible = false;
  for (const rock of rocks) rock.userData.laserDamage = 0;
  state.running = true;
  document.querySelector('#app').classList.add('is-playing');
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
  state.gaitBlend = 0;
  state.sprintBlend = 0;
  astronautFlightBlend = 0;
  astronautFlightDirection.set(0, 0);
  for (const key of Object.keys(astronautFlightPose)) astronautFlightPose[key] = 0;
  for (const rig of limbRig) {
    rig.armSwing = 0;
    rig.armSideSwing = 0;
    rig.handGrip = 0;
    poseAstronautHand(rig, 0);
  }
  astronautGroundDirection.set(1, 0);
  astronautPreviousForward = 0;
  astronautAccelerationLean = 0;
  astronautPreviousFlight = 0;
  astronautLandingCompression = 0;
  astronautPreviousYaw = state.faceYaw;
  headRig.rotation.set(0, 0, 0);
  activeKeys.clear();
  placePlayerAtSpacecraft();
  updateTerrainAroundPlayer();
  resetSceneryAroundPlayer();
  resetFootEffects();
  overlayTitle.textContent = 'Rust Mesa';
  overlayCopy.textContent = 'Roam across rust-red terrain, dry grass, weathered rocks, low hills, and eroded desert washes.';
  startButton.textContent = 'Start run';
  overlay.classList.remove('visible');
  updateHud();
}

function gameOver(reason) {
  deathRespawn = { x: ship.position.x, z: ship.position.z, yaw: state.faceYaw };
  audio.silence(); audio.play('death');
  state.running = false;
  if (inventory.open) inventory.close();
  restartAfterDeath = true;
  state.laserActive = false;
  state.jetpackActive = false;
  activeKeys.clear();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  document.querySelector('#app').classList.remove('is-playing');
  state.best = Math.max(state.best, Math.floor(state.score));
  localStorage.setItem('orbital-drift-best', String(state.best));
  overlayTitle.textContent = 'Run ended';
  overlayCopy.textContent = reason || `Score ${Math.floor(state.score)}. Launch again and push the run further.`;
  startButton.textContent = 'Restart';
  overlay.classList.add('visible');
  updateHud();
}

function updateHud() {
  document.querySelector('#cors-hud').textContent = `${state.cors} Cors`;
  healthEl.textContent = String(Math.ceil(state.health));
  healthBar.value = state.health;
  scoreEl.textContent = String(Math.floor(state.score));
  bestEl.textContent = String(state.best);
}

function updateJetpack(delta, tornadoActive = false) {
  const thrusting = state.running && state.jetpackActive && !tornadoActive;
  const targetBurn = thrusting ? 1 : 0;
  state.jetpackBurn = THREE.MathUtils.damp(state.jetpackBurn, targetBurn, thrusting ? 18 : 10, delta);
  const controlMagnitude = Math.max(1, Math.hypot(state.depthVelocity, state.steerVelocity));
  const thrustForward = state.depthVelocity / controlMagnitude;
  const thrustSideways = -state.steerVelocity / controlMagnitude;

  for (const flame of jetpackFlames.children) {
    const flicker = 0.92 + Math.sin(clock.elapsedTime * 37 + flame.position.x * 19) * 0.05
      + Math.sin(clock.elapsedTime * 61 + flame.position.x * 31) * 0.03;
    flame.visible = state.jetpackBurn > 0.025;
    flame.scale.set(
      (0.82 + state.jetpackBurn * 0.42 * flicker) * 1.3,
      (0.82 + state.jetpackBurn * 0.26) * 1.3,
      0.35 + state.jetpackBurn * 1.15 * flicker,
    );
    // Exhaust points down and opposite the requested horizontal motion. Blend
    // the gimbal rotation so reversing or combining directions stays smooth.
    if (state.jetpackBurn > 0.025) {
      jetpackExhaustDirection.set(-thrustSideways * 0.82 + flame.userData.side * 0.07,
        -1, -thrustForward * 0.9).normalize();
    } else {
      jetpackExhaustDirection.copy(jetpackRearAxis);
    }
    jetpackTargetRotation.setFromUnitVectors(jetpackRearAxis, jetpackExhaustDirection);
    flame.quaternion.slerp(jetpackTargetRotation, 1 - Math.exp(-8 * delta));
    const nozzle = jetpackNozzles[flame.userData.side < 0 ? 0 : 1];
    nozzle.quaternion.copy(flame.quaternion);
    nozzle.localToWorld(jetpackExhaustPoint.set(0, 0, -0.1));
    flame.position.copy(jetpackFlames.worldToLocal(jetpackExhaustPoint));
    for (const mesh of [flame.userData.outer, flame.userData.core]) {
      mesh.material.uniforms.time.value = clock.elapsedTime;
      mesh.material.uniforms.burn.value = state.jetpackBurn;
    }
    flame.userData.glow.intensity = state.jetpackBurn * flicker * 0.7;
  }

  if (!state.running) {
    state.flightHeight = THREE.MathUtils.damp(state.flightHeight, 0, 8, delta);
    state.flightVelocity = 0;
    return;
  }

  if (!tornadoActive) {
    if (thrusting) {
      state.flightVelocity += playerMovement.jetpackLift * delta;
    } else {
      state.flightVelocity -= playerMovement.jetpackGravity * delta;
    }

    state.flightVelocity = THREE.MathUtils.clamp(state.flightVelocity, -10.875, 5.2 + state.jetpackLevel);
  }
  const impactVelocity = state.flightVelocity;
  state.flightHeight += state.flightVelocity * delta;

  if (state.flightHeight <= 0) {
    if (state.flightVelocity < -1) audio.play(isInsideBaseBuilding() || abandonedBuilding.inside(ship.position) ? 'metalStep' : 'step', 1.5);
    state.flightHeight = 0;
    state.flightVelocity = Math.max(0, state.flightVelocity);
  }
  return impactVelocity;
}

function minimumCameraPitch() {
  const airborne = THREE.MathUtils.smoothstep(state.flightHeight, 0.1, 1);
  return THREE.MathUtils.lerp(-Math.PI / 3, -Math.PI / 2, airborne);
}

const buildingCameraRay = new THREE.Raycaster();
const buildingCameraOrigin = new THREE.Vector3();
const buildingCameraDirection = new THREE.Vector3();
const spacecraftCameraTarget = new THREE.Vector3();

function preventCameraWallClipping() {
  buildingCameraOrigin.copy(ship.position).y += 1.25;
  buildingCameraDirection.subVectors(camera.position, buildingCameraOrigin);
  const distance = buildingCameraDirection.length();
  if (distance < 0.001) return;
  buildingCameraDirection.divideScalar(distance);
  buildingCameraRay.set(buildingCameraOrigin, buildingCameraDirection);
  buildingCameraRay.far = distance + 0.35;
  planetaryBase.group.updateWorldMatrix(true, true);
  abandonedBuilding.group.updateWorldMatrix(true, true);
  watchtower.group.updateWorldMatrix(true, true);
  const hit = buildingCameraRay.intersectObjects([planetaryBase.group, abandonedBuilding.group, watchtower.group], true)
    .find(hit => hit.object.isMesh && !hit.object.material.transparent);
  if (hit) {
    // Leave room for the near plane so it cannot slice through the hull.
    camera.position.copy(buildingCameraOrigin).addScaledVector(buildingCameraDirection, Math.max(0, hit.distance - 0.35));
  }
}

function setDefaultCameraPerspective() {
  camera.up.set(0, 1, 0);
  if (aboardSpacecraft) {
    ship.visible = false;
    if (spacecraftThirdPerson) {
      // Follow the hull's local rear and up axes, including pitch and banking.
      const followDistance = Math.max(24, 16 / camera.aspect);
      camera.position.set(0, 8, -followDistance).applyQuaternion(spacecraft.group.quaternion).add(spacecraft.group.position);
      camera.position.y = Math.max(camera.position.y, terrainHeight(camera.position.x, camera.position.z) + 2);
      spacecraftCameraTarget.set(0, 3.1, 0).applyQuaternion(spacecraft.group.quaternion).add(spacecraft.group.position);
      camera.up.applyQuaternion(spacecraft.group.quaternion);
      camera.lookAt(spacecraftCameraTarget);
      return;
    }
    camera.position.copy(spacecraft.cockpit);
    if (spacecraft.isLanded()) {
      camera.rotation.set(state.cameraPitch, spacecraft.flight.yaw + state.cameraOrbitYaw + Math.PI, 0, 'YXZ');
    } else {
      camera.quaternion.copy(spacecraft.group.quaternion);
      camera.rotateY(Math.PI);
    }
    return;
  }
  // Restore the ground limit on landing, even without another mouse movement.
  state.cameraPitch = THREE.MathUtils.clamp(state.cameraPitch, minimumCameraPitch(), Math.PI / 2);
  // The first-person laser is attached to the camera, outside the hidden body.
  ship.visible = !state.firstPerson;
  for (const part of bodyRig.headParts) {
    part.mesh.visible = !state.firstPerson;
  }
  if(watchtower.lift.isRiding()&&!state.firstPerson) {
    camera.position.set(ship.position.x+6,ship.position.y+3.1,ship.position.z+5);
    camera.lookAt(ship.position.x,ship.position.y+0.6,ship.position.z);
    return;
  }
  if (state.firstPerson) {
    const viewYaw = seatedBench ? state.cameraOrbitYaw : state.faceYaw;
    const forwardX = Math.sin(viewYaw);
    const forwardZ = Math.cos(viewYaw);
    camera.position.set(
      ship.position.x + forwardX * 0.48,
      ship.position.y + 1.25,
      ship.position.z + forwardZ * 0.48,
    );
    preventCameraWallClipping();
    // Explicit yaw keeps the view stable even when looking exactly straight up.
    camera.rotation.set(state.cameraPitch, viewYaw + Math.PI, 0, 'YXZ');
    return;
  }
  const isStandingStill = isPlayerStandingStill();
  const cameraYaw = isStandingStill ? state.cameraOrbitYaw : state.faceYaw;
  const followDistance = innerWidth < 720 ? 6 : 5;
  // Keep the viewing angle stable when starting or stopping movement.
  const lookAhead = innerWidth < 720 ? 9 : 10;
  // Follow the explorer's actual elevation, including dunes, roofs and flight.
  const height = ship.position.y + (innerWidth < 720 ? 3.25 : 2.8);
  const forwardX = Math.sin(cameraYaw);
  const forwardZ = Math.cos(cameraYaw);
  const indoors = isInsideBaseBuilding() || watchtower.inside(ship.position);
  const restingPitch = indoors ? -0.32 : -Math.atan2(innerWidth < 720 ? 2.9 : 2.45, followDistance + lookAhead);
  // Preserve the normal follow view and reach exactly vertical in both directions.
  const viewPitch = state.cameraPitch >= 0
    ? THREE.MathUtils.lerp(restingPitch, Math.PI / 2, state.cameraPitch / (Math.PI / 2))
    : THREE.MathUtils.lerp(restingPitch, -Math.PI / 2, -state.cameraPitch / (Math.PI / 2));

  camera.position.x = ship.position.x - forwardX * followDistance;
  camera.position.z = ship.position.z - forwardZ * followDistance;
  camera.position.y = height;
  if (watchtower.inside(ship.position)) watchtower.positionCamera(ship.position,cameraYaw,camera.position);
  else if (indoors) positionBaseCamera(ship.position, cameraYaw, camera.position);
  preventCameraWallClipping();
  camera.rotation.set(viewPitch, cameraYaw + Math.PI, 0, 'YXZ');
}

function isPlayerStandingStill() {
  return Math.abs(state.depthInput) + Math.abs(state.steer) + Math.abs(state.depthVelocity) + Math.abs(state.steerVelocity) < 0.04;
}

function updateMovementInputs() {
  if (!state.running) return;
  if (seatedBench || aboardSpacecraft || watchtower.lift.isRiding()) {
    state.depthInput = state.steer = 0;
    state.sprinting = state.jetpackActive = false;
    return;
  }
  const forward = activeKeys.has('w') || activeKeys.has('arrowup');
  const backward = activeKeys.has('s') || activeKeys.has('arrowdown');
  const left = activeKeys.has('a') || activeKeys.has('arrowleft');
  const right = activeKeys.has('d') || activeKeys.has('arrowright');
  const sprint = activeKeys.has('shift');
  const jetpack = activeKeys.has('space');

  const startingToMove = state.depthInput === 0 && state.steer === 0
    && (forward || backward || left || right);
  if (startingToMove && !state.firstPerson) {
    state.faceYaw = state.cameraOrbitYaw;
    ship.rotation.y = state.faceYaw;
  }
  state.depthInput = THREE.MathUtils.clamp((forward ? 1 : 0) + (backward ? -1 : 0), -1, 1);
  state.steer = THREE.MathUtils.clamp((right ? 1 : 0) + (left ? -1 : 0), -1, 1);
  state.sprinting = forward && !backward && sprint;
  state.jetpackActive = jetpack;
}

function moveWithMouse(event) {
  if (screenshotMode) return;
  if (isSleeping) return;
  if (inventory.open || pauseMenu.open || (tradeMenu.open || archiveMenu.open || towerMenu.open)) return;
  updateAimFromPointer(event);
  if (!state.running || event.pointerType === 'touch') return;
  const movementX = event.movementX || 0;
  const movementY = event.movementY || 0;
  if (aboardSpacecraft) {
    if (!spacecraft.isLanded()) {
      if (!spacecraftExitRequested) spacecraft.steer(-movementX * 0.002, -movementY * 0.0018);
      state.cameraOrbitYaw = state.cameraPitch = 0;
      return;
    }
    if (spacecraftThirdPerson) return;
    state.cameraOrbitYaw = THREE.MathUtils.clamp(state.cameraOrbitYaw - movementX * 0.002, -1.2, 1.2);
    state.cameraPitch = THREE.MathUtils.clamp(state.cameraPitch - movementY * 0.0018, -0.65, 0.8);
    return;
  }
  if (Math.abs(movementX) + Math.abs(movementY) < 0.5) return;

  const isStandingStill = isPlayerStandingStill();
  if (seatedBench || (isStandingStill && !state.firstPerson && !state.laserActive)) {
    state.cameraOrbitYaw -= movementX * 0.002;
  } else {
    // Rotate the explorer itself without a yaw limit; the follow camera stays behind.
    state.faceYaw -= movementX * 0.002;
    ship.rotation.y = state.faceYaw;
    state.cameraOrbitYaw = state.faceYaw;
  }
  state.cameraPitch = THREE.MathUtils.clamp(state.cameraPitch - movementY * 0.0018, minimumCameraPitch(), Math.PI / 2);
  state.mouseSteer = 0;
  state.mouseDepth = 0;
  state.mouseMoveUntil = performance.now() + 140;
  updateMovementInputs();
}

function setTouchSteer(direction) {
  if (!state.running) return;
  state.steer = direction;
}

function updateAimFromPointer() {
  state.aimX = 0.5;
  state.aimY = 0.5;
}

function setLaserActive(event, active) {
  if (screenshotMode) {
    state.laserActive = false;
    if (active && event.button === 0 && event.target === canvas && state.running) {
      event.preventDefault();
      saveGameScreenshot();
    }
    return;
  }
  if (!active && event.type === 'pointercancel') { state.laserActive = false; return; }
  if (isSleeping) return;
  if (inventory.open || pauseMenu.open || (tradeMenu.open || archiveMenu.open || towerMenu.open)) return;
  if (event.button !== 0 || event.pointerType === 'touch') return;
  if (aboardSpacecraft) {
    if (active && event.target !== canvas) return;
    if (active && state.running) captureGameMouse();
    state.laserActive = active && state.running && !spacecraftExitRequested;
    return;
  }
  if (active && state.running && !seatedBench && !state.firstPerson && isPlayerStandingStill()) {
    state.faceYaw = state.cameraOrbitYaw;
    ship.rotation.y = state.faceYaw;
  }
  if (active && state.running && event.target === canvas) {
    captureGameMouse();
  }
  updateAimFromPointer(event);
  if (!active && state.laserActive && state.firstPerson && handLaser) {
    handLaser.visibleUntil = performance.now() + 5000;
  }
  state.laserActive = active && state.running && !isInsideBaseBuilding() && !watchtower.inside(ship.position);

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
  if (object.userData.laserDamage !== undefined) object.userData.laserDamage = 0;
  if (damagedRock === object) damagedRock = null;
  const { x, z } = getScatterPositionAroundPlayer(range, minDistance);
  object.position.x = x;
  object.position.z = z;
  const ground = object.userData.groundOffset === undefined ? terrainHeight(x,z) : footprintGroundHeight(x,z);
  object.position.y = ground + (object.userData.groundOffset ?? yOffset);
}

function recycleGroundObjectAroundPlayer(object, yOffset, range = 136, minDistance = 24) {
  if (Math.abs(object.position.x - ship.position.x) > range || Math.abs(object.position.z - ship.position.z) > range) {
    placeGroundObjectAroundPlayer(object, yOffset, range, minDistance);
  }
}

const rockCollisionBounds = new THREE.Box3();
function resolveRockCollisions() {
  const playerRadius = 0.38;
  // Repeat once so neighboring rocks cannot push the player into each other.
  for (let pass = 0; pass < 2; pass += 1) {
    for (const rock of rocks) {
      if (!rock.visible) continue;
      const reach = (rock.userData.hitRadius || 1) + playerRadius + 1;
      if (Math.abs(ship.position.x - rock.position.x) > reach
          || Math.abs(ship.position.z - rock.position.z) > reach) continue;
      rock.updateWorldMatrix(true, true);
      rockCollisionBounds.setFromObject(rock);
      const feetY = terrainHeight(ship.position.x, ship.position.z) + state.flightHeight;
      if (feetY > rockCollisionBounds.max.y + 0.05 || feetY + 2.2 < rockCollisionBounds.min.y) continue;
      const closestX = THREE.MathUtils.clamp(ship.position.x, rockCollisionBounds.min.x, rockCollisionBounds.max.x);
      const closestZ = THREE.MathUtils.clamp(ship.position.z, rockCollisionBounds.min.z, rockCollisionBounds.max.z);
      const dx = ship.position.x - closestX;
      const dz = ship.position.z - closestZ;
      const distance = Math.hypot(dx, dz);
      if (distance >= playerRadius) continue;
      if (distance > 0.0001) {
        ship.position.x += dx / distance * (playerRadius - distance);
        ship.position.z += dz / distance * (playerRadius - distance);
      } else {
        // Resolve an overlap after spawning or landing using the nearest edge.
        const edges = [
          { distance: ship.position.x - rockCollisionBounds.min.x, x: rockCollisionBounds.min.x - playerRadius },
          { distance: rockCollisionBounds.max.x - ship.position.x, x: rockCollisionBounds.max.x + playerRadius },
          { distance: ship.position.z - rockCollisionBounds.min.z, z: rockCollisionBounds.min.z - playerRadius },
          { distance: rockCollisionBounds.max.z - ship.position.z, z: rockCollisionBounds.max.z + playerRadius },
        ];
        const edge = edges.reduce((nearest, candidate) => candidate.distance < nearest.distance ? candidate : nearest);
        if (edge.x !== undefined) ship.position.x = edge.x;
        else ship.position.z = edge.z;
      }
    }
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
  sandworm.reset(ship.position, state.faceYaw, state.crystals >= 5);

  for (const tuft of grassTufts) {
    placeGroundObjectAroundPlayer(tuft, 0.015, 100, 3);
  }
  for (const hill of hills) {
    placeGroundObjectAroundPlayer(hill, 0.025, 158, 32);
  }
  for (const mountain of mountains) {
    placeGroundObjectAroundPlayer(mountain, 0.02, 940, 520);
  }
  for (const rock of rocks) {
    if (!rock.userData.isBlueCrystal) placeGroundObjectAroundPlayer(rock, 0.18, 146, 14);
  }
  resetBlueCrystalGroups(ship.position);
  for (const cloud of clouds) {
    placeCloudAround(cloud, ship.position.x, ship.position.z, 320);
  }
}

function updateRunAnimation(delta, movementAmount, movementDirection, sprintAmount) {
  astronautMotionTime += delta;
  const airbornePose = watchtowerGrounded ? 0 : THREE.MathUtils.smoothstep(state.flightHeight, 0.015, 0.16);
  const flightTarget = Math.max(airbornePose, THREE.MathUtils.clamp(state.jetpackBurn, 0, 1));
  astronautFlightBlend = THREE.MathUtils.damp(astronautFlightBlend, flightTarget, 8, delta);
  const flightAmount = astronautFlightBlend;
  const flightPoseTarget = sampleAstronautFlight(state.flightHeight, state.flightVelocity, state.jetpackBurn);
  for (const key of Object.keys(astronautFlightPose)) {
    astronautFlightPose[key] = THREE.MathUtils.damp(astronautFlightPose[key], flightPoseTarget[key], 7, delta);
  }
  const flightPose = astronautFlightPose;
  const groundedAmount = 1 - flightAmount;
  // A landing bends the knees before the torso settles back over the feet.
  const airborne = watchtowerGrounded ? 0 : state.flightHeight;
  if (astronautPreviousFlight > 0.025 && airborne <= 0.025) {
    astronautLandingCompression = Math.min(0.13, 0.035 + astronautFlightBlend * 0.11);
  }
  astronautPreviousFlight = airborne;
  astronautLandingCompression = THREE.MathUtils.damp(astronautLandingCompression, 0, 9, delta);
  const acceleration = delta > 0 ? (state.depthVelocity - astronautPreviousForward) / delta : 0;
  astronautPreviousForward = state.depthVelocity;
  astronautAccelerationLean = THREE.MathUtils.damp(astronautAccelerationLean,
    THREE.MathUtils.clamp(acceleration * 0.025, -0.07, 0.09), 7, delta);
  const flightControlLength = Math.max(1, Math.hypot(state.depthVelocity, state.steerVelocity));
  astronautFlightDirection.x = THREE.MathUtils.damp(astronautFlightDirection.x,
    state.depthVelocity / flightControlLength, 6, delta);
  astronautFlightDirection.y = THREE.MathUtils.damp(astronautFlightDirection.y,
    -state.steerVelocity / flightControlLength, 6, delta);
  const flightForward = astronautFlightDirection.x * flightAmount;
  const flightSideways = astronautFlightDirection.y * flightAmount;
  state.gaitBlend = THREE.MathUtils.damp(state.gaitBlend, movementAmount, 7, delta);
  state.sprintBlend = THREE.MathUtils.damp(state.sprintBlend, sprintAmount, 5, delta);
  sprintAmount = state.sprintBlend;
  const runAmount = state.gaitBlend * groundedAmount;
  state.runCycle += delta * (4.6 + runAmount * 3.4) * runAmount * (1 + sprintAmount * 0.55);

  const phase = state.runCycle;
  const sway = Math.sin(phase) * runAmount;
  const idle = (1 - runAmount) * groundedAmount;
  const breath = Math.sin(astronautMotionTime * 1.65);
  const weightShift = Math.sin(astronautMotionTime * 0.75) * idle;
  const bob = Math.cos(phase * 2 - 0.4) * runAmount * 0.009;
  const lean = sprintAmount * runAmount;
  const lateralMotion = THREE.MathUtils.lerp(1, 0.2, sprintAmount);
  const steering = THREE.MathUtils.clamp(state.steerVelocity, -1, 1);
  const pelvisSway = sway * 0.024 * lateralMotion + weightShift * 0.009;

  chestRig.position.copy(chestRestPosition);
  chestRig.position.x += sway * 0.012 * lateralMotion + weightShift * 0.006;
  chestRig.position.y += bob + breath * 0.006 * idle;
  chestRig.position.z += lean * 0.08 + flightForward * 0.045;
  chestRig.rotation.set(lean * 0.16 + astronautAccelerationLean * groundedAmount + flightAmount * 0.015 + flightForward * 0.12 + breath * idle * 0.006,
    -Math.sin(phase + 0.2) * runAmount * 0.11 + flightSideways * 0.055,
    (steering * 0.045 * groundedAmount - sway * 0.06) * lateralMotion
      + weightShift * 0.012 - flightSideways * 0.07);
  chestRig.scale.set(1 + breath * idle * 0.0025, 1, 1 + breath * idle * 0.004);
  // Turn the complete helmet around its neck pivot. Looking, gait and a little
  // delayed follow-through give the head motion of its own, with no camera bob.
  const yawChange = Math.atan2(Math.sin(state.faceYaw - astronautPreviousYaw),
    Math.cos(state.faceYaw - astronautPreviousYaw));
  const turnRate = delta > 0 ? THREE.MathUtils.clamp(yawChange / delta, -2.5, 2.5) : 0;
  astronautPreviousYaw = state.faceYaw;
  const lookYaw = state.cameraOrbitYaw - state.faceYaw;
  const headPitch = -state.cameraPitch * 0.52 - chestRig.rotation.x * 0.55
    + Math.sin(phase * 2 - 0.5) * runAmount * 0.018
    + Math.sin(astronautMotionTime * 1.1) * idle * 0.025;
  const headYaw = Math.sin(lookYaw) * 0.65 + turnRate * 0.08 + steering * 0.1 * groundedAmount + flightSideways * 0.15
    - chestRig.rotation.y * 0.4 + Math.sin(phase - 0.35) * runAmount * 0.045
    + (Math.sin(astronautMotionTime * 0.55) * 0.075
      + Math.sin(astronautMotionTime * 0.91) * 0.025) * idle;
  const headRoll = -chestRig.rotation.z * 0.45
    + Math.sin(phase - 0.6) * runAmount * 0.04 * lateralMotion
    + Math.sin(astronautMotionTime * 0.8) * idle * 0.018;
  headRig.rotation.x = THREE.MathUtils.damp(headRig.rotation.x, THREE.MathUtils.clamp(headPitch, -0.46, 0.4), 8, delta);
  headRig.rotation.y = THREE.MathUtils.damp(headRig.rotation.y, THREE.MathUtils.clamp(headYaw, -0.78, 0.78), 6, delta);
  headRig.rotation.z = THREE.MathUtils.damp(headRig.rotation.z, THREE.MathUtils.clamp(headRoll, -0.13, 0.13), 8, delta);
  pelvis.rotation.set(flightForward * 0.045, sway * 0.065 - flightSideways * 0.055,
    sway * 0.025 * lateralMotion - flightSideways * 0.04);
  pelvis.position.x = pelvisSway;
  waistSeal.position.copy(bodyRig.waistSeal.position);
  waistSeal.position.x += pelvisSway;
  waistSeal.rotation.copy(bodyRig.waistSeal.rotation);
  waistSeal.rotation.z += sway * 0.02 * lateralMotion - flightSideways * 0.04;

  const inputLength = Math.hypot(state.depthVelocity, state.steerVelocity);
  // Retain the last direction at rest, so braking does not snap both feet forward.
  if (inputLength > 0.01) {
    astronautGroundDirection.x = THREE.MathUtils.damp(astronautGroundDirection.x,
      state.depthVelocity / inputLength, 12, delta);
    astronautGroundDirection.y = THREE.MathUtils.damp(astronautGroundDirection.y,
      -state.steerVelocity / inputLength, 12, delta);
  }
  const forward = astronautGroundDirection.x;
  const sideways = astronautGroundDirection.y;
  let pelvisDrop = -astronautLandingCompression * groundedAmount;
  const poses = limbRig.map(rig => {
    const { base, side } = rig;
    const legPhase = phase + (side < 0 ? 0 : Math.PI);
    const step = sampleAstronautStep(legPhase, runAmount, sprintAmount);
    const foot = new THREE.Vector3(base.bootPosition.x + sideways * step.travel
      + side * Math.sin(step.swing * Math.PI) ** 2 * runAmount * 0.018,
      base.bootPosition.y + step.lift,
      base.bootPosition.z + forward * step.travel);
    const flyingFoot = base.bootPosition.clone().add(new THREE.Vector3(
      side * (0.025 + Math.abs(astronautFlightDirection.y) * 0.035) - astronautFlightDirection.y * 0.065,
      flightPose.tuck + Math.max(0, astronautFlightDirection.x) * 0.07,
      -flightPose.trail - astronautFlightDirection.x * 0.22 + side * astronautFlightDirection.y * 0.06));
    foot.lerp(flyingFoot, flightAmount);
    const hip = base.hipPosition.clone();
    hip.y -= 0.035;
    hip.x += pelvisSway - flightSideways * 0.025;
    hip.z += side * sway * 0.023 - flightForward * 0.06;
    const ankle = foot.clone().add(new THREE.Vector3(0, 0.055, -0.045));
    // Reserve a little knee flex even when the leg reaches its longest stride.
    const reachLimit = astronautAnatomy.thigh + astronautAnatomy.shin - 0.02;
    const horizontal = (ankle.x - hip.x) ** 2 + (ankle.z - hip.z) ** 2;
    const allowance = ankle.y + Math.sqrt(Math.max(0, reachLimit ** 2 - horizontal)) - hip.y;
    pelvisDrop = smoothMinimum(pelvisDrop, smoothMinimum(0, allowance));
    return { rig, legPhase, step, hip, ankle, foot };
  });
  upperBody.position.set(0, pelvisDrop, 0);

  for (const { rig, legPhase, step, hip, ankle, foot } of poses) {
    const { base, side } = rig;
    hip.y += pelvisDrop;
    const knee = solveLimbJoint(hip, ankle, astronautAnatomy.thigh,
      astronautAnatomy.shin, new THREE.Vector3(side * 0.035, 0, 1));
    rig.hip.position.copy(hip).y += 0.035;
    rig.thighRing.position.copy(hip).y -= 0.065;
    rig.thighRing.quaternion.copy(pelvis.quaternion)
      .multiply(new THREE.Quaternion().setFromEuler(base.thighRingRotation));
    alignLimb(rig.upperLeg, hip, knee);
    alignLimb(rig.leg, knee, ankle);
    rig.knee.position.copy(knee);
    rig.knee.quaternion.copy(rig.leg.quaternion);
    const kneeFront = new THREE.Vector3(0, 0, 0.105).applyQuaternion(rig.leg.quaternion);
    rig.kneePad.position.copy(knee).add(kneeFront);
    rig.kneePad.quaternion.copy(rig.leg.quaternion);
    rig.ankleRing.position.copy(ankle);
    rig.ankleRing.rotation.copy(base.ankleRingRotation);
    const footRoll = step.roll * forward * groundedAmount - flightAmount * (0.10 + flightPose.thrust * 0.10) + flightForward * 0.25;
    rig.ankleRing.rotation.x += footRoll * 0.7;
    for (const [mesh, rest] of [[rig.boot, base.bootPosition], [rig.bootSole, base.bootSolePosition]]) {
      mesh.position.copy(foot).add(rest.clone().sub(base.bootPosition));
      mesh.rotation.set(footRoll, 0, sideways * step.roll * groundedAmount - flightSideways * 0.14
        + side * Math.abs(flightSideways) * 0.05);
    }

    rig.handGrip = THREE.MathUtils.damp(rig.handGrip, sprintAmount * runAmount, 10, delta);
    poseAstronautHand(rig, rig.handGrip);
    const aiming = state.laserActive && handLaser?.parent === rig.glove;
    const swingAmount = runAmount * (aiming ? 0.25 : 1);
    // Arms lag behind the foot's sharper push-off and return, keeping a
    // smaller counter-swing even at sprint cadence.
    const armTarget = -step.travel * forward * (aiming ? 0.25 : 1) * (0.65 + sprintAmount * 0.10);
    rig.armSwing = THREE.MathUtils.damp(rig.armSwing ?? 0, armTarget, 9, delta);
    rig.armSideSwing = THREE.MathUtils.damp(rig.armSideSwing ?? 0, -step.travel * sideways * 0.20, 9, delta);
    const armSwing = rig.armSwing;
    const shoulder = base.shoulderPosition.clone();
    shoulder.y += Math.sin(legPhase + 0.4) * runAmount * 0.007 * lateralMotion + side * flightSideways * 0.025;
    const hand = base.glovePosition.clone();
    hand.x += side * (0.01 + Math.cos(legPhase + 0.4) * swingAmount * 0.008
      + flightAmount * flightPose.armSpread - Math.max(0, flightForward) * 0.045 + Math.abs(flightSideways) * 0.06)
      - flightSideways * 0.04 + rig.armSideSwing;
    hand.y += 0.045 + Math.max(0, armSwing) * 0.16 + lean * 0.22
      + flightAmount * 0.09 + Math.max(0, flightForward) * 0.08 + side * flightSideways * 0.1;
    hand.z += 0.025 + lean * 0.10 + armSwing - flightAmount * 0.06 - flightForward * 0.16 + side * flightSideways * 0.1;
    // Transform both arm targets with the chest, then solve their joints once.
    for (const [target, rest] of [[rig.shoulder.position, shoulder], [rig.glove.position, hand]]) {
      target.copy(rest).sub(chestRestPosition).applyQuaternion(chestRig.quaternion)
        .add(chestRig.position).add(upperBody.position);
    }
    rig.shoulderRing.position.copy(rig.shoulder.position)
      .add(base.shoulderRingPosition.clone().sub(base.shoulderPosition));
    rig.shoulderRing.rotation.copy(base.shoulderRingRotation);
    rig.shoulderRing.rotation.x += armSwing * 0.2;
    poseAstronautArms(rig, { swing: armSwing, amount: swingAmount, flight: flightAmount,
      flightForward, flightSideways });
    rig.isFootPlanted = flightAmount < 0.08 && runAmount > 0.18 && !step.swinging;
  }
}

function applyAstronautLean(weightSettle, gaitSway) {
  // Keep the sprint lean forward and bank only gently into steering.
  const sprint = state.sprintBlend;
  const rollLimit = THREE.MathUtils.lerp(0.16, 0.04, sprint);
  const groundRoll = THREE.MathUtils.clamp(
    -state.steerVelocity * THREE.MathUtils.lerp(0.09, 0.025, sprint)
      - gaitSway * 0.4 * (1 - sprint), -rollLimit, rollLimit);
  const groundPitch = astronautAccelerationLean * 0.45
    + THREE.MathUtils.clamp(state.depthVelocity * (0.075 + sprint * 0.035), -0.09, 0.16)
      - weightSettle * 0.8 * (1 - sprint * 0.5);
  ship.rotation.z = THREE.MathUtils.lerp(groundRoll, -astronautFlightDirection.y * 0.28, astronautFlightBlend);
  ship.rotation.x = THREE.MathUtils.lerp(groundPitch, (astronautFlightDirection.x * 0.24 - astronautFlightPose.thrust * 0.045
    + astronautFlightPose.landing * 0.08), astronautFlightBlend);
}

function dampAngle(current, target, lambda, delta) {
  const angleDelta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + angleDelta * (1 - Math.exp(-lambda * delta));
}

function updateGame(delta) {
  if (!state.running) {
    ship.rotation.z = Math.sin(clock.elapsedTime * 1.4) * 0.035;
    updateJetpack(delta);
    updateRockFragments(delta);
    return;
  }

  updateHealthRecovery(state, delta);
  if(watchtower.lift.isRiding()) {
    watchtower.lift.carry(ship.position);
    state.flightHeight=ship.position.y-playerGroundOffset-terrainHeight(ship.position.x,ship.position.z);
    state.flightVelocity=state.fallDistance=state.depthVelocity=state.steerVelocity=0;
    state.jetpackActive=state.laserActive=false;
    watchtowerGrounded=true;
    updateRunAnimation(delta,0,1,0);ship.rotation.set(0,state.faceYaw,0);updateHud();
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
    state.cameraOrbitYaw = state.faceYaw;
  }
  const previousFlightHeight = state.flightHeight;
  watchtowerGrounded = !state.jetpackActive && watchtower.supports(ship.position);
  previousSpacecraftPosition.copy(ship.position);
  const shelteredFromStorm = aboardSpacecraft || watchtower.lift.isRiding() || isInsideBaseBuilding() || watchtower.inside(ship.position)
    || (abandonedBuilding.inside(ship.position) && ship.position.y < abandonedLocation.ground + 6.9);
  const tornadoActive = tornadoFlight.update(delta, state, ship.position, sandstorm.getTornadoes(), shelteredFromStorm);
  if (tornadoActive && seatedBench) seatedBench = null;
  let impactVelocity = 0;
  if (!aboardSpacecraft) {
    impactVelocity = updateJetpack(delta, tornadoActive);
    updateRunAnimation(delta, movementAmount, movementDirection, sprintAmount);
  }
  if (seatedBench) applySeatedPose();

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
  // Resolve contact after flight movement, using the explorer's current height.
  ship.position.y = terrainHeight(ship.position.x, ship.position.z) + playerGroundOffset + state.flightHeight;
  state.hurtCooldown = Math.max(0, state.hurtCooldown - delta);
  state.hurtFlash = Math.max(0, state.hurtFlash - delta * 2.5);
  const dayElapsed = ((pausedAt ?? performance.now()) - dayStartedAt) / 1000;
  if (!state.curseLifted) sandworm.updateDawn(dayElapsed, dayDuration, ship.position, state.faceYaw);
  const shelteredFromWorm = aboardSpacecraft || watchtower.lift.isRiding() || isInsideBaseBuilding() || watchtower.inside(ship.position)
    || (abandonedBuilding.inside(ship.position) && ship.position.y < abandonedLocation.ground + 6.9);
  const wormContact = sandworm.update(delta, ship.position, state.faceYaw, shelteredFromWorm);
  if (!shelteredFromWorm && wormContact === 'mouth') {
    state.health = 0;
    gameOver('Der Sandwurm hat dich mit seinem Maul erwischt.');
    return;
  }
  if (!shelteredFromWorm && wormContact === 'body' && state.hurtCooldown === 0) {
    audio.play('hurt');
    damageHealth(state, 50);
    state.hurtCooldown = 1.2;
    state.hurtFlash = 0.65;
    if (state.health === 0) {
      gameOver('Du wurdest vom Sandwurm tödlich verletzt.');
      return;
    }
  }
  document.querySelector('#app').style.setProperty('--hurt-opacity', state.hurtFlash);
  clearBaseApproach();
  resolveMountainCollisions();
  resolveRockCollisions();
  spaceTreasure.resolve(ship.position,state);
  if (aboardSpacecraft) ship.position.copy(spacecraft.exit);
  const unresolvedFlightHeight = state.flightHeight;
  let limitedFlight = seatedBench ? 0 : planetaryBase.resolve(ship.position, state.flightHeight, previousFlightHeight);
  limitedFlight = abandonedBuilding.resolve(ship.position, limitedFlight, previousFlightHeight, state.abandonedUnlocked >= 1);
  limitedFlight = watchtower.resolve(ship.position,limitedFlight,previousFlightHeight,previousSpacecraftPosition);
  if (!aboardSpacecraft) limitedFlight = spacecraft.resolve(ship.position, limitedFlight, previousSpacecraftPosition);
  if (limitedFlight < state.flightHeight) state.flightVelocity = Math.min(0, state.flightVelocity);
  else if (limitedFlight > state.flightHeight) state.flightVelocity = Math.max(0, state.flightVelocity);
  state.flightHeight = limitedFlight;
  const tornadoImpact = tornadoFlight.isSlamming() && (state.flightHeight <= 0 || state.flightVelocity >= 0);
  if (tornadoImpact) {
    tornadoFlight.land(state, () => {
      state.healthRecoveryDelay = HEALTH_RECOVERY_DELAY;
      audio.play('hurt'); audio.play('groundImpact');
      state.hurtFlash = 0.85;
      document.querySelector('#app').style.setProperty('--hurt-opacity', state.hurtFlash);
      updateHud();
    });
    if (state.health === 0) {
      gameOver('Der Sandtornado hat dich zu Boden geschleudert.');
      return;
    }
  }
  const landed = impactVelocity < 0 && (state.flightHeight <= 0 || limitedFlight > unresolvedFlightHeight);
  if (aboardSpacecraft || seatedBench) state.fallDistance = 0;
  else if (applyFallDamage(state, previousFlightHeight, state.flightHeight, impactVelocity, landed, tornadoImpact)) {
    audio.play('hurt'); audio.play('groundImpact');
    state.hurtFlash = 0.55;
    document.querySelector('#app').style.setProperty('--hurt-opacity', state.hurtFlash);
    updateHud();
    if (state.health === 0) {
      gameOver('Du wurdest beim Sturz tödlich verletzt.');
      return;
    }
  }
  const groundedMovement = state.flightHeight <= 0.02 || watchtowerGrounded ? movementAmount : 0;
  const leftStep = sampleAstronautStep(state.runCycle, groundedMovement, state.sprintBlend);
  const rightStep = sampleAstronautStep(state.runCycle + Math.PI, groundedMovement, state.sprintBlend);
  const runningFloat = Math.min(leftStep.lift, rightStep.lift) * state.sprintBlend * 0.35;
  const stepBob = (1 - Math.cos(state.runCycle * 2)) * groundedMovement * 0.012 + runningFloat;
  const weightSettle = Math.max(0, -Math.cos(state.runCycle * 2)) * groundedMovement * 0.026;
  const gaitSway = Math.sin(state.runCycle) * groundedMovement * 0.04;
  ship.position.y = terrainHeight(ship.position.x, ship.position.z) + playerGroundOffset + state.flightHeight + stepBob - weightSettle;
  ship.rotation.y = state.faceYaw;
  applyAstronautLean(weightSettle, gaitSway);
  if (seatedBench) {
    ship.position.copy(seatedBench.seat);
    ship.rotation.set(0, seatedBench.yaw, 0);
  }
  if (aboardSpacecraft) {
    ship.position.copy(spacecraft.exit);
    ship.position.y += spacecraft.flight.altitude;
    ship.rotation.set(0, 0, 0);
  }
  if ((state.flightHeight <= 0.08 || watchtowerGrounded) && state.flightVelocity <= 0.4 && !seatedBench && !aboardSpacecraft) {
    emitStepEffects(movementAmount);
  }

  updateTerrainAroundPlayer();

  updateDust(delta);
  updateFootEffects(delta);
  updateRockFragments(delta);

  for (const tuft of grassTufts) {
    recycleGroundObjectAroundPlayer(tuft, 0.015, 110);
  }

  for (const hill of hills) {
    recycleGroundObjectAroundPlayer(hill, 0.025, 164);
  }

  for (const mountain of mountains) {
    recycleGroundObjectAroundPlayer(mountain, 0.02, 1040, 520);
  }

  for (const rock of rocks) {
    if (!rock.userData.isBlueCrystal) recycleGroundObjectAroundPlayer(rock, 0.18, 152);
  }
  for (const cluster of blueCrystalGroups) {
    if (!cluster.placed || Math.abs(cluster.x - ship.position.x) > 152 || Math.abs(cluster.z - ship.position.z) > 152
      || cluster.members.every(crystal => !crystal.visible)) placeBlueCrystalGroup(cluster, ship.position, 146, 36);
  }

  for (const cloud of clouds) {
    cloud.position.x += delta * (0.12 + cloud.userData.speedFactor * 3);
    if (Math.abs(cloud.position.x - ship.position.x) > 350 || Math.abs(cloud.position.z - ship.position.z) > 350) {
      placeCloudAround(cloud, ship.position.x, ship.position.z, 320);
    }
  }

  updateHud();
}

function updateCameraDrawDistance() {
  updateBuildingVisibility(camera.position);
  const far=cameraDrawDistance(camera.position.y-terrainHeight(camera.position.x,camera.position.z));
  if (camera.far!==far) { camera.far=far; camera.updateProjectionMatrix(); }
}

function resize() {
  const { innerWidth, innerHeight } = window;
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  setDefaultCameraPerspective();
  camera.updateProjectionMatrix();
}

function updateFirstPersonCrosshair() {
  firstPersonCrosshair.hidden = !state.running || inventory.open || pauseMenu.open || (tradeMenu.open || archiveMenu.open || towerMenu.open);
  firstPersonCrosshair.style.left = '50%';
  firstPersonCrosshair.style.top = '50%';
}

const compass = document.querySelector('#compass');
const compassHeading = document.querySelector('#compass-heading');
const compassTicks = Array.from({ length: 13 }, () => {
  const tick = document.createElement('span');
  document.querySelector('#compass-tape').append(tick);
  return tick;
});

function updateCompass() {
  compass.hidden = !state.running;
  if (!state.running) return;
  const yaw = aboardSpacecraft ? spacecraft.flight.yaw + (spacecraft.isLanded() ? state.cameraOrbitYaw : 0)
    : !seatedBench && (state.firstPerson || !isPlayerStandingStill()) ? state.faceYaw : state.cameraOrbitYaw;
  const heading = ((180 - THREE.MathUtils.radToDeg(yaw)) % 360 + 360) % 360;
  const directions = document.documentElement.lang === 'en'
    ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    : ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  const label = `${directions[Math.round(heading / 45) % 8]} · ${Math.round(heading) % 360}°`;
  if (compassHeading.textContent !== label) compassHeading.textContent = label;
  const dx = baseLocation.x - ship.position.x;
  const dz = baseLocation.z - ship.position.z;
  const bearing = (THREE.MathUtils.radToDeg(Math.atan2(dx, -dz)) + 360) % 360;
  const offset = ((bearing - heading + 540) % 360) - 180;
  const marker = document.querySelector('#base-compass-marker');
  marker.style.left = `${50 + THREE.MathUtils.clamp(offset * 0.65, -34, 34)}%`;
  const markerText = `${offset < -53 ? '‹ ' : ''}⌂ ${Math.round(Math.hypot(dx, dz))} m${offset > 53 ? ' ›' : ''}`;
  if (marker.textContent !== markerText) marker.textContent = markerText;
  const ruinX = abandonedLocation.x - ship.position.x;
  const ruinZ = abandonedLocation.z - ship.position.z;
  const ruinBearing = (THREE.MathUtils.radToDeg(Math.atan2(ruinX, -ruinZ)) + 360) % 360;
  const ruinOffset = ((ruinBearing - heading + 540) % 360) - 180;
  const ruinMarker = document.querySelector('#abandoned-compass-marker');
  ruinMarker.style.left = `${50 + THREE.MathUtils.clamp(ruinOffset * 0.65, -34, 34)}%`;
  const ruinText = `${ruinOffset < -53 ? '‹ ' : ''}☠ ${Math.round(Math.hypot(ruinX, ruinZ))} m${ruinOffset > 53 ? ' ›' : ''}`;
  if (ruinMarker.textContent !== ruinText) ruinMarker.textContent = ruinText;
  const towerX=watchtowerLocation.x-ship.position.x,towerZ=watchtowerLocation.z-ship.position.z;
  const towerBearing=(THREE.MathUtils.radToDeg(Math.atan2(towerX,-towerZ))+360)%360;
  const towerOffset=((towerBearing-heading+540)%360)-180;
  const towerMarker=document.querySelector('#watchtower-compass-marker');
  towerMarker.style.left=`${50+THREE.MathUtils.clamp(towerOffset*0.65,-34,34)}%`;
  const towerText=`${towerOffset < -53 ? '‹ ' : ''}♜ ${Math.round(Math.hypot(towerX,towerZ))} m${towerOffset > 53 ? ' ›' : ''}`;
  if(towerMarker.textContent!==towerText)towerMarker.textContent=towerText;
  const treasureMarker=document.querySelector('#treasure-compass-marker');
  treasureMarker.hidden=!state.treasureScanned||!!state.treasureOpened;
  if(!treasureMarker.hidden) {
    const tx=treasureLocation.x-ship.position.x,tz=treasureLocation.z-ship.position.z;
    const bearing=(THREE.MathUtils.radToDeg(Math.atan2(tx,-tz))+360)%360;
    const offset=((bearing-heading+540)%360)-180;
    treasureMarker.style.left=`${50+THREE.MathUtils.clamp(offset*0.65,-24,24)}%`;
    treasureMarker.textContent=`${offset < -53 ? '‹ ' : ''}◇ ${document.documentElement.lang==='en'?'Treasure':'Schatz'} · ${Math.round(Math.hypot(tx,tz))} m${offset > 53 ? ' ›' : ''}`;
  }
  const base = Math.floor(heading / 15) * 15;
  compassTicks.forEach((tick, index) => {
    const angle = base + (index - 6) * 15;
    const normalized = (angle % 360 + 360) % 360;
    const text = normalized % 45 === 0 ? directions[normalized / 45] : '│';
    if (tick.textContent !== text) tick.textContent = text;
    tick.style.transform = `translateX(${(angle - heading) * 2.4}px) translateX(-50%)`;
    tick.classList.toggle('cardinal', normalized % 90 === 0);
  });
}

const benchMarkers = planetaryBase.benches.map(() => {
  const marker = document.createElement('div');
  marker.className = 'bench-interaction'; marker.textContent = 'F'; marker.hidden = true;
  marker.setAttribute('aria-hidden', 'true'); document.querySelector('#app').append(marker);
  return marker;
});
const benchProjection = new THREE.Vector3();
const scanner = createScanner(scene, document.querySelector('#app'), terrainHeight);

function scanSurroundings() {
  const candidates = rocks.map(object => ({ object,
    kind: object.userData.isBlueCrystal ? 'blue-crystal' : object.userData.isCrystal ? 'crystal' : 'stone',
    title: object.userData.isBlueCrystal ? 'Blauer Kristall' : object.userData.isCrystal ? 'Kristall' : 'Stein' }));
  candidates.push({ object: abandonedBuilding.group, kind: 'base', title: 'Verlassenes Gebäude' });
  candidates.push({ object: planetaryBase.group, kind: 'base', title: 'Planetarische Basis' });
  candidates.push({ object: watchtower.group, kind: 'base', title: 'Weltraum-Wachturm' });
  candidates.push({ object: spacecraft.group, kind: 'base', title: 'Raumschiff · Kestrel 09' });
  if (sandworm.isPresent()) candidates.push({ object: sandworm.object, kind: 'worm', title: 'Sandwurm' });
  if (scanner.start(ship.position, candidates, 100 + state.scannerLevel * 50)) audio.play('scan');
}

function animate() {
  if (screenshotMode && !state.running) setScreenshotMode(false);
  const frameDelta = clock.getDelta();
  const delta = Math.min(frameDelta, 0.04);
  if (isSleeping) { requestAnimationFrame(animate); return; }
  if (screenshotMode) {
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
    return;
  }
  grassWindTime.value = clock.elapsedTime;
  // The terminal scan takes real seconds even when rendering is slow.
  const treasureDelta=state.running&&!pauseMenu.open&&!inventory.open&&!tradeMenu.open&&!archiveMenu.open?frameDelta:0;
  if(spaceTreasure.update(treasureDelta,state)) {
    audio.play('scan');
    curseMessage.show('Scan abgeschlossen · Space-Schatztruhe markiert.');
    updateInventoryResources();
  }
  if (!pauseMenu.open && !tradeMenu.open && !towerMenu.open) {
    abandonedBuilding.update(state.running ? delta : 0);
    spacecraft.update(state.running ? delta : 0, {
      occupied: aboardSpacecraft, exitPending: spacecraftExitRequested,
      up: activeKeys.has('w') || activeKeys.has('arrowup'),
      down: activeKeys.has('s') || activeKeys.has('arrowdown'),
      brake: activeKeys.has('space'),
    });
    if (state.running && spacecraftExitRequested && spacecraft.isCanopyOpen()) completeSpacecraftExit();
    watchtower.update(state.running && !inventory.open ? delta : 0);
    updateGame(delta);
  }
  audio.setCockpit(aboardSpacecraft && !spacecraftThirdPerson && spacecraft.isCanopyClosed());
  sandstorm.update(state.running && !pauseMenu.open && !tradeMenu.open && !towerMenu.open ? delta : 0, ship.position, aboardSpacecraft || isInsideBaseBuilding() || watchtower.inside(ship.position)
    || (abandonedBuilding.inside(ship.position) && ship.position.y < abandonedLocation.ground + 6.9));
  audio.update({
    playing: state.running && !pauseMenu.open && !tradeMenu.open && !towerMenu.open,
    indoors: isInsideBaseBuilding() || watchtower.inside(ship.position) || (abandonedBuilding.inside(ship.position) && ship.position.y < abandonedLocation.ground + 6.9), jetpack: state.jetpackBurn, storm: sandstorm.getIntensity(), stormGust: sandstorm.getGust(),
    moving: !seatedBench && (state.flightHeight <= 0.03 || watchtowerGrounded) && Math.hypot(state.depthVelocity, state.steerVelocity) > 0.16,
    sprinting: state.sprinting && state.depthVelocity > 0.12,
    beam: state.laserActive && state.weaponMode === 'beam' && handLaser?.canFire,
    shake: sandworm.getGroundShake(ship.position),
    wormDistance: sandworm.object.position.distanceTo(ship.position), wormPresent: sandworm.isPresent(),
    wormPhase: sandworm.getSoundPhase(),
    listenerPosition: camera.position, listenerRight: { x: camera.matrixWorld.elements[0], z: camera.matrixWorld.elements[2] },
    wormPosition: sandworm.object.position,
  });
  setDefaultCameraPerspective();
  if (state.running && !pauseMenu.open && !tradeMenu.open && !towerMenu.open && !aboardSpacecraft) {
    const grounded = 1 - THREE.MathUtils.smoothstep(state.flightHeight, 0.3, 5);
    const shake = sandworm.getGroundShake(ship.position) * grounded;
    const quakeTime = clock.elapsedTime;
    camera.position.x += (Math.sin(quakeTime * 43) + Math.sin(quakeTime * 71) * 0.4) * shake * 0.16;
    camera.position.y += Math.sin(quakeTime * 57) * shake * 0.24;
    camera.position.z += Math.cos(quakeTime * 47) * shake * 0.12;
    camera.rotateZ(Math.sin(quakeTime * 39) * shake * 0.008);
    const windForce = isInsideBaseBuilding() || watchtower.inside(ship.position) ? 0 : sandstorm.getIntensity() * sandstorm.getGust();
    camera.position.x += Math.sin(quakeTime * 5.3) * windForce * 0.025;
    camera.position.y += Math.sin(quakeTime * 7.1) * windForce * 0.018;
    camera.rotateZ(Math.sin(quakeTime * 3.7) * windForce * 0.0025);
  }
  updateCameraDrawDistance();
  // Aim and fire using the final rendered camera, including quake movement.
  if (!pauseMenu.open && !tradeMenu.open && !towerMenu.open) {
    camera.updateMatrixWorld(true);
    updateLaser(delta);
    updateLaserShots(delta);
  }
  updateFirstPersonCrosshair();
  updateCompass();
  updateBenchMarkers();
  spacecraftHint.hidden = !state.running || inventory.open || pauseMenu.open || tradeMenu.open || archiveMenu.open || towerMenu.open || (!aboardSpacecraft && !spacecraft.nearEntrance(ship.position));
  const spacecraftHintText = !state.spacecraftRepaired
    ? (state.fuelTank && state.landingStrut && state.crystals >= 50 && state.blueCrystals >= 20
      ? (document.documentElement.lang === 'en' ? 'F · Repair spacecraft · Fuel tank + landing strut + 30 crystals + 20 blue crystals' : 'F · Raumschiff reparieren · Treibstofftank + Landestütze + 30 Kristalle + 20 blaue Kristalle')
      : getSpacecraftObjective())
    : spacecraftExitRequested ? 'Cockpithaube öffnet sich …'
    : aboardSpacecraft && !spacecraft.isCanopyClosed() ? 'Cockpithaube schließt sich …'
    : aboardSpacecraft && spacecraft.flight.phase === 'lifting' ? 'Hebt ab … · S · Landen'
    : aboardSpacecraft && spacecraft.flight.phase === 'landing' ? 'Landet …'
    : aboardSpacecraft && !spacecraft.isLanded() ? 'Maus · Lenken · Linksklick · Schießen · W · Schub · Leertaste · Bremsen · S · Landen · P · Ansicht wechseln'
    : aboardSpacecraft ? 'W · Abheben und schweben · Linksklick · Schießen · P · Ansicht wechseln · F · Aussteigen' : 'F · In Raumschiff einsteigen';
  spacecraftHint.disabled = spacecraftExitRequested;
  const spacecraftHintMode = spacecraftHintText;
  if (spacecraftHint.dataset.mode !== spacecraftHintMode) {
    spacecraftHint.textContent = spacecraftHintText;
    spacecraftHint.dataset.mode = spacecraftHintMode;
  }
  document.querySelector('#watchtower-hint').hidden = !state.running || inventory.open || pauseMenu.open || tradeMenu.open || archiveMenu.open || towerMenu.open || !watchtower.nearTerminal(ship.position);
  const liftHint=document.querySelector('#watchtower-lift-hint');
  liftHint.hidden=!state.running||inventory.open||pauseMenu.open||tradeMenu.open||archiveMenu.open||towerMenu.open||(!watchtower.lift.near(ship.position)&&!watchtower.lift.isRiding());
  liftHint.disabled=watchtower.lift.isMoving();
  const liftText=watchtower.lift.hint(ship.position);if(liftHint.textContent!==liftText)liftHint.textContent=liftText;
  updateTreasureUI();
  document.querySelector('#archive-hint').hidden = !state.running || inventory.open || pauseMenu.open || (tradeMenu.open || archiveMenu.open || towerMenu.open) || !abandonedBuilding.nearTerminal(ship.position);
  const archiveHint = document.querySelector('#archive-hint');
  if (archiveHint.dataset.activated !== String(state.archiveActivated)) {
    archiveHint.dataset.activated = String(state.archiveActivated);
    archiveHint.textContent = state.archiveActivated ? 'F · Notfallarchiv lesen' : 'F · Archivterminal aktivieren · 50 Cors';
  }
  abandonedBuilding.setUnlocked(state.abandonedUnlocked >= 1);
  const abandonedHint = document.querySelector('#abandoned-hint');
  abandonedHint.hidden = !state.running || inventory.open || pauseMenu.open || (tradeMenu.open || archiveMenu.open || towerMenu.open) || !abandonedBuilding.nearDoor(ship.position);
  const accessText = state.abandonedUnlocked >= 1 ? 'Pass-Key erkannt · Zugang freigegeben' : state.passKey >= 1 ? 'F · Tür mit Pass-Key aufschließen' : 'Verschlossen · Pass-Key am Handelsterminal kaufen';
  if (!abandonedHint.hidden && abandonedHint.dataset.access !== `${state.passKey}:${state.abandonedUnlocked}`) {
    abandonedHint.textContent = accessText; abandonedHint.dataset.access = `${state.passKey}:${state.abandonedUnlocked}`;
  }
  terminalHint.hidden = !state.running || inventory.open || pauseMenu.open || (tradeMenu.open || archiveMenu.open || towerMenu.open) || !planetaryBase.canTrade(ship.position);
  updateRockProgress();
  scanner.update(pauseMenu.open || tradeMenu.open || towerMenu.open ? 0 : delta, camera, ship.position, state.running);
  skyDome.position.copy(camera.position);
  updateSunAndKeyLight();
  sandstorm.applyAtmosphere();
  updateChestFlashlight();
  sandworm.setDustLighting(hemi, keyLight);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);
function captureGameMouse() {
  if (isSleeping) return;
  if (inventory.open || pauseMenu.open || (tradeMenu.open || archiveMenu.open || towerMenu.open) || deleteDialog.open) return;
  if (document.pointerLockElement === canvas || !canvas.requestPointerLock) return;
  const request = canvas.requestPointerLock();
  request?.catch(() => {});
}

window.addEventListener('pointermove', (event) => {
  if (document.pointerLockElement !== canvas) moveWithMouse(event);
});
window.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement === canvas) moveWithMouse(event);
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas) {
    state.laserActive = false;
    if (state.running && !inventory.open && !pauseMenu.open && !(tradeMenu.open || archiveMenu.open || towerMenu.open)) openPauseMenu();
  }
});
window.addEventListener('pointerdown', (event) => setLaserActive(event, true));
window.addEventListener('pointerup', (event) => setLaserActive(event, false));
window.addEventListener('pointercancel', (event) => setLaserActive(event, false));
window.addEventListener('blur', () => {
  state.laserActive = false;
  state.jetpackActive = false;
  activeKeys.clear();
});
window.addEventListener('keydown', (event) => {
  if (isSleeping) { event.preventDefault(); return; }
  if (deleteDialog.open || (tradeMenu.open || archiveMenu.open || towerMenu.open)) return;
  const key = event.code === 'Space' ? 'space' : event.key.toLowerCase();
  if (event.key === 'Escape') {
    if (inventory.open || pauseMenu.open || (tradeMenu.open || archiveMenu.open || towerMenu.open)) return;
    event.preventDefault();
    if (!event.repeat) openPauseMenu();
    return;
  }
  if (pauseMenu.open) return;
  if (event.code === 'KeyO' && state.running && !inventory.open) {
    event.preventDefault();
    if (!event.repeat) setScreenshotMode(!screenshotMode);
    return;
  }
  if (screenshotMode) { event.preventDefault(); return; }
  if (event.code === 'KeyC' && state.running && !inventory.open && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    if (!event.repeat) scanSurroundings();
    return;
  }
  if (event.code === 'KeyF' && !event.repeat && state.running) {
    event.preventDefault();
    if (inventory.open) {
      const horn = document.querySelector('#worm-horn');
      if (!horn.hidden && (horn.matches(':hover') || horn === document.activeElement)) {
        activateWormHorn();
        return;
      }
      const bag = document.querySelector('#sleeping-bag');
      if (bag.matches(':hover') || bag === document.activeElement) sleepUntilMorning();
      return;
    }
    if (aboardSpacecraft || spacecraft.nearEntrance(ship.position)) { toggleSpacecraft(); return; }
    if (watchtower.nearTerminal(ship.position)) { openWatchtowerTerminal(); return; }
    if (watchtower.lift.near(ship.position)||watchtower.lift.isRiding()) { activateTowerLift(); return; }
    if (spaceTreasure.near(ship.position,state)) { interactWithTreasure(); return; }
    if (abandonedBuilding.nearTerminal(ship.position)) { openArchiveTerminal(); return; }
    if (abandonedBuilding.nearDoor(ship.position)) {
      if (state.passKey >= 1 && !state.abandonedUnlocked) {
        state.abandonedUnlocked = 1;
        abandonedBuilding.setUnlocked(true);
        audio.play('door', 1, { x: abandonedLocation.x, y: abandonedLocation.ground + 2, z: abandonedLocation.z + 8 });
      }
      return;
    }
    if (seatedBench || planetaryBase.nearestBench(ship.position)) toggleBenchSeat();
    else openTradingTerminal();
    return;
  }
  if (event.code === 'KeyE') {
    event.preventDefault();
    if (!event.repeat) {
      if (inventory.open) inventory.close();
      else if (state.running) {
        state.laserActive = false;
        state.jetpackActive = false;
        state.mouseMoveUntil = 0;
        activeKeys.clear();
        updateMovementInputs();
        if (document.pointerLockElement === canvas) document.exitPointerLock();
        updateInventoryResources();
        document.querySelector('#sleep-status').textContent = '';
        audio.play('ui');
        inventory.showModal();
      }
    }
    return;
  }
  if (inventory.open || pauseMenu.open || (tradeMenu.open || archiveMenu.open || towerMenu.open)) return;
  if (key === 'p' && !event.repeat) {
    if (aboardSpacecraft) {
      event.preventDefault();
      spacecraftThirdPerson = !spacecraftThirdPerson;
      if (state.running) captureGameMouse();
      setDefaultCameraPerspective();
      return;
    }
    if (!seatedBench && !state.firstPerson && isPlayerStandingStill()) {
      state.faceYaw = state.cameraOrbitYaw;
    }
    state.firstPerson = !state.firstPerson;
    if (state.running) captureGameMouse();
    document.querySelector('#app').classList.toggle('is-first-person', state.firstPerson);
    state.cameraOrbitYaw = state.faceYaw + (seatedBench && !state.firstPerson ? Math.PI / 3 : 0);
    setDefaultCameraPerspective();
  }
  if (key === 'space') {
    event.preventDefault();
  }
  if ((key === 'space' || event.key === 'Enter') && !state.running) {
    event.preventDefault();
    startOrRestartRun();
    return;
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
document.querySelector('#inventory-close').addEventListener('click', () => inventory.close());
inventory.addEventListener('close', () => {
  if (state.running) captureGameMouse();
});
pauseMenu.addEventListener('close', () => {
  if (pausedAt !== null) dayStartedAt += performance.now() - pausedAt;
  pausedAt = null;
  if (state.running) captureGameMouse();
});
document.querySelector('#resume-button').addEventListener('click', () => pauseMenu.close());
document.querySelector('#quit-button').addEventListener('click', () => {
  if (!saveGame()) return;
  state.running = false;
  state.best = Math.max(state.best, Math.floor(state.score));
  localStorage.setItem('orbital-drift-best', String(state.best));
  pauseMenu.close();
  document.querySelector('#app').classList.remove('is-playing', 'is-first-person');
  overlayTitle.textContent = 'Rust Mesa';
  overlayCopy.textContent = 'Spiel gespeichert und beendet. Du kannst deinen Spielstand später laden.';
  startButton.textContent = 'Neues Spiel';
  overlay.classList.add('visible');
  updateHud();
});
loadSlot.addEventListener('change', () => {
  if (state.running) return;
  updateLoadButton();
});
saveSlot.addEventListener('change', () => {
  saveSlot.value = String(activeSaveSlot);
});
loadButton.addEventListener('click', () => {
  if (state.running || !overlay.classList.contains('visible')) return;
  captureGameMouse();
  loadGame();
});
refreshLoadButton();
// Keep the death location in memory; restarting must not move or overwrite a save.
function restoreDeathPosition(respawn) {
  if (!respawn) return;
  ship.position.set(respawn.x, terrainHeight(respawn.x, respawn.z) + playerGroundOffset, respawn.z);
  state.flightHeight = state.flightVelocity = state.fallDistance = 0;
  state.jetpackBurn = 0;
  state.faceYaw = state.cameraOrbitYaw = respawn.yaw;
  astronautPreviousYaw = respawn.yaw;
  ship.rotation.set(0, respawn.yaw, 0);
  state.hurtCooldown = 2;
  updateTerrainAroundPlayer();
  resetSceneryAroundPlayer();
  resetFootEffects();
  updateHud();
}

function startOrRestartRun() {
  captureGameMouse();
  if (restartAfterDeath) {
    const respawn = deathRespawn;
    if (currentRunHasSave) {
      try {
        if (readSaves(localStorage)[activeSaveSlot]) {
          loadSlot.value = String(activeSaveSlot);
          loadGame();
          restoreDeathPosition(respawn);
          return;
        }
      } catch { /* Keep the current slot if the checkpoint cannot be read. */ }
    }
    currentRunHasSave = false;
    resetGame({ preserveSlot: true });
    restoreDeathPosition(respawn);
    return;
  }
  resetGame();
}
startButton.addEventListener('click', startOrRestartRun);

resize();
sandworm.reset(ship.position, state.faceYaw, state.crystals >= 5);
overlay.classList.add('visible');
animate();

// Capture C before gameplay shortcuts, while leaving save-name typing untouched.
window.addEventListener('keydown', (event) => {
  if (deleteDialog.open) {
    event.stopImmediatePropagation();
    return;
  }
  if (event.key.toLowerCase() !== 'c' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.closest?.('input, textarea, [contenteditable="true"]')) return;
  const inMainMenu = !state.running && overlay.classList.contains('visible')
    && !pauseMenu.open && !inventory.open;
  const selector = inMainMenu && !loadSlot.hidden ? loadSlot : null;
  if (!selector) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    const slot = Number(selector.value);
    const saved = readSaves(localStorage)[slot];
    if (!saved) return;
    pendingDeleteSlot = slot;
    document.querySelector('#delete-save-name').textContent = `${slot + 1} · ${saved.name}`;
    document.querySelector('#delete-save-error').hidden = true;
    deleteDialog.showModal();
  } catch { /* No deletion is possible when storage cannot be read. */ }
}, true);
document.querySelector('#delete-save-cancel').addEventListener('click', () => deleteDialog.close());
deleteDialog.addEventListener('close', () => { pendingDeleteSlot = null; });
document.querySelector('#delete-save-confirm').addEventListener('click', () => {
  if (pendingDeleteSlot === null || state.running || !overlay.classList.contains('visible')) return;
  try {
    deleteSave(localStorage, pendingDeleteSlot);
    refreshLoadButton();
    deleteDialog.close();
  } catch {
    document.querySelector('#delete-save-error').hidden = false;
  }
});

function clearBaseApproach() {
  for (const object of [...rocks, ...grassTufts, ...hills]) {
    if (object.userData.isBlueCrystal) continue;
    if(Math.hypot(object.position.x-watchtowerLocation.x,object.position.z-watchtowerLocation.z)<9) {
      object.position.x=watchtowerLocation.x+(object.position.x<watchtowerLocation.x?-12:12);
      object.position.y=(object.userData.groundOffset===undefined?terrainHeight(object.position.x,object.position.z):footprintGroundHeight(object.position.x,object.position.z))+(object.userData.groundOffset??0.02);
    }
    if(Math.hypot(object.position.x-treasureLocation.x,object.position.z-treasureLocation.z)<4) {
      object.position.x=treasureLocation.x+(object.position.x<treasureLocation.x?-6:6);
      object.position.y=(object.userData.groundOffset===undefined?terrainHeight(object.position.x,object.position.z):footprintGroundHeight(object.position.x,object.position.z))+(object.userData.groundOffset??0.02);
    }
    if (Math.abs(object.position.x - abandonedLocation.x) < 11 && Math.abs(object.position.z - abandonedLocation.z) < 14) {
      object.position.x = abandonedLocation.x + (object.position.x < abandonedLocation.x ? -16 : 16);
      object.position.y = (object.userData.groundOffset === undefined ? terrainHeight(object.position.x,object.position.z) : footprintGroundHeight(object.position.x,object.position.z)) + (rocks.includes(object) ? (object.userData.groundOffset ?? 0.18) : 0.02);
    }
    const clearance = hills.includes(object) ? 60 : 12 * baseLayout.scale;
    if (Math.abs(object.position.x) < clearance && Math.abs(object.position.z - baseLocation.z) < clearance) {
      object.position.x += object.position.x < 0 ? -clearance - 4 : clearance + 4;
      object.position.y = (object.userData.groundOffset === undefined ? terrainHeight(object.position.x,object.position.z) : footprintGroundHeight(object.position.x,object.position.z)) + (rocks.includes(object) ? (object.userData.groundOffset ?? 0.18) : 0.02);
    }
  }
}

function refreshTradingTerminal() {
  const english = document.documentElement.lang === 'en';
  document.querySelector('#trade-balance').textContent = `${state.cors} Cors`;
  document.querySelector('#sell-balance').textContent = `${state.cors} Cors`;
  const list = document.querySelector('#trade-products');
  list.replaceChildren();
  for (const item of catalog) {
    const card = document.createElement('article');
    const title = document.createElement('h3');
    title.textContent = (english ? item.english : item.name) + (item.id === 'laser' ? ` (${state.laserLevel}/3)` : item.id === 'jetpack' ? ` (${state.jetpackLevel}/2)` : item.id === 'scanner' ? ` (${state.scannerLevel}/3)` : '');
    const price = document.createElement('p'); price.textContent = `${item.cors} Cors`;
    const button = document.createElement('button'); button.type = 'button'; button.dataset.product = item.id;
    const maximum = item.id === 'medical' ? state.health >= 100 : item.id === 'laser' ? state.laserLevel >= 3 : item.id === 'jetpack' ? state.jetpackLevel >= 2 : item.id === 'scanner' ? state.scannerLevel >= 3 : item.id === 'passkey' ? state.passKey >= 1 : false;
    button.textContent = maximum ? (english ? 'Maximum reached' : 'Maximum erreicht') : (english ? 'Buy' : 'Kaufen');
    button.disabled = maximum || state.cors < item.cors;
    button.addEventListener('click', () => {
      const result = purchase(state, item.id);
      audio.play(result === 'success' ? 'buy' : 'ui');
      document.querySelector('#trade-status').textContent = result === 'success' ? 'Kauf erfolgreich.' : 'Kauf nicht möglich.';
      updateHud(); updateInventoryResources(); refreshTradingTerminal();
    });
    card.append(title, price, button); list.append(card);
  }
  const sales = document.querySelector('#trade-sales');
  sales.replaceChildren();
  for (const item of resourceMarket) {
    const count = resourceAmount(state, item.id);
    const card = document.createElement('article');
    const title = document.createElement('h3');
    title.textContent = `${english ? item.english : item.name} · ${count} ${english ? 'items' : 'Stück'}`;
    card.append(title);
    for (const all of [false, true]) {
      const amount = all ? count : 1;
      const button = document.createElement('button'); button.type = 'button';
      if (all) button.dataset.sellAll = item.id; else button.dataset.sell = item.id;
      button.textContent = `${all ? (english ? 'Sell all' : 'Alle verkaufen') : (english ? 'Sell 1' : '1 verkaufen')} · +${amount * item.cors} Cors`;
      button.disabled = count < 1;
      button.addEventListener('click', () => {
        const result = sellResource(state, item.id, amount);
        audio.play(result === 'success' ? 'buy' : 'ui');
        document.querySelector('#sell-status').textContent = result === 'success' ? 'Rohstoffe verkauft.' : 'Verkauf nicht möglich.';
        updateHud(); updateInventoryResources(); refreshTradingTerminal();
      });
      card.append(button);
    }
    sales.append(card);
  }
}
function openTradingTerminal() {
  if (!state.running || pauseMenu.open || inventory.open || (tradeMenu.open || archiveMenu.open || towerMenu.open) || !planetaryBase.canTrade(ship.position)) return;
  pausedAt = performance.now();
  state.laserActive = state.jetpackActive = false;
  activeKeys.clear(); updateMovementInputs();
  state.depthVelocity = state.steerVelocity = 0;
  document.querySelector('#trade-status').textContent = '';
  audio.silence(); audio.play('ui');
  refreshTradingTerminal(); tradeMenu.showModal();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}
function openWatchtowerTerminal() {
  if(!state.running || inventory.open || pauseMenu.open || tradeMenu.open || archiveMenu.open || towerMenu.open || !watchtower.nearTerminal(ship.position))return;
  pausedAt=performance.now();
  state.laserActive=state.jetpackActive=false;
  activeKeys.clear();state.mouseMoveUntil=0;state.mouseSteer=state.mouseDepth=0;
  updateMovementInputs();state.depthVelocity=state.steerVelocity=0;
  updateTreasureUI();
  audio.play('ui');towerMenu.showModal();
  if(document.pointerLockElement===canvas)document.exitPointerLock();
}
document.querySelector('#watchtower-hint').addEventListener('click',openWatchtowerTerminal);
function activateTowerLift() {
  if(!state.running||inventory.open||pauseMenu.open||tradeMenu.open||archiveMenu.open||towerMenu.open)return;
  const result=watchtower.lift.activate(ship.position);
  if(!result)return;
  state.laserActive=state.jetpackActive=false;state.fallDistance=0;
  activeKeys.clear();state.mouseMoveUntil=0;state.mouseSteer=state.mouseDepth=0;
  updateMovementInputs();state.depthVelocity=state.steerVelocity=0;
  if(result==='riding')state.flightHeight=ship.position.y-1-terrainHeight(ship.position.x,ship.position.z);
  audio.play('door');captureGameMouse();
}
document.querySelector('#watchtower-lift-hint').addEventListener('click',activateTowerLift);
document.querySelector('#treasure-scan').addEventListener('click',()=>{
  if(!towerMenu.open)return;
  if(spaceTreasure.startScan(state)==='started')audio.play('scan');
  updateTreasureUI();
});
document.querySelector('#watchtower-close').addEventListener('click',()=>{
  if(state.treasureScanned&&!state.treasureOpened) {
    state.faceYaw=state.cameraOrbitYaw=Math.atan2(treasureLocation.x-ship.position.x,treasureLocation.z-ship.position.z);
    state.cameraPitch=0;
  }
  towerMenu.close();
});
towerMenu.addEventListener('close',()=>{
  if(pausedAt!==null)dayStartedAt+=performance.now()-pausedAt;
  pausedAt=null;
  if(state.running)captureGameMouse();
});

function updateTreasureUI() {
  const english=document.documentElement.lang==='en';
  const scanning=spaceTreasure.scanning(),progress=Math.floor(spaceTreasure.progress()*100);
  const scan=document.querySelector('#treasure-scan');
  scan.disabled=scanning;
  scan.setAttribute('aria-busy',String(scanning));
  scan.setAttribute('aria-pressed',String(scanning||!!state.treasureScanned));
  const bar=document.querySelector('#treasure-scan-progress');bar.hidden=!scanning;
  bar.setAttribute('aria-valuenow',String(progress));bar.firstElementChild.style.width=`${progress}%`;
  const status=scanning ? (english?`Scanning underground … ${progress} %`:`Untergrund wird gescannt … ${progress} %`)
    : state.treasureOpened ? (english?'Chest recovered · Landing strut secured.':'Schatztruhe geborgen · Landestütze gesichert.')
    : state.treasureScanned ? (english?'Scan complete · Space treasure chest marked.':'Scan abgeschlossen · Space-Schatztruhe markiert.') : '';
  const statusElement=document.querySelector('#watchtower-status');
  if(statusElement.textContent!==status)statusElement.textContent=status;
  const close=document.querySelector('#watchtower-close');
  const closeText=state.treasureScanned&&!state.treasureOpened ? (english?'Show dig site':'Fundstelle anzeigen') : (english?'Close':'Schließen');
  if(close.textContent!==closeText)close.textContent=closeText;
  const available=state.running&&!inventory.open&&!pauseMenu.open&&!tradeMenu.open&&!archiveMenu.open&&!towerMenu.open&&!aboardSpacecraft;
  const hint=document.querySelector('#treasure-hint');hint.hidden=!available||!spaceTreasure.near(ship.position,state);
  const hintText=!state.treasureExcavated ? 'F · Space-Schatztruhe ausgraben'
    : spaceTreasure.excavating() ? 'Space-Schatztruhe wird ausgegraben …' : 'F · Space-Schatztruhe öffnen · Landestütze bergen';
  const englishHint=!state.treasureExcavated ? 'F · Excavate space treasure chest'
    : spaceTreasure.excavating() ? 'Excavating space treasure chest …' : 'F · Open space treasure chest · Recover landing strut';
  const text=english?englishHint:hintText;if(hint.textContent!==text)hint.textContent=text;
  hint.disabled=!!state.treasureExcavated&&spaceTreasure.excavating();
  const marker=document.querySelector('#treasure-marker');
  marker.hidden=!available||!state.treasureScanned||!!state.treasureOpened;
  if(!marker.hidden) {
    const placement=positionWaypoint(spaceTreasure.markerPosition,camera,innerWidth,innerHeight);
    marker.classList.toggle('is-offscreen',placement.offscreen);
    marker.style.left=`${placement.x}px`;marker.style.top=`${placement.y}px`;
    marker.querySelector('.treasure-waypoint-arrow').style.transform=`rotate(${placement.angle}deg)`;
    document.querySelector('#treasure-distance').textContent=`${Math.round(Math.hypot(treasureLocation.x-ship.position.x,treasureLocation.z-ship.position.z))} m`;
  }
}
function interactWithTreasure() {
  if(!state.running||inventory.open||pauseMenu.open||tradeMenu.open||archiveMenu.open||towerMenu.open)return;
  const result=spaceTreasure.interact(state,ship.position);
  if(result==='excavated') {
    audio.play('groundImpact');curseMessage.show('Space-Schatztruhe wird ausgegraben …');
  } else if(result==='opened') {
    audio.play('buy');curseMessage.show('Landestütze geborgen · Für die Reparatur des Raumschiffs.');
    updateInventoryResources();
  }
  updateTreasureUI();
}
document.querySelector('#treasure-hint').addEventListener('click',interactWithTreasure);

function openArchiveTerminal() {
  if (!state.running || inventory.open || pauseMenu.open || tradeMenu.open || archiveMenu.open || towerMenu.open || !abandonedBuilding.nearTerminal(ship.position)) return;
  const activation = activateArchive(state);
  if (activation === 'funds') {
    audio.play('ui');
    curseMessage.show('Zur Aktivierung des Archivterminals brauchst du 50 Cors.');
    return;
  }
  if (activation === 'success') {
    audio.play('buy'); updateHud(); updateInventoryResources();
  }
  state.laserActive = state.jetpackActive = false;
  state.mouseMoveUntil = 0; state.mouseSteer = state.mouseDepth = 0;
  activeKeys.clear(); updateMovementInputs();
  state.depthVelocity = state.steerVelocity = 0;
  audio.play('ui');
  document.querySelector('#archive-close').textContent = state.archiveRead ? 'Schließen' : 'Eintrag gelesen · Treibstofftank bergen';
  archiveMenu.showModal();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}
document.querySelector('#archive-close').addEventListener('click', () => {
  if (state.running && archiveMenu.open && recoverFuelTank(state)) {
    updateInventoryResources();
    audio.play('buy');
    curseMessage.show('Treibstofftank geborgen · Zusätzlich brauchst du die Landestütze aus der Schatztruhe und 30 Kristalle plus 20 blaue Kristalle.');
  }
  archiveMenu.close();
});
archiveMenu.addEventListener('close', () => {
  if (state.running) captureGameMouse();
});
terminalHint.addEventListener('click', openTradingTerminal);
document.querySelector('#trade-sell-open').addEventListener('click', () => {
  if (!tradeMenu.open || sellMenu.open) return;
  document.querySelector('#sell-status').textContent = '';
  refreshTradingTerminal();
  sellMenu.showModal();
});
document.querySelector('#sell-close').addEventListener('click', () => sellMenu.close());
document.querySelector('#trade-close').addEventListener('click', () => tradeMenu.close());
tradeMenu.addEventListener('close', () => {
  if (sellMenu.open) sellMenu.close();
  if (pausedAt !== null) dayStartedAt += performance.now() - pausedAt;
  pausedAt = null;
  if (state.running) captureGameMouse();
});


function updateBenchMarkers() {
  const available = state.running && !inventory.open && !pauseMenu.open && !(tradeMenu.open || archiveMenu.open || towerMenu.open);
  const nearest = available && !seatedBench ? planetaryBase.nearestBench(ship.position) : null;
  planetaryBase.benches.forEach((bench, index) => {
    const marker = benchMarkers[index];
    marker.hidden = bench !== nearest;
    if (marker.hidden) return;
    benchProjection.copy(bench.marker).project(camera);
    marker.hidden = benchProjection.z < -1 || benchProjection.z > 1 || Math.abs(benchProjection.x) > 1 || Math.abs(benchProjection.y) > 1;
    marker.style.left = `${(benchProjection.x + 1) * innerWidth / 2}px`;
    marker.style.top = `${(1 - benchProjection.y) * innerHeight / 2}px`;
  });
  document.querySelector('#stand-hint').hidden = !available || !seatedBench;
}
function toggleBenchSeat() {
  if (!state.running || inventory.open || pauseMenu.open || (tradeMenu.open || archiveMenu.open || towerMenu.open)) return;
  if (seatedBench) {
    ship.position.copy(seatedBench.stand);
    seatedBench = null;
    updateRunAnimation(0, 0, 1, 0);
  } else {
    const bench = planetaryBase.nearestBench(ship.position);
    if (!bench || state.flightHeight > 0.2) return;
    seatedBench = bench;
    ship.position.copy(bench.seat);
    state.faceYaw = bench.yaw;
    state.cameraOrbitYaw = bench.yaw + (state.firstPerson ? 0 : Math.PI / 3);
  }
  audio.play('seat');
  activeKeys.clear();
  state.depthInput = state.steer = state.depthVelocity = state.steerVelocity = 0;
  state.flightHeight = state.flightVelocity = state.jetpackBurn = 0;
  state.jetpackActive = state.laserActive = state.sprinting = false;
  ship.rotation.set(0, state.faceYaw, 0);
  updateMovementInputs();
}
function applySeatedPose() {
  upperBody.position.y = -0.3;
  for (const rig of limbRig) {
    const x = rig.side * 0.18;
    rig.hip.position.set(x, -0.29, 0.02);
    rig.thighRing.position.set(x, -0.29, 0.16);
    rig.thighRing.rotation.set(Math.PI / 2, 0, 0);
    rig.upperLeg.position.set(x, -0.3, 0.27);
    rig.upperLeg.rotation.set(Math.PI / 2, 0, 0);
    rig.leg.position.set(x, -0.565, 0.54);
    rig.leg.rotation.set(0, 0, 0);
    rig.kneePad.position.set(x, -0.3, 0.64);
    rig.knee.position.set(x, -0.3, 0.54);
    rig.ankleRing.position.set(x, -0.82, 0.54);
    rig.boot.position.set(x, -0.91, 0.67);
    rig.boot.rotation.set(0, 0, 0);
    rig.bootSole.position.set(x, -1.0, 0.69);
    rig.bootSole.rotation.set(0, 0, 0);
    rig.shoulder.position.y -= 0.3;
    rig.shoulderRing.position.y -= 0.3;
    rig.glove.position.set(rig.side * 0.4, -0.08, 0.3);
    poseAstronautArms(rig);
    rig.isFootPlanted = false;
  }
}

function sleepUntilMorning() {
  if (!state.running || !inventory.open || isSleeping) return;
  const status = document.querySelector('#sleep-status');
  if (state.flightHeight > 0.2) {
    status.textContent = 'Lande zuerst, um den Schlafsack zu benutzen.';
    return;
  }
  const elapsed = ((pausedAt ?? performance.now()) - dayStartedAt) / 1000;
  const cycle = (initialSunAngle / Math.PI * daylightDuration + elapsed) % dayDuration;
  if (cycle < daylightDuration) {
    status.textContent = 'Du kannst den Schlafsack nur nachts benutzen.';
    return;
  }
  const morningElapsed = elapsed + dayDuration - cycle;
  if (!state.curseLifted) sandworm.updateDawn(elapsed, dayDuration, ship.position, state.faceYaw);
  state.laserActive = state.jetpackActive = false;
  state.depthVelocity = state.steerVelocity = 0;
  activeKeys.clear(); updateMovementInputs();
  curseMessage.hide();
  audio.silence(); audio.play('sleep');
  isSleeping = true;
  sleepOverlay.hidden = false;
  sleepFade = sleepOverlay.animate([
    { opacity: 0, offset: 0 },
    { opacity: 1, offset: 1 / 7 },
    { opacity: 1, offset: 6 / 7 },
    { opacity: 0, offset: 1 },
  ], { duration: 7000, fill: 'forwards', easing: 'linear' });
  inventory.close();
  sleepTimer = setTimeout(() => {
    sleepTimer = null;
    // Prepare dawn while still black, before gently revealing the morning.
    dayStartedAt = performance.now() - morningElapsed * 1000;
    if (!state.curseLifted) sandworm.updateDawn(morningElapsed, dayDuration, ship.position, state.faceYaw);
    updateSunAndKeyLight();
    updateChestFlashlight();
    renderer.render(scene, camera);
    sleepTimer = setTimeout(() => {
      sleepTimer = null;
      isSleeping = false;
      sleepOverlay.hidden = true;
      sleepFade?.cancel();
      sleepFade = null;
      captureGameMouse();
    }, 1000);
  }, 6000);
}

function activateWormHorn() {
  if (!state.running || !inventory.open || state.wormHorns < 1 || state.curseLifted) return;
  if (!sandworm.isPresent()) {
    document.querySelector('#sleep-status').textContent = 'Das Wurmhorn funktioniert nur, wenn der Sandwurm da ist.';
    return;
  }
  audio.play('horn');
  state.wormHorns -= 1;
  state.curseLifted = true;
  sandworm.repel(true);
  curseMessage.show(freedomMessageText);
  curseMessage.remember();
  updateInventoryResources();
  inventory.close();
}

document.querySelector('#language-select').addEventListener('change', () => { updateInventoryResources(); if (tradeMenu.open) refreshTradingTerminal(); });
