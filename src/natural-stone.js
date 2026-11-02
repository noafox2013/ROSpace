import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const hash = (x, y, z = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
};
function noise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const smooth = n => n * n * (3 - 2 * n);
  const u = smooth(x - ix), v = smooth(y - iy), w = smooth(z - iz);
  const mix = THREE.MathUtils.lerp;
  return mix(mix(mix(hash(ix,iy,iz),hash(ix+1,iy,iz),u),mix(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),u),v),
    mix(mix(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),u),mix(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),u),v),w);
}

export function createNaturalStoneGeometry(seed, radius, fragment = false) {
  const geometry = new THREE.IcosahedronGeometry(1, fragment ? 1 : radius < 0.45 ? 3 : 5);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const point = new THREE.Vector3(), color = new THREE.Color();
  const profile = Math.floor(hash(seed,41) * 3);
  const planes = Array.from({length:5}, (_, i) => ({
    normal: new THREE.Vector3(hash(seed,i,1)-0.5,hash(seed,i,2)-0.5,hash(seed,i,3)-0.5).normalize(),
    distance: 0.67 + hash(seed,i,4) * 0.27,
  }));
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions,i);
    const weather = noise(point.x*2.1+seed, point.y*2.1, point.z*2.1);
    const chips = noise(point.x*8+seed,point.y*8,point.z*8);
    if (profile === 0) {
      const boxRadius = Math.max(Math.abs(point.x),Math.abs(point.y),Math.abs(point.z));
      point.multiplyScalar(THREE.MathUtils.lerp(1,1/boxRadius,0.28));
    } else if (profile === 1) {
      point.y *= 0.72;
      point.x += point.z * 0.16;
    } else {
      point.x += (weather-0.5) * 0.18;
      point.z += (noise(point.y*2+seed,point.z*2,point.x*2)-0.5)*0.15;
    }
    point.multiplyScalar(0.79 + weather * 0.38 + chips * 0.045);
    // Fracture planes cut asymmetric faces into the eroded rounded mass.
    for (const plane of planes) {
      const beyond = point.dot(plane.normal) - plane.distance;
      if (beyond > 0) point.addScaledVector(plane.normal,-beyond);
    }
    point.x += point.y * (hash(seed,2)-0.5) * 0.23;
    if (!fragment) point.y = Math.max((profile === 1 ? -0.5 : -0.72) + noise(point.x*4+seed,0,point.z*4)*0.045,point.y);
    positions.setXYZ(i,point.x*radius,point.y*radius,point.z*radius);
    const mottling = noise(point.x*3+seed,point.y*3,point.z*3);
    color.setRGB(0.72+mottling*0.25,0.70+mottling*0.25,0.66+mottling*0.26);
    colors.set([color.r,color.g,color.b],i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.deleteAttribute('normal'); geometry.deleteAttribute('uv');
  const welded = mergeVertices(geometry,0.0001);
  geometry.dispose();
  welded.computeVertexNormals(); welded.computeBoundingBox(); welded.computeBoundingSphere();
  return welded;
}

// Exact support from the mesh vertices, rather than the empty corners of its box.
export function stoneSupportHeight(geometry,matrix) {
  const positions=geometry.attributes.position, elements=matrix.elements;
  let bottom=Infinity;
  for (let i=0;i<positions.count;i++) bottom=Math.min(bottom,
    positions.getX(i)*elements[1]+positions.getY(i)*elements[5]+positions.getZ(i)*elements[9]);
  return -bottom;
}

