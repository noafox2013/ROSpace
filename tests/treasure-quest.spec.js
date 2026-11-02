import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('ride the space lift, scan, excavate, recover and save the landing strut, then repair the spacecraft',async({page})=>{
  test.setTimeout(240000);
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
      window.treasureTest={
        read(){return {scanned:state.treasureScanned,excavated:state.treasureExcavated,opened:state.treasureOpened,strut:state.landingStrut,
          tank:state.fuelTank,crystals:state.crystals,blue:state.blueCrystals,repaired:state.spacecraftRepaired,damaged:spacecraft.isDamaged()};},
        prepareRepair(){state.fuelTank=state.archiveRead=state.archiveActivated=1;state.crystals=50;state.blueCrystals=20;updateInventoryResources();},
        craft(){ship.position.copy(spacecraft.exit);state.flightHeight=state.flightVelocity=state.depthVelocity=state.steerVelocity=0;},
        climb(){
          state.jetpackActive=state.sprinting=false;state.jetpackBurn=state.steer=state.steerVelocity=state.depthVelocity=state.flightHeight=state.flightVelocity=0;
          ship.position.copy(watchtower.lift.approach('bottom'));
          state.flightHeight=ship.position.y-1-terrainHeight(ship.position.x,ship.position.z);
          resetSceneryAroundPlayer();state.curseLifted=true;sandworm.repel(true);
          if(watchtower.lift.activate(ship.position)!=='riding')throw new Error('Lift did not start');
          for(let i=0;i<440;i++){watchtower.update(1/60);updateGame(1/60);}
          const targets=[[2.7,0],[2.7,2.4],[-2.4,2.4],[-2.4,0.6]];
          let steps=0,minHealth=state.health;
          for(const target of targets) {
            let ticks=0;
            while(Math.hypot(watchtowerLocation.x+target[0]-ship.position.x,watchtowerLocation.z+target[1]-ship.position.z)>0.055&&ticks++<900) {
              const dx=watchtowerLocation.x+target[0]-ship.position.x,dz=watchtowerLocation.z+target[1]-ship.position.z;
              state.faceYaw=state.cameraOrbitYaw=Math.atan2(dx,dz);state.depthInput=1;
              updateGame(1/60);steps++;minHealth=Math.min(minHealth,state.health);
            }
            if(ticks>=900)throw new Error('Lift exit blocked: '+ship.position.toArray());
          }
          state.depthInput=state.depthVelocity=0;state.faceYaw=state.cameraOrbitYaw=Math.PI;
          return {steps,minHealth,terminal:watchtower.nearTerminal(ship.position),grounded:watchtowerGrounded,flightBlend:astronautFlightBlend};
        },
        chest(){
          ship.position.set(treasureLocation.x+2,0,treasureLocation.z);
          ship.position.y=terrainHeight(ship.position.x,ship.position.z)+1;
          state.flightHeight=state.flightVelocity=state.depthVelocity=state.steerVelocity=0;
          resetSceneryAroundPlayer();sandworm.repel(true);state.faceYaw=state.cameraOrbitYaw=-Math.PI/2;
        },
        save(){return saveGame();},
        capture(){
          const position=camera.position.clone(),rotation=camera.quaternion.clone(),visible=ship.visible;
          ship.visible=false;renderer.setPixelRatio(1);
          camera.position.copy(spaceTreasure.group.position).add(new THREE.Vector3(3.8,2.5,4.5));
          camera.lookAt(spaceTreasure.group.position.clone().add(new THREE.Vector3(0,0.5,0)));
          skyDome.position.copy(camera.position);renderer.render(scene,camera);const data=canvas.toDataURL();
          camera.position.copy(position);camera.quaternion.copy(rotation);ship.visible=visible;renderer.setPixelRatio(0.5);return data;
        },
      };
    `});
  });
  const read=()=>page.evaluate(()=>window.treasureTest.read());
  await page.goto('http://127.0.0.1:5173/');await page.locator('#start-button').click();
  await expect(page.locator('#treasure-compass-marker')).toBeHidden();
  await page.evaluate(()=>{window.treasureTest.prepareRepair();window.treasureTest.craft();});
  await page.keyboard.press('f');
  expect(await read()).toMatchObject({tank:1,strut:0,repaired:0,crystals:50,blue:20});
  const walk=await page.evaluate(()=>window.treasureTest.climb());
  expect(walk).toMatchObject({minHealth:100,terminal:true,grounded:true});expect(walk.flightBlend).toBeLessThan(0.1);
  await page.keyboard.press('f');await expect(page.locator('#watchtower-menu')).toBeVisible();
  await page.locator('#treasure-scan').click();
  await expect(page.locator('#treasure-scan-progress')).toBeVisible();
  await expect(page.locator('#treasure-scan')).toBeDisabled();
  expect((await read()).scanned).toBe(0);
  await expect(page.locator('#watchtower-status')).toHaveText('Scan abgeschlossen · Space-Schatztruhe markiert.',{timeout:60000});
  expect(await read()).toMatchObject({scanned:1,excavated:0,opened:0,strut:0});
  await page.keyboard.press('Escape');await expect(page.locator('#treasure-compass-marker')).toBeVisible();
  expect(await page.evaluate(()=>window.treasureTest.save())).toBe(true);
  await page.reload();await page.locator('#load-button').click();
  expect(await read()).toMatchObject({scanned:1,excavated:0,opened:0,strut:0});
  await expect(page.locator('#treasure-compass-marker')).toBeVisible();
  await page.evaluate(()=>window.treasureTest.chest());
  await expect(page.locator('#treasure-hint')).toHaveText('F · Space-Schatztruhe ausgraben');
  await page.keyboard.press('f');expect(await read()).toMatchObject({excavated:1,opened:0,strut:0});
  await expect(page.locator('#treasure-hint')).toHaveText('F · Space-Schatztruhe öffnen · Landestütze bergen',{timeout:30000});
  if(process.env.ROSPACE_CAPTURE){const data=await page.evaluate(()=>window.treasureTest.capture());writeFileSync('/tmp/rospace-space-treasure.png',Buffer.from(data.split(',')[1],'base64'));}
  await page.keyboard.press('f');expect(await read()).toMatchObject({opened:1,strut:1});
  await expect(page.locator('#treasure-compass-marker')).toBeHidden();
  await page.keyboard.press('e');await expect(page.locator('#landing-strut')).toBeVisible();
  await expect(page.locator('#equipment-title span')).toHaveText('5 Gegenstände');await page.keyboard.press('e');
  expect(await page.evaluate(()=>window.treasureTest.save())).toBe(true);
  await page.reload();await page.locator('#load-button').click();
  expect(await read()).toMatchObject({opened:1,strut:1,tank:1,crystals:50,blue:20});
  await page.keyboard.press('f');expect((await read()).strut).toBe(1);
  await page.evaluate(()=>window.treasureTest.craft());await page.keyboard.press('f');
  expect(await read()).toMatchObject({opened:1,strut:0,tank:0,crystals:0,blue:0,repaired:1,damaged:false});
  await page.keyboard.press('e');await expect(page.locator('#landing-strut')).toBeHidden();
  expect(errors).toEqual([]);
});
