import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createClothCapsule, addFabricSeam } from './suit-fabric.js';

export function createEquipmentMaterials(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const grain = Math.sin(x * 17.3 + y * 31.7) * Math.sin(x * 3.1 - y * 11.7);
      const scratch = Math.pow(Math.max(0, Math.sin(x * 0.47 + Math.sin(y * 0.025))), 22);
      const value = 174 + grain * 22 - scratch * 26;
      pixels.data.set([value, value, value, 255], (y * 256 + x) * 4);
    }
  }
  context.putImageData(pixels, 0, 0);
  const relief = new THREE.CanvasTexture(canvas);
  relief.wrapS = relief.wrapT = THREE.RepeatWrapping;
  relief.repeat.set(3, 3);
  relief.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const finish = (color, roughness, metalness, bumpScale = 0.00025) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, bumpMap: relief, bumpScale });
  return {
    shell: finish(0xd6d3c7, 0.69, 0.18),
    metal: finish(0x939c9f, 0.42, 0.8),
    darkMetal: finish(0x39434a, 0.5, 0.73),
    rubber: finish(0x303431, 0.96, 0, 0.0006),
    sole: finish(0x181d1c, 0.98, 0, 0.0008),
    welt: finish(0x686961, 0.96, 0),
    webbing: finish(0x555a50, 1, 0, 0.0007),
    accent: finish(0xb96a38, 0.76, 0.15),
    brass: finish(0x9a8860, 0.42, 0.78),
    heatShield: finish(0x504e48, 0.62, 0.82),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x172e33, roughness: 0.2,
      metalness: 0.12, clearcoat: 0.75, clearcoatRoughness: 0.18 }),
    green: new THREE.MeshStandardMaterial({ color: 0x8dac83, emissive: 0x3c6849, emissiveIntensity: 0.3, roughness: 0.45 }),
    amber: new THREE.MeshStandardMaterial({ color: 0xc79b54, emissive: 0x72421c, emissiveIntensity: 0.2, roughness: 0.45 }),
  };
}

function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const needsColors = (Array.isArray(material) ? material : [material]).some(finish => finish.vertexColors);
  if (needsColors && !geometry.hasAttribute('color')) {
    const colors = new Float32Array(geometry.attributes.position.count * 3).fill(1);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  const part = new THREE.Mesh(geometry, material);
  part.position.set(x, y, z);
  part.castShadow = true;
  part.receiveShadow = true;
  parent.add(part);
  return part;
}

function box(parent, width, height, depth, material, x = 0, y = 0, z = 0, radius = 0.006) {
  return mesh(parent, new RoundedBoxGeometry(width, height, depth, 3,
    Math.min(radius, width / 3, height / 3, depth / 3)), material, x, y, z);
}

function tube(parent, points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  return mesh(parent, new THREE.TubeGeometry(curve, 40, radius, 8, false), material);
}

function fasteners(parent, points, material, facing = 1) {
  const geometry = new THREE.CylinderGeometry(0.0045, 0.0045, 0.0025, 6);
  geometry.rotateX(Math.PI / 2);
  const bolts = new THREE.InstancedMesh(geometry, material, points.length);
  const transform = new THREE.Object3D();
  points.forEach((point, index) => {
    transform.position.set(...point);
    transform.rotation.z = index * 0.7;
    transform.updateMatrix();
    bolts.setMatrixAt(index, transform.matrix);
    box(parent, 0.004, 0.0009, 0.0008, material, point[0], point[1], point[2] + facing * 0.0018, 0.0002);
  });
  parent.add(bolts);
}

function label(parent, width, height, lines, color, x, y, z, rear = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.max(96, Math.round(512 * height / width));
  const context = canvas.getContext('2d');
  context.fillStyle = color;
  let fontSize = Math.round(canvas.height / (lines.length * 1.9));
  context.font = `500 ${fontSize}px monospace`;
  const longestLine = Math.max(...lines.map(line => context.measureText(line).width));
  fontSize = Math.min(fontSize, fontSize * (canvas.width - 36) / longestLine);
  context.font = `500 ${fontSize}px monospace`;
  context.textBaseline = 'middle';
  lines.forEach((line, i) => context.fillText(line, 18, (i + 0.5) * canvas.height / lines.length));
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({ map, transparent: true,
    alphaTest: 0.2, roughness: 0.86, depthWrite: false });
  const part = mesh(parent, new THREE.PlaneGeometry(width, height), material, x, y, z);
  part.rotation.y = rear ? Math.PI : 0;
  part.castShadow = false;
  return part;
}

