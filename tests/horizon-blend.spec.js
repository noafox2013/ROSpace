import { test,expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('a dune viewpoint has a flat hazy desert horizon without a hard red band',async({page})=>{
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.setViewportSize({width:1200,height:750});
  await page.route('**/src/main.js*',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:await response.text()+`
      renderer.setPixelRatio(0.8);renderer.shadowMap.enabled=false;
      window.horizonBlendTest=(angle=0)=>{
        screenshotMode=true;
        const x=watchtowerLocation.x-8,z=watchtowerLocation.z+14,ground=terrainHeight(x,z);
        ship.position.set(x,ground+1,z);state.flightHeight=0;
        updateTerrainAroundPlayer();resetSceneryAroundPlayer();
        camera.position.set(x,ground+3.2,z);camera.lookAt(x+Math.sin(angle)*100,ground+3.2,z-Math.cos(angle)*100);
        skyDome.position.copy(camera.position);updateCameraDrawDistance();
        dayStartedAt=performance.now()-210000;pausedAt=null;
        sandstorm.restore({wait:100,age:0,duration:0});sandstorm.update(0,ship.position,false);
        updateSunAndKeyLight();sandstorm.applyAtmosphere();
        const visibility=scene.children.map(object=>[object,object.visible]);
        for(const [object] of visibility)object.visible=object===skyDome;
        renderer.render(scene,camera);
        const gl=renderer.getContext(),size=renderer.getDrawingBufferSize(new THREE.Vector2());
        let maxJump=0;
        for(const fraction of [0.3,0.5,0.7]) {
          let previous=null;
          for(let y=Math.floor(size.y*0.38);y<Math.floor(size.y*0.62);y++) {
            const pixel=new Uint8Array(4);gl.readPixels(Math.floor(size.x*fraction),y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
            if(previous)maxJump=Math.max(maxJump,Math.abs(pixel[0]-previous[0])+Math.abs(pixel[1]-previous[1])+Math.abs(pixel[2]-previous[2]));
            previous=pixel;
          }
        }
        for(const [object,visible] of visibility)object.visible=visible;
        ship.visible=false;renderer.render(scene,camera);
        return {maxJump,planetHeight:skyDome.material.uniforms.planetHeight.value,localHeight:3.2,data:canvas.toDataURL()};
      };
    `});
  });
  await page.goto('http://127.0.0.1:5173/');await page.locator('#start-button').click();
  for(const [name,angle] of [['north',0],['east',Math.PI/2]]) {
    const result=await page.evaluate(angle=>window.horizonBlendTest(angle),angle);
    expect(result.planetHeight).toBeGreaterThan(20);
    expect(result.maxJump).toBeLessThan(35);
    if(process.env.ROSPACE_CAPTURE)writeFileSync('/tmp/rospace-horizon-blend-'+name+'.png',Buffer.from(result.data.split(',')[1],'base64'));
  }
  expect(errors).toEqual([]);
});
