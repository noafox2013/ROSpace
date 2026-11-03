import assert from 'node:assert/strict';
import * as THREE from 'three';
import { poseAstronautHand } from '../src/astronaut-rig.js';

for (const side of [-1, 1]) {
  const glove = new THREE.Group();
  const fingers = [];
  const tips = [];
  for (let index = 0; index < 4; index++) {
    const joints = [[side * (index - 1.5) * 0.036, -0.045, 0.018],
      [0, -0.055, 0.010], [0, -0.040, 0.024]];
    let parent = glove;
    const pivots = joints.map(point => {
      const pivot = new THREE.Group();
      pivot.position.set(...point);
      parent.add(pivot);
      parent = pivot;
      return pivot;
    });
    const tip = new THREE.Object3D();
    tip.position.set(0, -0.015, 0.023);
    parent.add(tip);
    fingers.push(pivots);
    tips.push(tip);
  }
  const thumb = new THREE.Object3D();
  thumb.position.set(side * 0.075, -0.025, 0.045);
  glove.add(thumb);
  const rig = { side, fingers, thumb, thumbRestPosition: thumb.position.clone(),
    thumbRestRotation: thumb.rotation.clone() };
  poseAstronautHand(rig, 0);
  glove.updateMatrixWorld(true);
  const openTips = tips.map(tip => tip.getWorldPosition(new THREE.Vector3()));
  for (let frame = 0; frame <= 60; frame++) {
    poseAstronautHand(rig, frame / 60);
    glove.updateMatrixWorld(true);
    for (const finger of fingers) {
      for (let joint = 1; joint < 3; joint++) {
        const start = finger[joint - 1].getWorldPosition(new THREE.Vector3());
        const end = finger[joint].getWorldPosition(new THREE.Vector3());
        assert.ok(Math.abs(start.distanceTo(end) - finger[joint].position.length()) < 1e-10);
      }
    }
  }
  tips.forEach((tip, index) => assert.ok(tip.getWorldPosition(new THREE.Vector3()).length() < openTips[index].length()));
  poseAstronautHand(rig, 0);
  glove.updateMatrixWorld(true);
  tips.forEach((tip, index) => assert.ok(tip.getWorldPosition(new THREE.Vector3()).distanceTo(openTips[index]) < 1e-10));
  assert.ok(thumb.position.equals(rig.thumbRestPosition));
}
console.log('Both hands close into fists with connected joints and return to their relaxed pose.');
