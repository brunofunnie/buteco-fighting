import assert from 'node:assert/strict';
import {FIGHTERS, fighterIds} from '../src/roster.js';
import {audioDirector} from '../src/audio.js';
import {FightGame} from '../src/game.js';
const module = await import('../src/power-preview.js').catch(()=>null);
assert.ok(module?.PowerPreview, 'PowerPreview module must provide the fighting demonstration');
const {PowerPreview}=module;
const listenerCalls=[];
const liveFight={live:true};
globalThis.window={__fight:liveFight,addEventListener(...args){listenerCalls.push(args)},removeEventListener(...args){listenerCalls.push(args)}};
globalThis.requestAnimationFrame=()=>{throw new Error('Preview must not schedule its own animation')};
globalThis.cancelAnimationFrame=()=>{};
const canvas=()=>({dataset:{},getContext:()=>({})});
const step=(preview,seconds)=>{for(let remaining=seconds;remaining>1e-8;){const dt=Math.min(remaining,1/120);preview.tick(dt);remaining-=dt;}};
let audioCalls=0;audioDirector.combat=()=>{audioCalls++;throw new Error('Silent preview invoked audio')};audioDirector.unlock=()=>{audioCalls++;throw new Error('Silent preview unlocked audio')};
for(const id of Object.keys(FIGHTERS)){
 for(const facing of [1,-1]){
  const moves=[];const view=canvas();const preview=new PowerPreview(view,{}, {player:id,opponent:id==='bruno'?'maya':'bruno',facing,onMove:move=>moves.push(move)});
  assert.equal(preview.game.fighters[1].id,'dummy','Every power demonstration targets the non-playable dummy');
  assert.ok(!fighterIds.includes('dummy'),'Dummy must not appear in the playable roster');
  assert.equal(preview.move,'special');assert.equal(preview.game.fighters[0].action,null);
  step(preview,.4);assert.equal(preview.game.fighters[1].health,100);
  step(preview,2.8);assert.ok(preview.game.fighters[1].health<100,`${id} special facing ${facing} must actually damage target`);
  step(preview,.6);assert.equal(preview.move,'super');assert.equal(preview.game.fighters[1].health,100);assert.equal(preview.game.fighters[0].energy,100);
  step(preview,3.2);assert.ok(preview.game.fighters[1].health<100,`${id} super facing ${facing} must actually damage target`);
  step(preview,.6);assert.equal(preview.move,'special');assert.equal(preview.game.fighters[1].health,100);
  assert.deepEqual(moves.map(m=>m.move),['special','super','special']);assert.equal(moves[0].label,FIGHTERS[id].power.label);assert.equal(moves[1].key,'I');
  assert.equal(view.dataset.demoFighter,id);assert.equal(view.dataset.demoMove,'special');assert.equal(view.dataset.demoReady,'true');
  const elapsed=preview.game.elapsed;preview.destroy();preview.tick(1);assert.equal(preview.game.elapsed,elapsed);
 }
}
assert.equal(listenerCalls.length,0,'Previews must neither register nor remove game keyboard listeners');assert.equal(window.__fight,liveFight);assert.equal(audioCalls,0);
const playable = new FightGame(canvas(),{}, {interactive:false,headless:true});
playable.start({player:'dummy',opponent:'dummy'});
assert.notEqual(playable.player,'dummy','Dummy cannot be selected as a player');
assert.notEqual(playable.opponent,'dummy','Dummy cannot be selected as a playable opponent');
playable.destroy();
console.log(`PASS ${Object.keys(FIGHTERS).length} fighters, both directions, dummy targets, special/super impacts, resets, lifecycle and silence`);
