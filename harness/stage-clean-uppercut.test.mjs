import assert from 'node:assert/strict';
import {FightGame} from '../src/game.js';
import {drawArena} from '../src/stages.js';
globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
for(let stage=0;stage<5;stage++){
 const art={complete:true,naturalWidth:2048},calls=[];
 const ctx={save(){},restore(){},translate(){},drawImage(image){calls.push(image);}};
 drawArena(ctx,{stage,art,crowdArt:{},time:5});assert.deepEqual(calls,[art],'Stage '+stage+' must draw only authored art when no crowd sprites are supplied');
}
for(const facing of [1,-1])for(const y of [590,400]){
 const g=new FightGame({getContext:()=>({})});g.start({mode:'training'});g.debugForce({phase:'fight',cpu:false});const [a,t]=g.fighters;
 Object.assign(a,{x:facing===1?600:1200,facing});Object.assign(t,{x:a.x+facing*180,y,vy:0,action:null});const x=t.x;
 g.hitFighter(a,t,18,150,220,{launch:true});assert.equal(t.vy,-430);assert.equal(t.airVX,facing*300);assert.ok(t.knockdown>0);
 let landed=false,layDown=false,recovered=false;
 for(let i=0;i<240;i++){g.update(1/120);if(t.y===590){landed=true;if(t.knockdown>0){layDown=true;assert.equal(t.state,'ko');}}if(landed&&t.knockdown===0&&['idle','turn','land'].includes(t.state))recovered=true;}
 assert.ok((t.x-x)*facing>30,'Opponent moves backward');assert.ok(landed&&layDown&&recovered,'Ground and airborne victims fall, lie down and recover');
}
for(const defense of ['block','armor']){
 const g=new FightGame({getContext:()=>({})});g.start();g.debugForce({phase:'fight',cpu:false});const [a,t]=g.fighters;
 Object.assign(t,{guard:defense==='block',armorTime:defense==='armor'?1:0,y:590,vy:0});g.hitFighter(a,t,18,150,220,{launch:true});assert.equal(t.vy,0);assert.equal(t.knockdown,0);
}
console.log('PASS five stages without procedural overlays; uppercut knockback, slight launch, grounded knockdown and recovery in both facings/from ground and air');
