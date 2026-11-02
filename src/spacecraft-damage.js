import * as THREE from 'three';

export function createSpacecraftDamage() {
  const group = new THREE.Group();
  group.name = 'spacecraft-crash-damage';
  const charred = new THREE.MeshStandardMaterial({ color: 0x1d1712, roughness: 1, metalness: 0.15 });
  const scar = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), charred);
  scar.position.set(-4.15, 3.65, -3.7); scar.scale.set(1.1, 0.65, 2.4);
  group.add(scar);
  for (let i = 0; i < 5; i++) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.09, 1.1), charred);
    plate.position.set(-4.15 + Math.sin(i * 2.4) * 1.1, 4.1 + i * 0.06, -2 - i * 0.8);
    plate.rotation.set(i * 0.15, i * 1.7, (i % 2 ? 1 : -1) * 0.45);
    group.add(plate);
  }
  const warningMaterial = new THREE.MeshStandardMaterial({ color: 0xb52712, emissive: 0xff2408, emissiveIntensity: 1 });
  const warning = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.16), warningMaterial);
  warning.position.set(-2.1, 3.1, 1.6); group.add(warning);
  const pixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const r = Math.hypot((x - 31.5) / 32, (y - 31.5) / 32);
    const grain = 0.7 + Math.sin(x * 0.37 + Math.sin(y * 0.41)) * 0.2;
    const at = (y * 64 + x) * 4;
    pixels[at] = pixels[at + 1] = pixels[at + 2] = 255;
    pixels[at + 3] = Math.pow(Math.max(0, 1 - r), 1.6) * grain * 255;
  }
  const map = new THREE.DataTexture(pixels, 64, 64);
  map.needsUpdate = true;
  const smokeSources = [
    new THREE.Vector3(-4.15, 4.1, -3.7), new THREE.Vector3(4.15, 4, -4.6),
    new THREE.Vector3(0, 4.1, -3), new THREE.Vector3(1.4, 3.9, 2.5),
  ];
  const smoke = Array.from({ length: 72 }, (_, index) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: 0x34302c, transparent: true, depthWrite: false }));
    sprite.name = 'spacecraft-crash-smoke';
    sprite.userData.source = index % smokeSources.length;
    group.add(sprite); return sprite;
  });
  const sparkSources = [
    [-4.15, 4.25, -2.5], [4.15, 4.2, -4.6], [-6, 3.1, -4.5], [6, 3.1, -3.2],
    [-1.75, 4.2, 2.8], [1.7, 4.2, 1.2], [0, 3.5, -6.5], [-2, 3.4, -1],
  ].map((position, index) => ({ position: new THREE.Vector3(...position), wait: index * 0.045 }));
  const sparks = Array.from({ length: 192 }, () => ({ position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, duration: 1 }));
  const sparkPositions = new Float32Array(sparks.length * 6);
  const sparkColors = new Float32Array(sparks.length * 6);
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3).setUsage(THREE.DynamicDrawUsage));
  sparkGeometry.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3).setUsage(THREE.DynamicDrawUsage));
  sparkGeometry.setDrawRange(0, 0);
  const sparkMesh = new THREE.LineSegments(sparkGeometry, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  sparkMesh.name = 'spacecraft-crash-sparks'; sparkMesh.frustumCulled = false; group.add(sparkMesh);
  const connectors = sparkSources.map(source => {
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffa135, toneMapped: false }));
    glow.position.copy(source.position); group.add(glow); return glow;
  });
  let nextSpark = 0;
  function updateSparks(delta) {
    for (let index = 0; index < sparkSources.length; index++) {
      const source = sparkSources[index];
      source.wait -= delta;
      if (delta > 0 && source.wait <= 0) {
        source.wait = 0.12 + Math.random() * 0.48;
        for (let count = 0; count < 6 + index % 5; count++) {
          const spark = sparks[nextSpark++ % sparks.length];
          spark.position.copy(source.position);
          spark.velocity.set((Math.random() - 0.5) * 7 + Math.sign(source.position.x) * 2,
            1.8 + Math.random() * 4.8, (Math.random() - 0.5) * 8);
          spark.life = spark.duration = 0.25 + Math.random() * 0.6;
        }
      }
      connectors[index].visible = source.wait > 0.24 && Math.sin(time * 48 + index * 3) > -0.1;
    }
    let visible = 0;
    for (const spark of sparks) {
      spark.life -= delta;
      if (spark.life <= 0) continue;
      spark.velocity.y -= delta * 9.8;
      spark.position.addScaledVector(spark.velocity, delta);
      const offset = visible++ * 6;
      sparkPositions[offset] = spark.position.x; sparkPositions[offset + 1] = spark.position.y; sparkPositions[offset + 2] = spark.position.z;
      sparkPositions[offset + 3] = spark.position.x - spark.velocity.x * 0.035;
      sparkPositions[offset + 4] = spark.position.y - spark.velocity.y * 0.035;
      sparkPositions[offset + 5] = spark.position.z - spark.velocity.z * 0.035;
      const fade = Math.min(1, spark.life / spark.duration * 2);
      sparkColors.set([2.8 * fade, 1.6 * fade, 0.35 * fade, 1.2 * fade, 0.25 * fade, 0.025 * fade], offset);
    }
    sparkGeometry.setDrawRange(0, visible * 2);
    sparkGeometry.attributes.position.needsUpdate = true;
    sparkGeometry.attributes.color.needsUpdate = true;
  }
  let time = 0;
  group.visible = false;
  return {
    group,
    update(delta) {
      if (!group.visible) return;
      time += delta;
      warningMaterial.emissiveIntensity = Math.sin(time * 4) > 0 ? 2 : 0.15;
      updateSparks(delta);
      smoke.forEach((sprite, index) => {
        const source = smokeSources[sprite.userData.source];
        const layer = Math.floor(index / smokeSources.length);
        const age = (time * (0.1 + sprite.userData.source * 0.008) + layer / 18) % 1;
        const drift = age * age;
        sprite.position.set(
          source.x + drift * 6 + Math.sin(index * 2.3 + time * 0.45) * age * 1.8,
          source.y + age * 18,
          source.z + drift * 4 + Math.cos(index * 1.7 + time * 0.35) * age);
        sprite.scale.setScalar(2 + age * 11);
        sprite.material.color.setScalar(0.065 + age * 0.085);
        sprite.material.rotation = index + time * (0.12 + index % 3 * 0.04);
        sprite.material.opacity = Math.sin(Math.pow(age, 0.65) * Math.PI) * 0.72;
      });
    },
  };
}
