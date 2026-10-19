import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSandworm } from '../src/sandworm.js';

function airborneWorm() {
  const worm = createSandworm(() => 0);
  const player = new THREE.Vector3(0, 1, 0);
  worm.reset(player, 0);
  worm.update(3, player, 0);
  return worm;
}

test('the mouth catches an explorer inside its opening', () => {
  const worm = airborneWorm();
  const player = worm.object.position.clone();
  assert.equal(worm.update(0, player, 0), 'mouth');
});

test('body contact causes a graze and pushes the explorer away', () => {
  const worm = airborneWorm();
  const matrix = new THREE.Matrix4();
  worm.object.children[0].getMatrixAt(30, matrix);
  const player = new THREE.Vector3().setFromMatrixPosition(matrix).add(worm.object.position);
  const before = player.clone();
  assert.equal(worm.update(0, player, 0), 'body');
  assert(player.distanceTo(before) > 0);
});

test('nearby explorers outside the mouth and body are safe', () => {
  const worm = airborneWorm();
  const player = worm.object.position.clone().add(new THREE.Vector3(30, 0, 0));
  assert.equal(worm.update(0, player, 0), null);
});

test('buried worm does not hit the explorer above it', () => {
  const worm = createSandworm(() => 0);
  worm.reset(new THREE.Vector3(0, 1, 0), 0);
  const player = worm.object.position.clone(); player.y = 1;
  assert.equal(worm.update(0, player, 0), null);
});

test('brushing the outer lip damages without counting as a bite', () => {
  const worm = airborneWorm();
  const head = worm.object.getObjectByName('sandworm-head');
  const player = new THREE.Vector3(3.2 * head.scale.x, 0, 0)
    .applyQuaternion(head.quaternion).add(worm.object.position);
  assert.equal(worm.update(0, player, 0), 'body');
});

test('one hit per weak point repels the worm', () => {
  const worm = airborneWorm();
  const weakPoint = worm.object.getObjectByName('sandworm-weak-point');
  assert.equal(worm.hitLaser(worm.object.children[0]), false);
  assert.equal(worm.isRepelled(), false);
  worm.object.updateMatrixWorld(true);
  const center = weakPoint.getWorldPosition(new THREE.Vector3());
  const outward = new THREE.Vector3(0, 1, 0).applyQuaternion(weakPoint.quaternion);
  const ray = new THREE.Raycaster(center.clone().addScaledVector(outward, 30), outward.clone().negate(), 0, 60);
  const hit = ray.intersectObjects(worm.getLaserTargets(), true)[0];
  assert.equal(hit.object, weakPoint);
  const firstPosition = weakPoint.position.clone();
  assert.equal(worm.hitLaser(hit.object), true);
  assert.equal(worm.isRepelled(), false);
  assert(weakPoint.position.distanceTo(firstPosition) > 10);
  assert.deepEqual(worm.getWeakPointProgress(), { stage: 1, hits: 0 });
  worm.object.updateMatrixWorld(true);
  const secondCenter = weakPoint.getWorldPosition(new THREE.Vector3());
  const secondNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(weakPoint.quaternion);
  ray.set(secondCenter.clone().addScaledVector(secondNormal, 30), secondNormal.clone().negate());
  assert.equal(ray.intersectObjects(worm.getLaserTargets(), true)[0].object, weakPoint);
  assert.equal(worm.hitLaser(weakPoint), true);
  assert.equal(worm.isRepelled(), true);
  assert.equal(worm.hitLaser(hit.object), false);
  const before = worm.object.position.y;
  const player = worm.object.position.clone();
  for (let i = 0; i < 210; i++) assert.equal(worm.update(1 / 60, player, 0), null);
  assert(worm.object.position.y < before - 100);
  assert.equal(worm.getLaserTargets().length, 0);
  worm.update(30, player, 0);
  assert.equal(worm.getLaserTargets().length, 0);
  worm.reset(new THREE.Vector3(), 0);
  assert.equal(worm.isRepelled(), false);
  assert(worm.getLaserTargets().includes(weakPoint));
});

