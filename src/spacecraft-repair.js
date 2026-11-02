export function activateArchive(state) {
  if (state.archiveActivated === 1) return 'active';
  if ((state.cors || 0) < 50) return 'funds';
  state.cors -= 50;
  state.archiveActivated = 1;
  return 'success';
}

export function recoverFuelTank(state) {
  if (state.archiveRead >= 1) return false;
  if (state.archiveActivated !== 1) return false;
  state.archiveRead = 1;
  if (state.spacecraftRepaired !== 1) state.fuelTank = 1;
  return true;
}

export function repairSpacecraft(state) {
  if (state.spacecraftRepaired === 1) return 'repaired';
  if (state.fuelTank !== 1) return 'tank';
  if (state.landingStrut !== 1) return 'landing-strut';
  if ((state.blueCrystals || 0) < 20) return 'blue-crystals';
  if (state.crystals < 50) return 'crystals';
  state.crystals -= 50;
  // Reserve the 20 blue crystals, then spend the other 30 purple-first.
  state.blueCrystals = Math.min(state.blueCrystals - 20, state.crystals);
  state.fuelTank = 0;
  state.landingStrut = 0;
  state.spacecraftRepaired = 1;
  return 'success';
}
