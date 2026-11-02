import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planetSurfaceDistance, cameraDrawDistance, planetViewHeight, PLANET_RADIUS, TERRAIN_FADE_END } from '../src/planet-horizon.js';

test('the ground remains beneath the camera at every flight altitude', () => {
  for (const height of [1,100,500,1500,5000,50000,1000000]) {
    assert(Math.abs(planetSurfaceDistance(height,-1)-height)<0.000001);
    assert(cameraDrawDistance(height)>Math.hypot(height,TERRAIN_FADE_END));
  }
});
test('a curved horizon separates ground and sky and lowers naturally with altitude', () => {
  let previous=0;
  for (const height of [1,100,1000,10000]) {
    const dip=Math.sqrt(height*(2*PLANET_RADIUS+height))/(PLANET_RADIUS+height);
    assert(dip>previous); previous=dip;
    assert.equal(planetSurfaceDistance(height,-dip*0.99),null);
    assert(planetSurfaceDistance(height,-dip*1.01)>0);
    assert.equal(planetSurfaceDistance(height,0),null);
  }
});
test('the detail fade finishes before the nearest edge of the moving terrain grid', () => {
  // Seven 160 m tiles, with up to half a tile of rounding from the player.
  assert(TERRAIN_FADE_END < 7*160/2-160/2);
});
test('standing on a dune raises the horizon viewpoint above the distant plain',()=>{
  assert.equal(planetViewHeight(35,30),36.05);
  assert.equal(planetViewHeight(35,0),36.05);
  assert.equal(planetViewHeight(3,-2),5);
  const trueHeight=planetViewHeight(35,30);
  assert(planetSurfaceDistance(trueHeight,-0.1)>planetSurfaceDistance(5,-0.1)*6);
});
