import * as THREE from 'three';
import { TERRAIN_FADE_START, TERRAIN_FADE_END } from './planet-horizon.js';

// Pack tileable sand grain and rounded gravel into a shared surface texture.
function createSurfaceTexture() {
  const size = 1024, cells = 64;
  const data = new Uint8Array(size * size * 4);
  const random = (x,y,seed) => {
    const value = Math.sin(x*127.1+y*311.7+seed*74.7)*43758.5453;
    return value-Math.floor(value);
  };
  const sites = Array.from({length:cells*cells},(_,index) => {
    const x=index%cells, y=Math.floor(index/cells);
    return {x:0.15+random(x,y,1)*0.7,y:0.15+random(x,y,2)*0.7,
      radius:0.06+random(x,y,3)*0.24,tone:random(x,y,4),
      stretch:0.65+random(x,y,5)*1.1,skew:(random(x,y,6)-0.5)*0.7};
  });
  for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
    const px=x/size*cells, py=y/size*cells;
    const cx=Math.floor(px), cy=Math.floor(py);
    let pebble=0, tone=0.5;
    for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
      const site=sites[((cy+dy+cells)%cells)*cells+(cx+dx+cells)%cells];
      if (site.tone<0.42) continue;
      const localX=px-cx-dx-site.x, localY=py-cy-dy-site.y;
      const sx=(localX+localY*site.skew)/(site.radius*site.stretch), sy=localY/site.radius;
      const height=Math.max(0,1-sx*sx-sy*sy);
      if (height>pebble) {pebble=height;tone=site.tone;}
    }
    const offset=(y*size+x)*4;
    data[offset]=Math.round((0.25+random(x,y,7)*0.65)*255);
    data[offset+1]=Math.round(Math.sqrt(pebble)*255);
    data[offset+2]=Math.round(tone*255);
    data[offset+3]=255;
  }
  // Filter surface slopes in world space before lighting, rather than deriving
  // high-frequency normals from the screen's changing pixel grid.
  const heights=new Float32Array(size*size), grains=new Float32Array(size*size);
  const at=(x,y)=>((y+size)%size)*size+(x+size)%size;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    let height=0,grain=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
      const weight=(dx===0?2:1)*(dy===0?2:1), offset=at(x+dx,y+dy)*4;
      height+=data[offset+1]*weight; grain+=data[offset]*weight;
    }
    heights[at(x,y)]=height/(255*16); grains[at(x,y)]=grain/(255*16);
  }
  const normalData=new Uint8Array(data.length), step=4/size;
  const encode=value=>Math.round(128+THREE.MathUtils.clamp(value,-1,1)*127);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const left=at(x-1,y),right=at(x+1,y),down=at(x,y-1),up=at(x,y+1),offset=at(x,y)*4;
    normalData[offset]=encode(-(heights[right]-heights[left])*0.006/(2*step));
    normalData[offset+1]=encode(-(heights[up]-heights[down])*0.006/(2*step));
    normalData[offset+2]=encode(-(grains[right]-grains[left])*0.00015/(2*step));
    normalData[offset+3]=encode(-(grains[up]-grains[down])*0.00015/(2*step));
  }
  const makeTexture=pixels=>{
    const texture=new THREE.DataTexture(pixels,size,size);
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.magFilter=THREE.LinearFilter; texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps=true; texture.anisotropy=8; texture.needsUpdate=true;
    return texture;
  };
  return {surface:makeTexture(data),normals:makeTexture(normalData)};
}

const surfaceShader = /* glsl */ `
  uniform sampler2D terrainSurface;
  uniform sampler2D terrainNormals;
  uniform vec3 terrainViewOrigin;
  varying vec3 terrainWorldPosition;
  float soilHash(vec2 p) {
    return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
  }
  float soilNoise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(soilHash(i),soilHash(i+vec2(1,0)),f.x),
      mix(soilHash(i+vec2(0,1)),soilHash(i+vec2(1,1)),f.x),f.y);
  }
  float soilFbm(vec2 p) {
    return soilNoise(p)*0.57+soilNoise(p*2.03+5.1)*0.28+soilNoise(p*4.09-3.7)*0.15;
  }
`;