test('saved retreat can be restored without making the worm attack again', () => {
  const worm = airborneWorm();
  worm.repel(true);
  assert.equal(worm.update(0, new THREE.Vector3(), 0), null);
  assert.equal(worm.getLaserTargets().length, 0);
});

test('the continuous beam needs one pulse per weak point', () => {
  const worm = airborneWorm();
  const target = worm.object.getObjectByName('sandworm-weak-point');
  const player = new THREE.Vector3(500, 1, 500);
  assert.equal(worm.hitLaser(target, 'beam'), true);
  for (let pulse = 0; pulse < 1; pulse++) {
    assert.equal(worm.hitLaser(target, 'beam'), false);
    assert.equal(worm.isRepelled(), false);
    worm.update(0.61, player, 0);
    assert.equal(worm.hitLaser(target, 'beam'), true);
  }
  assert.equal(worm.isRepelled(), true);
  worm.reset(player, 0);
  assert.equal(worm.hitLaser(target), true);
  assert.equal(worm.isRepelled(), false);
});

test('the target ring pulses and is only a visual marker', () => {
  const worm = airborneWorm();
  const ring = worm.object.getObjectByName('sandworm-weak-point-ring');
  const scale = ring.scale.x;
  worm.update(0.2, new THREE.Vector3(500, 1, 500), 0);
  assert.notEqual(ring.scale.x, scale);
  const hits = [];
  ring.raycast(new THREE.Raycaster(), hits);
  assert.equal(hits.length, 0);
  assert.equal(worm.hitLaser(ring), false);
  worm.repel();
  assert.equal(ring.visible, false);
  worm.reset(new THREE.Vector3(), 0);
  assert.equal(ring.visible, true);
});

test('landing maintains a dense cloud around the impact site', () => {
  const worm = createSandworm(() => 0);
  const player = new THREE.Vector3();
  worm.reset(player, 0);
  let impact;
  let wasAbove = false;
  for (let frame = 0; frame < 390; frame++) {
    worm.update(1 / 60, player, 0);
    if (worm.object.position.y > 0) wasAbove = true;
    if (!impact && wasAbove && worm.object.position.y <= 0) impact = worm.object.position.clone();
  }
  assert(impact);
  const dust = worm.object.getObjectByName('sandworm-dust-clouds');
  const position = dust.geometry.attributes.position;
  let nearImpact = 0;
  for (let i = 0; i < dust.geometry.drawRange.count; i++) {
    const x = position.getX(i) + worm.object.position.x;
    const z = position.getZ(i) + worm.object.position.z;
    if (Math.hypot(x - impact.x, z - impact.z) < 22) nearImpact++;
  }
  assert(nearImpact > 250);
});

test('impact dust starts before the head center enters the ground', () => {
  const worm = createSandworm(() => 0);
  const player = new THREE.Vector3();
  worm.reset(player, 0);
  const dust = worm.object.getObjectByName('sandworm-dust-clouds');
  let sawEarlyImpact = false;
  for (let frame = 0; frame < 330; frame++) {
    worm.update(1 / 60, player, 0);
    const count = dust.geometry.drawRange.count;
    const positions = dust.geometry.attributes.position;
    let nearby = 0;
    for (let i = 0; i < count; i++) {
      if (Math.hypot(positions.getX(i), positions.getZ(i)) < 20) nearby++;
    }
    if (frame > 180 && worm.object.position.y > 0 && nearby >= 250) sawEarlyImpact = true;
  }
  assert(sawEarlyImpact);
});

