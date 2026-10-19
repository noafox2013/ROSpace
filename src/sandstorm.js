import * as THREE from 'three';

export function createStormWeather(random = Math.random, onWarning = () => {}, onEnd = () => {}) {
  let wait = 45 + random() * 45, age = 0, duration = 0, warned = false;
  return {
    update(delta) {
      delta = Math.max(0, Math.min(1, delta));
      if (!duration) {
        wait -= delta;
        if (delta > 0 && wait <= 15 && !warned) { warned = true; onWarning(); }
        if (wait <= 0) { duration = 70 + random() * 35; age = 0; }
      } else {
        age += delta;
        if (age >= duration) { duration = 0; age = 0; wait = 180 + random() * 120; warned = false; onEnd(); }
      }
      return duration ? THREE.MathUtils.smoothstep(age, 0, 12) * (1 - THREE.MathUtils.smoothstep(age, duration - 16, duration)) : 0;
    },
    snapshot: () => ({ wait, age, duration, warned }),
    restore(value) {
      if (!value || ![value.wait, value.age, value.duration].every(Number.isFinite)) return;
      wait = THREE.MathUtils.clamp(value.wait, 0, 300);
      duration = value.duration === 0 ? 0 : THREE.MathUtils.clamp(value.duration, 70, 105);
      age = THREE.MathUtils.clamp(value.age, 0, duration);
      warned = value.warned === true || duration > 0;
    },
    reset() { wait = 45 + random() * 45; age = duration = 0; warned = false; },
  };
}

export function createSandstorm(scene, onWarning, onEnd, groundHeight = () => 0) {
  const weather = createStormWeather(Math.random, onWarning, onEnd);
  const count = 2800;
  const positions = new Float32Array(count * 6);
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attribute);
  const material = new THREE.LineBasicMaterial({ color: 0xd9ad78, transparent: true, opacity: 0, depthWrite: false, fog: true });
  const grains = new THREE.LineSegments(geometry, material);
  grains.frustumCulled = false; grains.visible = false;
  for (let i = 0; i < count; i++) {
    const offset = i * 6;
    positions[offset] = Math.random() * 100 - 50;
    positions[offset + 1] = Math.random() * 48 - 20;
    positions[offset + 2] = Math.random() * 100 - 50;
  }
  scene.add(grains);
  // Soft, uneven density patches form low rolling curtains, with no hard sprite edges.
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d'); const pixels = ctx.createImageData(128, 128);
  const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
  const noise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    let u = x - ix, v = y - iy; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u), THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v);
  };
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const u = (x - 64) / 64, v = (y - 64) / 64;
    const density = noise(x / 23, y / 23) * 0.65 + noise(x / 8, y / 8) * 0.25 + noise(x / 3, y / 3) * 0.1;
    const edge = Math.max(0, 1 - u * u - v * v);
    const offset = (y * 128 + x) * 4;
    pixels.data[offset] = pixels.data[offset + 1] = pixels.data[offset + 2] = 255;
    pixels.data[offset + 3] = Math.pow(edge, 1.6) * density * 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  const curtains = new THREE.Group();
  const curtainMaterial = new THREE.SpriteMaterial({ map, color: 0xa17b53, transparent: true, opacity: 0, depthWrite: false, fog: true });
  for (let i = 0; i < 22; i++) {
    const sprite = new THREE.Sprite(curtainMaterial);
    sprite.position.set(Math.random() * 80 - 40, Math.random() * 4 - 1, Math.random() * 80 - 40);
    sprite.scale.set(14 + Math.random() * 14, 5 + Math.random() * 7, 1);
    curtains.add(sprite);
  }
  curtains.visible = false; scene.add(curtains);
  const previousPlayer = new THREE.Vector3();
  let hasPreviousPlayer = false;
  const overlay = document.createElement('div');
  overlay.id = 'sandstorm-haze'; overlay.setAttribute('aria-hidden', 'true');
  document.querySelector('#app').append(overlay);
  const sandColor = new THREE.Color(), sandTint = new THREE.Color(0xd8aa79);
  let intensity = 0, time = 0, gust = 0.85;
  return {
    ...weather,
    update(delta, player, indoors) {
      intensity = weather.update(delta); time += delta;
      const exposure = intensity * (indoors ? 0.08 : 1);
      gust = 0.85 + Math.sin(time * 1.7) * 0.1 + Math.sin(time * 4.1) * 0.05;
      const moveX = hasPreviousPlayer ? player.x - previousPlayer.x : 0;
      const moveY = hasPreviousPlayer ? player.y - previousPlayer.y : 0;
      const moveZ = hasPreviousPlayer ? player.z - previousPlayer.z : 0;
      previousPlayer.copy(player); hasPreviousPlayer = true;
      curtains.visible = intensity > 0.01 && !indoors;
      curtains.position.set(player.x, groundHeight(player.x, player.z) + 3, player.z);
      curtainMaterial.opacity = exposure * (0.3 + gust * 0.35);
      curtainMaterial.rotation = Math.sin(time * 0.2) * 0.035;
      if (curtains.visible) for (let i = 0; i < curtains.children.length; i++) {
        const curtain = curtains.children[i];
        curtain.position.x += delta * (9 + i % 4) * gust - moveX;
        curtain.position.z += delta * 4.5 * gust - moveZ;
        curtain.position.x = THREE.MathUtils.euclideanModulo(curtain.position.x + 40, 80) - 40;
        curtain.position.z = THREE.MathUtils.euclideanModulo(curtain.position.z + 40, 80) - 40;
      }
      grains.visible = intensity > 0.01 && !indoors;
      grains.position.copy(player);
      material.opacity = exposure * 0.65;
      if (grains.visible) {
        for (let i = 0; i < count; i++) {
          const offset = i * 6;
          positions[offset] += delta * (32 + i % 13) * gust - moveX;
          positions[offset + 1] += delta * (Math.sin(time * 2 + positions[offset] * 0.15 + i) * 2.8 - 1.4) - moveY;
          positions[offset + 2] += delta * (12 * gust + Math.sin(time + i * 0.4) * 2) - moveZ;
          positions[offset] = THREE.MathUtils.euclideanModulo(positions[offset] + 50, 100) - 50;
          positions[offset + 2] = THREE.MathUtils.euclideanModulo(positions[offset + 2] + 50, 100) - 50;
          positions[offset + 1] = THREE.MathUtils.euclideanModulo(positions[offset + 1] + 20, 48) - 20;
          positions[offset + 3] = positions[offset] - (0.18 + i % 5 * 0.09) * gust;
          positions[offset + 4] = positions[offset + 1] + 0.03;
          positions[offset + 5] = positions[offset + 2] - (0.07 + i % 5 * 0.035) * gust;
        }
        attribute.needsUpdate = true;
      }
      overlay.style.opacity = String(exposure * (0.25 + gust * 0.15));
      return intensity;
    },
    applyAtmosphere() {
      const exposure = Number(overlay.style.opacity) / 0.4 || 0;
      // Base daylight/night colors are calculated first each frame.
      sandColor.copy(scene.fog.color).multiply(sandTint);
      scene.fog.color.lerp(sandColor, Math.min(1, exposure));
      material.color.copy(scene.fog.color).lerp(sandTint, 0.25);
      curtainMaterial.color.copy(scene.fog.color);
      scene.fog.near = THREE.MathUtils.lerp(300, 1.5, Math.min(1, exposure));
      scene.fog.far = THREE.MathUtils.lerp(1100, 18, Math.min(1, exposure ** 0.2));
    },
    getIntensity: () => intensity,
    getGust: () => gust,
  };
}
