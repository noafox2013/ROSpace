import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { positionWaypoint } from '../src/waypoint.js';

function camera(width,height) {
  const camera=new THREE.PerspectiveCamera(62,width/height,0.1,1600);
  camera.updateMatrixWorld();return camera;
}
test('a destination in view stays on its world projection',()=>{
  const marker=positionWaypoint(new THREE.Vector3(0,0,-100),camera(1100,800),1100,800);
  assert.deepEqual(marker,{x:550,y:400,offscreen:false,angle:0});
  assert.equal(positionWaypoint(new THREE.Vector3(0,0,-5000),camera(1100,800),1100,800).offscreen,false);
});
test('sideways, behind and near-plane destinations keep finite markers inside desktop and mobile screens',()=>{
  for(const [width,height] of [[1100,800],[390,800],[800,390]]) {
    for(const position of [[1000,0,-10],[-1000,0,-10],[20,10,100],[-20,-10,100],[0,0,100],[0,0,0],[0,-1000,-10],[0,1000,-10]]) {
      const marker=positionWaypoint(new THREE.Vector3(...position),camera(width,height),width,height);
      assert.equal(marker.offscreen,true);
      assert(Number.isFinite(marker.x)&&Number.isFinite(marker.y)&&Number.isFinite(marker.angle));
      assert(marker.x>=90&&marker.x<=width-90);
      assert(marker.y>=70&&marker.y<=height-70);
      if(position[0]>0)assert(marker.x>=width/2);
      if(position[0]<0)assert(marker.x<=width/2);
    }
  }
});