function footprint(depth, inset = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.075 + inset, -0.177 + inset);
  shape.bezierCurveTo(-0.115 + inset, -0.16, -0.105 + inset, -0.07, -0.115 + inset, 0.035);
  shape.bezierCurveTo(-0.143 + inset, 0.14, -0.128 + inset, 0.215 - inset, -0.06, 0.225 - inset);
  shape.quadraticCurveTo(0.09, 0.25 - inset, 0.122 - inset, 0.17);
  shape.quadraticCurveTo(0.14 - inset, 0.085, 0.108 - inset, -0.04);
  shape.lineTo(0.098 - inset, -0.14);
  shape.quadraticCurveTo(0.092, -0.18 + inset, 0.06, -0.177 + inset);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1,
    bevelEnabled: true, bevelSegments: 3, bevelSize: 0.003, bevelThickness: 0.003, curveSegments: 12 });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, depth / 2, 0);
  return geometry;
}

export function createAstronautBoot(side, equipment, fabric) {
  const boot = new THREE.Group();
  boot.name = `eva-boot-${side < 0 ? 'left' : 'right'}`;
  const upperGeometry = new THREE.BufferGeometry();
  const positions = [], uv = [], indices = [];
  const rows = 40, segments = 48, toeRow = 30;
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    const width = 0.131 * Math.sqrt(Math.max(0, 1 - (v * 2 - 1) ** 2)) * (0.78 + v * 0.3);
    const height = 0.17 - THREE.MathUtils.smoothstep(v, 0.3, 1) * 0.07;
    for (let segment = 0; segment <= segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      const top = Math.max(0, Math.cos(angle));
      positions.push(Math.sin(angle) * width,
        -0.055 + Math.pow(top, 0.55) * height - Math.max(0, -Math.cos(angle)) * 0.008,
        -0.165 + v * 0.385);
      uv.push(segment / segments * 0.6, v * 0.385);
      if (row < rows && segment < segments) {
        const a = row * (segments + 1) + segment, b = a + segments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  upperGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  upperGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  upperGeometry.setIndex(indices);
  upperGeometry.addGroup(0, toeRow * segments * 6, 0);
  upperGeometry.addGroup(toeRow * segments * 6, (rows - toeRow) * segments * 6, 1);
  upperGeometry.computeVertexNormals();
  mesh(boot, upperGeometry, [fabric.reinforcement, equipment.rubber]);
  const shaft = mesh(boot, createClothCapsule(0.102, 0.08, side * 17), fabric.panel, 0, 0.08, -0.064);
  shaft.scale.set(1, 0.85, 0.88);
  const heel = box(boot, 0.184, 0.13, 0.055, equipment.rubber, 0, 0.007, -0.135, 0.02);
  heel.rotation.x = -0.08;
  const rand = mesh(boot, footprint(0.029, 0.008), equipment.rubber, 0, -0.056, 0.009);
  rand.name = 'protective-rubber-rand';
  for (const y of [0.055, 0.14]) {
    const strap = mesh(boot, new THREE.TorusGeometry(0.104, 0.012, 5, 32), equipment.webbing, 0, y, -0.064);
    strap.rotation.x = Math.PI / 2;
    strap.scale.y = 0.87;
    box(boot, 0.027, 0.028, 0.018, equipment.metal, side * 0.101, y, -0.035, 0.004);
    box(boot, 0.015, 0.012, 0.019, equipment.darkMetal, side * 0.105, y, -0.035, 0.003);
  }
  for (const x of [-0.079, 0.079]) {
    addFabricSeam(boot, [[x, 0.025, 0.095], [x * 0.86, 0.067, 0.02],
      [x * 0.85, 0.15, -0.015]], fabric, 0.0012);
  }
  box(boot, 0.034, 0.064, 0.018, equipment.webbing, 0, 0.159, -0.151, 0.005);
  label(boot, 0.075, 0.025, [`EVA ${side < 0 ? 'L' : 'R'}`], '#cfccb8', 0, 0.109, 0.029);

  const sole = new THREE.Group();
  sole.name = 'layered-eva-outsole';
  mesh(sole, footprint(0.025), equipment.welt, 0, 0.008, 0);
  mesh(sole, footprint(0.02, 0.002), equipment.sole, 0, -0.012, 0);
  const treadPoints = [];
  for (let row = 0; row < 8; row++) {
    const z = -0.135 + row * 0.045;
    for (const sign of [-1, 1]) treadPoints.push({ x: sign * 0.064, z, angle: sign * 0.4 });
  }
  const treads = new THREE.InstancedMesh(new RoundedBoxGeometry(0.105, 0.013, 0.024, 2, 0.003),
    equipment.sole, treadPoints.length);
  const transform = new THREE.Object3D();
  treadPoints.forEach((point, index) => {
    transform.position.set(point.x, -0.031, point.z);
    transform.rotation.y = point.angle;
    transform.updateMatrix();
    treads.setMatrixAt(index, transform.matrix);
  });
  treads.castShadow = true;
  sole.add(treads);
  for (const sign of [-1, 1]) {
    for (const z of [-0.09, -0.025, 0.04, 0.105, 0.17]) {
      box(sole, 0.016, 0.023, 0.033, equipment.sole, sign * 0.117, -0.007, z, 0.003);
    }
  }
  // Enlarge the overshoe around the ankle, while leaving the sole's contact
  // height and the animation's ankle/foot attachment points unchanged.
  const upperVolume = new THREE.Group();
  for (const part of [...boot.children]) upperVolume.add(part);
  upperVolume.scale.set(1.25, 1.12, 1.28);
  upperVolume.position.set(0, 0.063 * (upperVolume.scale.y - 1), -0.045 * (1 - upperVolume.scale.z));
  boot.add(upperVolume);
  const soleVolume = new THREE.Group();
  for (const part of [...sole.children]) soleVolume.add(part);
  soleVolume.scale.set(1.25, 1, 1.28);
  soleVolume.position.z = -0.065 * (1 - soleVolume.scale.z);
  sole.add(soleVolume);
  return { boot, sole };
}

export function createChestConsole(equipment) {
  const root = new THREE.Group();
  root.name = 'chest-life-support-console';
  box(root, 0.455, 0.327, 0.074, equipment.rubber, 0, 0, -0.006, 0.026);
  box(root, 0.434, 0.309, 0.077, equipment.shell, 0, 0, 0, 0.025);
  box(root, 0.356, 0.24, 0.014, equipment.darkMetal, -0.015, 0, 0.044, 0.012);
  box(root, 0.183, 0.094, 0.01, equipment.rubber, -0.071, 0.056, 0.057, 0.008);
  box(root, 0.165, 0.078, 0.006, equipment.glass, -0.071, 0.056, 0.064, 0.005);
  label(root, 0.143, 0.058, ['LIFE SUPPORT', 'O2  /  FLOW', 'STATUS: NOMINAL'], '#a8c7b4', -0.071, 0.056, 0.068);
  label(root, 0.18, 0.023, ['PRESSURE / O2'], '#a7b0a5', -0.06, -0.015, 0.053);
  for (const [x, material] of [[0.054, equipment.green], [0.08, equipment.amber]]) {
    mesh(root, new THREE.CylinderGeometry(0.005, 0.005, 0.005, 12), material, x, 0.077, 0.058).rotation.x = Math.PI / 2;
  }
  for (const x of [-0.12, -0.045, 0.03]) {
    mesh(root, new THREE.CylinderGeometry(0.017, 0.019, 0.01, 24), equipment.metal, x, -0.064, 0.061).rotation.x = Math.PI / 2;
    box(root, 0.006, 0.018, 0.013, equipment.rubber, x, -0.063, 0.073, 0.002).rotation.z = x * 3;
  }
  box(root, 0.021, 0.038, 0.012, equipment.accent, 0.102, -0.061, 0.061, 0.006);
  for (const x of [0.082, 0.124]) {
    tube(root, [[x, -0.085, 0.057], [x, -0.085, 0.084], [x, -0.034, 0.084], [x, -0.034, 0.057]], 0.003, equipment.metal);
  }
  for (const side of [-1, 1]) {
    box(root, 0.031, 0.25, 0.015, equipment.webbing, side * 0.188, 0.215, -0.044, 0.004);
    box(root, 0.047, 0.038, 0.021, equipment.metal, side * 0.188, 0.145, -0.033, 0.005);
    box(root, 0.025, 0.016, 0.024, equipment.webbing, side * 0.188, 0.145, -0.03, 0.003);
    mesh(root, new THREE.CylinderGeometry(0.017, 0.017, 0.036, 20), equipment.brass,
      side * 0.157, -0.131, 0.038).rotation.x = Math.PI / 2;
    tube(root, [[side * 0.157, -0.131, 0.061], [side * 0.207, -0.207, 0.065],
      [side * 0.286, -0.19, -0.015], [side * 0.31, -0.12, -0.16]], 0.009, equipment.rubber);
    box(root, 0.04, 0.012, 0.008, equipment.accent, side * 0.16, 0.144, 0.039, 0.003);
  }
  fasteners(root, [[-0.201, -0.13, 0.042], [-0.201, 0.13, 0.042],
    [0.201, -0.13, 0.042], [0.201, 0.13, 0.042]], equipment.metal);

  const flashlight = new THREE.Group();
  flashlight.name = 'chest-flashlight';
  flashlight.position.set(0.162, 0.039, 0.07);
  root.add(flashlight);
  mesh(flashlight, new THREE.CylinderGeometry(0.041, 0.043, 0.065, 28), equipment.darkMetal).rotation.x = Math.PI / 2;
  for (const z of [-0.018, -0.003, 0.012, 0.032]) {
    mesh(flashlight, new THREE.TorusGeometry(0.041, 0.003, 6, 28), equipment.metal, 0, 0, z);
  }
  const reflector = mesh(flashlight, new THREE.ConeGeometry(0.035, 0.018, 28, 1, true), equipment.metal, 0, 0, 0.032);
  reflector.rotation.x = Math.PI / 2;
  reflector.material = equipment.metal.clone();
  reflector.material.side = THREE.DoubleSide;
  const lensMaterial = new THREE.MeshStandardMaterial({ color: 0xe3e5d8,
    emissive: 0xffe3a3, emissiveIntensity: 0, roughness: 0.22, metalness: 0.05 });
  mesh(flashlight, new THREE.CircleGeometry(0.031, 28), lensMaterial, 0, 0, 0.044);
  return { root, flashlight, lensMaterial };
}

export function createLifeSupportPack(equipment) {
  const root = new THREE.Group();
  root.name = 'life-support-jetpack';
  box(root, 0.568, 0.812, 0.281, equipment.rubber, 0, 0, 0.005, 0.04);
  box(root, 0.55, 0.8, 0.28, equipment.shell, 0, 0, 0, 0.038);
  box(root, 0.32, 0.43, 0.019, equipment.darkMetal, 0, 0.075, -0.15, 0.014);
  box(root, 0.294, 0.4, 0.018, equipment.shell, 0, 0.075, -0.164, 0.011);
  box(root, 0.244, 0.16, 0.012, equipment.darkMetal, 0, -0.045, -0.178, 0.007);
  for (let fin = 0; fin < 9; fin++) {
    box(root, 0.225, 0.006, 0.011, equipment.metal, 0, -0.105 + fin * 0.016, -0.187, 0.002);
  }
  label(root, 0.23, 0.068, ['PLSS-07', 'LIFE SUPPORT'], '#45504c', 0, 0.185, -0.176, true);
  box(root, 0.25, 0.042, 0.009, equipment.accent, 0, -0.302, -0.149, 0.004);
  label(root, 0.24, 0.033, ['PROPULSION / KEEP CLEAR'], '#e5dfcc', 0, -0.302, -0.155, true);
  fasteners(root, [[-0.13, -0.106, -0.177], [-0.13, 0.255, -0.177],
    [0.13, -0.106, -0.177], [0.13, 0.255, -0.177]], equipment.metal, -1);
  tube(root, [[-0.105, 0.375, 0], [-0.105, 0.446, -0.02],
    [0.105, 0.446, -0.02], [0.105, 0.375, 0]], 0.012, equipment.darkMetal);

  const nozzles = [];
  for (const side of [-1, 1]) {
    const x = side * 0.223;
    mesh(root, new THREE.CapsuleGeometry(0.073, 0.49, 10, 24), equipment.metal, x, 0.015, -0.192);
    mesh(root, new THREE.CylinderGeometry(0.074, 0.074, 0.032, 24), equipment.accent, x, 0.163, -0.192);
    for (const y of [-0.17, 0.22]) {
      const strap = mesh(root, new THREE.TorusGeometry(0.075, 0.01, 6, 24), equipment.webbing, x, y, -0.192);
      strap.rotation.x = Math.PI / 2;
      box(root, 0.032, 0.033, 0.018, equipment.darkMetal, x, y, -0.27, 0.004);
    }
    mesh(root, new THREE.CylinderGeometry(0.022, 0.025, 0.055, 20), equipment.brass, x, 0.35, -0.192);
    const valve = mesh(root, new THREE.TorusGeometry(0.027, 0.004, 6, 20), equipment.accent, x, 0.378, -0.192);
    valve.rotation.x = Math.PI / 2;
    tube(root, [[x, 0.35, -0.192], [side * 0.13, 0.345, -0.205],
      [side * 0.1, 0.27, -0.21]], 0.009, equipment.rubber);
    tube(root, [[x, -0.286, -0.192], [side * 0.27, -0.33, -0.17],
      [side * 0.35, -0.27, -0.12]], 0.01, equipment.darkMetal);
    box(root, 0.126, 0.113, 0.13, equipment.darkMetal, side * 0.296, -0.22, -0.12, 0.018);
    const hinge = mesh(root, new THREE.CylinderGeometry(0.035, 0.035, 0.1, 20), equipment.metal,
      side * 0.34, -0.22, -0.14);
    hinge.rotation.z = Math.PI / 2;
    const nozzle = new THREE.Group();
    nozzle.name = `gimballed-nozzle-${side}`;
    nozzle.position.set(side * 0.36, -0.22, -0.16);
    root.add(nozzle);
    const bellMount = new THREE.Group();
    bellMount.position.z = -0.1;
    nozzle.add(bellMount);
    const bell = new THREE.LatheGeometry([
      new THREE.Vector2(0.066, 0), new THREE.Vector2(0.062, 0.006),
      new THREE.Vector2(0.042, 0.07), new THREE.Vector2(0.022, 0.12),
      new THREE.Vector2(0.029, 0.12), new THREE.Vector2(0.049, 0.07),
      new THREE.Vector2(0.073, 0), new THREE.Vector2(0.066, 0),
    ], 36);
    bell.rotateX(Math.PI / 2);
    mesh(bellMount, bell, equipment.heatShield);
    mesh(bellMount, new THREE.TorusGeometry(0.07, 0.004, 6, 36), equipment.metal);
    mesh(bellMount, new THREE.CircleGeometry(0.023, 20), equipment.sole, 0, 0, 0.112).rotation.y = Math.PI;
    for (const z of [0.035, 0.055, 0.075]) {
      const ring = mesh(bellMount, new THREE.TorusGeometry(0.066 - z * 0.32, 0.0025, 5, 28), equipment.darkMetal, 0, 0, z);
      ring.name = 'nozzle-cooling-rib';
    }
    nozzles.push(nozzle);
    tube(root, [[side * 0.23, 0.3, 0.05], [side * 0.3, 0.4, 0.13],
      [side * 0.35, 0.13, 0.04], [side * 0.277, 0.03, -0.02]], 0.013, equipment.rubber);
    mesh(root, new THREE.CylinderGeometry(0.021, 0.021, 0.026, 6), equipment.brass,
      side * 0.284, 0.03, -0.02).rotation.z = Math.PI / 2;
    for (const y of [-0.325, 0.31]) {
      box(root, 0.05, 0.055, 0.065, equipment.darkMetal, side * 0.27, y, -0.06, 0.006);
    }
  }
  return { root, nozzles };
}
