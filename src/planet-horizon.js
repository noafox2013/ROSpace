import * as THREE from 'three';

export const PLANET_RADIUS = 50000;
export const TERRAIN_FADE_START = 300;
export const TERRAIN_FADE_END = 440;
const PLANET_GROUND_LEVEL = -1.05;

export function planetViewHeight(worldY,localGround) {
  // Climbing a dune must raise the view above the distant plain as well.
  return Math.max(0.1,worldY-Math.min(PLANET_GROUND_LEVEL,localGround));
}

export function cameraDrawDistance(altitude) {
  return Math.max(1600, Math.max(0,altitude)+1400);
}

// Stable near root of a ray/sphere intersection, including very high flight.
export function planetSurfaceDistance(altitude, directionY) {
  const height=Math.max(0.1,altitude);
  const b=(PLANET_RADIUS+height)*directionY;
  const c=height*(2*PLANET_RADIUS+height);
  const discriminant=b*b-c;
  return directionY<0 && discriminant>=0 ? c/(-b+Math.sqrt(discriminant)) : null;
}

export function installPlanetHorizon(skyDome, terrainHeight) {
  const uniforms=skyDome.material.uniforms;
  uniforms.planetHeight={value:1};
  uniforms.planetWorldXZ={value:new THREE.Vector2()};
  uniforms.planetFogColor={value:new THREE.Color()};
  uniforms.planetFogRange={value:new THREE.Vector2(300,1100)};
  skyDome.material.fragmentShader=skyDome.material.fragmentShader.replace('      void main() {', /* glsl */ `
      uniform float planetHeight;
      uniform vec2 planetWorldXZ;
      uniform vec3 planetFogColor;
      uniform vec2 planetFogRange;
      vec3 planetBackground(vec3 direction, vec3 skyColor) {
        const float radius=${PLANET_RADIUS.toFixed(1)};
        float height=max(0.1,planetHeight);
        float b=(radius+height)*direction.y;
        float c=height*(2.0*radius+height);
        float discriminant=b*b-c;
        float horizonY=-sqrt(c)/(radius+height);
        if (direction.y>=0.0 || discriminant<=0.0) return skyColor;
        float distanceToGround=c/(-b+sqrt(discriminant));
        vec2 worldXZ=planetWorldXZ+direction.xz*distanceToGround;
        float variation=stormNoise(worldXZ*0.0015)+stormNoise(worldXZ*0.004+19.0)*0.2;
        float daylight=smoothstep(-0.2,0.4,sunDirection.y);
        vec3 soil=mix(vec3(0.018,0.014,0.02),vec3(0.25,0.105,0.052),daylight);
        soil*=0.94+variation*0.12;
        // Dust accumulates gradually along the view ray, instead of forming a colored wall.
        float airDistance=distanceToGround*exp(-height/3500.0);
        float visibility=max(120.0,planetFogRange.y*0.42);
        float fog=1.0-exp(-airDistance/visibility);
        float limbHaze=1.0-smoothstep(0.0,0.055,horizonY-direction.y);
        vec3 airColor=mix(planetFogColor,skyColor,0.45+limbHaze*0.55);
        vec3 color=mix(soil,airColor,fog);
        color=mix(color,skyColor,limbHaze*fog);
        float feather=max(0.0012,fwidth(direction.y)*1.5);
        float groundCoverage=smoothstep(-feather,feather,horizonY-direction.y);
        return mix(skyColor,color,groundCoverage);
      }
      void main() {`);
  skyDome.material.fragmentShader=skyDome.material.fragmentShader.replace(
    'gl_FragColor = vec4(sky, 1.0);','gl_FragColor = vec4(planetBackground(direction, sky), 1.0);');
  skyDome.renderOrder=-10;
  skyDome.material.depthTest=false;
  skyDome.onBeforeRender=(_renderer,scene,camera) => {
    uniforms.planetHeight.value=planetViewHeight(camera.position.y,terrainHeight(camera.position.x,camera.position.z));
    uniforms.planetWorldXZ.value.set(camera.position.x,camera.position.z);
    uniforms.planetFogColor.value.copy(scene.fog.color);
    uniforms.planetFogRange.value.set(scene.fog.near,scene.fog.far);
  };
}