export function createTerrainSurfaceMaterial() {
  const texture=createSurfaceTexture();
  const viewOrigin={value:new THREE.Vector3()};
  const material=new THREE.MeshStandardMaterial({roughness:0.96,metalness:0,vertexColors:true,transparent:true,depthWrite:true});
  material.userData.viewOrigin=viewOrigin;
  material.onBeforeCompile=shader => {
    shader.uniforms.terrainViewOrigin=viewOrigin;
    shader.uniforms.terrainSurface={value:texture.surface};
    shader.uniforms.terrainNormals={value:texture.normals};
    shader.vertexShader=shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 terrainWorldPosition;`);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      terrainWorldPosition=(modelMatrix*vec4(position,1.0)).xyz;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>', `#include <common>\n${surfaceShader}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>', /* glsl */ `
      #include <color_fragment>
      float coverage=1.0-smoothstep(${TERRAIN_FADE_START.toFixed(1)},${TERRAIN_FADE_END.toFixed(1)},length(terrainWorldPosition.xz-terrainViewOrigin.xz));
      coverage*=1.0-smoothstep(500.0,800.0,length(vViewPosition));
      if (coverage<=0.0) discard;
      diffuseColor.a*=coverage;
      vec2 soilP=terrainWorldPosition.xz;
      float soilMacro=soilFbm(soilP*0.075);
      float soilPatch=soilNoise(soilP*0.24+vec2(19.0,-7.0));
      float gravelMask=smoothstep(0.46,0.7,soilMacro*0.6+soilPatch*0.4);
      float clayMask=smoothstep(0.6,0.78,soilNoise(soilP*0.045-11.0))*(1.0-gravelMask);
      vec4 surfaceDetail=texture2D(terrainSurface,soilP*0.25);
      vec4 scatteredDetail=texture2D(terrainSurface,mat2(0.8,-0.6,0.6,0.8)*soilP*0.173+0.31);
      float texelFootprint=max(length(dFdx(soilP*0.25)),length(dFdy(soilP*0.25)))*1024.0;
      float grainFilter=1.0-smoothstep(0.35,1.6,texelFootprint);
      float pebbleFilter=1.0-smoothstep(3.0,10.0,texelFootprint);
      float gravel=surfaceDetail.g*gravelMask*pebbleFilter;
      float coarseGravel=scatteredDetail.g*gravelMask*0.42*pebbleFilter;
      float claySeam=abs(soilFbm(soilP*2.0)-0.47);
      float seamPixel=fwidth(claySeam);
      float cracks=(1.0-smoothstep(0.005,max(0.025,seamPixel*1.5),claySeam))*clayMask
        *(1.0-smoothstep(0.025,0.12,seamPixel));
      float nearDetail=1.0-smoothstep(35.0,130.0,length(vViewPosition));
      vec3 sandTint=diffuseColor.rgb*vec3(1.06,1.18,1.28);
      vec3 clayTint=diffuseColor.rgb*vec3(0.96,1.06,1.16);
      diffuseColor.rgb=mix(sandTint,clayTint,clayMask*0.65);
      diffuseColor.rgb*=0.75+soilMacro*0.42+soilPatch*0.12;
      float stoneTone=mix(0.52,1.22,surfaceDetail.b);
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*stoneTone,gravel*0.9*nearDetail);
      diffuseColor.rgb*=1.0-coarseGravel*0.2-cracks*0.28*nearDetail;
      diffuseColor.rgb*=1.0+(surfaceDetail.r-0.5)*0.1*nearDetail*grainFilter;
      vec4 fineSlopes=(texture2D(terrainNormals,soilP*0.25)*255.0-128.0)/127.0;
      vec2 coarseSlopes=(texture2D(terrainNormals,mat2(0.8,-0.6,0.6,0.8)*soilP*0.173+0.31).rg*255.0-128.0)/127.0;
      coarseSlopes=vec2(0.8*coarseSlopes.x-0.6*coarseSlopes.y,0.6*coarseSlopes.x+0.8*coarseSlopes.y);
      vec2 groundSlope=((fineSlopes.rg+coarseSlopes*0.55)*gravelMask*pebbleFilter
        +fineSlopes.ba*grainFilter)*nearDetail;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor=clamp(0.96-surfaceDetail.b*gravel*0.19+cracks*0.04,0.78,1.0);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>', /* glsl */ `
      #include <normal_fragment_maps>
      vec3 worldX=mat3(viewMatrix)*vec3(1.0,0.0,0.0);
      vec3 worldZ=mat3(viewMatrix)*vec3(0.0,0.0,1.0);
      vec3 soilTangentX=normalize(worldX-normal*dot(normal,worldX));
      vec3 soilTangentZ=normalize(worldZ-normal*dot(normal,worldZ));
      normal=normalize(normal+soilTangentX*groundSlope.x+soilTangentZ*groundSlope.y);
    `);
  };
  material.customProgramCacheKey=()=>'layered-desert-soil-v3';
  return material;
}
