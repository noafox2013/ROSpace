import * as THREE from 'three';

export const SUN_ANGULAR_DIAMETER = 1.8;

export function solarLighting(elevation,storm=0) {
  const height=THREE.MathUtils.clamp(elevation,-1,1);
  const dust=THREE.MathUtils.clamp(storm,0,1);
  const daylight=THREE.MathUtils.smoothstep(height,-0.18,0.4);
  const transmission=1-Math.exp(-6*Math.max(0,height));
  const direct=THREE.MathUtils.smoothstep(height,-0.015,0.055)*(0.16+transmission*0.84);
  return {
    daylight,
    direct:3.4*direct*(1-dust*0.94),
    ambient:THREE.MathUtils.lerp(0.38,1.15,daylight)*(1-dust*0.35),
    warmth:THREE.MathUtils.smoothstep(height,0,0.65),
    exposure:THREE.MathUtils.lerp(1.05,0.95,daylight),
    environment:THREE.MathUtils.lerp(0.045,0.65,daylight)*(1-dust*0.6),
    sunOpacity:THREE.MathUtils.smoothstep(height,-0.009,0.009)*Math.pow(1-dust,3),
  };
}

// Broad sky/ground reflections fill rough metal without baking a second sun.
export function createDesertEnvironment(renderer) {
  const width=64,height=32,data=new Float32Array(width*height*4);
  const sky=new THREE.Color(0x9dbedf),horizon=new THREE.Color(0xd8d2c2),ground=new THREE.Color(0x92745c);
  const color=new THREE.Color();
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const elevation=-Math.cos((y+0.5)/height*Math.PI);
    color.copy(horizon).lerp(elevation>0?sky:ground,Math.sqrt(Math.abs(elevation)));
    const offset=(y*width+x)*4;
    data[offset]=color.r;data[offset+1]=color.g;data[offset+2]=color.b;data[offset+3]=1;
  }
  const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);
  texture.mapping=THREE.EquirectangularReflectionMapping;texture.needsUpdate=true;
  const generator=new THREE.PMREMGenerator(renderer);
  const environment=generator.fromEquirectangular(texture);
  texture.dispose();generator.dispose();return environment;
}
