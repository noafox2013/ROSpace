import { test, expect } from '@playwright/test';

test('fine ground detail remains stable during small camera movements under a spotlight',async({page})=>{
  test.setTimeout(90000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.route('**/__terrain-stability',route=>route.fulfill({contentType:'text/html',body:`
    <script type="module">
      import * as THREE from '/node_modules/.vite/deps/three.js';
      import {createTerrainSurfaceMaterial} from '/src/terrain-surface.js';
      const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(640,480);
      renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.append(renderer.domElement);
      const scene=new THREE.Scene(); scene.background=new THREE.Color(0x15100e);
      const geometry=new THREE.PlaneGeometry(20,20);geometry.rotateX(-Math.PI/2);
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(Array(geometry.attributes.position.count).fill([0.32,0.075,0.03]).flat(),3));
      const material=createTerrainSurfaceMaterial();const floor=new THREE.Mesh(geometry,material);floor.position.set(96,0,-38);material.userData.viewOrigin.value.copy(floor.position);scene.add(floor);
      scene.add(new THREE.HemisphereLight(0xb7c7dc,0x6b3420,0.35));
      const light=new THREE.SpotLight(0xffe4bf,45,15,0.8,0.5,2);light.position.set(96.3,2,-36);light.target.position.set(96,0,-38);scene.add(light,light.target);
      const camera=new THREE.PerspectiveCamera(62,640/480,0.1,100);
      window.measureTerrain=()=>{
        const points=[];
        for(let z=-4;z<=4;z++)for(let x=-4;x<=4;x++)points.push(new THREE.Vector3(96+x*0.12,0,-38+z*0.12));
        const frames=[], pixels=new Uint8Array(640*480*4),gl=renderer.getContext();
        for(let frame=0;frame<16;frame++){
          camera.position.set(96+frame*0.01,1.6,-37);camera.lookAt(96,0,-38);camera.updateMatrixWorld(true);renderer.render(scene,camera);
          gl.readPixels(0,0,640,480,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
          frames.push(points.map(point=>{
            const projected=point.clone().project(camera),px=(projected.x*0.5+0.5)*640-0.5,py=(projected.y*0.5+0.5)*480-0.5;
            const x=Math.floor(px),y=Math.floor(py),u=px-x,v=py-y;
            const lum=(ix,iy)=>{const i=(iy*640+ix)*4;return pixels[i]*0.2126+pixels[i+1]*0.7152+pixels[i+2]*0.0722;};
            return (lum(x,y)*(1-u)+lum(x+1,y)*u)*(1-v)+(lum(x,y+1)*(1-u)+lum(x+1,y+1)*u)*v;
          }));
        }
        const ranges=points.map((_,index)=>Math.max(...frames.map(f=>f[index]))-Math.min(...frames.map(f=>f[index]))).sort((a,b)=>a-b);
        return {average:ranges.reduce((a,b)=>a+b,0)/ranges.length,p95:ranges[Math.floor(ranges.length*0.95)],max:ranges.at(-1)};
      };
    </script>`}));
  await page.goto('http://127.0.0.1:5173/__terrain-stability');
  await page.waitForFunction(()=>window.measureTerrain);
  const result=await page.evaluate(()=>window.measureTerrain());
  console.log('Ground movement stability:',result);
  expect(result.average).toBeLessThan(3);
  expect(result.p95).toBeLessThan(8);
  expect(errors).toEqual([]);
});
