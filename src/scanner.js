import * as THREE from 'three';

export function createScanner(scene, container, terrainHeight) {
  let range = 100;
  const duration = 15;
  const origin = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const geometry = new THREE.RingGeometry(0.97, 1, 128);
  const material = new THREE.MeshBasicMaterial({ color: 0x70eee1, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const wave = new THREE.Mesh(geometry, material);
  wave.frustumCulled = false;
  wave.visible = false;
  scene.add(wave);
  const status = document.createElement('div');
  status.id = 'scan-status'; status.setAttribute('role', 'status'); status.hidden = true;
  container.append(status);
  const vertices = geometry.attributes.position.array.slice();
  let age = duration;
  let targets = [];
  function clear() {
    for (const target of targets) target.label.remove();
    targets = []; age = duration; wave.visible = false; status.hidden = true;
  }
  function start(position, candidates, scanRange = 100) {
    if (age < duration) return false;
    clear(); origin.copy(position); age = 0; range = scanRange;
    targets = candidates.filter(target => target.object.visible && target.object.position.distanceTo(origin) <= range)
      .sort((a, b) => a.object.position.distanceTo(origin) - b.object.position.distanceTo(origin))
      .slice(0, 24).map(target => {
        const label = document.createElement('div');
        label.className = `scan-marker ${target.kind}`; label.hidden = true;
        const title = document.createElement('span'); title.textContent = target.title;
        const distance = document.createElement('strong'); label.append(title, distance); container.append(label);
        return { ...target, label, distance, detected: false };
      });
    status.hidden = false; status.textContent = 'Umgebung wird gescannt …';
    return true;
  }
  function update(delta, camera, player, running) {
    if (!running) { clear(); return; }
    if (age >= duration) return;
    age += delta;
    if (age >= duration) { clear(); return; }
    const radius = Math.min(1, age / 2) * range;
    wave.visible = age < 2;
    material.opacity = 0.6 * (1 - age / 2);
    if (wave.visible) {
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = origin.x + vertices[i * 3] * radius;
        const z = origin.z + vertices[i * 3 + 1] * radius;
        positions.setXYZ(i, x, terrainHeight(x, z) + 0.09, z);
      }
      positions.needsUpdate = true;
    }
    camera.updateMatrixWorld(true);
    for (const target of targets) {
      if (target.object.position.distanceTo(origin) <= radius) target.detected = true;
      projected.copy(target.object.position); projected.y += target.kind === 'base' ? 5 : 2;
      projected.project(camera);
      target.label.hidden = !target.detected || !target.object.visible || projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 0.96 || Math.abs(projected.y) > 0.92;
      target.label.style.left = `${(projected.x * 0.5 + 0.5) * 100}%`;
      target.label.style.top = `${(0.5 - projected.y * 0.5) * 100}%`;
      target.label.style.opacity = String(Math.min(1, duration - age));
      const distanceText = `${Math.round(target.object.position.distanceTo(player))} m`;
      if (target.distance.textContent !== distanceText) target.distance.textContent = distanceText;
    }
    if (age - delta < 2 && age >= 2) status.textContent = 'Scan abgeschlossen';
  }
  return { start, update, clear };
}
