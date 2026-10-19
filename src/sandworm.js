import * as THREE from 'three';

// Local +Z points out of the mouth; each segment follows the leap trajectory.
export function createSandworm(terrainHeight, onDefeat = () => {}) {
  const worm = new THREE.Group();
  worm.name = 'sandworm';
  worm.visible = false;
  let active = false;
  // Repeatable pores, wrinkles and mottling without external image downloads.
  const textureSize = 256;
  const pixels = new Uint8Array(textureSize * textureSize * 4);
  for (let y = 0; y < textureSize; y += 1) {
    for (let x = 0; x < textureSize; x += 1) {
      const u = x / textureSize * Math.PI * 2;
      const v = y / textureSize * Math.PI * 2;
      const grain = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      const noise = grain - Math.floor(grain);
      const wrinkles = Math.pow(Math.abs(Math.sin(v * 12 + Math.sin(u * 5) * 0.65)), 14);
      const tone = 150 + Math.sin(u * 3 + Math.sin(v * 2)) * 22
        + Math.sin(u * 11 + v * 7) * 9 + noise * 30 - wrinkles * 48;
      const index = (y * textureSize + x) * 4;
      pixels[index] = tone;
      pixels[index + 1] = tone;
      pixels[index + 2] = tone;
      pixels[index + 3] = 255;
    }
  }
  const hideTexture = new THREE.DataTexture(pixels, textureSize, textureSize);
  hideTexture.wrapS = hideTexture.wrapT = THREE.RepeatWrapping;
  hideTexture.magFilter = THREE.LinearFilter;
  hideTexture.minFilter = THREE.LinearMipmapLinearFilter;
  hideTexture.generateMipmaps = true;
  hideTexture.needsUpdate = true;
  const skin = new THREE.MeshStandardMaterial({
    color: 0x92765a, roughness: 0.94, map: hideTexture, bumpMap: hideTexture, bumpScale: 0.19,
  });
  const armor = new THREE.MeshStandardMaterial({
    color: 0x80694e, roughness: 0.87, map: hideTexture, bumpMap: hideTexture, bumpScale: 0.12,
  });
  const creases = new THREE.MeshStandardMaterial({ color: 0x342116, roughness: 1 });
  const horn = new THREE.MeshStandardMaterial({ color: 0x493024, roughness: 0.84 });
  const gums = new THREE.MeshStandardMaterial({ color: 0x43201b, roughness: 0.91 });
  const teeth = new THREE.MeshStandardMaterial({ color: 0xd8bd88, roughness: 0.73 });
  const throat = new THREE.MeshStandardMaterial({ color: 0x090504, roughness: 1 });
  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x302516, roughness: 0.18,
  });
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  const size = 2.5;
  const segmentCount = 72;
  const segmentDelay = 0.06;
  const body = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 24, 16), skin, segmentCount);
  const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.065, 10, 40), armor, segmentCount);
  const seams = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.045, 6, 32), creases, segmentCount);
  const spines = new THREE.InstancedMesh(new THREE.ConeGeometry(0.28, 0.65, 8), horn, segmentCount * 3);
  // Small asymmetries break up the manufactured, perfectly circular silhouette.
  for (const mesh of [body, rings, seams]) {
    const positions = mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const angle = Math.atan2(y, x);
      const irregularity = 1 + Math.sin(angle * 7 + z * 3) * 0.025 + Math.cos(angle * 13 - z * 5) * 0.012;
      positions.setXYZ(i, x * irregularity, y * irregularity, z);
    }
    mesh.geometry.computeVertexNormals();
    for (let i = 0; i < segmentCount; i += 1) {
      mesh.setColorAt(i, new THREE.Color().setHSL(0.085 + Math.sin(i * 2.7) * 0.008,
        0.14, 0.73 + Math.sin(i * 1.9) * 0.07));
    }
  }
  for (const mesh of [body, rings, seams, spines]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // The animated instance positions span the entire worm, including its buried tail.
    mesh.frustumCulled = false;
    worm.add(mesh);
  }

  const head = new THREE.Group();
  head.name = 'sandworm-head';
  head.scale.setScalar(size);
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
  const fangs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 1, 10), teeth, toothCount);
  fangs.castShadow = true;
  head.add(fangs);
  for (let i = 0; i < toothCount; i += 1) {
    const inner = i >= 36;
    const index = inner ? i - 36 : i;
    const angle = index / (inner ? 28 : 36) * Math.PI * 2 + (inner ? 0.09 : 0) + Math.sin(i * 7.3) * 0.025;
    const radius = (inner ? 1.58 : 2.22) + Math.sin(i * 3.7) * 0.08;
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
    const tusk = addMesh(new THREE.ConeGeometry(0.4, 1.4, 10), horn, side * 2.53, 2.2, -0.9);
    tusk.rotation.z = -side * 0.45;
  }

  const weakPoint = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xff6c24, emissive: 0xff3908,
      emissiveIntensity: 1.5, roughness: 0.45 }),
  );
  weakPoint.name = 'sandworm-weak-point';
  weakPoint.scale.setScalar(size * 0.32);
  const weakPointRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.1, 0.09, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0xffa34b, transparent: true,
      opacity: 0.8, depthWrite: false, toneMapped: false }),
  );
  weakPointRing.name = 'sandworm-weak-point-ring';
  weakPointRing.rotation.x = -Math.PI / 2;
  // The ring marks the target; only the central point counts as a laser hit.
  weakPointRing.raycast = () => {};
  weakPoint.add(weakPointRing);
  worm.add(weakPoint);
  const laserTargets = [body, rings, seams, spines, head, weakPoint];
  let repelled = false;
  let retreatTime = 0;
  let weakPointHits = 0;
  let weakPointStage = 0;
  let lastWeakPointHit = -Infinity;
  let quakeStrength = 0;
  let lastDawnDay = null;
  const quakeOrigin = new THREE.Vector3();

  function repel(immediate = false) {
    if (repelled) return false;
    repelled = true;
    retreatTime = immediate ? 3.2 : 0;
    weakPoint.material.emissiveIntensity = 0;
    weakPointRing.visible = false;
    if (!immediate) {
      emitDust(worm.position, 80, true);
      onDefeat();
    }
    return true;
  }

  function updateWeakPointGlow() {
    const hitFlash = time - lastWeakPointHit < 0.35;
    weakPoint.material.color.setHex(hitFlash ? 0x56ff85 : 0xff6c24);
    weakPoint.material.emissive.setHex(hitFlash ? 0x16ff4b : 0xff3908);
    weakPoint.material.emissiveIntensity = hitFlash ? 4 : repelled ? 0 : 1.5 + Math.sin(time * 4) * 0.35;
  }

  function hitLaser(object, mode = 'shots') {
    if (!active || object !== weakPoint || !weakPoint.visible || repelled) return false;
    // A sustained beam counts one hit per pulse; individual projectiles count once each.
    if (mode === 'beam' && time - lastWeakPointHit < 0.6) return false;
    lastWeakPointHit = time;
    weakPointHits += 1;
    if (weakPointHits >= 1) {
      if (weakPointStage === 0) {
        weakPointStage = 1;
        weakPointHits = 0;
        positionWeakPoint();
      } else repel();
    }
    updateWeakPointGlow();
    return true;
  }

  const sandCount = 240;
  const sandPositions = new Float32Array(sandCount * 3);
  const sandGeometry = new THREE.BufferGeometry();
  sandGeometry.setAttribute('position', new THREE.BufferAttribute(sandPositions, 3));
  const sandMaterial = new THREE.PointsMaterial({
    color: 0xc39464, size: 0.12, transparent: true, opacity: 0.8, depthWrite: false,
  });
  const sand = new THREE.Points(sandGeometry, sandMaterial);
  sand.name = 'sandworm-sand';
  sand.frustumCulled = false;
  worm.add(sand);
  const grains = Array.from({ length: sandCount }, () => ({
    position: new THREE.Vector3(), velocity: new THREE.Vector3(), age: 0, life: 0, ground: 0,
  }));
  let grainCursor = 0;
  sandGeometry.setDrawRange(0, 0);

  function emitSand(position, count) {
    for (let i = 0; i < count; i++) {
      const grain = grains[grainCursor];
      grainCursor = (grainCursor + 1) % sandCount;
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * size * 1.5;
      grain.position.set(position.x + Math.cos(angle) * radius, 0, position.z + Math.sin(angle) * radius);
      grain.ground = terrainHeight(grain.position.x, grain.position.z) + 0.08;
      grain.position.y = grain.ground + 0.3;
      const speed = 3 + Math.random() * 8;
      grain.velocity.set(Math.cos(angle) * speed, 3 + Math.random() * 7, Math.sin(angle) * speed);
      grain.age = 0;
      grain.life = 0.8 + Math.random();
    }
  }

  function updateSand(delta) {
    let count = 0;
    for (const grain of grains) {
      grain.age += delta;
      if (grain.age >= grain.life) continue;
      grain.velocity.y -= delta * 9.8;
      grain.position.addScaledVector(grain.velocity, delta);
      if (grain.position.y <= grain.ground) {
        grain.life = 0;
        continue;
      }
      sandPositions[count * 3] = grain.position.x - worm.position.x;
      sandPositions[count * 3 + 1] = grain.position.y - worm.position.y;
      sandPositions[count * 3 + 2] = grain.position.z - worm.position.z;
      count++;
    }
    sandGeometry.setDrawRange(0, count);
    const positions = sandGeometry.attributes.position;
    positions.clearUpdateRanges();
    if (count > 0) {
      positions.addUpdateRange(0, count * 3);
      positions.needsUpdate = true;
    }
  }
  // World-space particle storage keeps dust at the breach after the worm moves on.
  const dustCount = 900;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustOpacity = new Float32Array(dustCount);
  const dustSizes = new Float32Array(dustCount);
  const dustHeights = new Float32Array(dustCount);
  const dustStyles = new Float32Array(dustCount * 3);
  const dustParticles = Array.from({ length: dustCount }, () => ({
    position: new THREE.Vector3(), velocity: new THREE.Vector3(), age: 0, life: 0, size: 0, layer: 0, seed: 0, ground: 0, groundCheck: 0, impact: false,
  }));
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute('opacity', new THREE.BufferAttribute(dustOpacity, 1));
  dustGeometry.setAttribute('particleSize', new THREE.BufferAttribute(dustSizes, 1));
  dustGeometry.setAttribute('heightAboveGround', new THREE.BufferAttribute(dustHeights, 1));
  dustGeometry.setAttribute('particleStyle', new THREE.BufferAttribute(dustStyles, 3));
  // Bake the cloud detail once instead of evaluating noise for every covered pixel.
  const cloudResolution = 64;
  const atlasResolution = cloudResolution * 2;
  const cloudPixels = new Uint8Array(atlasResolution * atlasResolution * 4);
  const cloudHash = (x, y) => {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const cloudNoise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(cloudHash(ix, iy), cloudHash(ix + 1, iy), u),
      THREE.MathUtils.lerp(cloudHash(ix, iy + 1), cloudHash(ix + 1, iy + 1), u), v);
  };
  // Four asymmetrical, overlapping cloud silhouettes avoid repeated circular stamps.
  for (let variant = 0; variant < 4; variant++) {
    const lobes = Array.from({ length: 6 }, (_, i) => ({
      x: (cloudHash(variant * 17 + i, 3) - 0.5) * 1.05,
      y: (cloudHash(variant * 17 + i, 7) - 0.5) * 1.05,
      radius: 0.2 + cloudHash(variant * 17 + i, 11) * 0.2,
    }));
    for (let y = 0; y < cloudResolution; y++) {
      for (let x = 0; x < cloudResolution; x++) {
        const px = x / (cloudResolution - 1) * 2 - 1;
        const py = y / (cloudResolution - 1) * 2 - 1;
        const offset = variant * 19 + 9;
        const noise = cloudNoise(px * 3.5 + offset, py * 3.5 + offset) * 0.7
          + cloudNoise(px * 8 + offset, py * 8 + offset) * 0.3;
        let density = 0;
        for (const lobe of lobes) {
          const distance = ((px - lobe.x) ** 2 + (py - lobe.y) ** 2) / lobe.radius ** 2;
          density += Math.exp(-distance * 1.7) * 0.65;
        }
        const border = 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(px), Math.abs(py)), 0.65, 0.98);
        const atlasX = x + (variant % 2) * cloudResolution;
        const atlasY = y + Math.floor(variant / 2) * cloudResolution;
        const index = (atlasY * atlasResolution + atlasX) * 4;
        cloudPixels[index] = cloudPixels[index + 1] = cloudPixels[index + 2] = noise * 255;
        cloudPixels[index + 3] = Math.min(1, density * 2.4) * border * (0.65 + noise * 0.35) * 255;
      }
    }
  }
  const cloudTexture = new THREE.DataTexture(cloudPixels, atlasResolution, atlasResolution);
  cloudTexture.magFilter = THREE.LinearFilter;
  cloudTexture.minFilter = THREE.LinearFilter;
  cloudTexture.needsUpdate = true;
  const dustMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { pointScale: { value: 600 }, cloudTexture: { value: cloudTexture },
      lightTint: { value: new THREE.Color(0.85, 0.75, 0.65) } },
    vertexShader: `
      attribute float opacity;
      attribute float particleSize;
      attribute float heightAboveGround;
      attribute vec3 particleStyle;
      varying vec3 style;
      varying vec2 rotation;
      varying vec2 cloudTile;
      varying vec3 deformation;
      varying vec2 heightInfo;
      uniform float pointScale;
      varying float alpha;
      void main() {
        alpha = opacity;
        style = particleStyle;
        float tile = floor(style.x * 4.0);
        cloudTile = vec2(mod(tile, 2.0), floor(tile / 2.0));
        float angle = style.x * 6.283 + style.z * 0.07;
        rotation = vec2(cos(angle), sin(angle));
        deformation = vec3(1.0 + sin(style.z * 0.5 + style.x * 12.0) * 0.12,
          1.0 + cos(style.z * 0.4 + style.x * 17.0) * 0.12,
          sin(style.z * 0.35 + style.x * 9.0) * 0.18);
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(particleSize * pointScale / max(1.0, -viewPosition.z), 1.0, 128.0);
        heightInfo = vec2(heightAboveGround,
          gl_PointSize * max(1.0, -viewPosition.z) / pointScale * viewMatrix[1][1]);
        alpha *= smoothstep(0.5, 3.0, -viewPosition.z);
      }`,
    fragmentShader: `
      uniform sampler2D cloudTexture;
      uniform vec3 lightTint;
      varying float alpha;
      varying vec3 style;
      varying vec2 rotation;
      varying vec2 cloudTile;
      varying vec3 deformation;
      varying vec2 heightInfo;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        p.x += p.y * deformation.z;
        p *= deformation.xy;
        p = mat2(rotation.x, -rotation.y, rotation.y, rotation.x) * p;
        if (max(abs(p.x), abs(p.y)) > 1.0) discard;
        vec2 uv = ((p * 0.5 + 0.5) * 63.0 + 0.5) / 128.0 + cloudTile * 0.5;
        vec4 cloud = texture2D(cloudTexture, uv);
        if (cloud.a < 0.01) discard;
        vec3 shade = mix(vec3(0.24, 0.12, 0.055), vec3(0.37, 0.22, 0.11), cloud.r);
        // Denser folds shade themselves, while thin edges catch more light.
        float scattering = mix(0.75, 1.12, 1.0 - cloud.a);
        float opacity = 1.0 - exp(-alpha * cloud.a * 4.5);
        // Fade the lower edge into the locally sampled ground instead of drawing a flat stamp.
        float worldHeight = heightInfo.x + (0.5 - gl_PointCoord.y) * heightInfo.y;
        float groundFade = smoothstep(-0.3, 1.1, worldHeight);
        gl_FragColor = vec4(shade * lightTint * scattering * mix(0.92, 1.08, style.x), opacity * groundFade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.name = 'sandworm-dust-clouds';
  dust.frustumCulled = false;
  const dustViewport = new THREE.Vector2();
  dust.onBeforeRender = renderer => {
    dustMaterial.uniforms.pointScale.value = renderer.getDrawingBufferSize(dustViewport).y * 0.85;
  };
  worm.add(dust);
  let dustCursor = 0;
  const breachPoint = new THREE.Vector3();

  function emitDust(position, count, impact) {
    quakeOrigin.copy(position);
    quakeStrength = Math.max(quakeStrength, count >= 80 ? 3.5 : 0.7);
    emitSand(position, Math.min(100, Math.ceil(count * 0.3)));
    for (let i = 0; i < count; i += 1) {
      const particle = dustParticles[dustCursor];
      dustCursor = (dustCursor + 1) % dustCount;
      particle.impact = impact;
      particle.layer = Math.random() < 0.45 ? 0 : Math.random() < 0.6 ? 1 : 2;
      particle.seed = Math.random();
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * size * (impact ? 1.2 : 2.5);
      particle.position.set(position.x + Math.cos(angle) * radius,
        terrainHeight(position.x, position.z) + 0.4 + Math.random(),
        position.z + Math.sin(angle) * radius);
      const speed = (impact ? 5 : 3) + Math.random() * 8;
      const outwardSpeed = speed * (particle.layer === 0 ? 0.9 : 0.5) * (impact ? 0.9 : 1.7);
      const lift = particle.layer === 0 ? 0.6 + Math.random() * 1.3
        : particle.layer === 1 ? 4 + Math.random() * 11 : 1.5 + Math.random() * 4;
      particle.velocity.set(Math.cos(angle) * outwardSpeed, lift, Math.sin(angle) * outwardSpeed);
      particle.ground = terrainHeight(particle.position.x, particle.position.z) + 0.3;
      particle.groundCheck = Math.random() * 0.3;
      particle.age = 0;
      particle.life = particle.layer === 2 ? 20 + Math.random() * 8
        : particle.layer === 1 ? 13 + Math.random() * 5 : (impact ? 8 : 6) + Math.random() * 3;
      particle.size = size * (6 + Math.random() * 9.6) * (impact ? 1.5 : 1);
    }
  }

  function updateDust(delta) {
    for (let segment = 0; segment <= segmentCount; segment += 1) {
      const delay = segment === 0 ? 0 : (segment + 1) * segmentDelay;
      const progress = THREE.MathUtils.clamp((cycleTime - delay) / leapDuration, 0, 1);
      const earlierProgress = THREE.MathUtils.clamp((cycleTime - delta - delay) / leapDuration, 0, 1);
      const sink = repelled ? THREE.MathUtils.smoothstep(retreatTime, 0, 3) * 110 : 0;
      const height = -24 + 64 * 4 * progress * (1 - progress) - sink;
      const earlierHeight = -24 + 64 * 4 * earlierProgress * (1 - earlierProgress) - sink;
      // Emit at the outer surface's first contact, rather than waiting for its center.
      const fraction = Math.max(0, segment - 1) / (segmentCount - 1);
      const contactRadius = segment === 0 ? size * 3.4
        : size * 2.7 * (1 - fraction ** 2 * 0.88);
      const emerging = height > earlierHeight
        && earlierHeight + contactRadius < 0 && height + contactRadius >= 0;
      const impact = height < earlierHeight
        && earlierHeight - contactRadius > 0 && height - contactRadius <= 0;
      if (emerging || impact) {
        sampleLeap(cycleTime - delay, breachPoint);
        // Both breaking out and landing throw up the same dense, lingering cloud.
        emitDust(breachPoint, segment === 0 ? 300 : 7, true);
      }
    }
    updateSand(delta);
    let activeCount = 0;
    for (let i = 0; i < dustCount; i += 1) {
      const particle = dustParticles[i];
      particle.age += delta;
      if (particle.age >= particle.life) {
        continue;
      }
      particle.velocity.multiplyScalar(Math.exp(-delta * (particle.layer === 0 ? 0.7 : 0.5)));
      particle.velocity.y += delta * (particle.layer === 2 ? 0.08 : particle.layer === 0 ? -1.5 : -0.25);
      // Gentle wind and turbulence carry suspended dust away from the impact.
      const wind = particle.impact ? THREE.MathUtils.lerp(0.25, 1, Math.min(1, particle.age / 6)) : 1;
      particle.velocity.x += delta * wind * (0.65 + Math.sin(particle.position.z * 0.06 + time * 0.6) * 0.4);
      particle.velocity.z += delta * wind * (0.2 + Math.cos(particle.position.x * 0.06 - time * 0.5) * 0.35);
      particle.position.addScaledVector(particle.velocity, delta);
      particle.groundCheck -= delta;
      if (particle.groundCheck <= 0 && particle.position.y < particle.ground + 12) {
        particle.ground = terrainHeight(particle.position.x, particle.position.z) + 0.3;
        particle.groundCheck = 0.3;
      }
      if (particle.position.y <= particle.ground) {
        particle.position.y = particle.ground;
        particle.velocity.y = Math.max(0, particle.velocity.y);
        // Heavy dust settles and loses momentum instead of sliding forever.
        if (particle.layer === 0) particle.velocity.multiplyScalar(Math.exp(-delta * 2));
      }
      const renderIndex = activeCount++;
      dustPositions[renderIndex * 3] = particle.position.x - worm.position.x;
      dustPositions[renderIndex * 3 + 1] = particle.position.y - worm.position.y;
      dustPositions[renderIndex * 3 + 2] = particle.position.z - worm.position.z;
      const life = particle.age / particle.life;
      const expansion = 1 + (1 - Math.exp(-particle.age * (particle.layer === 0 ? 0.7 : 0.45))) * 3;
      const thinning = 1 / Math.pow(expansion, particle.layer === 2 ? 0.15 : 0.08);
      dustOpacity[renderIndex] = THREE.MathUtils.smoothstep(particle.age, 0, 0.22) * Math.pow(1 - life, 1.25) * thinning * (particle.layer === 2 ? 0.75 : 1) * (particle.impact ? 1 : 0.65);
      // Deposited heavy dust disperses, while fine suspended dust keeps its long lifetime.
      if (particle.layer === 0 && particle.position.y < particle.ground + 0.5) {
        dustOpacity[renderIndex] *= 1 - THREE.MathUtils.smoothstep(particle.age, 2, 5) * 0.8;
      }
      dustSizes[renderIndex] = particle.size * expansion;
      dustHeights[renderIndex] = particle.position.y - particle.ground;
      dustStyles[renderIndex * 3] = particle.seed;
      dustStyles[renderIndex * 3 + 1] = particle.layer;
      dustStyles[renderIndex * 3 + 2] = particle.age;
    }
    dustGeometry.setDrawRange(0, activeCount);
    for (const attribute of Object.values(dustGeometry.attributes)) {
      attribute.clearUpdateRanges();
      if (activeCount > 0) {
        attribute.addUpdateRange(0, activeCount * attribute.itemSize);
        attribute.needsUpdate = true;
      }
    }
  }

  let time = 0;
  let cycleTime = 0;
  const leapDuration = 6;
  const cycleDuration = leapDuration + (segmentCount + 1) * segmentDelay + 0.7;
  const launch = new THREE.Vector3();
  const landing = new THREE.Vector3();
  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const forward = new THREE.Vector3(0, 0, 1);
  const previousPlayer = new THREE.Vector3();
  const velocity = new THREE.Vector3();

  // Aim for the descending ground crossing, when the mouth can reach the explorer.
  const strikeProgress = (1 + Math.sqrt(1 - 25 / 64)) / 2;
  const strikeTime = leapDuration * strikeProgress;

  function aimLanding(player, yaw, remainingTime) {
    const dx = player.x + velocity.x * remainingTime - launch.x;
    const dz = player.z + velocity.z * remainingTime - launch.z;
    const distance = Math.hypot(dx, dz);
    direction.set(distance > 0.01 ? dx / distance : Math.sin(yaw), 0,
      distance > 0.01 ? dz / distance : Math.cos(yaw));
    landing.copy(launch).addScaledVector(direction, Math.min(260, distance / strikeProgress));
  }

  function planLeap(player, yaw) {
    launch.copy(worm.position);
    aimLanding(player, yaw, strikeTime);
  }

  function sampleLeap(seconds, target) {
    const progress = THREE.MathUtils.clamp(seconds / leapDuration, 0, 1);
    target.lerpVectors(launch, landing, progress);
    const lateral = Math.sin(progress * Math.PI) * Math.sin(progress * Math.PI * 2) * 0.45;
    const length = Math.hypot(landing.x - launch.x, landing.z - launch.z) || 1;
    target.x += (landing.z - launch.z) / length * lateral;
    target.z -= (landing.x - launch.x) / length * lateral;
    target.y = terrainHeight(target.x, target.z) - 24 + 64 * 4 * progress * (1 - progress);
    if (repelled) target.y -= THREE.MathUtils.smoothstep(retreatTime, 0, 3) * 110;
    return target;
  }

  function orientAt(seconds) {
    sampleLeap(seconds + 0.01, tangent);
    sampleLeap(seconds - 0.01, point);
    tangent.sub(point).normalize();
    dummy.quaternion.setFromUnitVectors(forward, tangent);
  }

  function positionWeakPoint() {
    body.getMatrixAt(weakPointStage === 0 ? 10 : 38, dummy.matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
    weakPoint.position.set(0, dummy.scale.x * 0.94 + size * 0.55, 0)
      .applyQuaternion(dummy.quaternion).add(dummy.position);
    weakPoint.quaternion.copy(dummy.quaternion);
    const pulse = (Math.sin(time * 4.5) + 1) * 0.5;
    weakPointRing.scale.setScalar(0.9 + pulse * 0.35);
    weakPointRing.material.opacity = 0.45 + pulse * 0.45;
    updateWeakPointGlow();
  }

  function restoreWeakPointProgress(progress) {
    if (!active || !progress || ![0, 1].includes(progress.stage)
      || !Number.isInteger(progress.hits) || progress.hits < 0
      || progress.hits >= 1) return false;
    weakPointStage = progress.stage;
    weakPointHits = progress.hits;
    lastWeakPointHit = -Infinity;
    positionWeakPoint();
    return true;
  }

  function pose() {
    sampleLeap(cycleTime, worm.position);
    for (let i = 0; i < segmentCount; i += 1) {
      const fraction = i / (segmentCount - 1);
      const contraction = 1 + Math.sin(time * 2.1 - fraction * 8) * 0.035;
      const radius = size * 2.7 * (1 - Math.pow(fraction, 2) * 0.88) * contraction;
      const seconds = cycleTime - (i + 2) * segmentDelay;
      sampleLeap(seconds, dummy.position).sub(worm.position);
      orientAt(seconds);
      dummy.scale.set(radius, radius * 0.94, size * 1.12);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
      dummy.scale.set(radius, radius * 0.94, size * 0.65);
      dummy.updateMatrix();
      rings.setMatrixAt(i, dummy.matrix);
      seams.setMatrixAt(i, dummy.matrix);
      const center = dummy.position.clone();
      const orientation = dummy.quaternion.clone();
      for (let row = 0; row < 3; row += 1) {
        const angle = (row - 1) * 0.92;
        dummy.position.set(Math.sin(angle) * radius, Math.cos(angle) * radius * 0.9, 0)
          .applyQuaternion(orientation).add(center);
        dummy.quaternion.copy(orientation);
        dummy.rotateZ(-angle);
        dummy.scale.setScalar(size * (0.45 + (1 - fraction) * 0.75));
        dummy.updateMatrix();
        spines.setMatrixAt(i * 3 + row, dummy.matrix);
      }
    }
    positionWeakPoint();
    for (const mesh of [body, rings, seams, spines]) {
      mesh.instanceMatrix.needsUpdate = true;
      // Raycasts must follow the moving instances instead of a cached old bound.
      mesh.computeBoundingSphere();
    }
    head.position.set(0, 0, 0);
    orientAt(cycleTime);
    head.quaternion.copy(dummy.quaternion);
  }

  function awaken(crystals, player, yaw) {
    if (active || crystals < 5) return false;
    reset(player, yaw, true);
    quakeOrigin.copy(worm.position);
    quakeStrength = 0.45;
    return true;
  }

  function reset(player, yaw = Math.PI, startActive = true) {
    active = startActive;
    worm.visible = active;
    time = 0;
    cycleTime = 0;
    repelled = false;
    retreatTime = 0;
    weakPointHits = 0;
    weakPointStage = 0;
    lastWeakPointHit = -Infinity;
    quakeStrength = 0;
    lastDawnDay = null;
    weakPointRing.visible = true;
    for (const mesh of laserTargets) mesh.visible = true;
    for (const particle of dustParticles) particle.life = 0;
    for (const grain of grains) grain.life = 0;
    sandGeometry.setDrawRange(0, 0);
    dustGeometry.setDrawRange(0, 0);
    dustOpacity.fill(0);
    dustGeometry.attributes.opacity.needsUpdate = true;
    velocity.set(0, 0, 0);
    previousPlayer.copy(player);
    worm.position.set(player.x + Math.sin(yaw) * 50 - Math.cos(yaw) * 10, 0,
      player.z + Math.cos(yaw) * 50 + Math.sin(yaw) * 10);
    worm.rotation.y = 0;
    planLeap(player, yaw);
    pose();
  }

  function update(delta, player, yaw) {
    if (!active) return null;
    quakeStrength *= Math.exp(-delta * 1.7);
    time += delta;
    if (repelled) {
      retreatTime += delta;
      pose();
      updateDust(delta);
      if (retreatTime >= 3.2) {
        for (const mesh of laserTargets) mesh.visible = false;
        sand.visible = false;
      }
      return null;
    }
    sand.visible = true;
    if (delta > 0) {
      velocity.set((player.x - previousPlayer.x) / delta, 0, (player.z - previousPlayer.z) / delta);
      velocity.clampLength(0, 8);
    }
    previousPlayer.copy(player);
    cycleTime += delta;
    while (cycleTime >= cycleDuration) {
      cycleTime -= cycleDuration;
      // The whole body is buried before the next pursuit leap begins.
      worm.position.copy(landing);
      planLeap(player, yaw);
    }
    // Refine the prediction while still underground, then commit to the leap.
    if (cycleTime < 0.35) aimLanding(player, yaw, Math.max(0, strikeTime - cycleTime));
    pose();
    updateDust(delta);
    // Test the mouth before resolving body contact so a bite always takes priority.
    const localPlayer = new THREE.Vector3().copy(player).sub(worm.position)
      .applyQuaternion(head.quaternion.clone().invert()).divideScalar(size);
    const playerRadius = 0.65 / size;
    if (Math.hypot(localPlayer.x, localPlayer.y) < 2.45 + playerRadius
      && localPlayer.z > -1.9 - playerRadius && localPlayer.z < 1.2 + playerRadius) {
      return 'mouth';
    }
    let contact = null;
    if (Math.hypot(localPlayer.x, localPlayer.y) < 3.4 + playerRadius
      && localPlayer.z > -2.1 - playerRadius && localPlayer.z < 1.3 + playerRadius) {
      contact = 'body';
      const push = new THREE.Vector3(localPlayer.x, localPlayer.y, 0)
        .applyQuaternion(head.quaternion);
      push.y = 0;
      if (push.lengthSq() > 0.0001) player.addScaledVector(push.normalize(), 0.35);
    }
    for (let i = 0; i < segmentCount; i += 1) {
      body.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
      const center = dummy.position.clone().add(worm.position);
      const inverse = dummy.quaternion.clone().invert();
      const offset = new THREE.Vector3();
      let touching = false;
      // Sample the explorer's vertical capsule against the oriented body ellipsoid.
      for (const height of [-0.65, 0, 0.65]) {
        offset.copy(player); offset.y += height;
        offset.sub(center).applyQuaternion(inverse);
        const distance = (offset.x / (dummy.scale.x + 0.5)) ** 2
          + (offset.y / (dummy.scale.y + 0.5)) ** 2
          + (offset.z / (dummy.scale.z + 0.5)) ** 2;
        if (distance < 1) { touching = true; break; }
      }
      if (!touching) continue;
      contact = 'body';
      // Push the explorer to the nearest surface along the contact normal.
      offset.set(offset.x / dummy.scale.x ** 2, offset.y / dummy.scale.y ** 2,
        offset.z / dummy.scale.z ** 2).applyQuaternion(dummy.quaternion);
      offset.y = 0;
      if (offset.lengthSq() < 0.0001) offset.set(1, 0, 0);
      player.addScaledVector(offset.normalize(), 0.35);
    }
    return contact;
  }

  const dustSunTint = new THREE.Color();
  const sandBaseColor = new THREE.Color(0xc39464);
  function setDustLighting(ambient, sunlight) {
    dustMaterial.uniforms.lightTint.value.copy(ambient.color).multiplyScalar(ambient.intensity * 0.32)
      .add(dustSunTint.copy(sunlight.color).multiplyScalar(sunlight.intensity * 0.2));
    sandMaterial.color.copy(sandBaseColor).multiply(dustMaterial.uniforms.lightTint.value);
  }

  function updateDawn(elapsedSeconds, dayLength, player, yaw) {
    const day = Math.floor(Math.max(0, elapsedSeconds) / dayLength);
    const newDawn = lastDawnDay !== null && day > lastDawnDay;
    lastDawnDay = day;
    if (!newDawn || !active || !repelled) return false;
    reset(player, yaw, true);
    lastDawnDay = day;
    quakeOrigin.copy(worm.position);
    quakeStrength = 0.45;
    return true;
  }

  function getGroundShake(player) {
    if (!active) return 0;
    const distance = Math.hypot(player.x - quakeOrigin.x, player.z - quakeOrigin.z);
    return quakeStrength * (1 - THREE.MathUtils.smoothstep(distance, 8, 150));
  }

  return { object: worm, reset, update, awaken, hitLaser, repel, setDustLighting, getGroundShake, updateDawn, restoreWeakPointProgress,
    isPresent: () => active && !repelled,
    getWeakPointProgress: () => ({ stage: weakPointStage, hits: weakPointHits }), isRepelled: () => repelled,
    getLaserTargets: () => active ? laserTargets.filter(mesh => mesh.visible) : [] };
}
