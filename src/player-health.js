export const FALL_DAMAGE_HEIGHT = 8;
export const HEALTH_RECOVERY_DELAY = 25;

export function damageHealth(state, amount) {
  state.health = Math.max(0, state.health - amount);
  state.healthRecoveryDelay = HEALTH_RECOVERY_DELAY;
}

export function updateHealthRecovery(state, delta) {
  if (!state.running || state.health <= 0 || delta <= 0) return;
  const wait = Math.max(0, state.healthRecoveryDelay || 0);
  state.healthRecoveryDelay = Math.max(0, wait - delta);
  const healingTime = Math.max(0, delta - wait);
  state.health = Math.min(100, state.health + healingTime * 5);
}

export function applyFallDamage(state, previousHeight, height, velocity, landed, exempt = false) {
  if (velocity < 0) state.fallDistance = (state.fallDistance || 0) + Math.max(0, previousHeight - height);
  else state.fallDistance = 0;
  if (!landed) return false;
  const hurt = !exempt && state.fallDistance > FALL_DAMAGE_HEIGHT && velocity < -6;
  state.fallDistance = 0;
  if (hurt) damageHealth(state, 10);
  return hurt;
}
