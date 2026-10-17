import * as THREE from 'three';

// Local +Z points out of the mouth. The tail disappears beneath the desert.
export function createSandworm(terrainHeight) {
  const worm = new THREE.Group();
  worm.name = 'sandworm';
  const skin = new THREE.MeshStandardMaterial({
    color: 0x69412a, roughness: 0.97, emissive: 0x30190c, emissiveIntensity: 0.16,
  });
  const armor = new THREE.MeshStandardMaterial({
    color: 0x98633b, roughness: 0.88, emissive: 0x422612, emissiveIntensity: 0.12,
  });
  const creases = new THREE.MeshStandardMaterial({ color: 0x342116, roughness: 1 });
  const horn = new THREE.MeshStandardMaterial({ color: 0x493024, roughness: 0.84 });
  const gums = new THREE.MeshStandardMaterial({ color: 0x43201b, roughness: 0.91 });
  const teeth = new THREE.MeshStandardMaterial({ color: 0xd8bd88, roughness: 0.73 });
  const throat = new THREE.MeshStandardMaterial({ color: 0x090504, roughness: 1 });
  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffa344, emissive: 0xf16a12, emissiveIntensity: 1.6, roughness: 0.35,
  });
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  const segmentCount = 27;
  const body = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 24, 16), skin, segmentCount);
  const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.1, 8, 32), armor, segmentCount);
  const seams = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.045, 6, 32), creases, segmentCount);
  const spines = new THREE.InstancedMesh(new THREE.ConeGeometry(0.24, 1.25, 6), horn, segmentCount * 3);
  for (const mesh of [body, rings, seams, spines]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // The animated instance positions span the entire worm, including its buried tail.
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, -12), 26);
    worm.add(mesh);
  }

  const head = new THREE.Group();
  head.name = 'sandworm-head';
  worm.add(head);
  const addMesh = (geometry, material, x, y, z, parent = head) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  addMesh(new THREE.TorusGeometry(2.65, 0.58, 14, 48), skin, 0, 0, 0);
  addMesh(new THREE.TorusGeometry(2.42, 0.55, 12, 40), skin, 0, 0, -1.08);
  addMesh(new THREE.TorusGeometry(2.68, 0.2, 10, 48), armor, 0, 0, 0.48);
  addMesh(new THREE.TorusGeometry(2.29, 0.19, 10, 48), gums, 0, 0, 0.26);
  // Nested dark rings give the open maw depth, with no solid face behind the teeth.
  for (let i = 0; i < 5; i += 1) {
    addMesh(new THREE.TorusGeometry(2.05 - i * 0.32, 0.19, 8, 40), gums, 0, 0, -0.24 - i * 0.35);
  }
  addMesh(new THREE.CircleGeometry(0.85, 32), throat, 0, 0, -1.85);

  const toothCount = 64;
  const fangs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 1, 7), teeth, toothCount);
  fangs.castShadow = true;
  head.add(fangs);
  for (let i = 0; i < toothCount; i += 1) {
    const inner = i >= 36;
    const index = inner ? i - 36 : i;
    const angle = index / (inner ? 28 : 36) * Math.PI * 2 + (inner ? 0.09 : 0);
    const radius = inner ? 1.58 : 2.22;
    dummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, inner ? -0.45 : 0.61);
    direction.set(-Math.cos(angle), -Math.sin(angle), 0.6).normalize();
    dummy.quaternion.setFromUnitVectors(up, direction);
    dummy.scale.setScalar(1);
    dummy.scale.y = (inner ? 0.7 : 1.12) + Math.sin(i * 5.7) * 0.18;
    dummy.updateMatrix();
    fangs.setMatrixAt(i, dummy.matrix);
  }
  const brow = addMesh(new THREE.SphereGeometry(1, 24, 12), armor, 0, 2.29, -0.45);
  brow.scale.set(2.15, 0.77, 1.25);
  for (const side of [-1, 1]) {
    const cheek = addMesh(new THREE.SphereGeometry(1, 20, 12), armor, side * 2.52, 0.1, -0.6);
    cheek.scale.set(0.73, 1.7, 1.24);
    for (let i = 0; i < 2; i += 1) {
      const socket = addMesh(new THREE.SphereGeometry(0.32, 12, 8), creases, side * (1.55 + i * 0.48), 2.04 - i * 0.29, 0.53);
      socket.scale.set(1.2, 0.65, 0.7);
      const eye = addMesh(new THREE.SphereGeometry(0.16, 12, 8), eyeMaterial, socket.position.x, socket.position.y, 0.73);
      eye.scale.y = 0.5;
    }
    const tusk = addMesh(new THREE.ConeGeometry(0.4, 2.5, 8), horn, side * 2.53, 2.2, -0.9);
    tusk.rotation.z = -side * 0.45;
  }

  const sandCount = 240;
  const sandPositions = new Float32Array(sandCount * 3);
  const sandGeometry = new THREE.BufferGeometry();
  sandGeometry.setAttribute('position', new THREE.BufferAttribute(sandPositions, 3));
  const sandMaterial = new THREE.PointsMaterial({
    color: 0xc39464, size: 0.18, transparent: true, opacity: 0.66, depthWrite: false,
  });
  const sand = new THREE.Points(sandGeometry, sandMaterial);
  sand.name = 'sandworm-sand';
  sand.frustumCulled = false;
  worm.add(sand);
  let time = 0;
  let rise = 1;

  function pose() {
    const groundY = terrainHeight(worm.position.x, worm.position.z);
    worm.position.y = groundY - (1 - rise) * 12;
    for (let i = 0; i < segmentCount; i += 1) {
      const fraction = i / (segmentCount - 1);
      const radius = 2.7 * (1 - Math.pow(fraction, 2) * 0.88);
      const sway = Math.sin(time * 1.45 - i * 0.31) * (0.14 + fraction * 1.9);
      const height = 6.3 + Math.sin(fraction * Math.PI) * 4.8 - Math.pow(fraction, 1.55) * 10.5;
      dummy.position.set(sway, height + Math.sin(time * 1.25 - i * 0.25) * 0.25, -2 - i * 0.95);
      dummy.rotation.set(-0.1 + fraction * 0.55, Math.cos(time * 1.45 - i * 0.31) * 0.08, 0);
      dummy.scale.set(radius, radius * 0.91, 0.78);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
      dummy.scale.set(radius, radius * 0.91, radius * 0.68);
      dummy.position.z += 0.33;
      dummy.updateMatrix();
      rings.setMatrixAt(i, dummy.matrix);
      dummy.position.z -= 0.18;
      dummy.updateMatrix();
      seams.setMatrixAt(i, dummy.matrix);
      for (let row = 0; row < 3; row += 1) {
        const angle = (row - 1) * 0.92;
        dummy.position.set(sway + Math.sin(angle) * radius, height + Math.cos(angle) * radius * 0.9, -2 - i * 0.95);
        dummy.rotation.set(-0.3, 0, -angle);
        dummy.scale.setScalar(0.45 + (1 - fraction) * 0.75);
        dummy.updateMatrix();
        spines.setMatrixAt(i * 3 + row, dummy.matrix);
      }
    }
    for (const mesh of [body, rings, seams, spines]) mesh.instanceMatrix.needsUpdate = true;
    head.position.set(Math.sin(time * 1.45) * 0.14, 6.3 + Math.sin(time * 1.25) * 0.25, 0.75);
    head.rotation.set(-0.12 + Math.sin(time * 0.7) * 0.06, Math.sin(time * 0.8) * 0.07, Math.sin(time) * 0.035);
    const cos = Math.cos(worm.rotation.y);
    const sin = Math.sin(worm.rotation.y);
    for (let i = 0; i < sandCount; i += 1) {
      const life = (time * 0.48 + i * 0.6180339) % 1;
      const angle = i * 2.39996;
      const radius = 2 + life * (3 + (i % 7) * 0.4);
      const x = Math.cos(angle) * radius;
      const z = -21 + Math.sin(angle) * radius * 1.8;
      const surface = terrainHeight(worm.position.x + x * cos + z * sin, worm.position.z - x * sin + z * cos);
      sandPositions[i * 3] = x;
      sandPositions[i * 3 + 1] = surface - worm.position.y + 0.1 + Math.sin(life * Math.PI) * (1.1 + (i % 5) * 0.32);
      sandPositions[i * 3 + 2] = z;
    }
    sandGeometry.attributes.position.needsUpdate = true;
    sandMaterial.opacity = rise * 0.66;
  }

  function reset(player, yaw = Math.PI) {
    time = 0;
    rise = 1;
    worm.position.set(player.x + Math.sin(yaw) * 34 - Math.cos(yaw) * 7, 0,
      player.z + Math.cos(yaw) * 34 + Math.sin(yaw) * 7);
    worm.rotation.y = Math.atan2(player.x - worm.position.x, player.z - worm.position.z) + 0.55;
    pose();
  }

  function update(delta, player, yaw) {
    time += delta;
    // A long surface phase gives time to explore; the worm then dives and resurfaces.
    const cycle = time % 30;
    rise = cycle < 20 ? 1 : cycle < 24 ? 1 - THREE.MathUtils.smoothstep(cycle, 20, 24)
      : THREE.MathUtils.smoothstep(cycle, 26, 30);
    const dx = player.x - worm.position.x;
    const dz = player.z - worm.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 150 && rise < 0.01) {
      // Rejoin a travelling player while entirely underground.
      worm.position.x = player.x + Math.sin(yaw) * 46;
      worm.position.z = player.z + Math.cos(yaw) * 46;
      worm.rotation.y = yaw + Math.PI;
    } else {
      const targetYaw = Math.atan2(dx, dz) + 0.55 + Math.sin(time * 0.28) * 0.14;
      const turn = Math.atan2(Math.sin(targetYaw - worm.rotation.y), Math.cos(targetYaw - worm.rotation.y));
      worm.rotation.y += turn * (1 - Math.exp(-delta * 0.38));
      const speed = distance > 29 ? 1.45 : distance < 22 ? -0.8 : 0.18;
      worm.position.x += Math.sin(worm.rotation.y) * speed * delta * rise;
      worm.position.z += Math.cos(worm.rotation.y) * speed * delta * rise;
    }
    pose();
    // Solid surfaced segments keep the explorer from walking through the creature.
    const cos = Math.cos(worm.rotation.y);
    const sin = Math.sin(worm.rotation.y);
    for (let i = 0; i < segmentCount; i += 1) {
      body.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
      const centerY = worm.position.y + dummy.position.y;
      if (player.y + 1.2 < centerY - dummy.scale.y || player.y - 1 > centerY + dummy.scale.y) continue;
      const x = worm.position.x + dummy.position.x * cos + dummy.position.z * sin;
      const z = worm.position.z - dummy.position.x * sin + dummy.position.z * cos;
      const offsetX = player.x - x;
      const offsetZ = player.z - z;
      const separation = Math.hypot(offsetX, offsetZ);
      const radius = dummy.scale.x + 0.5;
      if (separation < radius) {
        player.x = x + (separation > 0.001 ? offsetX / separation : cos) * radius;
        player.z = z + (separation > 0.001 ? offsetZ / separation : -sin) * radius;
      }
    }
  }

  return { object: worm, reset, update };
}
