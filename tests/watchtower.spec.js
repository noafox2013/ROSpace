import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('dune watchtower has a compass marker and an F-operated terminal with a clickable Trasure Scan field',async({page})=>{
  test.setTimeout(180000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error' && /shader|WebGLProgram/i.test(message.text()))errors.push(message.text());});
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
      window.watchtowerTest={
        read(){return {position:ship.position.toArray(),paused:pausedAt!==null,cors:state.cors,crystals:state.crystals,health:state.health};},
        approach(){
          ship.position.copy(watchtower.terminalApproach);
          state.flightHeight=ship.position.y-playerGroundOffset-terrainHeight(ship.position.x,ship.position.z);
          state.flightVelocity=state.depthVelocity=state.steerVelocity=0;
          updateTerrainAroundPlayer();resetSceneryAroundPlayer();
        },
        exterior(){
          ship.position.set(watchtowerLocation.x+18,terrainHeight(watchtowerLocation.x+18,watchtowerLocation.z+24)+1,watchtowerLocation.z+24);
          state.flightHeight=state.flightVelocity=0;updateTerrainAroundPlayer();resetSceneryAroundPlayer();
          dayStartedAt=performance.now()-(daylightDuration*0.4-initialSunAngle/Math.PI*daylightDuration)*1000;
          updateSunAndKeyLight();
          const position=camera.position.clone(),rotation=camera.quaternion.clone(),visible=ship.visible;
          ship.visible=false;renderer.setPixelRatio(1);
          camera.position.copy(watchtower.group.position).add(new THREE.Vector3(28,18,35));
          camera.lookAt(watchtower.group.position.clone().add(new THREE.Vector3(0,12,0)));
          skyDome.position.copy(camera.position);updateCameraDrawDistance();renderer.render(scene,camera);
          const data=canvas.toDataURL();camera.position.copy(position);camera.quaternion.copy(rotation);ship.visible=visible;renderer.setPixelRatio(0.5);return data;
        },
        interior(){
          const position=camera.position.clone(),rotation=camera.quaternion.clone(),visible=ship.visible;
          ship.visible=false;renderer.setPixelRatio(1);
          camera.position.copy(watchtower.terminalPosition).add(new THREE.Vector3(1.6,0.9,2.9));
          camera.lookAt(watchtower.terminalPosition);skyDome.position.copy(camera.position);renderer.render(scene,camera);
          const data=canvas.toDataURL();camera.position.copy(position);camera.quaternion.copy(rotation);ship.visible=visible;renderer.setPixelRatio(0.5);return data;
        },
      };
    `});
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  await expect(page.locator('#watchtower-compass-marker')).toContainText('♜');
  await expect(page.locator('#watchtower-hint')).toBeHidden();
  await page.keyboard.press('f');
  await expect(page.locator('#watchtower-menu')).toBeHidden();
  if(process.env.ROSPACE_CAPTURE){
    const data=await page.evaluate(()=>window.watchtowerTest.exterior());
    writeFileSync('/tmp/rospace-watchtower.png',Buffer.from(data.split(',')[1],'base64'));
  }
  await page.evaluate(()=>window.watchtowerTest.approach());
  await expect(page.locator('#watchtower-hint')).toBeVisible();
  await page.keyboard.press('f');
  await expect(page.locator('#watchtower-menu')).toBeVisible();
  await expect(page.locator('#treasure-scan')).toHaveText(/Trasure Scan/);
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement)).toBe(null);
  await expect(page.locator('#watchtower-menu')).toHaveCSS('cursor','auto');
  const before=await page.evaluate(()=>window.watchtowerTest.read());
  expect(before.paused).toBe(true);
  await page.locator('#treasure-scan').click();
  await expect(page.locator('#treasure-scan')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#watchtower-status')).toContainText('Untergrund wird gescannt');
  await page.keyboard.press('w');
  expect(await page.evaluate(()=>window.watchtowerTest.read())).toEqual(before);
  if(process.env.ROSPACE_CAPTURE)await page.screenshot({path:'/tmp/rospace-watchtower-terminal.png'});
  await page.keyboard.press('Escape');
  await expect(page.locator('#watchtower-menu')).toBeHidden();
  await expect(page.locator('#pause-menu')).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('game-canvas');
  if(process.env.ROSPACE_CAPTURE){
    const data=await page.evaluate(()=>window.watchtowerTest.interior());
    writeFileSync('/tmp/rospace-watchtower-interior.png',Buffer.from(data.split(',')[1],'base64'));
  }
  await page.locator('#watchtower-hint').click();
  await expect(page.locator('#watchtower-menu')).toBeVisible();
  await page.setViewportSize({width:390,height:800});
  expect(await page.locator('#watchtower-menu').evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
  await page.locator('#watchtower-close').click();
  await expect(page.locator('#watchtower-menu')).toBeHidden();
  expect(errors).toEqual([]);
});
