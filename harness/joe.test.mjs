import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {FightGame} from '../src/game.js';
import {animationIndex} from '../src/collision.js';
const read=p=>JSON.parse(readFileSync(p));
const approved=read('harness/fixtures/animation-layout.json'),runtime=read('assets/manifest.json')['joe-munist'];
assert.equal(Object.keys(runtime).length,23);
for(const m of approved.movements)assert.deepEqual(runtime[m.name].frames.map(f=>f.sourceKey),m.frames.map(f=>f.key));
for(const [path,sha256]of Object.entries(read('harness/fixtures/asset-hashes.json')))if(path.includes('/joe-munist/'))assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),sha256);
globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
const game=new FightGame({getContext:()=>({})});game.start({player:'joe-munist',opponent:'maya',mode:'versus'});game.debugForce({phase:'fight',cpu:false});
for(const facing of [1,-1])for(const dir of [1,-1]){
 const f={id:'joe-munist',state:'jumpForward',action:null,jumpBackward:dir*facing<0,jumpElapsed:0};const order=[];
 for(let t=0;t<.84;t+=1/120){f.jumpElapsed=t;const i=animationIndex(f,6);if(order.at(-1)!==i)order.push(i);}
 assert.deepEqual(order,f.jumpBackward?[5,4,3,2,1,0]:[0,1,2,3,4,5]);
}
for(const state of ['airPunch','airKick','land','idle']) {
 const f={id:'joe-munist',state,stateTime:.1,action:null,vy:0,jumpElapsed:.5};
 assert.equal(animationIndex({...f,jumpBackward:true},3),animationIndex({...f,jumpBackward:false},3),'Reverse jump must not affect '+state);
}
for(const facing of [1,-1])for(const superMove of [false,true]){
 const [f,e]=game.fighters;Object.assign(f,{x:500,y:590,facing});game.projectiles=[];game.releasePower(f,e,superMove);
 assert.equal(game.projectiles.length,superMove?3:1);assert.ok(game.projectiles.every(p=>p.kind==='solidarity'),'Joe uses the original solidarity effect');assert.ok(game.projectiles.every(p=>p.vy===0&&p.vx===facing*780));
 assert.equal(game.projectiles.reduce((s,p)=>s+p.damage,0),superMove?39:18);
 if(superMove){const [a,b,c]=game.projectiles;assert.ok((a.x-b.x)*facing>0);assert.equal(b.x,c.x);assert.ok(b.y<a.y&&c.y>a.y);}
 for(const p of game.projectiles){p.x=e.x;p.y=e.y-160;}
 e.health=100;e.guard=false;game.updateProjectiles(0);const health=e.health;game.updateProjectiles(0);assert.equal(e.health,health);
}
for(const state of ['special','super']){
 const release=state==='super'?5:3,move={active:.3,duration:.9};
 assert.equal(animationIndex({id:'joe-munist',action:state,state,actionTime:.3},6,10,move),release);
 assert.ok(animationIndex({id:'joe-munist',action:state,state,actionTime:.299},6,10,move)<release);
}
console.log('PASS Joe: 23 states / 79 frames in approved pose order (dash removed), published PNG hashes, four jump orders, mirrored parallel powers, 18/39 damage budget, single-hit collision and release frames');
