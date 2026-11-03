import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// One tile represents 8 cm of woven outer restraint fabric. Colour, relief and
// roughness share the same threads, so grazing light reveals actual weave.
export function createSuitFabric(renderer) {
  const size = 512;
  const canvases = Array.from({ length: 3 }, () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    return canvas;
  });
  const contexts = canvases.map(canvas => canvas.getContext('2d'));
  const pixels = contexts.map(context => context.createImageData(size, size));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const warp = Math.cos(x * Math.PI / 4);
      const weft = Math.cos(y * Math.PI / 4);
      const over = ((x >> 3) + (y >> 3)) % 2 === 0;
      const thread = over ? warp * 0.7 + weft * 0.25 : weft * 0.7 + warp * 0.25;
      const fiber = Math.sin(x * 2.1 + Math.sin(y * 0.37)) * Math.sin(y * 1.9) * 0.09;
      const mottling = Math.sin(x * Math.PI * 2 / size + Math.sin(y * Math.PI * 4 / size))
        * Math.cos(y * Math.PI * 6 / size) * 0.5 + 0.5;
      const index = (y * size + x) * 4;
      const tone = 231 + thread * 6 + fiber * 12 - mottling * 10;
      pixels[0].data.set([tone, tone - 3, tone - 10, 255], index);
      const height = 128 + thread * 78 + fiber * 42;
      pixels[1].data.set([height, height, height, 255], index);
      const roughness = 221 + thread * 17 + mottling * 12;
      pixels[2].data.set([roughness, roughness, roughness, 255], index);
    }
  }
  const textures = canvases.map((canvas, index) => {
    contexts[index].putImageData(pixels[index], 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.setScalar(12.5);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  });
  textures[0].colorSpace = THREE.SRGBColorSpace;
  const make = (color, bumpScale, sheen) => new THREE.MeshPhysicalMaterial({
    color, map: textures[0], bumpMap: textures[1], roughnessMap: textures[2],
    bumpScale, roughness: 1, metalness: 0, sheen,
    sheenColor: new THREE.Color(0xf3ead7), sheenRoughness: 0.93,
    vertexColors: true,
  });
  return {
    shell: make(0xf4f1e6, 0.0013, 0.38),
    panel: make(0xe3dfd1, 0.001, 0.3),
    reinforcement: make(0xa7a89e, 0.0009, 0.22),
    thread: new THREE.MeshStandardMaterial({ color: 0xc9bd9f, roughness: 1 }),
    seam: new THREE.MeshStandardMaterial({ color: 0xb5ae9b, roughness: 1 }),
  };
}

// Dense longitudinal rings let folds alter the silhouette instead of drawing
// dark hoops on a smooth capsule. Off-axis creases gather near the joints.
export function createClothCapsule(radius, length, seed = 0, fit = {}) {
  const half = length / 2 + radius;
  const rows = length === 0 ? 40 : 80;
  const points = [];
  for (let row = 0; row <= rows; row++) {
    const y = -half + row / rows * half * 2;
    const capY = Math.max(0, Math.abs(y) - length / 2);
    points.push(new THREE.Vector2(Math.sqrt(Math.max(0, radius * radius - capY * capY)), y));
  }
  const geometry = new THREE.LatheGeometry(points, length === 0 ? 40 : 56);
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const colors = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const angle = uv.getX(i) * Math.PI * 2;
    const v = THREE.MathUtils.clamp((y + half) / (half * 2), 0, 1);
    const envelope = Math.pow(Math.max(0, Math.sin(v * Math.PI)), 0.65);
    const gathered = 0.35 + Math.exp(-Math.pow((v - 0.24) / 0.15, 2)) * 0.65
      + Math.exp(-Math.pow((v - 0.77) / 0.13, 2)) * 0.5;
    let crease = 0;
    const folds = length === 0 ? 3 : 7;
    for (let fold = 0; fold < folds; fold++) {
      const center = 0.13 + fold * 0.74 / (folds - 1)
        + Math.sin(angle * 2 + fold * 1.7 + seed) * 0.036;
      const distance = (v - center) / (length === 0 ? 0.034 : 0.022);
      const lip = Math.exp(-distance * distance / 2)
        - 0.55 * Math.exp(-(((distance - 1.5) / 0.85) ** 2) / 2);
      // Interrupted folds gather at different angles, rather than encircling
      // the limb like rigid corrugation.
      crease += lip * (0.48 + Math.sin(angle * 3 + fold * 2.3 + seed) * 0.4);
    }
    const drape = Math.cos(angle * 5 + v * 5 + seed) * 0.013;
    const offset = envelope * (crease * gathered * 0.09 + drape);
    const tailoring = THREE.MathUtils.lerp(fit.lower ?? 1, fit.upper ?? 1,
      THREE.MathUtils.smoothstep(v, 0.1, 0.9));
    positions.setXYZ(i, x * (1 + offset) * tailoring, y, z * (1 + offset) * tailoring);
    // UVs in metres keep the weave consistent between torso and limbs.
    uv.setXY(i, uv.getX(i) * Math.PI * 2 * radius, y + half);
    const dirt = (1 - v) ** 3 * 0.12
      + (1 - Math.sin(v * 53 + Math.sin(angle * 3 + seed) * 1.6 + seed)) * envelope * 0.015;
    colors.push(1 - dirt * 0.65, 1 - dirt * 0.85, 1 - dirt);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function addFabricSeam(parent, points, fabric, thickness = 0.0016) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), false, 'catmullrom', 0.1);
  const seam = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, thickness, 4, false), fabric.seam);
  parent.add(seam);
  const count = Math.max(2, Math.floor(curve.getLength() / 0.012));
  const stitches = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 5, 4), fabric.thread, count);
  const transform = new THREE.Object3D();
  const axis = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    transform.position.copy(curve.getPointAt(t));
    transform.position.z += thickness;
    transform.quaternion.setFromUnitVectors(axis, curve.getTangentAt(t));
    transform.scale.set(0.0011, 0.0032, 0.001);
    transform.updateMatrix();
    stitches.setMatrixAt(i, transform.matrix);
  }
  parent.add(stitches);
}

export function createPaddedPanel(width, height, depth, fabric, material = fabric.panel) {
  const geometry = new RoundedBoxGeometry(width, height, depth, 5, Math.min(depth * 0.45, 0.018));
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const colors = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const bulge = Math.max(0, 1 - (x / (width / 2)) ** 2)
      * Math.max(0, 1 - (y / (height / 2)) ** 2);
    positions.setZ(i, z + Math.sign(z) * bulge * depth * 0.24);
    uv.setXY(i, x + width / 2, y + height / 2);
    colors.push(1, 1, 1);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const panel = new THREE.Mesh(geometry, material);
  const x = width / 2 - 0.009, y = height / 2 - 0.009, z = depth / 2 + 0.0015;
  const corner = Math.min(0.012, width * 0.1, height * 0.1);
  addFabricSeam(panel, [
    [-x + corner, -y, z], [-x, -y + corner, z], [-x, 0, z],
    [-x, y - corner, z], [-x + corner, y, z], [0, y, z],
    [x - corner, y, z], [x, y - corner, z], [x, 0, z],
    [x, -y + corner, z], [x - corner, -y, z], [0, -y, z], [-x + corner, -y, z],
  ], fabric);
  panel.castShadow = true;
  return panel;
}
