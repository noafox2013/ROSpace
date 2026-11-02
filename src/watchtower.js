import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { nearestDuneCrest } from './dunes.js';
import { spacecraftLocation } from './spacecraft.js';
import { createTowerLift } from './tower-lift.js';

export const watchtowerLocation = nearestDuneCrest(spacecraftLocation.x,spacecraftLocation.z);
export const watchtowerDeckHeight = 18.68;
function landingGeometry(radius,top,thickness) {
  const shape=new THREE.Shape();shape.absarc(0,0,radius,0,Math.PI*2,false);
  const hole=new THREE.Path();hole.moveTo(-1.65,-1.65);hole.lineTo(-1.65,1.65);
  hole.lineTo(1.65,1.65);hole.lineTo(1.65,-1.65);hole.closePath();shape.holes.push(hole);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,curveSegments:40});
  geometry.rotateX(Math.PI/2);geometry.translate(0,top,0);return geometry;
}
export function createWatchtower(scene,terrainHeight) {
  const group=new THREE.Group();group.name='AEGIS-04-watchtower';
  let ground=terrainHeight(watchtowerLocation.x,watchtowerLocation.z);
  for(const x of [-3.5,0,3.5])for(const z of [-3.5,0,3.5])ground=Math.max(ground,terrainHeight(watchtowerLocation.x+x,watchtowerLocation.z+z));
  group.position.set(watchtowerLocation.x,ground,watchtowerLocation.z);scene.add(group);
  const steel=new THREE.MeshStandardMaterial({color:0x626c70,metalness:0.72,roughness:0.63});
  const dark=new THREE.MeshStandardMaterial({color:0x202b30,metalness:0.55,roughness:0.75});
  const pale=new THREE.MeshStandardMaterial({color:0xb3b9b4,metalness:0.43,roughness:0.66});
  const rust=new THREE.MeshStandardMaterial({color:0x875239,metalness:0.3,roughness:0.94});
  const concrete=new THREE.MeshStandardMaterial({color:0x777568,roughness:0.98});
  const caution=new THREE.MeshStandardMaterial({color:0xcfa44e,metalness:0.25,roughness:0.7});
  const glass=new THREE.MeshPhysicalMaterial({color:0x7ca6ad,roughness:0.17,metalness:0.1,transparent:true,opacity:0.22,depthWrite:false,side:THREE.DoubleSide});
  const glow=new THREE.MeshBasicMaterial({color:0x78dcca,toneMapped:false});
  // Shared fine panel wear, with isolated scratches and seams instead of uniform gloss.
  const pixels=new Uint8Array(128*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++) {
    const n=Math.sin(x*127.1+y*311.7)*43758.5453;
    const grain=0.78+(n-Math.floor(n))*0.18;
    const value=Math.round(grain*255*(x%32===0||y%64===0?0.68:1));
    const at=(y*128+x)*4;pixels[at]=pixels[at+1]=pixels[at+2]=value;pixels[at+3]=255;
  }
  const wear=new THREE.DataTexture(pixels,128,128);wear.wrapS=wear.wrapT=THREE.RepeatWrapping;wear.needsUpdate=true;
  for(const material of [steel,dark,pale,rust]) {material.map=wear;material.bumpMap=wear;material.bumpScale=0.008;}
  function mesh(geometry,material,x=0,y=0,z=0,parent=group) {
    const part=new THREE.Mesh(geometry,material);part.position.set(x,y,z);part.castShadow=true;part.receiveShadow=true;parent.add(part);return part;
  }
  const box=(w,h,d,x,y,z,material=steel,parent=group)=>mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z,parent);
  function beam(a,b,radius=0.07,material=steel,parent=group) {
    const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);
    const part=mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),8),material,...from.add(to).multiplyScalar(0.5).toArray(),parent);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return part;
  }
  function ring(radius,y,material=steel,tube=0.045) {
    const part=mesh(new THREE.TorusGeometry(radius,tube,6,72),material,0,y,0);part.rotation.x=Math.PI/2;return part;
  }
  // Both landings leave the shaft clear so their tops cannot overlap the cabin floor.
  mesh(landingGeometry(4.5,0.2,0.3),concrete);
  // A shallow ramp connects the dune to the lift entrance.
  const rampStart=7.8,rampEnd=3.3,rampZ=0.35,rampWidth=1.25;
  const rampBottom=terrainHeight(group.position.x+rampStart,group.position.z+rampZ)-ground+0.025;
  const rampTop=0.2;
  const rampGeometry=new THREE.BufferGeometry();
  rampGeometry.setAttribute('position',new THREE.Float32BufferAttribute([
    rampEnd,rampTop,rampZ-rampWidth/2, rampEnd,rampTop,rampZ+rampWidth/2,
    rampStart,rampBottom,rampZ-rampWidth/2, rampStart,rampBottom,rampZ+rampWidth/2,
  ],3));
  rampGeometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,0,1,4,0,4,1],2));
  rampGeometry.setIndex([0,1,2,2,1,3]);rampGeometry.computeVertexNormals();mesh(rampGeometry,steel);
  for(const z of [rampZ-rampWidth/2,rampZ+rampWidth/2]) {
    beam([rampStart,rampBottom,z],[rampEnd,rampTop,z],0.045,caution);
  }
  for(const sx of [-1,1])for(const sz of [-1,1]) {
    const x=sx*3.9,z=sz*3.9;
    const baseY=terrainHeight(group.position.x+x,group.position.z+z)-ground;
    box(1.05,0.5,1.05,x,baseY+0.08,z,concrete);
    box(0.83,0.12,0.83,x,baseY+0.38,z,dark);
    beam([x,baseY+0.4,z],[x,watchtowerDeckHeight-0.3,z],0.15,pale);
    beam([x,watchtowerDeckHeight-0.5,z],[sx*3.15,watchtowerDeckHeight-0.2,sz*3.15],0.14,pale);
    for(const bx of [-0.28,0.28])for(const bz of [-0.28,0.28])mesh(new THREE.CylinderGeometry(0.04,0.04,0.12,6),steel,x+bx,baseY+0.49,z+bz);
    for(let level=0;level<3;level++) {
      const low=1+level*5.4,high=low+4.6;
      beam([x,low,z],[-x,high,z],0.045,steel);
      beam([x,high,z],[-x,low,z],0.045,steel);
      if(sx===1)beam([x,low,z],[x,high,-z],0.045,steel);
    }
  }
  const deck=watchtowerDeckHeight;
  mesh(landingGeometry(4.85,deck,0.22),dark);
  const lift=createTowerLift(group,ground,deck,{steel,dark,pale,glass,glow,caution});
  ring(4.8,deck-0.27,steel,0.12);ring(4.8,deck-0.52,pale,0.08);
  for(let side=0;side<12;side++) {
    const a=side*Math.PI/6,b=(side+1)*Math.PI/6,mid=(a+b)/2,radius=4.65;
    beam([Math.cos(a)*radius,deck,Math.sin(a)*radius],[Math.cos(a)*radius,deck+3.3,Math.sin(a)*radius],0.065,pale);
    const width=2*radius*Math.sin(Math.PI/12);
    const lower=box(width,0.78,0.13,Math.cos(mid)*radius,deck+0.4,Math.sin(mid)*radius,pale);
    lower.rotation.y=Math.PI/2-mid;
    const window=box(width-0.12,2.1,0.035,Math.cos(mid)*radius,deck+1.88,Math.sin(mid)*radius,glass);
    window.rotation.y=Math.PI/2-mid;window.castShadow=false;
    beam([Math.cos(a)*radius,deck+3.04,Math.sin(a)*radius],[Math.cos(b)*radius,deck+3.04,Math.sin(b)*radius],0.045,dark);
  }
  mesh(new THREE.CylinderGeometry(4.8,5.1,0.3,12),pale,0,deck+3.45,0);
  ring(4.96,deck+3.36,dark,0.055);
  const solarMaterial=new THREE.MeshStandardMaterial({color:0x253d54,metalness:0.4,roughness:0.35});
  for(const x of [-1.6,1.6]) {
    const solar=box(2.5,0.08,2.7,x,deck+3.73,-0.8,dark);solar.rotation.x=-0.15;
    for(let cell=0;cell<7;cell++)box(2.3,0.018,0.27,x,deck+3.79+cell*0.045,-1.9+cell*0.35,solarMaterial);
  }
  beam([0,deck+3.55,1.5],[0,deck+9.6,1.5],0.045,steel);
  for(const y of [deck+7.4,deck+8.5])beam([-1.1,y,1.5],[1.1,y,1.5],0.025,dark);
  const beaconMaterial=new THREE.MeshStandardMaterial({color:0xf35d36,emissive:0xff3d13,emissiveIntensity:2});
  mesh(new THREE.SphereGeometry(0.13,12,8),beaconMaterial,0,deck+9.65,1.5);
  for(const x of [-1,1])mesh(new THREE.BoxGeometry(0.08,0.16,0.14),glow,x*0.8,deck+0.12,0.7);
  // A service console on the central platform, with a sloping touchscreen.
  box(1.12,0.9,0.65,-2.65,deck+0.45,-0.55,dark);
  const display=box(1.35,0.65,0.10,-2.65,deck+1.12,-0.62,dark);display.rotation.x=-0.48;
  const screen=box(1.18,0.48,0.018,-2.65,deck+1.13,-0.555,glow);screen.rotation.x=-0.48;
  for(let i=0;i<4;i++)box(0.12,0.028,0.08,-3+i*0.23,deck+0.95,-0.13,i===0?caution:steel);
  if(typeof document!=='undefined') {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#101e23';ctx.fillRect(0,0,512,192);
    ctx.fillStyle='#8ce9d7';ctx.font='24px monospace';ctx.fillText('AEGIS / 04   TERMINAL',24,40);
    ctx.strokeStyle='#466972';ctx.strokeRect(20,64,472,106);
    ctx.fillStyle='#eef9f2';ctx.font='bold 40px monospace';ctx.fillText('TRASURE SCAN',40,133);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    screen.material=new THREE.MeshBasicMaterial({map,toneMapped:false});
    const sign=mesh(new THREE.PlaneGeometry(1.5,0.56),new THREE.MeshBasicMaterial({map,toneMapped:false}),0,deck-1,2.1);sign.name='watchtower-identification';
  }
  // Merge the many structural details into a handful of static material batches.
  const batches=new Map();
  for(const part of [...group.children]) {
    if(!part.isMesh || part.material.transparent)continue;
    if(!batches.has(part.material))batches.set(part.material,[]);batches.get(part.material).push(part);
  }
  for(const [material,parts] of batches) {
    const geometries=parts.map(part=>{part.updateMatrix();const geometry=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();geometry.applyMatrix4(part.matrix);return geometry;});
    const combined=mergeGeometries(geometries,false);
    const batch=new THREE.Mesh(combined,material);batch.castShadow=batch.receiveShadow=true;group.add(batch);
    for(const part of parts){group.remove(part);part.geometry.dispose();}for(const geometry of geometries)geometry.dispose();
  }
  const terminalPosition=new THREE.Vector3(-2.65,deck+1.1,-0.5).add(group.position);
  const terminalApproach=new THREE.Vector3(-2.4,deck+1,0.6).add(group.position);
  function inside(player) {
    return Math.hypot(player.x-group.position.x,player.z-group.position.z)<4.5
      && player.y-1>ground+deck-0.25 && player.y<ground+deck+3.35;
  }
  function surfaces(x,z) {
    const radius=Math.hypot(x,z),floors=[];
    if(radius<4.25)floors.push(ground+0.2);
    if(x>=rampEnd&&x<=rampStart && Math.abs(z-rampZ)<=rampWidth/2) {
      floors.push(ground+THREE.MathUtils.lerp(rampTop,rampBottom,(x-rampEnd)/(rampStart-rampEnd)));
    }
    if(radius<4.87 && (Math.abs(x)>=1.65||Math.abs(z)>=1.65))floors.push(ground+deck);
    const liftFloor=lift.floorAt(x,z);if(liftFloor!==null)floors.push(liftFloor);
    if(radius<4.98)floors.push(ground+deck+3.6);
    return floors;
  }
  function supports(player) {
    const x=player.x-group.position.x,z=player.z-group.position.z;
    return Math.hypot(x,z)<8 && surfaces(x,z).some(top=>Math.abs(player.y-1-top)<0.085);
  }
  function resolve(player,height,previousHeight,previousPosition) {
    let x=player.x-group.position.x,z=player.z-group.position.z,radius=Math.hypot(x,z);
    if(radius>8)return height;
    const startingTerrain=terrainHeight(player.x,player.z),feet=startingTerrain+height;
    const previousFeet=previousPosition?previousPosition.y-1:startingTerrain+previousHeight;
    lift.resolveWalls(player,feet);
    x=player.x-group.position.x;z=player.z-group.position.z;radius=Math.hypot(x,z);
    const terrain=terrainHeight(player.x,player.z);
    height=feet-terrain;
    const floors=surfaces(x,z);
    let floor=-Infinity;
    for(const top of floors)if(top<=previousFeet+0.32 && feet<=top+0.06)floor=Math.max(floor,top);
    let limited=Math.max(height,floor-terrain);
    const ceiling=ground+deck+3.3;
    if(radius<4.98 && previousFeet<ceiling-1.9 && feet+2.2>ceiling)limited=Math.min(limited,ceiling-2.2-terrain);
    // The observation cabin has a solid perimeter; access is through the lift.
    if(feet>ground+deck-0.3 && feet<ground+deck+3.25) {
      if(radius>4.15 && radius<5.08) {
        const target=radius<4.65?4.14:5.09;
        player.x=group.position.x+x/radius*target;player.z=group.position.z+z/radius*target;
      }
    }
    return Math.max(0,limited);
  }
  let time=0;
  return {group,ground,terminalPosition,terminalApproach,inside,resolve,supports,lift,
    nearTerminal:player=>inside(player)&&player.distanceTo(terminalPosition)<2.35,
    update(delta){lift.update(delta);time+=delta;beaconMaterial.emissiveIntensity=0.25+Math.pow(Math.max(0,Math.sin(time*2.4)),6)*3;},
    positionCamera(player,yaw,camera){
      const dx=camera.x-group.position.x,dz=camera.z-group.position.z,distance=Math.hypot(dx,dz);
      if(distance>4.05){camera.x=group.position.x+dx/distance*4.05;camera.z=group.position.z+dz/distance*4.05;}
      camera.y=THREE.MathUtils.clamp(camera.y,ground+deck+1,ground+deck+3.05);
    },
  };
}
