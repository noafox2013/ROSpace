import { test, expect } from '@playwright/test';

test('the scanned treasure stays visible when looking away, from behind a dune, on mobile and after loading',async({page})=>{
  test.setTimeout(150000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1100,height:800});
  await page.addInitScript(()=>{
    let lock=null;
    Object.defineProperty(document,'pointerLockElement',{get:()=>lock});
    HTMLCanvasElement.prototype.requestPointerLock=async function(){lock=this;document.dispatchEvent(new Event('pointerlockchange'));};
    document.exitPointerLock=()=>{lock=null;document.dispatchEvent(new Event('pointerlockchange'));};
  });
  await page.route('**/src/main.js*',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:await response.text()+`
      renderer.setPixelRatio(0.5);renderer.shadowMap.enabled=false;
      window.markerTest={
        terminal(){
          ship.position.copy(watchtower.terminalApproach);
          state.flightHeight=ship.position.y-1-terrainHeight(ship.position.x,ship.position.z);
          state.flightVelocity=state.depthVelocity=state.steerVelocity=0;
          updateTerrainAroundPlayer();resetSceneryAroundPlayer();state.curseLifted=true;sandworm.repel(true);
        },
        look(offset){
          const yaw=Math.atan2(treasureLocation.x-ship.position.x,treasureLocation.z-ship.position.z)+offset;
          state.faceYaw=state.cameraOrbitYaw=yaw;state.cameraPitch=0;
        },
        save(){return saveGame();},
        collect(){state.treasureOpened=state.treasureExcavated=state.landingStrut=1;spaceTreasure.restore(state);},
      };
    `});
  });
  const marker=page.locator('#treasure-marker');
  async function expectOnScreen(width,height) {
    await expect(marker).toBeVisible();
    await expect(marker).toContainText('Space-Schatztruhe');
    await expect(page.locator('#treasure-distance')).toHaveText(/\d+ m/);
    const box=await marker.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(height);
  }
  await page.goto('http://127.0.0.1:5173/');await page.locator('#start-button').click();
  await expect(marker).toBeHidden();
  await page.evaluate(()=>window.markerTest.terminal());await page.keyboard.press('f');
  await page.locator('#treasure-scan').click();
  await expect(page.locator('#watchtower-status')).toHaveText('Scan abgeschlossen · Space-Schatztruhe markiert.',{timeout:50000});
  await expect(page.locator('#watchtower-close')).toHaveText('Fundstelle anzeigen');
  await page.locator('#watchtower-close').click();
  await expectOnScreen(1100,800);
  await expect(page.locator('#treasure-compass-marker')).toContainText('Schatz');
  for(const yaw of [Math.PI/2,Math.PI,-Math.PI/2,0]) {
    await page.evaluate(yaw=>window.markerTest.look(yaw),yaw);
    await expectOnScreen(1100,800);
    if(yaw!==0)await expect(marker).toHaveClass(/is-offscreen/);
  }
  if(process.env.ROSPACE_CAPTURE)await page.screenshot({path:'/tmp/rospace-treasure-marker.png'});
  await page.setViewportSize({width:390,height:800});
  await page.evaluate(()=>window.markerTest.look(Math.PI));
  await expect(marker).toHaveClass(/is-offscreen/);await expectOnScreen(390,800);
  if(process.env.ROSPACE_CAPTURE)await page.screenshot({path:'/tmp/rospace-treasure-marker-away.png'});
  expect(await page.evaluate(()=>window.markerTest.save())).toBe(true);
  await page.reload();await page.locator('#load-button').click();
  await expectOnScreen(390,800);await expect(page.locator('#treasure-compass-marker')).toContainText('Schatz');
  await page.evaluate(()=>window.markerTest.collect());
  await expect(marker).toBeHidden();await expect(page.locator('#treasure-compass-marker')).toBeHidden();
  expect(errors).toEqual([]);
});
