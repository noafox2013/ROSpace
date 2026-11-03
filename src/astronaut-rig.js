import * as THREE from 'three';

// Local joint lengths share the model's scale. The sole remains at its original
// height, so changing anatomy does not move the player through the terrain.
export const astronautAnatomy = Object.freeze({
  thigh: 0.515,
  shin: 0.515,
  upperArm: 0.37,
  forearm: 0.35,
});

export function sampleAstronautStep(phase, amount, sprint = 0) {
  const cycle = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
  sprint = THREE.MathUtils.clamp(sprint, 0, 1);
  const stance = THREE.MathUtils.lerp(0.6, 0.38, sprint);
  const swinging = cycle > stance;
  const swing = swinging ? (cycle - stance) / (1 - stance) : 0;
  const reach = (0.25 + sprint * 0.15) * amount;
  // Match the backward velocity of the planted foot at both ends of its
  // return arc. The small push-off and follow-through avoid a sharp reversal.
  const tangent = -(1 - stance) / stance;
  const returnArc = tangent * swing + (3 - 3 * tangent) * swing ** 2
    + (2 * tangent - 2) * swing ** 3;
  const travel = swinging ? THREE.MathUtils.lerp(-reach, reach, returnArc)
    : THREE.MathUtils.lerp(reach, -reach, cycle / stance);
  const lift = Math.sin(swing * Math.PI) ** 2 * (0.16 + sprint * 0.23) * amount;
  const roll = (swinging ? THREE.MathUtils.lerp(-0.23, 0.13, THREE.MathUtils.smoothstep(swing, 0, 1))
      - Math.sin(swing * Math.PI) ** 2 * 0.14
    : 0.13 * (1 - THREE.MathUtils.smoothstep(cycle / stance, 0, 0.27))
      - 0.23 * THREE.MathUtils.smoothstep(cycle / stance, 0.67, 1)) * amount;
  return { travel, lift, roll, swinging, swing, stance };
}

// Pose targets depend on thrust and vertical speed, never on a repeating kick.
export function sampleAstronautFlight(height, velocity, burn) {
  const thrust = THREE.MathUtils.clamp(burn, 0, 1);
  const falling = THREE.MathUtils.smoothstep(-velocity, 0.3, 5);
  const landing = falling * (1 - THREE.MathUtils.smoothstep(height, 0.15, 1.6));
  return {
    tuck: (0.13 + thrust * 0.10 + falling * 0.13) * (1 - landing * 0.85),
    trail: (0.10 + thrust * 0.10) * (1 - landing),
    armSpread: 0.035 + falling * 0.065 + thrust * 0.025,
    landing,
    thrust,
  };
}

export function smoothMinimum(a, b, softness = 0.012) {
  return (a + b - Math.sqrt((a - b) ** 2 + softness ** 2)) * 0.5;
}

export function solveLimbJoint(start, end, upperLength, lowerLength, bendDirection) {
  const axis = end.clone().sub(start);
  const distance = THREE.MathUtils.clamp(axis.length(),
    Math.abs(upperLength - lowerLength) + 0.001, upperLength + lowerLength - 0.001);
  axis.normalize();
  const along = (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
  const bend = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
  const direction = bendDirection.clone().addScaledVector(axis, -bendDirection.dot(axis));
  if (direction.lengthSq() < 0.000001) {
    direction.set(1, 0, 0).addScaledVector(axis, -axis.x);
    if (direction.lengthSq() < 0.000001) direction.set(0, 0, 1);
  }
  return start.clone().addScaledVector(axis, along).addScaledVector(direction.normalize(), bend);
}

export function alignLimb(mesh, start, end) {
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), start.clone().sub(end).normalize());
}

export function poseAstronautArms(rig, { swing = 0, amount = 0, flight = 0,
  flightForward = 0, flightSideways = 0 } = {}) {
  rig.glove.rotation.set(-0.08 + swing * 0.35 + flight * 0.18 + flightForward * 0.1,
    rig.side * 0.05, rig.side * (0.06 + amount * 0.04) - swing * 0.12 - flightSideways * 0.12);
  const shoulder = rig.shoulder.position.clone();
  const wristOffset = new THREE.Vector3(0, 0.085, -0.015).applyQuaternion(rig.glove.quaternion);
  const wrist = rig.glove.position.clone().add(wristOffset);
  // Keep the wrist within reach when the flight animation raises the hand.
  const reach = wrist.clone().sub(shoulder);
  const maximum = astronautAnatomy.upperArm + astronautAnatomy.forearm - 0.002;
  if (reach.length() > maximum) {
    wrist.copy(shoulder).add(reach.setLength(maximum));
    rig.glove.position.copy(wrist).sub(wristOffset);
  }
  const elbow = solveLimbJoint(shoulder, wrist, astronautAnatomy.upperArm,
    astronautAnatomy.forearm, new THREE.Vector3(rig.side * (0.28 + amount * 0.2
      + Math.abs(flightSideways) * 0.12), swing * 0.15, -1));
  alignLimb(rig.upperArm, shoulder, elbow);
  alignLimb(rig.forearm, elbow, wrist);
  rig.elbow.position.copy(elbow);
  rig.elbow.quaternion.copy(rig.forearm.quaternion);
  rig.wristRing.position.copy(wrist);
  rig.wristRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), elbow.clone().sub(wrist).normalize());
}

// Joint pivots keep all finger segments connected throughout the grip.
export function poseAstronautHand(rig, grip) {
  const closed = THREE.MathUtils.smoothstep(grip, 0, 1);
  for (const finger of rig.fingers) {
    finger[0].rotation.x = -closed * 0.70;
    finger[1].rotation.x = -closed * 1.05;
    finger[2].rotation.x = -closed * 0.75;
  }
  rig.thumb.position.copy(rig.thumbRestPosition);
  rig.thumb.position.x -= rig.side * closed * 0.035;
  rig.thumb.position.y -= closed * 0.025;
  rig.thumb.position.z += closed * 0.025;
  rig.thumb.rotation.copy(rig.thumbRestRotation);
  rig.thumb.rotation.y -= rig.side * closed * 0.65;
  rig.thumb.rotation.z += rig.side * closed * 0.55;
}
