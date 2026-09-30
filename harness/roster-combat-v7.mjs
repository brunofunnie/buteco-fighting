import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {FightGame} from '../game.js';
import {FIGHTERS} from '../roster.js';
globalThis.window={addEventListener(){},removeEventListener(){}};
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
const ids=Object.keys(FIGHTERS);
const results=[];
function scene(id='maya',opponent='bruno'){const game=new FightGame({getContext:()=>({})});game.start({player:id,opponent,mode:'training'});game.debugForce({phase:'fight',cpu:false});const[a,b]=game.fighters;Object.assign(a,{x:600,energy:100});Object.assign(b,{x:970});return{game,a,b};}
function step(game,seconds){for(let t=0;t<seconds;t+=.016){game.update(.016);game.pressed.clear();}}
function cast(game,superMove=false){game.pressed.add(superMove?'KeyI':'KeyU');game.update(.016);game.pressed.clear();}
function check(name,fn){try{fn();results.push({name,passed:true})}catch(e){results.push({name,passed:false,error:e.message})}}
for(const id of ids){
check(`${id}: selected player and explicit opponent survive round reset`,()=>{const{game}=scene(id,id==='bruno'?'maya':'bruno');assert.equal(game.fighters[0].id,id);assert.equal(game.fighters[1].id,id==='bruno'?'maya':'bruno');game.resetRound();assert.equal(game.fighters[0].id,id)});
check(`${id}: catalog display name and color are used`,()=>{const{a}=scene(id);assert.equal(a.name,FIGHTERS[id].name.toUpperCase());assert.equal(a.color,FIGHTERS[id].color)});
check(`${id}: special costs 25 and damages opponent`,()=>{const{game,a,b}=scene(id);cast(game);assert.equal(a.energy,75);step(game,1.7);assert.ok(b.health<100,'special must connect');});
check(`${id}: super costs 100 and damages opponent`,()=>{const{game,a,b}=scene(id);cast(game,true);assert.equal(a.energy,0);step(game,1.8);assert.ok(b.health<100,'super must connect');});
check(`${id}: insufficient energy does not start special`,()=>{const{game,a}=scene(id);a.energy=24;cast(game);assert.equal(a.action,null);assert.equal(a.energy,24)});
}
for(const id of ['baiano-m','cowboy','henry-k','jamal','joe-munist','molly-jay']) {
 check(`${id}: physical height remains within adult roster proportions`,()=>assert.ok(FIGHTERS[id].visualHeight>=290&&FIGHTERS[id].visualHeight<=345));
 check(`${id}: unique power projectile profile and KO effects advance`,()=>{
  const {game,a,b}=scene(id);cast(game,true);step(game,.4);
  assert.ok(game.projectiles.length);const p=game.projectiles[0];assert.equal(p.kind,FIGHTERS[id].power.kind);
  const x=p.x,age=p.age;b.health=0;game.finishRound(a);game.update(.1);
  assert.ok(p.age>age);assert.notEqual(p.x,x);assert.equal(b.health,0);
 });
}
check('invalid player falls back to catalog fighter',()=>{const{game}=scene('unknown');assert.equal(game.fighters[0].id,'maya')});
check('explicit mirror opponent is accepted',()=>{const{game}=scene('viihuugo','viihuugo');assert.equal(game.fighters[1].id,'viihuugo')});
check('invalid opponent chooses valid different fighter',()=>{const{game}=scene('viihuugo','unknown');assert.ok(ids.includes(game.fighters[1].id));assert.notEqual(game.fighters[1].id,'viihuugo')});
check('prismatic angles produce multiple impact heights',()=>{const{game}=scene('viihuugo');cast(game);step(game,.35);assert.ok(game.projectiles.length>=3);assert.ok(new Set(game.projectiles.map(p=>p.vy)).size>=3)});
check('data cube survives its first impact without repeat damage',()=>{const{game,a,b}=scene('joke-l');cast(game);step(game,.35);const cube=game.projectiles[0];assert.ok(cube);b.x=cube.x+15;game.updateProjectiles(.016);const health=b.health;assert.ok(health<100);assert.ok(game.projectiles.includes(cube));game.updateProjectiles(.016);assert.equal(b.health,health)});
check('rune super emits a larger fan than special',()=>{const x=scene('king-luiz');cast(x.game);step(x.game,.4);const small=x.game.projectiles.length;const y=scene('king-luiz');cast(y.game,true);step(y.game,.4);assert.ok(y.game.projectiles.length>small)});
check('hologram attack blinks forward and hits repeatedly',()=>{const{game,a,b}=scene('maya-b');b.x=960;cast(game);step(game,1);assert.ok(a.x>650);assert.ok(a.combo>=2);assert.ok(b.health<100)});
check('hologram afterimages retain fighter identity and facing',()=>{const{game}=scene('maya-b');cast(game);step(game,.35);const e=game.powerEffects.find(e=>e.kind==='illusion');assert.equal(e?.fighterId,'maya-b');assert.equal(e?.facing,1)});
check('lunar smoke applies longer stun than ordinary projectile',()=>{const{game,b}=scene('pedro-pi');cast(game);step(game,.4);const p=game.projectiles[0];b.x=p.x+10;game.updateProjectiles(.016);assert.ok(b.stun>.5)});
check('tool boomerang reverses velocity and returns',()=>{const{game}=scene('alex-sebas');cast(game);step(game,.4);const p=game.projectiles[0];const direction=Math.sign(p.vx);step(game,.7);assert.equal(Math.sign(p.vx),-direction)});
check('kinetic armor reduces incoming unguarded damage',()=>{const{game,a,b}=scene('math-carpenter');cast(game);step(game,.3);assert.ok(a.armorTime>0);game.hitFighter(b,a,20);assert.ok(a.health>80);assert.ok(a.health<100)});
check('kinetic dash travels forward and makes contact',()=>{const{game,a,b}=scene('math-carpenter');const start=a.x;cast(game);step(game,.9);assert.ok(a.x-start>100);assert.ok(b.health<100)});
check('sonic wave causes greater knockback than ordinary projectile',()=>{const{game,b}=scene('dark-wong');cast(game);step(game,.4);const p=game.projectiles[0];b.x=p.x+10;const start=b.x;game.updateProjectiles(.016);assert.ok(b.x-start>=100)});
check('code fire explodes and creates an area impact effect',()=>{const{game,b}=scene('mr-funnie');cast(game);step(game,.4);const p=game.projectiles[0];b.x=p.x+10;game.updateProjectiles(.016);assert.ok(b.health<100);assert.ok(game.powerEffects.some(e=>e.kind==='explosion'))});
check('expired code fire hits nearby opponent with splash without direct contact',()=>{const{game,b}=scene('mr-funnie');cast(game);step(game,.4);const p=game.projectiles[0];p.life=.001;b.x=p.x+100;b.y=p.y+70;game.updateProjectiles(.016);assert.ok(b.health<100);assert.ok(game.powerEffects.some(e=>e.kind==='explosion'))});
check('stale projectiles cannot target a new round',()=>{const{game}=scene('maya');cast(game);step(game,.4);const p=game.projectiles[0];game.resetRound();game.projectiles.push(p);const health=game.fighters[1].health;game.updateProjectiles(.016);assert.equal(game.fighters[1].health,health);assert.equal(game.projectiles.length,0)});
check('new round discards old projectiles and power effects',()=>{const{game}=scene('mr-funnie');cast(game);step(game,.4);game.resetRound();assert.equal(game.projectiles.length,0);assert.equal(game.powerEffects.length,0)});
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/roster-combat-v7.json',JSON.stringify({results},null,2));for(const r of results)console.log(`${r.passed?'PASS':'FAIL'} ${r.name}${r.error?`: ${r.error}`:''}`);const failed=results.filter(r=>!r.passed);console.log(`${results.length-failed.length}/${results.length} passed`);if(failed.length)process.exitCode=1;
