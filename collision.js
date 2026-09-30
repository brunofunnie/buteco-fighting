import {COLLISION_DATA} from './collision-data.js';
export const FRAME_ALIASES={block:'guard',hurt:'hit',ko:'knockout',special:'punch',super:'special',airPunch:'punch',airKick:'kick',crouchPunch:'crouch',crouchKick:'crouch',uppercut:'punch',sweep:'crouch',dash:'walk',backwalk:'walk',lowBlock:'crouch',turn:'idle',land:'crouch',jumpForward:'jump'};
export function animationIndex(f,count,fps=6,move) {
  if(count<=1)return 0;
  let index=Math.floor(f.stateTime*(fps||6))%count;
  if(f.action&&move){
    const t=f.actionTime;
    const progress=t<move.active?t/move.active*.5:t<move.end?.5+(t-move.active)/(move.end-move.active)*.25:.75+(t-move.end)/(move.duration-move.end)*.25;
    index=Math.floor(progress*count);
  }else if(['hurt','ko','block','lowBlock','crouch','celebrate','land','turn'].includes(f.state)){
    index=Math.floor(f.stateTime/({hurt:.28,ko:.65,block:.22,crouch:.3,celebrate:.8,land:.11,turn:.14}[f.state]||.28)*count);
  }else if(['jump','jumpForward'].includes(f.state))index=Math.floor(Math.max(0,Math.min(.999,(f.vy+850)/1700))*count);
  return Math.max(0,Math.min(count-1,index));
}
export function collisionFrame(f,move){
  const states=COLLISION_DATA[f.id],spec=states[f.state]||states[FRAME_ALIASES[f.state]]||states.idle;
  const index=animationIndex(f,spec.frames.length,spec.fps,move);
  return {...spec.frames[index],index};
}
export function worldBoxes(f,boxes){
  const facing=f.state==='turn'?(f.turnFrom||f.facing):f.facing;
  return boxes.map(([x,y,w,h])=>[f.x+(facing===-1?-x-w:x),f.y+y,w,h]);
}
export const overlap=(a,b)=>a[0]<b[0]+b[2]&&a[0]+a[2]>b[0]&&a[1]<b[1]+b[3]&&a[1]+a[3]>b[1];
export function projectileConnects(p,boxes,radius=p.radius||55){
  return boxes.some(([x,y,w,h])=>Math.hypot(p.x-Math.max(x,Math.min(p.x,x+w)),p.y-Math.max(y,Math.min(p.y,y+h)))<=radius);
}
