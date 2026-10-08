import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {COLLISION_DATA,COLLISION_SOURCE_HASH} from '../src/collision-data.js';
import {collisionFrame,worldBoxes,overlap,projectileConnects} from '../src/collision.js';
import {FightGame} from '../src/game.js';
import {FIGHTERS} from '../src/roster.js';
const manifest=JSON.parse(readFileSync(new URL('../assets/manifest.json',import.meta.url)));
const hash=createHash('sha256');
for(const file of ['assets/manifest.json','src/roster.js','harness/build-collision.py'])hash.update(readFileSync(new URL('../'+file,import.meta.url)));
const overrides=new URL('../assets/collision-overrides.json',import.meta.url);
if(existsSync(overrides))hash.update(readFileSync(overrides));
for(const states of Object.values(manifest))for(const spec of Object.values(states))for(const entry of spec.frames)hash.update(readFileSync(new URL('../'+entry.path,import.meta.url)));
assert.equal(COLLISION_SOURCE_HASH,hash.digest('hex'),'Regenerate collision data after sprites, calibration, overrides or generator changes');
for(const [id,states] of Object.entries(manifest))for(const [state,spec] of Object.entries(states)){
  assert.equal(COLLISION_DATA[id][state].frames.length,spec.frames.length,`${id}/${state} coverage`);
  for(const frame of COLLISION_DATA[id][state].frames){assert.ok(frame.hurt.length);for(const box of [...frame.hurt,...frame.hit])assert.ok(box.every(Number.isFinite)&&box[2]>0&&box[3]>0);}
}
const f={id:'miranda',state:'punch',stateTime:0,action:'punch',actionTime:.16,x:500,y:590,facing:1,vy:0};
const move={active:.11,end:.2,duration:.34};
const frame=collisionFrame(f,move);
const punchPose=manifest.miranda.punch.frames.findIndex(frame=>frame.sourceKey==='soco_reto/1');
assert.equal(frame.index,punchPose>=0?punchPose:2);assert.ok(frame.hit.length);
const right=worldBoxes(f,frame.hit);const left=worldBoxes({...f,facing:-1},frame.hit);
for(let i=0;i<right.length;i++)assert.ok(Math.abs(right[i][0]+right[i][2]+left[i][0]-1000)<.001,'mirroring around fighter anchor');
assert.equal(overlap([0,0,10,10],[10,0,10,10]),false);
assert.equal(overlap([0,0,10,10],[9,9,10,10]),true);
assert.equal(projectileConnects({x:0,y:0,radius:5},[[4,4,10,10]]),false,'circle corner must miss');
assert.equal(projectileConnects({x:0,y:0,radius:6},[[4,4,10,10]]),true);
for(const id of Object.keys(FIGHTERS)){
 const idle=collisionFrame({...f,id,state:'idle',action:null,stateTime:0});
 const crouch=collisionFrame({...f,id,state:'crouch',action:null,stateTime:.3});
 const top=boxes=>Math.min(...boxes.map(b=>b[1]));
 assert.ok(top(crouch.hurt)>top(idle.hurt),id+' crouch follows visible pose');
}
console.log('PASS all sprite frames covered, active pose, facing symmetry, overlap, projectile corners and crouch geometry');

const game=new FightGame({getContext:()=>({})},{},{headless:true,interactive:false});
game.start({mode:'versus'});game.debugForce({phase:'fight',cpu:false});
let connections=0;
for(const id of Object.keys(FIGHTERS))for(const action of ['punch','kick','airPunch','airKick','crouchPunch','crouchKick','uppercut','sweep']){
  const [a,b]=game.fighters;
  Object.assign(a,{id,state:action,action,actionTime:action==='uppercut'?.2:action==='punch'||action==='airPunch'||action==='crouchPunch'?.15:.23,stateTime:0,hit:false,x:600,y:action.startsWith('air')?550:590,facing:1});
  Object.assign(b,{id:'bruno',state:'idle',action:null,stateTime:0,x:700,y:action==='uppercut'?470:590,facing:-1});
  assert.ok(game.combatBoxes(a).hit.length,id+'/'+action+' active');
  const distances=[];
  for(let d=88;d<=280;d+=2){b.x=600+d;if(game.attackConnects(a,b))distances.push(d);}
  assert.ok(distances.length,id+'/'+action+' must touch an opponent at some visible distance');
  b.x=600+distances[0];assert.equal(game.attackConnects(a,b),true);
  const distance=distances[0];a.facing=-1;b.facing=1;b.x=600-distance;
  assert.equal(game.attackConnects(a,b),true,id+'/'+action+' mirrored contact');
  a.actionTime=0;assert.equal(game.attackConnects(a,b),false,id+'/'+action+' startup');
  a.actionTime=1;assert.equal(game.attackConnects(a,b),false,id+'/'+action+' recovery');
  connections++;
}
console.log('PASS '+connections+' fighter/move contacts in both directions, startup and recovery');
