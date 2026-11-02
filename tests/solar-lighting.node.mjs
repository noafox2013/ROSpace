import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solarLighting } from '../src/solar-lighting.js';

test('direct sunlight strengthens as the sun rises and vanishes below the horizon',()=>{
  assert.equal(solarLighting(-0.1).direct,0);
  let previous=0;
  for(const height of [0,0.03,0.1,0.3,0.6,1]) {
    const light=solarLighting(height);assert(light.direct>=previous);previous=light.direct;
  }
  assert(solarLighting(0.03).warmth<solarLighting(0.6).warmth);
});
test('nighttime and dust storms reduce illumination and reflections without discontinuities',()=>{
  const noon=solarLighting(1),night=solarLighting(-1),storm=solarLighting(1,1);
  assert(night.ambient<noon.ambient*0.4);assert(night.environment<noon.environment*0.1);
  assert(storm.direct<noon.direct*0.1);assert(storm.ambient<noon.ambient);assert.equal(storm.sunOpacity,0);
  for(let elevation=-1;elevation<1;elevation+=0.0002) {
    const a=solarLighting(elevation),b=solarLighting(elevation+0.0002);
    for(const key of Object.keys(a)){assert(Number.isFinite(a[key]));assert(Math.abs(a[key]-b[key])<0.1);}
  }
});
