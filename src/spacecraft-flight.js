export function createSpacecraftFlight() {
  const state = { altitude: 0, velocity: 0 };
  return {
    state,
    isLanded: () => state.altitude === 0 && state.velocity === 0,
    reset() { state.altitude = state.velocity = 0; },
    update(delta, { occupied = false, canopyClosed = false, exitPending = false, up = false, down = false } = {}) {
      const dt = Math.max(0, Math.min(delta, 0.1));
      const enabled = occupied && canopyClosed && !exitPending;
      const target = enabled && up !== down ? (up ? 6 : -4) : 0;
      state.velocity += (target - state.velocity) * (1 - Math.exp(-3 * dt));
      if (Math.abs(state.velocity) < 0.005 && target === 0) state.velocity = 0;
      state.altitude += state.velocity * dt;
      if (state.altitude <= 0) { state.altitude = 0; state.velocity = 0; }
      if (state.altitude >= 80) { state.altitude = 80; state.velocity = Math.min(0, state.velocity); }
      return state;
    },
  };
}