test('emerging produces the same initial dust burst as landing', () => {
  const worm = createSandworm(() => 0);
  const player = new THREE.Vector3();
  worm.reset(player, 0);
  const dust = worm.object.getObjectByName('sandworm-dust-clouds');
  let previous = 0;
  let takeoff = 0;
  let landing = 0;
  for (let frame = 0; frame < 330; frame++) {
    worm.update(1 / 60, player, 0);
    const count = dust.geometry.drawRange.count;
    const burst = count - previous;
    if (frame < 180) takeoff = Math.max(takeoff, burst);
    else {
      // A full pool replaces older particles instead of increasing the total count.
      const positions = dust.geometry.attributes.position;
      let nearby = 0;
      for (let i = 0; i < count; i++) {
        if (Math.hypot(positions.getX(i), positions.getZ(i)) < 20) nearby++;
      }
      if (worm.object.position.y > 0) landing = Math.max(landing, nearby);
    }
    previous = count;
  }
  assert(takeoff >= 300);
  assert(landing >= 250);
});

test('the worm stays hidden until the fifth crystal and awakens near the current player', () => {
  const worm = createSandworm(() => 0);
  const player = new THREE.Vector3();
  worm.reset(player, 0, false);
  for (let crystals = 0; crystals < 5; crystals++) {
    assert.equal(worm.awaken(crystals, player, 0), false);
    assert.equal(worm.update(30, player, 0), null);
    assert.equal(worm.object.visible, false);
    assert.equal(worm.getLaserTargets().length, 0);
  }
  const weakPoint = worm.object.getObjectByName('sandworm-weak-point');
  assert.equal(worm.hitLaser(weakPoint), false);
  player.set(700, 1, -400);
  assert.equal(worm.awaken(5, player, 0), true);
  assert.equal(worm.object.visible, true);
  assert(worm.object.position.distanceTo(player) < 65);
  worm.update(1, player, 0);
  assert(worm.object.position.y > -24);
  assert.equal(worm.awaken(6, player, 0), false);
  worm.repel(true);
  assert.equal(worm.awaken(7, player, 0), false);
  worm.reset(player, 0, false);
  assert.equal(worm.object.visible, false);
});

test('sand grains appear at contact and fall out while fine dust remains', () => {
  const worm = createSandworm(() => 0);
  const player = new THREE.Vector3();
  worm.reset(player, 0);
  const sand = worm.object.getObjectByName('sandworm-sand');
  const dust = worm.object.getObjectByName('sandworm-dust-clouds');
  assert.equal(sand.geometry.drawRange.count, 0);
  for (let i = 0; i < 60; i++) worm.update(1 / 60, player, 0);
  assert(sand.geometry.drawRange.count > 0);
  assert(sand.geometry.drawRange.count <= 240);
  worm.repel();
  for (let i = 0; i < 240; i++) worm.update(1 / 60, player, 0);
  assert.equal(sand.geometry.drawRange.count, 0);
  assert(dust.geometry.drawRange.count > 0);
  worm.reset(player, 0);
  assert.equal(sand.geometry.drawRange.count, 0);
});

test('valid laser hits flash the target green across both phases', () => {
  const worm = airborneWorm();
  const target = worm.object.getObjectByName('sandworm-weak-point');
  const player = new THREE.Vector3(500, 1, 500);
  assert.equal(target.material.color.getHex(), 0xff6c24);
  worm.hitLaser(target);
  assert.equal(target.material.color.getHex(), 0x56ff85);
  assert.equal(target.material.emissive.getHex(), 0x16ff4b);
  worm.update(0.4, player, 0);
  assert.equal(target.material.color.getHex(), 0xff6c24);
  assert.equal(worm.isRepelled(), false);
  worm.hitLaser(target);
  assert(worm.isRepelled());
  assert.equal(target.material.color.getHex(), 0x56ff85);
  worm.update(0.1, player, 0);
  assert.equal(target.material.color.getHex(), 0x56ff85);
  worm.reset(player, 0);
  assert.equal(target.material.color.getHex(), 0xff6c24);
});

test('ground tremors start when the worm awakens, weaken with distance and fade', () => {
  const worm = createSandworm(() => 0);
  const player = new THREE.Vector3();
  worm.reset(player, 0, false);
  assert.equal(worm.getGroundShake(player), 0);
  worm.awaken(5, player, 0);
  const near = worm.object.position.clone();
  const far = near.clone().add(new THREE.Vector3(200, 0, 0));
  assert(worm.getGroundShake(near) > 0);
  assert.equal(worm.getGroundShake(far), 0);
  for (let i = 0; i < 60; i++) worm.update(1 / 60, player, 0);
  assert(worm.getGroundShake(worm.object.position) > 0);
  worm.repel();
  for (let i = 0; i < 600; i++) worm.update(1 / 60, player, 0);
  assert(worm.getGroundShake(near) < 0.001);
  worm.reset(player, 0, false);
  assert.equal(worm.getGroundShake(player), 0);
});