const surfaceShader = /* glsl */ `
  varying vec3 stonePosition;
  varying vec3 stoneWorldNormal;
  uniform float stoneVariant;
  float stoneHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1,0.2,0.3));
    p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
  }
  float stoneNoise(vec3 p) {
    vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(stoneHash(i),stoneHash(i+vec3(1,0,0)),f.x),
      mix(stoneHash(i+vec3(0,1,0)),stoneHash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(stoneHash(i+vec3(0,0,1)),stoneHash(i+vec3(1,0,1)),f.x),
      mix(stoneHash(i+vec3(0,1,1)),stoneHash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float stoneFbm(vec3 p) {
    return stoneNoise(p)*0.57 + stoneNoise(p*2.03+5.1)*0.28 + stoneNoise(p*4.09-3.7)*0.15;
  }
`;

export function createNaturalStoneMaterial(base, variant, fresh = false) {
  const material = base.clone();
  material.vertexColors = true; material.flatShading = fresh;
  if (fresh) material.color.lerp(new THREE.Color(0x9b8c77),0.2);
  material.metalness = 0; material.roughness = 0.94;
  material.onBeforeCompile = shader => {
    shader.uniforms.stoneVariant = { value:variant };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 stonePosition;
      varying vec3 stoneWorldNormal;`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      stonePosition = position;
      stoneWorldNormal = normalize(mat3(modelMatrix) * normal);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${surfaceShader}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', /* glsl */ `
      #include <color_fragment>
      vec3 stoneP = stonePosition * 4.5 + vec3(stoneVariant * 13.7);
      float mottling = stoneFbm(stoneP * 0.7);
      float grainPixel = max(length(dFdx(stoneP)),length(dFdy(stoneP))) * 19.0;
      float grainFilter = 1.0-smoothstep(0.25,1.2,grainPixel);
      float granules = mix(0.5,stoneNoise(stoneP * 19.0),grainFilter);
      float strataWave = stoneP.y * 3.2 + stoneP.x * 0.36 + stoneFbm(stoneP * 0.45) * 3.0;
      float strata = pow(abs(sin(strataWave)),18.0)*(1.0-smoothstep(0.3,1.0,fwidth(strataWave)));
      float seam = abs(stoneFbm(stoneP * vec3(0.8,0.38,0.8)) - 0.47);
      float cracks = (1.0 - smoothstep(0.002,max(0.012,fwidth(seam)*1.5),seam)) * smoothstep(0.52,0.76,mottling) * 0.35;
      float mineral = smoothstep(0.72,0.88,granules) * 0.12 * grainFilter;
      float dust = smoothstep(0.25,0.85,normalize(stoneWorldNormal).y) * (0.07 + mottling * 0.12);
      vec3 mineralTint = mix(vec3(0.8,0.82,0.85),vec3(1.16,1.02,0.85),mottling);
      diffuseColor.rgb *= mineralTint * (0.72 + mottling * 0.48 + granules * 0.12);
      diffuseColor.rgb *= 1.0 - cracks * 0.48 - strata * 0.055;
      diffuseColor.rgb = mix(diffuseColor.rgb,diffuseColor.rgb * vec3(1.3,1.12,0.85),dust);
      diffuseColor.rgb += vec3(mineral * 0.13);
      float stoneRelief = stoneFbm(stoneP * 4.0) * 0.008 * (1.0-smoothstep(0.35,1.5,grainPixel*4.0/19.0))
        + (granules-0.5)*0.0007*grainFilter;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(0.82 + mottling * 0.16 + cracks * 0.1 - mineral * 0.25,0.75,1.0);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', /* glsl */ `
      #include <normal_fragment_maps>
      vec3 surfaceDx = dFdx(-vViewPosition), surfaceDy = dFdy(-vViewPosition);
      vec3 crossX = cross(surfaceDy,normal), crossY = cross(normal,surfaceDx);
      float determinant = dot(surfaceDx,crossX);
      vec3 gradient = dFdx(stoneRelief)*crossX + dFdy(stoneRelief)*crossY;
      normal = normalize(abs(determinant)*normal - sign(determinant)*gradient);
    `);
  };
  material.customProgramCacheKey = () => fresh ? 'fresh-stone-v2' : 'weathered-stone-v2';
  return material;
}
