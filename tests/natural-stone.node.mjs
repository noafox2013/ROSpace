import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createNaturalStoneGeometry,stoneSupportHeight} from '../src/natural-stone.js';

test('rotated boulders and shards rest on an actual vertex rather than floating above the ground',()=>{
  const point=new THREE.Vector3();
  for(const fragment of [false,true]) for(let i=0;i<12;i++) {
    const geometry=createNaturalStoneGeometry(317+i*17,fragment?0.18:1,fragment);
    const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(i*0.17,i*0.4,-i*0.13));
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(90,50,-30),rotation,new THREE.Vector3(1.6,0.7,1.2));
    const support=stoneSupportHeight(geometry,matrix);
    let bottom=Infinity;
    const linear=matrix.clone().setPosition(0,0,0);
    for(let vertex=0;vertex<geometry.attributes.position.count;vertex++) {
      point.fromBufferAttribute(geometry.attributes.position,vertex).applyMatrix4(linear);
      bottom=Math.min(bottom,point.y+support);
      assert(point.y+support>=-0.000001);
    }
    assert(Math.abs(bottom)<0.000001);
    geometry.dispose();
  }
});
