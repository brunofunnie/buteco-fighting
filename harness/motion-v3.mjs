import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {FightGame} from '../src/game.js';
globalThis.window={addEventListener(){},removeEventListener(){}};
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
const checks=[];
function run(name,fn){try{fn();checks.push({name,pass:true});console.log('PASS',name)}catch(e){checks.push({name,pass:false,error:e.message});console.log('FAIL',name,e.message)}}
function scenario(){const g=new FightGame({getContext:()=>({})});g.start({mode:'versus'});g.debugForce({phase:'fight',cpu:false});g.sound=()=>{};g.fighters[0].x=600;g.fighters[1].x=760;return g}
function tick(g,n=1){for(let i=0;i<n;i++){g.update(1/120);g.pressed.clear()}}
run('released directional jump retains horizontal momentum',()=>{const g=scenario();g.keys.add('KeyD');g.keys.add('KeyW');g.pressed.add('KeyW');tick(g);g.keys.clear();const x=g.fighters[0].x;tick(g,20);assert(g.fighters[0].x>x+35)});
run('jump crosses rival and keeps original orientation airborne',()=>{const g=scenario();g.keys.add('KeyD');g.keys.add('KeyW');g.pressed.add('KeyW');tick(g);g.keys.clear();tick(g,65);const f=g.fighters[0];assert(f.x>g.fighters[1].x);assert(f.y<590);assert.equal(f.facing,1)});
run('landing plays dedicated pose before returning guard',()=>{const g=scenario();g.keys.add('KeyW');g.pressed.add('KeyW');tick(g);g.keys.clear();let landed=false;for(let i=0;i<150;i++){tick(g);if(g.fighters[0].state==='land'){landed=true;break}}assert(landed)});
run('side swap plays turn then faces rival from opposite side',()=>{const g=scenario();g.fighters[0].x=820;tick(g);assert.equal(g.fighters[0].state,'turn');tick(g,35);assert.equal(g.fighters[0].facing,-1);assert.equal(g.fighters[0].state,'idle')});
run('attack entered shortly before recovery ends is buffered',()=>{const g=scenario();g.keys.add('KeyJ');g.pressed.add('KeyJ');tick(g);g.keys.clear();const f=g.fighters[0];f.actionTime=.28;g.keys.add('KeyK');g.pressed.add('KeyK');tick(g);g.keys.clear();tick(g,20);assert.equal(f.action,'kick')});
run('old buffered input expires instead of triggering much later',()=>{const g=scenario();g.keys.add('KeyK');g.pressed.add('KeyK');tick(g);g.keys.clear();g.pressed.add('KeyJ');tick(g);tick(g,90);assert.equal(g.fighters[0].action,null)});
run('attack pressed during hitstop is kept for the next actionable tick',()=>{const g=scenario();g.hitstop=.065;g.keys.add('KeyJ');g.pressed.add('KeyJ');tick(g);g.keys.clear();tick(g,10);assert.equal(g.fighters[0].action,'punch')});
run('landing strike can cancel pivot delay and attack toward rival',()=>{const g=scenario();const f=g.fighters[0];f.x=820;f.landTime=.11;f.state='land';g.keys.add('KeyJ');g.pressed.add('KeyJ');tick(g);assert.equal(f.action,'punch');assert.equal(f.facing,-1)});
run('camera pans in both directions with both fighters',()=>{const g=scenario();g.fighters[0].x=1420;g.fighters[1].x=1690;tick(g,90);const right=g.cameraX;g.fighters[0].x=300;g.fighters[1].x=580;tick(g,90);assert(right>500);assert(g.cameraX<60)});
await writeFile('artifacts/motion-v3.json',JSON.stringify({checks},null,2));
if(checks.some(c=>!c.pass))process.exitCode=1;
