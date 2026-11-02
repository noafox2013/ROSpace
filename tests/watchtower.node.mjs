import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { duneHeight } from '../src/dunes.js';
import {createWatchtower,watchtowerLocation,watchtowerDeckHeight} from '../src/watchtower.js';
const terrain=(x,z)=>duneHeight(x,z)-1.05;
const make=()=>createWatchtower(new THREE.Scene(),terrain);
function complete(tower,player){for(let i=0;i<440;i++){tower.update(1/60);if(tower.lift.isRiding())tower.lift.carry(player);}}

test('the tower stands on a dune with a space lift and upstairs scan terminal',()=>{
  const tower=make();
  assert(duneHeight(watchtowerLocation.x,watchtowerLocation.z)>25);
  assert(tower.group.getObjectByName('space-elevator'));
  assert(tower.nearTerminal(tower.terminalApproach));
  const below=tower.terminalApproach.clone();below.y=tower.ground+1;
  assert.equal(tower.nearTerminal(below),false);
});
test('the elevator carries a player smoothly up and down and ignores repeated activation during a trip',()=>{
  const tower=make(),player=tower.lift.approach('bottom');
  assert.equal(tower.lift.activate(player),'riding');
  assert.equal(tower.lift.activate(player),null);
  let previous=player.y;
  for(let i=0;i<440;i++){
    tower.update(1/60);if(tower.lift.isRiding())tower.lift.carry(player);
    assert(player.y>=previous-0.001&&player.y-previous<0.12);previous=player.y;
  }
  assert(Math.abs(player.y-1-tower.ground-watchtowerDeckHeight)<0.01);
  assert.equal(tower.lift.isRiding(),false);
  assert.equal(tower.lift.activate(player),'riding');complete(tower,player);
  assert(Math.abs(player.y-1-tower.ground-0.2)<0.01);
});
test('the top gate blocks an empty shaft and callers can summon the lift without being teleported',()=>{
  const tower=make(),player=tower.lift.approach('top');
  const overlap=player.clone();overlap.x=tower.group.position.x+1.8;
  tower.lift.resolveWalls(overlap,overlap.y-1);
  assert(overlap.x>=tower.group.position.x+2);
  const original=player.clone();assert.equal(tower.lift.activate(player),'called');
  complete(tower,player);assert(player.equals(original));
  assert.equal(tower.lift.activate(player),'riding');
});
test('saving and loading mid-flight resumes a safe ride and a reset parks at the ground',()=>{
  const tower=make(),player=tower.lift.approach('bottom');tower.lift.activate(player);
  for(let i=0;i<140;i++){tower.update(1/60);tower.lift.carry(player);}
  const saved=JSON.parse(JSON.stringify(tower.lift.snapshot())),copy=make();
  copy.lift.restore(saved,player);assert(copy.lift.isRiding());complete(copy,player);
  assert(Math.abs(player.y-1-copy.ground-watchtowerDeckHeight)<0.01);
  copy.lift.reset();assert.equal(copy.lift.snapshot().height,0.2);
});
test('the cabin floor supports visitors, the solid roof blocks flight, and the ground ramp stays walkable',()=>{
  const tower=make(),player=tower.terminalApproach.clone(),base=terrain(player.x,player.z),floor=tower.ground+watchtowerDeckHeight;
  assert(Math.abs(tower.resolve(player,floor-base-0.2,floor-base+0.5)-(floor-base))<0.0001);
  player.y=floor+3;assert(tower.resolve(player,floor-base+2,floor-base+0.8)<floor-base+1.2);
  let feet=terrain(tower.group.position.x+7.8,tower.group.position.z+0.35);
  let previous=new THREE.Vector3(tower.group.position.x+7.8,feet+1,tower.group.position.z+0.35);
  for(let x=7.75;x>=2.7;x-=0.05){
    const p=new THREE.Vector3(tower.group.position.x+x,feet+1,tower.group.position.z+0.35),ground=terrain(p.x,p.z);
    const height=tower.resolve(p,feet-ground-0.005,feet-ground,previous);
    assert(Math.abs(p.x-tower.group.position.x-x)<0.00001);feet=terrain(p.x,p.z)+height;p.y=feet+1;previous=p;
  }
  assert(Math.abs(feet-tower.ground-0.2)<0.01);
});

test('the lift floor and threshold have exactly one surface at either landing',()=>{
  const tower=make(),player=tower.lift.approach('bottom');
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,0.6);
  for(const stop of [0.2,watchtowerDeckHeight]) {
    tower.group.updateMatrixWorld(true);
    const floor=tower.ground+stop;
    for(const [x,z] of [[0.25,0.17],[1.4,0.23],[1.575,0.21],[1.68,0.2]]) {
      ray.ray.origin.set(tower.group.position.x+x,floor+0.3,tower.group.position.z+z);
      const surfaces=ray.intersectObject(tower.group,true).filter(hit=>Math.abs(hit.point.y-floor)<0.003&&hit.face.normal.y>0.9);
      assert.equal(surfaces.length,1,`overlapping or missing floor at ${stop}, ${x}, ${z}`);
    }
    if(stop===0.2){tower.lift.activate(player);complete(tower,player);}
  }
});
