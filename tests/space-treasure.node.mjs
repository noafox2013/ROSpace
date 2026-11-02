import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSpaceTreasure, excavateTreasure, openTreasure } from '../src/space-treasure.js';
import { repairSpacecraft } from '../src/spacecraft-repair.js';

const fresh=()=>({treasureScanned:0,treasureExcavated:0,treasureOpened:0,landingStrut:0,spacecraftRepaired:0});
test('a timed underground scan marks exactly one chest only when it completes',()=>{
  const state=fresh(),treasure=createSpaceTreasure(new THREE.Scene(),()=>2);
  assert.equal(treasure.startScan(state),'started');
  assert.equal(treasure.update(2,state),false);
  assert.equal(state.treasureScanned,0);
  assert.equal(treasure.progress(),0.5);
  assert.equal(treasure.startScan(state),'scanning');
  assert.equal(treasure.update(2,state),true);
  assert.equal(state.treasureScanned,1);
  assert.equal(treasure.startScan(state),'found');
  assert.equal(treasure.update(10,state),false);
});
test('the buried chest requires discovery, proximity and excavation before it yields one landing strut',()=>{
  const state=fresh(),treasure=createSpaceTreasure(new THREE.Scene(),()=>2);
  const player=treasure.group.position.clone().add(new THREE.Vector3(2,1,0));
  assert.equal(treasure.interact(state,player),null);
  assert.equal(excavateTreasure(state),false);assert.equal(openTreasure(state),false);
  treasure.startScan(state);treasure.update(4,state);
  assert.equal(treasure.interact(state,player.clone().add(new THREE.Vector3(0,5,0))),null);
  assert.equal(treasure.interact(state,player),'excavated');
  assert.equal(treasure.interact(state,player),'digging');assert.equal(state.landingStrut,0);
  treasure.update(1.2,state);
  const overlap=treasure.group.position.clone().add(new THREE.Vector3(0,1,0));
  treasure.resolve(overlap,state);
  assert(Math.hypot(overlap.x-treasure.group.position.x,overlap.z-treasure.group.position.z)>1.079);
  assert.equal(treasure.interact(state,player),'opened');assert.equal(state.landingStrut,1);
  assert.equal(treasure.interact(state,player),null);assert.equal(openTreasure(state),false);
  Object.assign(state,{fuelTank:1,crystals:50,blueCrystals:20});
  assert.equal(repairSpacecraft(state),'success');assert.equal(state.landingStrut,0);
  assert.equal(openTreasure(state),false);assert.equal(treasure.startScan(state),'collected');
  treasure.restore(state);assert.equal(treasure.group.getObjectByName('treasure-scan-beacon').visible,false);
});
