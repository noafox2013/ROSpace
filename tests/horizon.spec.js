import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('curved planet fills the ground beyond the terrain chunks at high altitude and in storms', async ({ page }) => {
  test.setTimeout(150000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error' && /shader|WebGLProgram/i.test(message.text())) errors.push(message.text());});
  await page.setViewportSize({width:1000,height:700});
  await page.route('**/src/main.js*',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:await response.text()+`
      renderer.setPixelRatio(0.75); renderer.shadowMap.enabled=false;
      window.horizonTest=(height,storm=false,diagonal=false)=>{
        screenshotMode=true;
        const x=ship.position.x, z=ship.position.z, ground=terrainHeight(x,z);
        ship.position.y=ground+playerGroundOffset+height; state.flightHeight=height;
        dayStartedAt=performance.now()-(daylightDuration*0.4-initialSunAngle/Math.PI*daylightDuration)*1000;
        camera.position.set(x,ground+height,z);
        camera.lookAt(x+(diagonal ? height*0.56 : 0),ground+(height>10000 ? 0 : height*0.65),z-height*(diagonal ? 0.56 : 0.8));
        updateCameraDrawDistance(); skyDome.position.copy(camera.position);
        sandstorm.restore({wait:storm ? 0 : 100,age:storm ? 20 : 0,duration:storm ? 70 : 0});
        sandstorm.update(0.04,ship.position,false); updateSunAndKeyLight(); sandstorm.applyAtmosphere();
        const visibility=scene.children.map(object=>[object,object.visible]);
        for(const [object] of visibility) if(object!==skyDome) object.visible=false;
        skyDome.visible=true;
        const gl=renderer.getContext(), size=renderer.getDrawingBufferSize(new THREE.Vector2());
        const pixel=()=>{const p=new Uint8Array(4);gl.readPixels(Math.floor(size.x/2),Math.floor(size.y/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p);};
        renderer.render(scene,camera); const groundPixel=pixel();
        const update=skyDome.onBeforeRender;
        skyDome.onBeforeRender=(...args)=>{update(...args);skyDome.material.uniforms.planetHeight.value=1e9;};
        renderer.render(scene,camera); const skyPixel=pixel();
        skyDome.onBeforeRender=update;
        for(const [object,visible] of visibility) object.visible=visible;
        ship.visible=false;
        renderer.render(scene,camera);
        return {height,far:camera.far,groundPixel,skyPixel,data:canvas.toDataURL()};
      };
    `});
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#start-button').click();
  for(const [height,storm,diagonal] of [[80,false,false],[800,false,false],[2000,false,true],[20000,false,false],[800,true,true]]) {
    const result=await page.evaluate(args=>window.horizonTest(...args),[height,storm,diagonal]);
    expect(result.far).toBeGreaterThan(Math.hypot(height,440));
    const difference=result.groundPixel.slice(0,3).reduce((sum,c,index)=>sum+Math.abs(c-result.skyPixel[index]),0);
    expect(difference).toBeGreaterThan(5);
    if(process.env.ROSPACE_CAPTURE) writeFileSync('/tmp/rospace-horizon-'+height+(storm?'-storm':'')+'.png',Buffer.from(result.data.split(',')[1],'base64'));
  }
  expect(errors).toEqual([]);
});
