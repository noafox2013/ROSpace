import { test,expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('sunlight renders coherent dawn, noon, dusk, night and storm scenes with working reflections',async({page})=>{
  test.setTimeout(180000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.setViewportSize({width:1100,height:750});
  await page.addInitScript(()=>{
    let lock=null;Object.defineProperty(document,'pointerLockElement',{get:()=>lock});
    HTMLCanvasElement.prototype.requestPointerLock=async function(){lock=this;document.dispatchEvent(new Event('pointerlockchange'));};
    document.exitPointerLock=()=>{lock=null;document.dispatchEvent(new Event('pointerlockchange'));};
  });
  await page.route('**/src/main.js*',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:await response.text()+`
      renderer.setPixelRatio(0.7);keyLight.shadow.mapSize.set(2048,2048);
      window.solarTest=(seconds,storm=false,sunView=false)=>{
        screenshotMode=true;ship.visible=false;
        dayStartedAt=performance.now()-seconds*1000;pausedAt=null;
        sandstorm.restore({wait:storm?0:100,age:storm?20:0,duration:storm?70:0});
        sandstorm.update(0.04,ship.position,false);
        const origin=spacecraft.group.position;
        camera.position.copy(origin).add(new THREE.Vector3(17,8,23));
        camera.lookAt(origin.clone().add(new THREE.Vector3(0,3,0)));
        updateSunAndKeyLight();
        if(sunView)camera.lookAt(camera.position.clone().addScaledVector(sunDirection,100).add(new THREE.Vector3(0,-4,0)));
        skyDome.position.copy(camera.position);updateCameraDrawDistance();
        updateChestFlashlight();sandstorm.applyAtmosphere();renderer.render(scene,camera);
        const direction=sun.position.clone().sub(camera.position).normalize();
        const gl=renderer.getContext(),size=renderer.getDrawingBufferSize(new THREE.Vector2()),pixel=new Uint8Array(4);
        gl.readPixels(Math.floor(size.x*0.1),Math.floor(size.y*0.85),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
        return {direct:keyLight.intensity,ambient:hemi.intensity,exposure:renderer.toneMappingExposure,
          environment:scene.environmentIntensity,alignment:direction.dot(sunDirection),
          visible:sun.visible,pixel:Array.from(pixel),data:canvas.toDataURL()};
      };
    `});
  });
  await page.goto('http://127.0.0.1:5173/');await page.locator('#start-button').click();
  const captures={};
  for(const [name,seconds,storm,sunView] of [['dawn',12,false,true],['noon',210,false,false],['sunset',405,false,true],['night',570,false,false],['storm',210,true,false]]) {
    const result=await page.evaluate(args=>window.solarTest(...args),[seconds,storm,sunView]);captures[name]=result;
    expect(result.alignment).toBeGreaterThan(0.999999);expect(result.pixel.slice(0,3).some(channel=>channel>3)).toBe(true);
    if(process.env.ROSPACE_CAPTURE)writeFileSync('/tmp/rospace-lighting-'+name+'.png',Buffer.from(result.data.split(',')[1],'base64'));
  }
  expect(captures.noon.direct).toBeGreaterThan(captures.dawn.direct);
  expect(captures.night.direct).toBe(0);expect(captures.night.visible).toBe(false);
  expect(captures.storm.direct).toBeLessThan(captures.noon.direct);
  expect(captures.night.environment).toBeLessThan(captures.noon.environment);
  expect(errors).toEqual([]);
});
