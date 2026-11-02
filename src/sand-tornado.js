// The jetpack integrates height; a tornado temporarily controls vertical speed.
export function createTornadoFlight() {
  let phase = 'idle', age = 0, cooldown = 0, centerX = 0, centerZ = 0;
  return {
    update(delta, state, position, tornadoes, sheltered) {
      if (delta <= 0) return phase !== 'idle';
      cooldown = Math.max(0, cooldown - delta);
      if (sheltered) { phase = 'idle'; return false; }
      if (phase === 'idle' && cooldown === 0) {
        // The nearest funnel pulls from four core radii away. Close to its
        // center the inflow becomes stronger than the explorer's running speed.
        let tornado = null, distance = Infinity;
        for (const candidate of tornadoes) {
          const d = Math.hypot(position.x - candidate.x, position.z - candidate.z);
          if (state.flightHeight < candidate.height && d < candidate.radius * 4 && d < distance) {
            tornado = candidate; distance = d;
          }
        }
        if (tornado && distance > 0.001) {
          const strength = Math.pow(1 - distance / (tornado.radius * 4), 1.25);
          const pull = Math.min(distance, 22 * strength * delta);
          position.x += (tornado.x - position.x) / distance * pull;
          position.z += (tornado.z - position.z) / distance * pull;
          distance -= pull;
        }
        if (tornado && distance < tornado.radius) {
          phase = 'lift'; age = 0;
          centerX = tornado.x; centerZ = tornado.z;
        }
      }
      if (phase === 'idle') return false;
      age += delta;
      if (phase === 'lift') {
        state.flightVelocity = 24;
        // Pull inward while whipping the explorer around the funnel.
        const x = position.x - centerX, z = position.z - centerZ;
        const radius = Math.max(2, Math.hypot(x, z));
        position.x += (-z / radius * 11 - x * 0.7) * delta;
        position.z += (x / radius * 11 - z * 0.7) * delta;
        if (age >= 1.15) { phase = 'slam'; state.flightVelocity = -32; }
      } else state.flightVelocity = Math.max(-48, state.flightVelocity - 48 * delta);
      return true;
    },
    land(state, onImpact) {
      if (phase !== 'slam') return false;
      phase = 'idle'; cooldown = 7;
      state.health = Math.max(0, state.health - 25);
      onImpact();
      return true;
    },
    isSlamming: () => phase === 'slam',
    snapshot: () => ({ phase, age, cooldown, centerX, centerZ }),
    restore(value) {
      phase = 'idle'; age = cooldown = centerX = centerZ = 0;
      if (!value || !['idle', 'lift', 'slam'].includes(value.phase)
        || ![value.age, value.cooldown, value.centerX, value.centerZ].every(Number.isFinite)) return;
      phase = value.phase; age = Math.max(0, value.age);
      cooldown = Math.max(0, Math.min(7, value.cooldown));
      centerX = value.centerX; centerZ = value.centerZ;
    },
    reset() { this.restore(null); },
  };
}
