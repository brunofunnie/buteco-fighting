import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {FightGame} from '../game.js';
globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
const g=new FightGame({getContext:()=>({})});g.start({mode:'versus'});
const checks=[];
function check(name,fn){try{fn();checks.push({name,pass:true})}catch(e){checks.push({name,pass:false,error:e.message})}}
check('round opens at world center',()=>{assert.equal((g.fighters[0].x+g.fighters[1].x)/2,960);assert.equal(g.cameraX,320)});
g.debugForce({phase:'fight'});const f=g.fighters[0];f.y=350;f.vy=-400;f.health=0;f.action='airKick';g.fighters[1].y=410;g.fighters[1].vy=200;g.finishRound();
for(let i=0;i<120;i++)g.update(1/120);
check('airborne KO lands during round end',()=>{assert.equal(f.y,590);assert.equal(f.vy,0);assert.equal(f.state,'ko')});
check('KO cancels the airborne attack',()=>assert.equal(f.action,null));
check('airborne winner also lands during results',()=>assert.equal(g.fighters[1].y,590));
g.resetRound();check('next round also starts centered',()=>{assert.equal(g.cameraX,320);assert.equal((g.fighters[0].x+g.fighters[1].x)/2,960)});
await writeFile('artifacts/round-v5.json',JSON.stringify({checks},null,2));
console.log(checks);if(checks.some(c=>!c.pass))process.exitCode=1;
