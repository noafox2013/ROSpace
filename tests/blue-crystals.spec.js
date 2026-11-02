import { writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test('small blue crystals stay clustered, share the purple destruction sound and persist when mined', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      renderer.setPixelRatio(0.75);
      renderer.shadowMap.enabled = false;
      const crystalSounds = [];
      const originalPlay = audio.play;
      audio.play = (name, ...args) => { if (name === 'crystal' || name === 'rock') crystalSounds.push(name); originalPlay(name, ...args); };
      const firstBlue = blueCrystalGroups[0].members[0];
      window.blueTest = {
        read() {
          return {
            groups: blueCrystalGroups.map(cluster => ({ x: cluster.x, z: cluster.z, placed: cluster.placed,
              members: cluster.members.map(crystal => {
                const size = new THREE.Box3().setFromObject(crystal).getSize(new THREE.Vector3());
                return { position: crystal.position.toArray(), visible: crystal.visible, height: size.y,
                  clearance: crystal.position.y - terrainHeight(crystal.position.x, crystal.position.z),
                  blue: crystal.material.color.b > crystal.material.color.r,
                  inside: planetaryBase.inside(crystal.position) || abandonedBuilding.inside(crystal.position) };
              }) })),
            crystals: state.crystals, sounds: [...crystalSounds],
            purpleHeight: new THREE.Box3().setFromObject(crystals[0]).getSize(new THREE.Vector3()).y,
          };
        },
        hitBlue(fraction) { damageRock(firstBlue, getRockDestructionTime(firstBlue) * fraction); },
        hitPurple() { damageRock(crystals[0], getRockDestructionTime(crystals[0])); },
        rayHitsBlue() {
          const origin = firstBlue.position.clone().add(new THREE.Vector3(0, 3, 0));
          return findWeaponSurfaceHit(origin, new THREE.Vector3(0, -1, 0), 4)?.rock === firstBlue;
        },
        save() { return saveGame(); },
        travel() { ship.position.set(900, terrainHeight(900, 900) + 1, 900); updateGame(1 / 60); },
        capture() {
          const cluster = blueCrystalGroups[0];
          const position = camera.position.clone(), rotation = camera.quaternion.clone();
          const target = new THREE.Vector3(cluster.x, terrainHeight(cluster.x, cluster.z) + 0.4, cluster.z);
          camera.position.copy(target).add(new THREE.Vector3(4, 2.8, 5)); camera.lookAt(target);
          renderer.render(scene, camera); const result = canvas.toDataURL();
          camera.position.copy(position); camera.quaternion.copy(rotation); return result;
        },
      };
    ` });
  });
  await page.addInitScript(() => {
    let locked = null;
    Object.defineProperty(document, 'pointerLockElement', { get: () => locked });
    HTMLCanvasElement.prototype.requestPointerLock = async function () { locked = this; document.dispatchEvent(new Event('pointerlockchange')); };
    document.exitPointerLock = () => { locked = null; document.dispatchEvent(new Event('pointerlockchange')); };
  });
  const read = () => page.evaluate(() => window.blueTest.read());
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  const initial = await read();
  expect(initial.groups.length).toBe(8);
  for (const group of initial.groups) {
    expect(group.placed).toBe(true);
    expect(group.members.length).toBeGreaterThanOrEqual(5);
    expect(group.members.length).toBeLessThanOrEqual(8);
    for (const member of group.members) {
      expect(Math.hypot(member.position[0] - group.x, member.position[2] - group.z)).toBeLessThan(2.5);
      expect(member.height).toBeLessThan(1.2);
      expect(member.height).toBeLessThan(initial.purpleHeight / 3);
      expect(member.clearance).toBeCloseTo(0.04, 6);
      expect(member.blue).toBe(true);
      expect(member.inside).toBe(false);
    }
  }
  if (process.env.ROSPACE_CAPTURE) {
    const data = await page.evaluate(() => window.blueTest.capture());
    writeFileSync('/tmp/rospace-blue-crystals.png', Buffer.from(data.split(',')[1], 'base64'));
  }
  expect(await page.evaluate(() => window.blueTest.rayHitsBlue())).toBe(true);
  await page.evaluate(() => window.blueTest.hitBlue(0.4));
  expect((await read()).crystals).toBe(0);
  expect((await read()).sounds).toEqual([]);
  await page.evaluate(() => window.blueTest.hitBlue(0.6));
  const mined = await read();
  expect(mined.crystals).toBe(1);
  await expect(page.locator('#inventory-blue-crystal strong')).toHaveText('Blauer Kristall');
  await expect(page.locator('#inventory-blue-crystal small')).toHaveText('1 Stück');
  await expect(page.locator('#inventory-crystal small')).toHaveText('Noch nicht gesammelt');
  expect(await page.locator('#inventory-blue-crystal img').getAttribute('src')).not.toBe(await page.locator('#inventory-crystal img').getAttribute('src'));
  expect(mined.sounds).toEqual(['crystal']);
  expect(mined.groups[0].members[0].visible).toBe(false);
  expect(mined.groups[0].members.slice(1)).toEqual(initial.groups[0].members.slice(1));
  expect(await page.evaluate(() => window.blueTest.rayHitsBlue())).toBe(false);
  await page.evaluate(() => window.blueTest.hitPurple());
  expect((await read()).sounds).toEqual(['crystal', 'crystal']);
  expect(await page.evaluate(() => window.blueTest.save())).toBe(true);
  const saved = (await read()).groups;
  await page.reload();
  await page.locator('#load-button').click();
  const loaded = (await read()).groups;
  expect(loaded).toHaveLength(saved.length);
  for (let i = 0; i < saved.length; i++) {
    expect(loaded[i].members).toEqual(saved[i].members);
    expect(loaded[i].placed).toBe(true);
    expect(loaded[i].x).toBeCloseTo(saved[i].x, 8);
    expect(loaded[i].z).toBeCloseTo(saved[i].z, 8);
  }
  expect((await read()).crystals).toBe(2);
  await expect(page.locator('#inventory-blue-crystal small')).toHaveText('1 Stück');
  await expect(page.locator('#inventory-crystal small')).toHaveText('1 Stück');
  await expect(page.locator('#inventory-total')).toHaveText('2 gesammelt');
  await page.evaluate(() => window.blueTest.travel());
  const distant = await read();
  for (const group of distant.groups) {
    expect(group.placed).toBe(true);
    expect(Math.abs(group.x - 900)).toBeLessThan(150);
    expect(Math.abs(group.z - 900)).toBeLessThan(150);
    for (const member of group.members) {
      expect(member.visible).toBe(true);
      expect(Math.hypot(member.position[0] - group.x, member.position[2] - group.z)).toBeLessThan(2.5);
      expect(member.clearance).toBeCloseTo(0.04, 6);
    }
  }
  expect(errors).toEqual([]);
});
