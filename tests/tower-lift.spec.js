import { test,expect } from '@playwright/test';

test('F operates the space elevator in both directions and pauses safely during the ride',async({page})=>{
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    let lock=null;Object.defineProperty(document,'pointerLockElement',{get:()=>lock});
    HTMLCanvasElement.prototype.requestPointerLock=async function(){lock=this;document.dispatchEvent(new Event('pointerlockchange'));};
    document.exitPointerLock=()=>{lock=null;document.dispatchEvent(new Event('pointerlockchange'));};
  });
  await page.route('**/src/main.js*',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:await response.text()+`
      renderer.setPixelRatio(0.4);renderer.shadowMap.enabled=false;
      window.liftTest={
        approach(){ship.position.copy(watchtower.lift.approach('bottom'));state.flightHeight=ship.position.y-1-terrainHeight(ship.position.x,ship.position.z);state.flightVelocity=0;},
        read(){return {ride:watchtower.lift.isRiding(),health:state.health,height:ship.position.y-1-watchtower.ground,snapshot:watchtower.lift.snapshot(),jetpack:state.jetpackActive};},
        advance(seconds){for(let i=0;i<seconds*60;i++){watchtower.update(1/60);updateGame(1/60);}},
      };
    `});
  });
  await page.goto('http://127.0.0.1:5173/');await page.locator('#start-button').click();
  await expect(page.locator('#watchtower-lift-hint')).toBeHidden();
  await page.evaluate(()=>window.liftTest.approach());
  await expect(page.locator('#watchtower-lift-hint')).toHaveText('F · Space-Aufzug nach oben');
  await page.keyboard.press('f');
  expect((await page.evaluate(()=>window.liftTest.read())).ride).toBe(true);
  await page.evaluate(()=>window.liftTest.advance(2));
  await page.keyboard.press('Escape');await expect(page.locator('#pause-menu')).toBeVisible();
  const paused=await page.evaluate(()=>window.liftTest.read());
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  expect(await page.evaluate(()=>window.liftTest.read())).toEqual(paused);
  await page.locator('#resume-button').click();
  await page.keyboard.down('w');await page.keyboard.down('Space');
  await page.evaluate(()=>window.liftTest.advance(6));
  await page.keyboard.up('Space');await page.keyboard.up('w');
  const up=await page.evaluate(()=>window.liftTest.read());
  expect(up).toMatchObject({ride:false,health:100,jetpack:false});expect(up.height).toBeCloseTo(18.68,1);
  await expect(page.locator('#watchtower-lift-hint')).toHaveText('F · Space-Aufzug nach unten');
  await page.keyboard.press('f');expect((await page.evaluate(()=>window.liftTest.read())).ride).toBe(true);
  await page.evaluate(()=>window.liftTest.advance(8));
  const down=await page.evaluate(()=>window.liftTest.read());
  expect(down).toMatchObject({ride:false,health:100});expect(down.height).toBeCloseTo(0.2,1);
  expect(errors).toEqual([]);
});
