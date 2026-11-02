import * as THREE from 'three';

export function createTowerLift(tower,ground,deck,materials) {
  const {steel,dark,pale,glass,glow,caution}=materials;
  const root=new THREE.Group();root.name='space-elevator';tower.add(root);
  function box(w,h,d,x,y,z,material,parent=root) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  for(const x of [-1.65,1.65])for(const z of [-1.65,1.65]) {
    box(0.16,deck+2.8,0.16,x,(deck+2.8)/2,z,pale);
    box(0.035,deck+2.6,0.06,x+0.1,(deck+2.6)/2,z,glow);
  }
  box(0.04,deck+2.7,3.2,-1.65,(deck+2.7)/2,0,glass);
  for(const z of [-1.65,1.65])box(3.2,deck+2.7,0.04,0,(deck+2.7)/2,z,glass);
  box(0.04,deck-3,3.2,1.65,3+(deck-3)/2,0,glass);
  box(3.5,0.22,3.5,0,deck+2.95,0,dark);
  const car=new THREE.Group();car.name='elevator-cabin';root.add(car);
  box(3,0.22,3,0,-0.11,0,dark,car);
  // Bridge only the gap to the landing, leaving a small joint at each edge.
  box(0.146,0.12,2.6,1.575,-0.06,0,steel,car);
  box(3,0.15,3,0,2.7,0,dark,car);
  for(const x of [-1.45,1.45])for(const z of [-1.45,1.45]) {
    box(0.09,2.65,0.09,x,1.33,z,steel,car);
    box(0.04,2.4,0.025,x,1.33,z+0.05,glow,car);
  }
  for(const z of [-1.46,1.46])box(2.8,0.08,0.06,0,0.07,z,glow,car);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.95,0.035,8,48),glow);
  ring.rotation.x=Math.PI/2;ring.position.y=0.015;car.add(ring);
  const thruster=new THREE.Mesh(new THREE.TorusGeometry(1.2,0.08,8,48),glow);
  thruster.rotation.x=Math.PI/2;thruster.position.y=-0.24;car.add(thruster);
  function gates(parent,x,y) {
    const pair=[];
    for(const side of [-1,1]) {
      const door=new THREE.Group();parent.add(door);door.position.set(x,y,side*0.77);
      box(0.07,2.5,1.5,0,1.25,0,glass,door);
      box(0.1,0.1,1.5,0,0.08,0,caution,door);
      box(0.08,2.5,0.035,0,1.25,-side*0.73,glow,door);pair.push(door);
    }
    return pair;
  }
  const carDoors=gates(car,1.46,0);
  const bottomDoors=gates(root,1.67,0.2),topDoors=gates(root,1.67,deck);
  for(const y of [0.2,deck]) {
    box(0.25,1.05,0.42,2,y+0.55,1.85,dark);
    box(0.04,0.35,0.28,2.14,y+0.95,1.85,glow);
  }
  if(typeof document!=='undefined') {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#0c2029';ctx.fillRect(0,0,512,128);
    ctx.fillStyle='#9af4df';ctx.font='bold 40px monospace';ctx.fillText('AEGIS / MAGLIFT',35,57);
    ctx.font='24px monospace';ctx.fillText('F  /  ORBITAL ACCESS',40,102);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    const label=new THREE.Mesh(new THREE.PlaneGeometry(2.9,0.72),new THREE.MeshBasicMaterial({map,toneMapped:false}));
    label.rotation.y=Math.PI/2;label.position.set(1.8,3.4,0);root.add(label);
  }
  let height=0.2,target=0.2,from=0.2,phase='idle',elapsed=0,door=1,riding=false;
  function sync() {
    car.position.y=height;
    for(const [pair,amount] of [[carDoors,door],[bottomDoors,Math.abs(height-0.2)<0.01?door:0],[topDoors,Math.abs(height-deck)<0.01?door:0]]) {
      pair.forEach((panel,index)=>{panel.position.z=(index===0?-1:1)*(0.77+amount*1.5);});
    }
  }
  function near(player) {
    const x=player.x-tower.position.x,z=player.z-tower.position.z,feet=player.y-1-ground;
    return x>-1.25&&x<3.6&&Math.abs(z)<1.35&&(Math.abs(feet-0.2)<1||Math.abs(feet-deck)<0.6);
  }
  function activate(player) {
    if(!near(player)||phase!=='idle')return null;
    const landing=player.y-1-ground>deck/2?deck:0.2;
    riding=Math.abs(height-landing)<0.01;
    target=riding?(landing===deck?0.2:deck):landing;
    from=height;elapsed=0;phase='closing';
    if(riding)carry(player);
    return riding?'riding':'called';
  }
  function carry(player) {player.set(tower.position.x,ground+height+1,tower.position.z);}
  function update(delta) {
    if(phase!=='idle') {
      elapsed+=delta;
      if(phase==='closing') {
        door=Math.max(0,1-elapsed/0.65);
        if(elapsed>=0.65){phase='moving';elapsed=0;door=0;}
      } else if(phase==='moving') {
        const t=Math.min(1,elapsed/5.5),ease=t*t*(3-2*t);
        height=THREE.MathUtils.lerp(from,target,ease);
        if(t===1){phase='opening';elapsed=0;}
      } else {
        door=Math.min(1,elapsed/0.65);
        if(door===1){phase='idle';riding=false;elapsed=0;}
      }
    }
    sync();
  }
  function resolveWalls(player,feet) {
    const localFeet=feet-ground;
    const walls=[[-1.65,0,0.12,3.3],[0,-1.65,3.3,0.12],[0,1.65,3.3,0.12]];
    const openAtFloor=phase==='idle'&&door>0.9&&Math.abs(localFeet-height)<0.5;
    if(!openAtFloor)walls.push([1.67,0,0.12,3.3]);
    if(localFeet>deck+2.8||localFeet+2.2<0)return;
    for(const [x,z,w,d] of walls) {
      const minX=tower.position.x+x-w/2-0.36,maxX=tower.position.x+x+w/2+0.36;
      const minZ=tower.position.z+z-d/2-0.36,maxZ=tower.position.z+z+d/2+0.36;
      if(player.x<=minX||player.x>=maxX||player.z<=minZ||player.z>=maxZ)continue;
      const edges=[[player.x-minX,'x',minX],[maxX-player.x,'x',maxX],[player.z-minZ,'z',minZ],[maxZ-player.z,'z',maxZ]];
      edges.sort((a,b)=>a[0]-b[0]);player[edges[0][1]]=edges[0][2];
    }
  }
  function restore(saved,player) {
    height=target=from=0.2;phase='idle';elapsed=0;door=1;riding=false;
    if(saved&&[saved.height,saved.target,saved.from,saved.elapsed,saved.door].every(Number.isFinite)) {
      height=THREE.MathUtils.clamp(saved.height,0.2,deck);target=saved.target>deck/2?deck:0.2;
      from=THREE.MathUtils.clamp(saved.from,0.2,deck);elapsed=THREE.MathUtils.clamp(saved.elapsed,0,5.5);
      phase=['idle','closing','moving','opening'].includes(saved.phase)?saved.phase:'idle';
      door=THREE.MathUtils.clamp(saved.door,0,1);
      riding=saved.riding===true&&!!player&&Math.hypot(player.x-tower.position.x,player.z-tower.position.z)<1.6;
      if(riding)carry(player);
    }
    sync();
  }
  sync();
  return {root,near,activate,carry,update,resolveWalls,restore,reset:()=>restore(null),
    isRiding:()=>riding,isMoving:()=>phase!=='idle',
    floorAt:(x,z)=>Math.abs(x)<1.7&&Math.abs(z)<1.48?ground+height:null,
    approach:level=>new THREE.Vector3(tower.position.x+2.7,ground+(level==='top'?deck:0.2)+1,tower.position.z),
    hint(player){if(phase!=='idle')return riding?'Aufzug fährt …':'Aufzug kommt …';const landing=player.y-1-ground>deck/2?deck:0.2;
      return Math.abs(height-landing)>0.01?'F · Space-Aufzug rufen':landing===deck?'F · Space-Aufzug nach unten':'F · Space-Aufzug nach oben';},
    snapshot:()=>({height,target,from,phase,elapsed,door,riding}),
  };
}
