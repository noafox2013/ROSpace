import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { baseLocation, baseLayout } from './base.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSpacecraftCollision } from './spacecraft-collision.js';
import { createSpacecraftFlight } from './spacecraft-flight.js';

export const spacecraftLocation = { x: baseLocation.x + 100, z: baseLocation.z - 3.8 * baseLayout.scale };

export function createSpacecraft(scene, terrainHeight) {
  const group = new THREE.Group();
  group.name = 'Kestrel-09';
  const { x, z } = spacecraftLocation;
  let ground = terrainHeight(x, z);
  for (const dx of [-7, 0, 7]) for (const dz of [-7, 0, 7]) ground = Math.max(ground, terrainHeight(x + dx, z + dz));
  group.position.set(x, ground, z);
  scene.add(group);
  const hull = new THREE.MeshStandardMaterial({ color: 0xa5adb0, metalness: 0.38, roughness: 0.62 });
  const armor = new THREE.MeshStandardMaterial({ color: 0xd8d3c3, metalness: 0.24, roughness: 0.67 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x19242b, metalness: 0.75, roughness: 0.4 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xc96730, metalness: 0.45, roughness: 0.62 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9bbfc5, metalness: 0, roughness: 0.13, clearcoat: 1, clearcoatRoughness: 0.07, transparent: true, opacity: 0.23, depthWrite: false, side: THREE.DoubleSide });
  const glow = new THREE.MeshStandardMaterial({ color: 0xc4dfdb, emissive: 0x79b5bf, emissiveIntensity: 0.55 });
  const titanium = new THREE.MeshStandardMaterial({ color: 0x6d7479, metalness: 0.9, roughness: 0.32 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x24282a, metalness: 0.02, roughness: 0.94 });
  const ceramic = new THREE.MeshStandardMaterial({ color: 0x484642, metalness: 0.12, roughness: 0.88 });
  // A soft sky-and-sand reflection gives metal a readable finish without painted highlights.
  const reflectionFaces = Array.from({ length: 6 }, (_, face) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(64, 64);
    const sky = new THREE.Color('#a8b5bc'), horizon = new THREE.Color('#b7a18c'), sand = new THREE.Color('#86513a');
    for (let py = 0; py < 64; py++) for (let px = 0; px < 64; px++) {
      const u = (px + 0.5) / 32 - 1, v = (py + 0.5) / 32 - 1;
      const vertical = (face === 2 ? 1 : face === 3 ? -1 : -v) / Math.sqrt(1 + u * u + v * v);
      const color = horizon.clone().lerp(vertical > 0 ? sky : sand, Math.pow(Math.abs(vertical), 0.6));
      color.convertLinearToSRGB();
      const index = (py * 64 + px) * 4;
      pixels.data[index] = color.r * 255; pixels.data[index + 1] = color.g * 255; pixels.data[index + 2] = color.b * 255; pixels.data[index + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0); return canvas;
  });
  const reflection = new THREE.CubeTexture(reflectionFaces); reflection.colorSpace = THREE.SRGBColorSpace; reflection.needsUpdate = true;
  for (const material of [hull, armor, dark, titanium, glass]) { material.envMap = reflection; material.envMapIntensity = 0.45; }
  const panelCanvas = document.createElement('canvas'); panelCanvas.width = panelCanvas.height = 1024;
  const panelContext = panelCanvas.getContext('2d');
  panelContext.fillStyle = '#c7c8c2'; panelContext.fillRect(0, 0, 1024, 1024);
  let textureSeed = 109;
  const random = () => { textureSeed = (Math.imul(textureSeed, 1664525) + 1013904223) >>> 0; return textureSeed / 4294967296; };
  for (let i = 0; i < 28000; i++) {
    panelContext.fillStyle = i % 3 ? '#2428240b' : '#ffffff12';
    panelContext.fillRect(random() * 1024, random() * 1024, 1 + random() * 5, 1);
  }
  for (let row = 0; row < 4; row++) for (let col = 0; col < 2; col++) {
    const px = col * 512, py = row * 256;
    panelContext.strokeStyle = '#565e60'; panelContext.lineWidth = 2; panelContext.strokeRect(px + 3, py + 3, 506, 250);
    panelContext.strokeStyle = '#eeeee788'; panelContext.lineWidth = 1; panelContext.strokeRect(px + 6, py + 6, 500, 244);
    for (let n = 0; n < 6; n++) {
      const dirt = panelContext.createLinearGradient(0, py + 8, 0, py + 100);
      dirt.addColorStop(0, '#514b3555'); dirt.addColorStop(1, '#514b3500');
      panelContext.fillStyle = dirt; panelContext.fillRect(px + 24 + n * 84, py + 8, 4 + random() * 9, 90);
    }
    for (const dx of [14, 498]) for (let dy = 16; dy < 250; dy += 56) {
      panelContext.fillStyle = '#555955'; panelContext.beginPath(); panelContext.arc(px + dx, py + dy, 2.5, 0, Math.PI * 2); panelContext.fill();
    }
  }
  const panelMap = new THREE.CanvasTexture(panelCanvas); panelMap.colorSpace = THREE.SRGBColorSpace;
  panelMap.anisotropy = 8;
  hull.map = armor.map = panelMap;
  const roughnessCanvas = document.createElement('canvas'); roughnessCanvas.width = roughnessCanvas.height = 1024;
  const roughnessContext = roughnessCanvas.getContext('2d'); roughnessContext.drawImage(panelCanvas, 0, 0);
  const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
  hull.roughnessMap = armor.roughnessMap = roughnessMap;
  hull.bumpMap = armor.bumpMap = roughnessMap; hull.bumpScale = armor.bumpScale = 0.009;
  function mesh(geometry, material, px, py, pz) {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(px, py, pz); part.castShadow = part.receiveShadow = true; group.add(part); return part;
  }
  function box(w, h, d, px, py, pz, material = hull) {
    return mesh(new RoundedBoxGeometry(w, h, d, 1, Math.min(0.09, w / 4, h / 4, d / 4)), material, px, py, pz);
  }
  function rod(from, to, radius, material = titanium) {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
    const delta = end.clone().sub(start);
    const part = mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 10), material, ...start.clone().add(end).multiplyScalar(0.5).toArray());
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return part;
  }
  function ring(radius, tube, px, py, pz, material = titanium) {
    return mesh(new THREE.TorusGeometry(radius, tube, 8, 40), material, px, py, pz);
  }
  function stencil(text, width, height, position, yaw = 0, color = '#d4d3bf') {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.font = 'bold 100px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 128);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    const label = mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: 0.4, roughness: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), ...position);
    label.rotation.y = yaw; label.castShadow = false;
  }
  const cockpitDrop = 0.3;
  const seatDrop = 0.2;
  // Cross sections form a tapered pressure hull, with a broad stern and pointed nose.
  const sections = [[-7, 1.7, 1.05], [-6.5, 2.15, 1.3], [-4.5, 2.65, 1.65], [-1, 2.6, 1.6], [1.7, 2.5, 1.5], [3.8, 2.03, 1.1], [5.6, 1.25, 0.7], [7.6, 0.18, 0.18], [8, 0.045, 0.08]];
  const points = [], indices = [], uvs = [];
  const sides = 12, stride = sides + 1;
  sections.forEach(([pz, width, height], section) => {
    for (let i = 0; i <= sides; i++) {
      const angle = i * Math.PI * 2 / sides;
      const py = 3.1 + Math.sin(angle) * height;
      points.push(Math.cos(angle) * width, py, pz);
      uvs.push(i / sides, section / (sections.length - 1));
    }
  });
  for (let s = 0; s < sections.length - 1; s++) for (let i = 0; i < sides; i++) {
    const a = s * stride + i, b = a + 1, c = a + stride, d = b + stride;
    indices.push(a, b, c, b, d, c);
  }
  const last = (sections.length - 1) * stride;
  for (let i = 1; i < sides - 1; i++) indices.push(0, i + 1, i, last, last + i, last + i + 1);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  // Cut a cabin aperture out of the upper skin instead of letting the hull pass
  // through the seat and controls. Keep the surrounding pressure hull unchanged.
  const aperture = Array.from({ length: 24 }, (_, i) => {
    const angle = i * Math.PI / 12;
    return new THREE.Vector2(Math.cos(angle) * 1.65, 2 + Math.sin(angle) * 2.05);
  });
  const cabinHull = { position: [], normal: [], uv: [] };
  const cabinBoundary = [];
  function emitHullPolygon(polygon) {
    for (let i = 1; i < polygon.length - 1; i++) {
      for (const vertex of [polygon[0], polygon[i], polygon[i + 1]]) {
        for (const attribute of Object.keys(cabinHull)) cabinHull[attribute].push(...vertex[attribute]);
      }
    }
  }
  function splitHullPolygon(polygon, a, b) {
    const inside = [], outside = [];
    const distance = vertex => (b.x - a.x) * (vertex.position[2] - a.y) - (b.y - a.y) * (vertex.position[0] - a.x);
    for (let i = 0; i < polygon.length; i++) {
      const current = polygon[i], next = polygon[(i + 1) % polygon.length];
      const d = distance(current), nextD = distance(next);
      (d >= 0 ? inside : outside).push(current);
      if ((d >= 0) !== (nextD >= 0)) {
        const t = d / (d - nextD), intersection = {};
        for (const attribute of Object.keys(cabinHull)) intersection[attribute] = current[attribute].map((value, k) => THREE.MathUtils.lerp(value, next[attribute][k], t));
        inside.push(intersection); outside.push(intersection);
      }
    }
    return { inside, outside };
  }
  for (let i = 0; i < indices.length; i += 3) {
    let polygon = indices.slice(i, i + 3).map(index => {
      const vertex = {};
      for (const attribute of Object.keys(cabinHull)) {
        const buffer = geometry.getAttribute(attribute);
        vertex[attribute] = Array.from(buffer.array.slice(index * buffer.itemSize, (index + 1) * buffer.itemSize));
      }
      return vertex;
    });
    if (polygon.every(vertex => vertex.position[1] >= 3.1 - 0.001)) {
      for (let edge = 0; edge < aperture.length && polygon.length >= 3; edge++) {
        const split = splitHullPolygon(polygon, aperture[edge], aperture[(edge + 1) % aperture.length]);
        emitHullPolygon(split.outside);
        polygon = split.inside;
      }
      // Preserve the exact cut edges, including every change in hull slope.
      for (let edge = 0; edge < polygon.length; edge++) {
        const a = polygon[edge].position, b = polygon[(edge + 1) % polygon.length].position;
        if (aperture.some((start, i) => {
          const end = aperture[(i + 1) % aperture.length];
          const distance = point => (end.x - start.x) * (point[2] - start.y) - (end.y - start.y) * (point[0] - start.x);
          return Math.abs(distance(a)) < 1e-6 && Math.abs(distance(b)) < 1e-6;
        }) && Math.hypot(a[0] - b[0], a[2] - b[2]) > 1e-6) cabinBoundary.push([a, b]);
      }
    } else emitHullPolygon(polygon);
  }
  const openHull = new THREE.BufferGeometry();
  for (const [attribute, values] of Object.entries(cabinHull)) openHull.setAttribute(attribute, new THREE.Float32BufferAttribute(values, attribute === 'uv' ? 2 : 3));
  geometry.dispose();
  mesh(openHull, hull, 0, 0, 0);
  // A continuous inner wall joins the cut hull to a floor wider than the opening.
  // This closes the side and rear gaps without putting silver skin back inside.
  const liningPositions = [], liningUvs = [];
  const floorBottom = 4.35 - cockpitDrop - 0.12;
  for (const [a, b] of cabinBoundary) {
    const lowerA = [a[0], floorBottom, a[2]], lowerB = [b[0], floorBottom, b[2]];
    liningPositions.push(...a, ...b, ...lowerA, ...b, ...lowerB, ...lowerA);
    liningUvs.push(0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0);
    rod(a, b, 0.035, rubber);
  }
  const liningGeometry = new THREE.BufferGeometry();
  liningGeometry.setAttribute('position', new THREE.Float32BufferAttribute(liningPositions, 3));
  liningGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(liningUvs, 2));
  liningGeometry.computeVertexNormals();
  const lining = new THREE.MeshStandardMaterial({ color: 0x202b30, roughness: 0.9, metalness: 0.08, side: THREE.DoubleSide });
  mesh(liningGeometry, lining, 0, 0, 0);
  // Move the entire cabin together, including glazing, controls and pilot eye position.
  const cockpitPartsStart = group.children.length;
  const cabinFinish = new THREE.MeshStandardMaterial({ color: 0x343f43, roughness: 0.78, metalness: 0.15, envMap: reflection, envMapIntensity: 0.3 });
  const floorShape = new THREE.Shape();
  floorShape.absellipse(0, 0, 1.72, 2.13, 0, Math.PI * 2, false, 0);
  const cabinFloor = mesh(new THREE.ExtrudeGeometry(floorShape, {
    depth: 0.22, steps: 1, bevelEnabled: true, bevelSegments: 3,
    bevelSize: 0.045, bevelThickness: 0.035, curveSegments: 32,
  }), cabinFinish, 0, 4.44, 2);
  cabinFloor.rotation.x = Math.PI / 2;
  // Raised side sills and layered panels give the footwell a recessed shape.
  for (const side of [-1, 1]) {
    const sill = box(0.24, 0.3, 2.45, side * 1.43, 4.57, 1.95, cabinFinish);
    sill.rotation.z = side * -0.15;
    box(0.48, 0.14, 1.6, side * 1.13, 4.5, 2.05, rubber);
    box(0.11, 0.2, 1.3, side * 0.49, 4.53, 2.7, cabinFinish);
    const pedal = box(0.31, 0.075, 0.46, side * 0.23, 4.58, 3.02, titanium);
    pedal.rotation.x = -0.36;
    for (let i = 0; i < 4; i++) {
      const tread = box(0.25, 0.018, 0.025, side * 0.23, 4.64 + i * 0.023, 2.87 + i * 0.065, rubber);
      tread.rotation.x = -0.36;
    }
    for (const pz of [0.75, 1.2, 1.65, 2.1, 2.55, 3]) {
      box(0.42, 0.035, 0.025, side * 0.91, 4.51, pz, dark);
    }
  }
  box(1.28, 0.13, 1.13, 0, 4.5, 0.98, cabinFinish);
  for (const px of [-0.46, 0.46]) box(0.075, 0.045, 0.87, px, 4.59, 0.98, titanium);
  const footMat = box(0.82, 0.025, 1.12, 0, 4.49, 2.35, rubber);
  for (let i = 0; i < 10; i++) box(0.73, 0.014, 0.025, 0, 4.515, footMat.position.z - 0.47 + i * 0.1, cabinFinish);
  const canopyPartsStart = group.children.length;
  mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 4.45, 2).scale.set(1.8, 1.65, 2.25);
  for (const pz of [0.6, 3.2]) {
    const rib = mesh(new THREE.TorusGeometry(1, 0.045, 8, 32, Math.PI), armor, 0, 4.45, pz);
    rib.scale.set(1.65, 1.3, 1);
  }
  box(0.08, 0.08, 4.3, 0, 6.04, 2, armor);
  const canopyParts = group.children.slice(canopyPartsStart);
  const seatPartsStart = group.children.length;
  box(1.2, 1.05, 0.25, 0, 4.9, 0.5, dark);
  box(1.1, 0.2, 1, 0, 4.55, 1.05, dark);
  const leather = new THREE.MeshStandardMaterial({ color: 0x454b48, roughness: 0.96 });
  box(0.95, 0.15, 0.8, 0, 4.73, 1.05, leather);
  box(0.97, 0.88, 0.12, 0, 4.98, 0.66, leather);
  box(0.65, 0.32, 0.21, 0, 5.3, 0.62, rubber);
  // Sculpted cushions, side bolsters and armrests make the pilot seat visible through the canopy.
  for (const side of [-1, 1]) {
    box(0.15, 0.3, 0.85, side * 0.48, 4.82, 1.05, leather);
    const bolster = box(0.16, 0.84, 0.18, side * 0.48, 4.98, 0.76, leather); bolster.rotation.z = side * -0.08;
    box(0.12, 0.1, 0.72, side * 0.65, 5.03, 1.1, rubber);
    rod([side * 0.65, 4.55, 0.9], [side * 0.65, 4.98, 0.9], 0.035);
  }
  box(0.16, 0.09, 0.06, 0, 4.82, 1.43, titanium);
  for (const part of group.children.slice(seatPartsStart)) part.position.y += 0.25 - seatDrop;
  for (const side of [-1, 1]) {
    box(0.1, 0.72, 0.04, side * 0.28, 5.1, 0.75, dark);
    box(0.07, 0.09, 0.05, side * 0.28, 4.87, 0.8, titanium);
    box(0.36, 0.18, 1.9, side * 1.15, 4.74, 1.9, dark);
    rod([side * 0.69, 4.82, 2.25], [side * 0.69, 5.12, 2.4], 0.055, rubber);
    for (let row = 0; row < 7; row++) for (let col = 0; col < 2; col++) {
      const px = side * (1.07 + col * 0.14), pz = 1.2 + row * 0.2;
      box(0.065, 0.025, 0.11, px, 4.85, pz, rubber);
      rod([px, 4.86, pz], [px, 4.91, pz + 0.025], 0.012);
    }
    rod([side * 1.4, 4.55, 0.55], [side * 1.4, 4.55, 3], 0.04);
  }
  const frontScreenDrop = 0.2;
  box(0.95, 0.35, 0.7, 0, 4.75 - frontScreenDrop, 3.3, dark);
  const screenMounts = [
    { x: -1.13, z: 2.25, label: 'REACTOR / IDLE' },
    { x: 0, z: 3.28, drop: frontScreenDrop, label: 'KESTREL 09' },
    { x: 1.13, z: 2.25, label: 'NAV / MESA' },
  ];
  for (const { x: px, z: pz, drop = 0, label } of screenMounts) {
    const display = document.createElement('canvas'); display.width = 256; display.height = 160;
    const ctx = display.getContext('2d');
    ctx.fillStyle = '#051b24'; ctx.fillRect(0, 0, 256, 160);
    ctx.strokeStyle = '#397a8b'; ctx.lineWidth = 1;
    for (let i = 20; i < 256; i += 24) { ctx.beginPath(); ctx.moveTo(i, 32); ctx.lineTo(i, 145); ctx.stroke(); }
    for (let i = 40; i < 150; i += 20) { ctx.beginPath(); ctx.moveTo(12, i); ctx.lineTo(244, i); ctx.stroke(); }
    ctx.fillStyle = '#87e9e2'; ctx.font = 'bold 18px monospace';
    ctx.fillText(label, 14, 23);
    ctx.font = '14px monospace'; ctx.fillText('LANDED    SYS OK', 14, 148);
    ctx.strokeStyle = '#c8f9ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(128, 85, 31, 0, Math.PI * 2); ctx.moveTo(90, 85); ctx.lineTo(166, 85); ctx.stroke();
    const map = new THREE.CanvasTexture(display); map.colorSpace = THREE.SRGBColorSpace;
    rod([px, 4.8 - drop, pz], [px, 5.05 - drop, pz], 0.045, dark);
    const panelStart = group.children.length;
    box(0.86, 0.62, 0.1, 0, 0, 0, dark);
    mesh(new THREE.PlaneGeometry(0.75, 0.47), new THREE.MeshBasicMaterial({ map, toneMapped: false }), 0, 0.035, 0.056);
    for (let i = 0; i < 3; i++) box(0.055, 0.035, 0.025, -0.18 + i * 0.18, -0.25, 0.065, orange);
    const mount = new THREE.Object3D();
    mount.position.set(px, 5.05 - drop, pz);
    mount.lookAt(0, 5.75 - seatDrop, 1.8);
    for (const part of group.children.slice(panelStart)) {
      part.scale.multiplyScalar(0.75);
      part.position.multiplyScalar(0.75).applyQuaternion(mount.quaternion).add(mount.position);
      part.quaternion.premultiply(mount.quaternion);
    }
  }
  for (const part of group.children.slice(cockpitPartsStart)) part.position.y -= cockpitDrop;
  // Rear-hinged canopy stays separate from the static construction batches.
  const canopy = new THREE.Group(); canopy.name = 'cockpit-canopy';
  canopy.position.set(0, 4.45 - cockpitDrop, -0.25);
  group.add(canopy);
  for (const part of canopyParts) {
    part.position.sub(canopy.position);
    canopy.add(part);
  }
  let canopyClosure = 0, canopyTarget = 0;
  const canopyDuration = 2.8;
  function updateCanopy(delta) {
    const step = Math.max(0, delta) / canopyDuration;
    canopyClosure += THREE.MathUtils.clamp(canopyTarget - canopyClosure, -step, step);
    const eased = THREE.MathUtils.smoothstep(canopyClosure, 0, 1);
    canopy.rotation.x = -1.1 * (1 - eased);
  }
  function setBoarded(boarded, immediate = false) {
    canopyTarget = boarded ? 1 : 0;
    if (immediate) canopyClosure = canopyTarget;
    updateCanopy(0);
  }
  updateCanopy(0);

  function landingGear(attachX, footX, pz) {
    const footY = terrainHeight(x + footX, z + pz) - ground + 0.12;
    const jointX = THREE.MathUtils.lerp(attachX, footX, 0.73);
    const upper = [attachX, 2.1, pz], joint = [jointX, 0.85, pz - 0.25], foot = [footX, footY + 0.15, pz];
    rod(upper, joint, 0.13, dark); rod(joint, foot, 0.085);
    rod([attachX, 1.7, pz + 0.65], foot, 0.06, titanium);
    rod([attachX, 1.7, pz + 0.48], [jointX, 0.6, pz + 0.1], 0.095, dark);
    mesh(new THREE.SphereGeometry(0.18, 12, 8), titanium, ...joint);
    box(1.15, 0.16, 1.55, footX, footY, pz, dark);
    box(0.82, 0.05, 1.25, footX, footY + 0.1, pz, titanium);
    for (let n = 0; n < 5; n++) box(0.88, 0.025, 0.045, footX, footY + 0.14, pz - 0.5 + n * 0.25, rubber);
    box(0.58, 0.15, 1.1, attachX, 1.95, pz, armor);
  }
  // Tricycle undercarriage: two rear legs and one central nose leg.
  landingGear(0, 0, 4.8);
  for (const side of [-1, 1]) {
    // Swept wings, armored engine pods, turbine rings and recessed exhaust cores.
    const wing = new THREE.Shape();
    wing.moveTo(2 * side, 2); wing.lineTo(7 * side, -4); wing.lineTo(7 * side, -6); wing.lineTo(2 * side, -5); wing.closePath();
    const wingMesh = mesh(new THREE.ExtrudeGeometry(wing, { depth: 0.22, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1, steps: 1 }), armor, 0, 2.8, 0);
    wingMesh.rotation.x = Math.PI / 2;
    const engineX = side * 4.15;
    const housing = mesh(new THREE.CylinderGeometry(0.88, 1.04, 6.7, 32), hull, engineX, 3.1, -3.9); housing.rotation.x = Math.PI / 2;
    for (const pz of [-6.7, -4.7, -2.7, -0.65]) ring(0.99, 0.065, engineX, 3.1, pz);
    box(1.2, 0.15, 4.8, engineX, 4.08, -3.6, armor);
    // Recessed intake with stator vanes; the rear bell has a real inner liner.
    const intake = mesh(new THREE.CircleGeometry(0.79, 32), dark, engineX, 3.1, -0.53);
    ring(0.84, 0.09, engineX, 3.1, -0.52);
    for (let blade = 0; blade < 12; blade++) {
      const a = blade * Math.PI / 6;
      rod([engineX + Math.cos(a) * 0.23, 3.1 + Math.sin(a) * 0.23, -0.5], [engineX + Math.cos(a + 0.22) * 0.74, 3.1 + Math.sin(a + 0.22) * 0.74, -0.5], 0.025, titanium);
    }
    mesh(new THREE.SphereGeometry(0.23, 16, 8), titanium, engineX, 3.1, -0.43).scale.z = 0.5;
    const nozzleProfile = [[0.51, 0.6], [0.57, 0.36], [0.68, 0.05], [0.87, -0.42], [0.96, -0.63], [0.99, -0.63], [0.93, -0.38], [0.74, 0.12], [0.64, 0.42], [0.61, 0.6]].map(([r, h]) => new THREE.Vector2(r, h));
    const nozzle = mesh(new THREE.LatheGeometry(nozzleProfile, 48), titanium, engineX, 3.1, -7.55); nozzle.rotation.x = Math.PI / 2;
    ring(0.97, 0.035, engineX, 3.1, -8.18, ceramic);
    const core = mesh(new THREE.CircleGeometry(0.48, 32), ceramic, engineX, 3.1, -7); core.rotation.y = Math.PI;
    for (let i = 0; i < 18; i++) {
      const a = i * Math.PI / 9;
      rod([engineX + Math.cos(a) * 0.64, 3.1 + Math.sin(a) * 0.64, -7.2], [engineX + Math.cos(a) * 0.95, 3.1 + Math.sin(a) * 0.95, -8.1], 0.018, ceramic);
    }
    for (let i = 0; i < 10; i++) box(0.95, 0.035, 0.08, engineX, 4.18, -5.7 + i * 0.32, dark);
    rod([side * 2.4, 3.9, -4.8], [engineX, 3.9, -4.8], 0.09);
    rod([side * 2.4, 3.7, -2.1], [engineX, 3.7, -2.1], 0.06, orange);
    landingGear(side * 2.1, side * 2.85, -4.8);
    for (let i = 0; i < 7; i++) box(0.045, 0.08, 0.5, side * 2.57, 3.25, -4.8 + i * 0.8, dark);
    box(0.16, 0.12, 2.4, side * 2.45, 3.8, 0, orange);
    const nav = new THREE.MeshStandardMaterial({ color: side < 0 ? 0xb92e27 : 0x3ca36b, emissive: side < 0 ? 0xb92e27 : 0x3ca36b, emissiveIntensity: 0.9 });
    box(0.1, 0.085, 0.25, side * 6.8, 2.8, -4.7, nav);
    for (let n = 0; n < 5; n++) {
      box(0.62, 0.07, 0.85, side * (3 + n * 0.6), 2.86, -4.9, ceramic);
    }
    stencil('KESTREL  /  09', 2.7, 0.52, [side * 2.64, 3.38, -2.65], side * Math.PI / 2);
    stencil('CAUTION  ·  HOT', 1.4, 0.26, [engineX + side * 1.03, 3.17, -5.4], side * Math.PI / 2, '#d9ab62');
    // Reaction-control thrusters point away from the fuselage in three axes.
    for (const pz of [-5.5, 4.2]) {
      const rcsX = side * (pz > 0 ? 1.8 : 2.6);
      box(0.5, 0.43, 0.65, rcsX, 3.2, pz, dark);
      for (const offset of [-0.17, 0.17]) {
        const jet = mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.18, 12, 1, true), titanium, rcsX + side * 0.3, 3.2, pz + offset); jet.rotation.z = Math.PI / 2;
      }
    }
  }
  // Exterior maintenance hatch.
  box(0.12, 1.85, 1.5, -2.56, 3.1, -0.8, dark);
  box(0.14, 1.52, 1.2, -2.64, 3.1, -0.8, armor);
  box(0.08, 0.25, 0.48, -2.74, 3.15, -0.8, dark);
  rod([-2.8, 2.88, -0.55], [-2.8, 3.35, -0.55], 0.035);
  for (const pz of [-1.28, -0.32]) for (const py of [2.58, 3.6]) box(0.18, 0.15, 0.14, -2.72, py, pz, titanium);
  stencil('ACCESS  01', 0.95, 0.2, [-2.724, 3.64, -0.8], -Math.PI / 2, '#364147');
  box(0.15, 0.1, 1.6, -2.65, 4.05, -0.8, glow);
  // Vertical cockpit access ladder, with rungs facing the approach from port.
  const ladderX = -2.95, ladderZ = 2;
  const ladderBottom = terrainHeight(x + ladderX, z + ladderZ) - ground + 0.08;
  for (const railZ of [ladderZ - 0.4, ladderZ + 0.4]) {
    rod([ladderX, ladderBottom, railZ], [ladderX, 4.65, railZ], 0.045, titanium);
    for (const height of [1.8, 3.9]) rod([ladderX, height, railZ], [-2.35, height, railZ], 0.035, dark);
    box(0.14, 0.08, 0.16, ladderX, ladderBottom, railZ, rubber);
  }
  const rungCount = Math.ceil((4.02 - ladderBottom) / 0.3);
  for (let i = 1; i <= rungCount; i++) {
    const height = THREE.MathUtils.lerp(ladderBottom, 4.02, i / rungCount);
    rod([ladderX, height, ladderZ - 0.4], [ladderX, height, ladderZ + 0.4], 0.035, titanium);
    rod([ladderX - 0.015, height + 0.012, ladderZ - 0.28], [ladderX - 0.015, height + 0.012, ladderZ + 0.28], 0.038, rubber);
  }
  box(0.55, 0.08, 0.9, -2.72, 4.02, ladderZ, dark);
  box(0.04, 0.035, 0.5, ladderX - 0.03, 4.09, ladderZ, glow);
  // Insulated dorsal service spine, radiator louvers and protected cable runs.
  box(1.6, 0.24, 4.5, 0, 4.7, -3.4, dark);
  for (let i = 0; i < 12; i++) {
    const fin = box(1.48, 0.1, 0.16, 0, 4.89, -5.35 + i * 0.33, titanium); fin.rotation.x = -0.28;
  }
  for (const side of [-1, 1]) {
    rod([side * 0.98, 4.63, -5.8], [side * 0.98, 4.63, -1.2], 0.055, dark);
    for (let i = 0; i < 6; i++) box(0.2, 0.13, 0.1, side * 0.98, 4.63, -5.6 + i * 0.8, titanium);
    box(0.8, 0.08, 1.15, side * 1.6, 4.48, -3.2, armor);
  }
  box(1.45, 0.7, 0.2, 0, 3.3, -7.08, dark);
  stencil('MESA  /  09', 1.3, 0.3, [0, 3.4, -7.2], Math.PI);
  rod([0.7, 4.5, -5.5], [0.7, 5.25, -5.5], 0.045);
  mesh(new THREE.SphereGeometry(0.16, 16, 8), armor, 0.7, 5.28, -5.5).scale.y = 0.35;
  rod([-0.65, 4.6, -4.7], [-0.65, 5.8, -5], 0.018);
  const sensor = mesh(new THREE.SphereGeometry(0.25, 20, 12), dark, 0, 3.43, 7.3); sensor.scale.set(0.8, 0.7, 1);
  ring(0.12, 0.018, 0, 3.44, 7.52, titanium);
  // Bake static details into material batches to keep the detailed model inexpensive.
  const batches = new Map();
  for (const part of [...group.children]) {
    if (!part.isMesh || part.material.transparent) continue;
    if (!batches.has(part.material)) batches.set(part.material, []);
    batches.get(part.material).push(part);
  }
  for (const [material, parts] of batches) {
    const geometries = parts.map(part => {
      part.updateMatrix();
      const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
      geometry.applyMatrix4(part.matrix); return geometry;
    });
    const merged = mergeGeometries(geometries, false);
    if (!merged) throw new Error('Spacecraft geometry batching failed');
    const batch = new THREE.Mesh(merged, material); batch.castShadow = batch.receiveShadow = true;
    group.add(batch);
    for (const part of parts) { group.remove(part); part.geometry.dispose(); }
    for (const geometry of geometries) geometry.dispose();
  }
  const cockpit = new THREE.Vector3(0, 5.75 - cockpitDrop - seatDrop, 1.8).add(group.position);
  const cockpitGroundHeight = cockpit.y;
  const exit = new THREE.Vector3(x - 3.9, 0, z + ladderZ); exit.y = terrainHeight(exit.x, exit.z) + 1;
  const flight = createSpacecraftFlight();
  const resolveGroundContact = createSpacecraftCollision({ x, z }, ground, terrainHeight);
  function update(delta, controls = {}) {
    updateCanopy(delta);
    flight.update(delta, { ...controls, canopyClosed: canopyClosure === 1 });
    group.position.y = ground + flight.state.altitude;
    cockpit.y = cockpitGroundHeight + flight.state.altitude;
  }
  function resetFlight() {
    flight.reset(); group.position.y = ground; cockpit.y = cockpitGroundHeight;
  }
  function resolve(player, height, previous) {
    const altitude = flight.state.altitude;
    player.y -= altitude;
    const corrected = resolveGroundContact(player, height, { x: previous.x, y: previous.y - altitude, z: previous.z });
    player.y += altitude;
    return corrected === height ? height : corrected + altitude;
  }
  return { group, cockpit, exit, canopy, flight: flight.state, isLanded: flight.isLanded, resetFlight, isCanopyOpen: () => canopyClosure === 0, isCanopyClosed: () => canopyClosure === 1, update, setBoarded, resolve, nearEntrance: player => flight.isLanded() && Math.hypot(player.x - exit.x, player.z - exit.z) < 2 && Math.abs(player.y - exit.y) < 2 };
}
