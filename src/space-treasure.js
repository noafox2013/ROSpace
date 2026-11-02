import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { watchtowerLocation } from './watchtower.js';

export const TREASURE_SCAN_DURATION = 4;
export const treasureLocation = { x: watchtowerLocation.x - 82, z: watchtowerLocation.z + 72 };

export function excavateTreasure(state) {
  if (!state.treasureScanned || state.treasureOpened || state.treasureExcavated) return false;
  state.treasureExcavated = 1;
  return true;
}

export function openTreasure(state) {
  if (!state.treasureScanned || !state.treasureExcavated || state.treasureOpened) return false;
  state.treasureOpened = 1;
  // Older saves with an already repaired ship keep that repair and an empty chest.
  if (!state.spacecraftRepaired) state.landingStrut = 1;
  return true;
}

export function createSpaceTreasure(scene, terrainHeight) {
  const ground = terrainHeight(treasureLocation.x, treasureLocation.z);
  const group = new THREE.Group(); group.name = 'buried-space-treasure';
  group.position.set(treasureLocation.x, ground, treasureLocation.z); scene.add(group);
  const metal = new THREE.MeshStandardMaterial({ color: 0x52616a, metalness: 0.75, roughness: 0.57 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x19252c, metalness: 0.6, roughness: 0.7 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xc89f55, metalness: 0.5, roughness: 0.65 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x93f4dd, toneMapped: false });
  const sand = new THREE.MeshStandardMaterial({ color: 0xad7348, roughness: 1 });
  function box(w,h,d,x,y,z,material,parent) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,0.035), material);
    mesh.position.set(x,y,z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  const crate = new THREE.Group(); group.add(crate);
  // A hollow reinforced transport case with a hinged lid and folded landing gear.
  box(1.9,0.12,1.25,0,0.08,0,dark,crate);
  for (const x of [-0.9,0.9]) box(0.12,0.7,1.25,x,0.43,0,metal,crate);
  for (const z of [-0.56,0.56]) box(1.75,0.7,0.12,0,0.43,z,metal,crate);
  for (const x of [-0.68,0.68]) for (const z of [-0.65,0.65]) box(0.14,0.84,0.09,x,0.46,z,trim,crate);
  const lid = new THREE.Group(); lid.position.set(0,0.82,-0.62); crate.add(lid);
  box(2.02,0.19,1.35,0,0.06,0.62,dark,lid);
  box(1.7,0.045,1.05,0,0.18,0.62,metal,lid);
  for(const x of [-0.67,0.67]) box(0.12,0.06,1.3,x,0.2,0.62,trim,lid);
  box(0.35,0.08,0.045,0,0.47,0.641,glow,crate);
  const strut = new THREE.Group(); crate.add(strut);
  box(0.72,0.12,0.55,-0.35,0.23,0,metal,strut);
  const piston = box(0.17,0.17,1.05,0.1,0.42,0,trim,strut); piston.rotation.y = -0.62;
  const shaft = box(0.12,0.12,0.83,0.3,0.49,0,metal,strut); shaft.rotation.y = 0.57;
  const soil = new THREE.Group(); group.add(soil);
  for(let i=0;i<14;i++) {
    const angle=i*Math.PI*2/14,radius=1.25+Math.sin(i*8.3)*0.15;
    const mound=new THREE.Mesh(new THREE.SphereGeometry(0.32,9,6),sand);
    const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    mound.position.set(x,terrainHeight(group.position.x+x,group.position.z+z)-ground+0.015,z);
    mound.scale.set(1.5,0.22,1); soil.add(mound);
  }
  const marker = new THREE.Group(); marker.name='treasure-scan-beacon'; group.add(marker);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5,0.028,6,64),glow);
  ring.rotation.x=Math.PI/2;ring.position.y=0.14;marker.add(ring);
  const beamMaterial = new THREE.MeshBasicMaterial({color:0xffcc70,transparent:true,opacity:0.65,depthWrite:false,toneMapped:false});
  const beacon=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.3,24,12),beamMaterial);beacon.position.y=12.2;marker.add(beacon);
  const diamond=new THREE.Mesh(new THREE.OctahedronGeometry(0.75),new THREE.MeshBasicMaterial({color:0xffd887,toneMapped:false}));
  diamond.position.y=24.8;marker.add(diamond);
  const scanMaterial = new THREE.MeshBasicMaterial({color:0x83eedb,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.98,1,128),scanMaterial);
  pulse.rotation.x=-Math.PI/2;
  pulse.position.set(watchtowerLocation.x,terrainHeight(watchtowerLocation.x,watchtowerLocation.z)+1,watchtowerLocation.z);
  scene.add(pulse);
  const markerPosition=group.position.clone().add(new THREE.Vector3(0,3.4,0));
  let scanElapsed=null, excavation=0, opening=0, time=0;
  function restore(state) {
    scanElapsed=null;excavation=state.treasureExcavated?1:0;opening=state.treasureOpened?1:0;
    sync(state);
  }
  function sync(state) {
    crate.visible=!!state.treasureExcavated;
    crate.position.y=THREE.MathUtils.lerp(-1.2,0.08,excavation);
    soil.visible=!!state.treasureExcavated;
    lid.rotation.x=-opening*1.85;
    strut.visible=!state.treasureOpened;
    marker.visible=!!state.treasureScanned&&!state.treasureOpened;
    pulse.visible=scanElapsed!==null;
  }
  function near(player,state) {
    return !!state.treasureScanned&&!state.treasureOpened
      && Math.hypot(player.x-group.position.x,player.z-group.position.z)<2.8
      && Math.abs(player.y-1-ground)<1.5;
  }
  function interact(state,player) {
    if(!near(player,state))return null;
    if(!state.treasureExcavated)return excavateTreasure(state)?'excavated':null;
    if(excavation<0.99)return 'digging';
    return openTreasure(state)?'opened':null;
  }
  function startScan(state) {
    if(state.treasureOpened)return 'collected';
    if(state.treasureScanned)return 'found';
    if(scanElapsed!==null)return 'scanning';
    scanElapsed=0;return 'started';
  }
  function update(delta,state) {
    time+=delta;
    let completed=false;
    if(scanElapsed!==null) {
      scanElapsed=Math.min(TREASURE_SCAN_DURATION,scanElapsed+delta);
      const progress=scanElapsed/TREASURE_SCAN_DURATION;
      pulse.scale.setScalar(2+progress*150);scanMaterial.opacity=0.5*(1-progress*0.6);
      if(scanElapsed>=TREASURE_SCAN_DURATION){state.treasureScanned=1;scanElapsed=null;completed=true;}
    }
    if(state.treasureExcavated)excavation=Math.min(1,excavation+delta/1.2);
    if(state.treasureOpened)opening=Math.min(1,opening+delta/0.8);
    ring.rotation.z=time*0.25;diamond.rotation.y=time*0.7;beamMaterial.opacity=0.6+Math.sin(time*2.5)*0.1;
    sync(state);return completed;
  }
  function resolve(player,state) {
    if(!state.treasureExcavated || excavation<0.9 || player.y-1>ground+1.05 || player.y+1<ground)return;
    const x=player.x-group.position.x,z=player.z-group.position.z;
    const halfX=1.4,halfZ=1.08;
    if(Math.abs(x)>=halfX||Math.abs(z)>=halfZ)return;
    if(halfX-Math.abs(x)<halfZ-Math.abs(z))player.x=group.position.x+Math.sign(x||1)*halfX;
    else player.z=group.position.z+Math.sign(z||1)*halfZ;
  }
  restore({});
  return { group, body:crate, markerPosition, near, interact, startScan, update, restore, resolve,
    scanning:()=>scanElapsed!==null,
    progress:()=>scanElapsed===null?0:scanElapsed/TREASURE_SCAN_DURATION,
    excavating:()=>excavation<0.99,
  };
}
