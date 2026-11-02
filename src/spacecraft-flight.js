const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const approach = (value, target, step) => value + clamp(target - value, -step, step);

export function createSpacecraftFlight({ groundHeight = () => 0 } = {}) {
  const hoverHeight = 1.8;
  const state = {
    altitude: 0, height: 0, velocity: 0, velocityX: 0, velocityZ: 0,
    forwardSpeed: 0, forwardDistance: 0, offsetX: 0, offsetZ: 0,
    yaw: 0, pitch: 0, roll: 0, yawVelocity: 0, pitchVelocity: 0, rollVelocity: 0,
    throttle: 0, phase: 'landed',
  };
  let upWasHeld = false;
  let targetYaw = 0, targetPitch = 0, landingHeight = 0;

  function reset() {
    for (const key of Object.keys(state)) if (key !== 'phase') state[key] = 0;
    state.phase = 'landed';
    state.height = groundHeight(state);
    targetYaw = targetPitch = 0;
    landingHeight = state.height;
    upWasHeld = false;
  }

  function rotate(axis, target, dt, maxRate = 2.2) {
    const rate = `${axis}Velocity`;
    // Attitude thrusters accelerate and counter-thrust; mouse movement cannot
    // instantly rotate the hull or redirect its existing momentum.
    const acceleration = clamp((target - state[axis]) * 100 - state[rate] * 20, -12, 12);
    state[rate] = clamp(state[rate] + acceleration * dt, -maxRate, maxRate);
    state[axis] += state[rate] * dt;
    if (Math.abs(target - state[axis]) < 0.00001 && Math.abs(state[rate]) < 0.0001) {
      state[axis] = target;
      state[rate] = 0;
    }
  }

  function step(dt, { enabled, up, brake }) {
    const landing = state.phase === 'landing';
    const lifting = state.phase === 'lifting';
    if (landing || state.phase === 'landed') targetPitch = 0;
    rotate('yaw', targetYaw, dt);
    rotate('pitch', targetPitch, dt);
    state.pitch = clamp(state.pitch, -Math.PI / 2, Math.PI / 2);
    const horizontalSpeed = Math.hypot(state.velocityX, state.velocityZ);
    const bank = landing ? 0 : clamp(-state.yawVelocity * horizontalSpeed * 0.025, -0.28, 0.28)
      * Math.cos(state.pitch) ** 2;
    rotate('roll', bank, dt, 0.55);

    const powered = enabled && state.phase === 'flying' && up && !brake;
    state.throttle += ((powered ? 1 : 0) - state.throttle) * (1 - Math.exp(-dt / (powered ? 0.22 : 0.12)));
    if (state.throttle < 0.0001) state.throttle = 0;

    if (powered) {
      // Flight assist cancels sideways and vertical slip relative to the nose.
      // A short response time keeps turns smooth without long drifting arcs.
      const noseX = Math.sin(state.yaw) * Math.cos(state.pitch);
      const noseY = Math.sin(state.pitch);
      const noseZ = Math.cos(state.yaw) * Math.cos(state.pitch);
      const alongNose = state.velocityX * noseX + state.velocity * noseY + state.velocityZ * noseZ;
      const grip = 1 - Math.exp(-10 * dt);
      state.velocityX -= (state.velocityX - alongNose * noseX) * grip;
      state.velocity -= (state.velocity - alongNose * noseY) * grip;
      state.velocityZ -= (state.velocityZ - alongNose * noseZ) * grip;

      // Main-engine thrust still builds gradually along the nose.
      const noseSpeed = (state.velocityX * Math.sin(state.yaw) + state.velocityZ * Math.cos(state.yaw))
        * Math.cos(state.pitch) + state.velocity * Math.sin(state.pitch);
      const acceleration = 10 * state.throttle * Math.max(0, 1 - (Math.max(0, noseSpeed) / 24) ** 2);
      const horizontalThrust = Math.cos(state.pitch) * acceleration * dt;
      state.velocityX += Math.sin(state.yaw) * horizontalThrust;
      state.velocityZ += Math.cos(state.yaw) * horizontalThrust;
      state.velocity += Math.sin(state.pitch) * acceleration * dt;
      const drag = Math.exp(-0.08 * dt);
      state.velocityX *= drag;
      state.velocityZ *= drag;
      state.velocity *= drag;
    } else {
      // Releasing W actively stabilizes the craft instead of letting it coast.
      // Space and automatic landing apply stronger counter-thrust.
      const speed = Math.hypot(state.velocityX, state.velocity, state.velocityZ);
      const strongBrake = brake || landing;
      const remaining = Math.max(0, speed - (strongBrake ? 22 : 12) * dt)
        * Math.exp(-(strongBrake ? 3.8 : 2.6) * dt);
      const ratio = speed > 0 ? remaining / speed : 0;
      state.velocityX *= ratio;
      state.velocityZ *= ratio;
      if (!lifting && !landing) state.velocity *= ratio;
    }

    if (lifting || landing) {
      // The landing controller brakes and levels the hull before descending.
      // Near the ground it reduces sink rate for a soft touchdown.
      const canDescend = horizontalSpeed < 0.4 && Math.abs(state.pitch) < 0.04 && Math.abs(state.roll) < 0.04;
      const targetHeight = lifting ? groundHeight(state) + hoverHeight
        : canDescend ? groundHeight(state) : landingHeight;
      const error = targetHeight - state.height;
      const targetVelocity = clamp(error * 2, landing ? -3.5 : -1.6, 1.6);
      state.velocity = approach(state.velocity, targetVelocity, 3 * dt);
      if (Math.abs(error) < 0.004 && Math.abs(state.velocity) < 0.03) {
        state.height = targetHeight;
        state.velocity = 0;
        if (lifting) state.phase = 'hover';
      }
    }

    state.offsetX += state.velocityX * dt;
    state.offsetZ += state.velocityZ * dt;
    state.height += state.velocity * dt;
    const ground = groundHeight(state);
    const minimumHeight = ground + (landing || lifting || state.phase === 'landed' ? 0 : hoverHeight);
    if (state.height < minimumHeight) {
      state.height = minimumHeight;
      state.velocity = Math.max(0, state.velocity);
    }
    // The ceiling and ground-clearance assist counter-thrust before the limit.
    if (!lifting && !landing && state.phase !== 'landed') {
      const targetVelocity = clamp(state.velocity,
        -Math.sqrt(6 * Math.max(0, state.height - ground - hoverHeight)),
        Math.sqrt(6 * Math.max(0, ground + 120 - state.height)));
      state.velocity = approach(state.velocity, targetVelocity, 14 * dt);
      if (state.height > ground + 120) { state.height = ground + 120; state.velocity = Math.min(0, state.velocity); }
    }
    state.altitude = Math.max(0, state.height - ground);
    state.forwardSpeed = Math.hypot(state.velocityX, state.velocity, state.velocityZ);
    state.forwardDistance += (lifting ? 0 : landing ? Math.hypot(state.velocityX, state.velocityZ) : state.forwardSpeed) * dt;

    if (landing && state.altitude < 0.004 && state.forwardSpeed < 0.03 && Math.abs(state.pitch) < 0.0001 && Math.abs(state.roll) < 0.0001) {
      state.phase = 'landed';
      state.height = ground;
      state.altitude = state.velocity = state.velocityX = state.velocityZ = state.forwardSpeed = 0;
      state.pitch = state.pitchVelocity = state.roll = state.rollVelocity = 0;
      targetPitch = 0;
    }
  }

  reset();
  return {
    state,
    isLanded: () => state.phase === 'landed',
    reset,
    steer(yawDelta, pitchDelta) {
      if (state.phase !== 'hover' && state.phase !== 'flying') return;
      targetYaw += yawDelta;
      targetPitch = clamp(targetPitch + pitchDelta, -Math.PI / 2, Math.PI / 2);
    },
    update(delta, { occupied = false, canopyClosed = false, exitPending = false, up = false, down = false, brake = false } = {}) {
      const dt = clamp(delta, 0, 0.1);
      if (dt === 0) return state;
      const enabled = occupied && canopyClosed && !exitPending;
      const upPressed = up && !upWasHeld;
      upWasHeld = up;
      if (enabled && down && state.phase !== 'landed') {
        if (state.phase !== 'landing') landingHeight = state.height;
        state.phase = 'landing';
      } else if (enabled && upPressed && !down) {
        // A first tap completes takeoff; a fresh W press starts forward thrust.
        if (state.phase === 'landed') state.phase = 'lifting';
        else if (state.phase === 'hover') state.phase = 'flying';
      }
      if (state.phase === 'flying' && (!enabled || !up || down)) state.phase = 'hover';
      // Small physics steps keep acceleration and braking consistent at low FPS.
      const steps = Math.ceil(dt * 120);
      for (let i = 0; i < steps; i++) step(dt / steps, { enabled, up, brake: enabled && brake });
      return state;
    },
  };
}
