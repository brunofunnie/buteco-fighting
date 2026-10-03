import test from 'node:test';
import assert from 'node:assert/strict';
import {startDevonSlide as start, tickDevonSlide as tick} from '../src/devon-slide.js';
const fighter = (x = 400) => ({id:'devon',x,y:590,health:100,energy:100,stun:0,knockdown:0,action:null,facing:1});
test('slide APIs exist', () => {assert.equal(typeof start,'function'); assert.equal(typeof tick,'function');});
test('both directions cross continuously and recover without damaging enemy', () => {
  for (const [source,target,dest] of [[400,600,710],[800,600,490]]) {
    const f=fighter(source), e=fighter(target), snapshot=structuredClone(e);
    assert.equal(start(f,e),true); assert.equal(f.energy,75); assert.equal(f.slideCooldown,3);
    tick(f,e,.18); assert.equal(f.x,source); assert.equal(f.slide.phase,'travel');
    tick(f,e,.15); assert.ok(Math.abs(f.x-(source+dest)/2)<1e-6);
    tick(f,e,.15); assert.equal(f.x,dest); assert.equal(f.slide.phase,'recovery');
    assert.equal(f.facing,Math.sign(target-dest));
    assert.equal(tick(f,e,.25).finished,true); assert.equal(f.slide,null);
    assert.equal(f.slideCooldown,3); assert.deepEqual(e,snapshot);
  }
});
test('large dt consumes all phases',()=>{const f=fighter(),e=fighter(600); start(f,e); assert.equal(tick(f,e,1).finished,true);assert.equal(f.x,710);});
test('edges fall back to the near side and impossible corners do not charge',()=>{
  for(const [source,target,dest] of [[1600,1820,1710],[300,100,210]]) {const f=fighter(source),e=fighter(target);assert.equal(start(f,e),true);tick(f,e,1);assert.equal(f.x,dest);}
  const f=fighter(70), e=fighter(180);assert.equal(start(f,e,{minX:70,maxX:180}),false);assert.equal(f.energy,100);
});
test('rejects unavailable actions without cost',()=>{
 for(const change of [{id:'other'},{health:0},{y:589},{stun:.1},{knockdown:.1},{action:{}},{energy:24},{slideCooldown:.1},{slide:{}}]) {const f=Object.assign(fighter(),change);const energy=f.energy;assert.equal(start(f,fighter(600)),false);assert.equal(f.energy,energy);}
 assert.equal(start(fighter(),fighter(900)),false);
 const f=fighter();start(f,fighter(600));assert.equal(start(f,fighter(600)),false);
});
test('moving enemy forces a safe bounded landing',()=>{
 const f=fighter(),e=fighter(600);start(f,e);tick(f,e,.3);e.x=710;tick(f,e,.18);assert.ok(Math.abs(f.x-e.x)>=88);assert.ok(f.x>=70&&f.x<=1850);assert.equal(e.x,710);
});
test('stun, death, knockdown, or a new action cancel on a safe side',()=>{
 for(const change of [{stun:.2},{health:0},{knockdown:.2},{action:{}}]) {const f=fighter(),e=fighter(600);start(f,e);tick(f,e,.36);Object.assign(f,change);const result=tick(f,e,.01);assert.equal(result.cancelled,true);assert.equal(f.slide,null);assert.ok(Math.abs(f.x-e.x)>=88);assert.equal(f.energy,75);assert.equal(e.x,600);}
});
test('cancellation during startup holds the original safe position',()=>{
 const f=fighter(),e=fighter(600);start(f,e);f.stun=.1;assert.equal(tick(f,e,.1).cancelled,true);assert.equal(f.x,400);
});
test('moving opponent at the arena edges leaves a bounded safe landing',()=>{
 for(const [source,target,moved] of [[1600,1820,1710],[300,100,210]]) {const f=fighter(source),e=fighter(target);start(f,e);e.x=moved;tick(f,e,1);assert.ok(Math.abs(f.x-e.x)>=88);assert.ok(f.x>=70&&f.x<=1850);assert.equal(e.x,moved);}
});
