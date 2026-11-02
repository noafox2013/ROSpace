import * as THREE from 'three';

const viewPosition=new THREE.Vector3();
const projectedPosition=new THREE.Vector3();

// Keep discovered destinations visible, including beside or behind the camera.
export function positionWaypoint(target,camera,width,height) {
  camera.updateMatrixWorld(true);
  viewPosition.copy(target).applyMatrix4(camera.matrixWorldInverse);
  projectedPosition.copy(target).project(camera);
  const side=Math.min(96,width*0.25);
  const top=Math.min(205,height*0.3),bottom=height-Math.min(110,height*0.2);
  const centerX=width/2,centerY=height/2;
  const x=(projectedPosition.x+1)*width/2,y=(1-projectedPosition.y)*height/2;
  const inFront=viewPosition.z < -camera.near;
  if(inFront&&x>=side&&x<=width-side&&y>=top&&y<=bottom) {
    return {x,y,offscreen:false,angle:0};
  }
  let dx=viewPosition.x*camera.projectionMatrix.elements[0];
  let dy=-viewPosition.y*camera.projectionMatrix.elements[5];
  if(Math.abs(dx)+Math.abs(dy)<0.0001) {dx=0;dy=1;}
  const horizontal=dx===0?Infinity:(width/2-side)/Math.abs(dx);
  const vertical=dy===0?Infinity:(dy>0?bottom-centerY:centerY-top)/Math.abs(dy);
  const scale=Math.min(horizontal,vertical);
  return {x:centerX+dx*scale,y:centerY+dy*scale,offscreen:true,angle:Math.atan2(dy,dx)*180/Math.PI};
}