test('second weak point progress can be saved and restored', () => {
  const worm = airborneWorm();
  const target = worm.object.getObjectByName('sandworm-weak-point');
  worm.hitLaser(target);
  const progress = worm.getWeakPointProgress();
  assert.deepEqual(progress, { stage: 1, hits: 0 });
  const restored = airborneWorm();
  assert(restored.restoreWeakPointProgress(progress));
  assert.deepEqual(restored.getWeakPointProgress(), progress);
  assert.equal(restored.restoreWeakPointProgress({ stage: 1, hits: 1 }), false);
  const nextTarget = restored.object.getObjectByName('sandworm-weak-point');
  assert.equal(restored.isRepelled(), false);
  restored.hitLaser(nextTarget);
  assert.equal(restored.isRepelled(), true);
});

test('a defeated worm returns at the next dawn with both weak points reset', () => {
  const worm = airborneWorm();
  const player = new THREE.Vector3(400, 1, 400);
  assert.equal(worm.updateDawn(100, 720, player, 0), false);
  const target = worm.object.getObjectByName('sandworm-weak-point');
  for (let i = 0; i < 8; i++) worm.hitLaser(target);
  assert(worm.isRepelled());
  assert.equal(worm.updateDawn(719.9, 720, player, 0), false);
  assert(worm.isRepelled());
  assert.equal(worm.updateDawn(720, 720, player, 0), true);
  assert.equal(worm.isRepelled(), false);
  assert.deepEqual(worm.getWeakPointProgress(), { stage: 0, hits: 0 });
  assert(worm.object.position.distanceTo(player) < 65);
  assert(worm.getGroundShake(player) > 0);
  assert.equal(worm.updateDawn(721, 720, player, 0), false);
  worm.hitLaser(target);
  assert.equal(worm.updateDawn(1440, 720, player, 0), false);
  assert.deepEqual(worm.getWeakPointProgress(), { stage: 1, hits: 0 });
});

test('loading a defeated worm waits for a future dawn, and dormant worms stay dormant', () => {
  const worm = createSandworm(() => 0);
  const player = new THREE.Vector3();
  worm.reset(player, 0, true);
  worm.repel(true);
  assert.equal(worm.updateDawn(900, 720, player, 0), false);
  assert(worm.isRepelled());
  assert.equal(worm.updateDawn(1440, 720, player, 0), true);
  worm.reset(player, 0, false);
  worm.updateDawn(0, 720, player, 0);
  assert.equal(worm.updateDawn(720, 720, player, 0), false);
  assert.equal(worm.object.visible, false);
});

for (const speed of [0, 5]) {
  test(`the first leap intercepts an explorer moving at ${speed} units per second`, () => {
    const worm = createSandworm(() => 0);
    worm.reset(new THREE.Vector3(0, 1, 0), Math.PI);
    let contact = false;
    for (let frame = 1; frame <= 360; frame++) {
      const player = new THREE.Vector3(speed * frame / 60, 1, 0);
      if (worm.update(1 / 60, player, Math.PI)) contact = true;
    }
    assert(contact, 'the predicted leap should reach the explorer');
  });
}

test('the horn requires an awakened worm that has not been repelled', () => {
  const worm = createSandworm(() => 0);
  const player = new THREE.Vector3(0, 1, 0);
  assert.equal(worm.isPresent(), false);
  worm.reset(player, 0, false);
  assert.equal(worm.isPresent(), false);
  worm.awaken(5, player, 0);
  assert.equal(worm.isPresent(), true);
  worm.repel(true);
  assert.equal(worm.isPresent(), false);
});
