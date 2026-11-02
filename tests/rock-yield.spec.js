import { writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test('mining awards 1–5 stones by size and shows the same number of fragments', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /shader|WebGLProgram/i.test(message.text())) errors.push(message.text()); });
  await page.setViewportSize({ width: 800, height: 600 });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: await response.text() + `
      renderer.setPixelRatio(0.5);
      renderer.shadowMap.enabled = false;
      let miningTestRock;
      window.miningTest = {
        capture() {
          renderer.setPixelRatio(1);
          const rock = rocks.filter(rock => !rock.userData.isCrystal).sort((a,b) => b.userData.hitRadius-a.userData.hitRadius)[0];
          const position = camera.position.clone(), rotation = camera.quaternion.clone(), day = dayStartedAt;
          dayStartedAt = performance.now() - (daylightDuration * 0.4 - initialSunAngle / Math.PI * daylightDuration) * 1000;
          updateSunAndKeyLight();
          const bounds = new THREE.Box3().setFromObject(rock), center = bounds.getCenter(new THREE.Vector3());
          const size = bounds.getSize(new THREE.Vector3()).length();
          camera.position.copy(center).add(new THREE.Vector3(size*0.6,size*0.35,size*0.8));
          camera.lookAt(center); skyDome.position.copy(camera.position);
          renderer.shadowMap.enabled=true;
          keyLight.target.position.copy(center);keyLight.target.updateMatrixWorld();
          keyLight.position.copy(center).addScaledVector(sunDirection,keyLightDistance);
          renderer.render(scene,camera); const data = canvas.toDataURL();
          camera.position.copy(position); camera.quaternion.copy(rotation); dayStartedAt = day;
          renderer.setPixelRatio(0.5);renderer.shadowMap.enabled=false;
          return data;
        },
        captureFragments() {
          for(let frame=0;frame<120;frame++) updateRockFragments(1/60);
          const fragment=rockFragments.find(fragment=>fragment.visible && fragment.userData.stoneDebris);
          renderer.setPixelRatio(1);
          const position=camera.position.clone(),rotation=camera.quaternion.clone(),day=dayStartedAt;
          dayStartedAt=performance.now()-(daylightDuration*0.4-initialSunAngle/Math.PI*daylightDuration)*1000;
          updateSunAndKeyLight();
          const bounds=new THREE.Box3().setFromObject(fragment),center=bounds.getCenter(new THREE.Vector3());
          const size=Math.max(0.3,bounds.getSize(new THREE.Vector3()).length());
          camera.position.copy(center).add(new THREE.Vector3(size*0.8,size*0.6,size));camera.lookAt(center);
          renderer.shadowMap.enabled=true;
          keyLight.target.position.copy(center);keyLight.target.updateMatrixWorld();
          keyLight.position.copy(center).addScaledVector(sunDirection,keyLightDistance);
          skyDome.position.copy(camera.position);renderer.render(scene,camera);const data=canvas.toDataURL();
          camera.position.copy(position);camera.quaternion.copy(rotation);dayStartedAt=day;renderer.setPixelRatio(0.5);renderer.shadowMap.enabled=false;
          return data;
        },
        prepare(radius, crystal = false) {
          miningTestRock = rocks.find(rock => (rock.userData.isCrystal === true) === crystal);
          miningTestRock.userData.hitRadius = radius;
          miningTestRock.userData.laserDamage = 0;
          for (const fragment of rockFragments) fragment.visible = false;
        },
        hit(fraction) {
          damageRock(miningTestRock, getRockDestructionTime(miningTestRock) * fraction);
          return { stones: state.stones, crystals: state.crystals, fragments: rockFragments.filter(fragment => fragment.visible).length };
        }
      };
    ` });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  if (process.env.ROSPACE_CAPTURE) {
    const data = await page.evaluate(() => window.miningTest.capture());
    writeFileSync('/tmp/rospace-realistic-stones.png', Buffer.from(data.split(',')[1], 'base64'));
  }
  let total = 0;
  for (const [radius, count] of [[0.3, 1], [0.8, 2], [1.3, 3], [1.8, 4], [2.7, 5]]) {
    await page.evaluate(radius => window.miningTest.prepare(radius), radius);
    const partial = await page.evaluate(() => window.miningTest.hit(0.4));
    expect(partial.stones).toBe(total);
    expect(partial.fragments).toBe(0);
    const completed = await page.evaluate(() => window.miningTest.hit(0.6));
    total += count;
    expect(completed).toEqual({ stones: total, crystals: 0, fragments: count });
    await expect(page.locator('#inventory-stone small')).toHaveText(`${total} Stück`);
  }
  if (process.env.ROSPACE_CAPTURE) {
    const data=await page.evaluate(() => window.miningTest.captureFragments());
    writeFileSync('/tmp/rospace-stone-fragments.png',Buffer.from(data.split(',')[1],'base64'));
  }
  await page.evaluate(() => window.miningTest.prepare(1.8, true));
  expect(await page.evaluate(() => window.miningTest.hit(1))).toEqual({ stones: 15, crystals: 1, fragments: 30 });
  await page.keyboard.press('e');
  await expect(page.locator('#inventory')).toBeVisible();
  await expect(page.locator('#inventory-total')).toHaveText('16 gesammelt');
  expect(errors).toEqual([]);
});
