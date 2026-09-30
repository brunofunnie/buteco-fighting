import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {FightGame} from '../game.js';
globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
const checks=[];const check=(name,pass)=>{checks.push({name,pass:!!pass});assert.ok(pass,name);};
for(const id of ['maya','joke-l','alex-sebas','mr-funnie','pedro-pi']){
 const g=new FightGame({getContext:()=>({})});g.start({mode:'versus',player:id,opponent:'bruno'});g.debugForce({phase:'fight'});
 const [a,t]=g.fighters;g.wins=[1,0];t.health=0;a.x=800;t.x=900;g.releasePower(a,t,true);g.powerEffects.push({kind:'explosion',x:900,y:400,color:a.color,life:.5,maxLife:.5,radius:50});
 const p=g.projectiles[0],oldX=p.x,oldAge=p.age||0;g.finishRound();g.update(.1);
 check(`${id} projectile moves and ages after KO`,p.x!==oldX&&p.age>oldAge);
 check(`${id} explosion continues fading`,g.powerEffects[0].life<.5);
 check(`${id} no damage to either fighter after KO`,a.health===100&&t.health===0);
 check(`${id} hit power state cleared`,g.fighters.every(f=>!f.powerState));
 while(g.running)g.update(.016);
 check(`${id} no frozen effects at final result`,g.projectiles.length===0&&g.powerEffects.length===0&&g.particles.length===0);
}
await writeFile('artifacts/ko-effects-v10.json',JSON.stringify({checks},null,2));console.log(`PASS ${checks.length} knockout effect checks`);
