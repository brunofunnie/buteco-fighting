import assert from 'node:assert/strict';
import {FightGame} from '../src/game.js';
import {FIGHTERS,NON_PLAYABLE_FIGHTERS} from '../src/roster.js';
import {startDevonSlide} from '../src/devon-slide.js';
globalThis.window={addEventListener(){},removeEventListener(){}};
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
assert.ok(NON_PLAYABLE_FIGHTERS.devon,'Devon is registered as a boss');
assert.equal(FIGHTERS.devon,undefined,'boss is excluded from normal roster');
const g=new FightGame({getContext:()=>({})});g.start({mode:'arcade',opponent:'devon'});g.sound=()=>{};g.burst=()=>{};g.phase='fight';g.cpuEnabled=false;
const [p,b]=g.fighters;p.x=950;b.x=700;b.energy=50;
assert.equal(startDevonSlide(b,p),true);
for(let t=0;t<.8;t+=1/120){g.updateFighter(b,p,1,1/120);g.resolveBodies();}
assert.ok(b.x>p.x,'engine allows crossing');assert.equal(p.x,950,'slide never pushes the target');assert.equal(b.slide,null);assert.equal(b.energy,25);assert.equal(b.facing,-1);
b.x=700;b.energy=50;b.slideCooldown=0;startDevonSlide(b,p);
g.updateFighter(b,p,1,.3);b.stun=.2;g.updateFighter(b,p,1,1/120);
assert.equal(b.slide,null,'damage cancels movement');assert.ok(Math.abs(b.x-p.x)>=88);assert.equal(b.state,'hurt');
b.health=100;b.guard=false;b.armorTime=0;g.hitFighter(p,b,16,0);
assert.equal(b.health,92,'boss takes 50% damage, equivalent to 200 health');
p.health=100;p.guard=false;p.armorTime=0;g.hitFighter(b,p,16,0);
assert.equal(p.health,84,'normal fighter damage stays unchanged');
b.stun=0;b.action=null;b.knockdown=0;b.x=700;p.x=950;b.energy=50;b.slideCooldown=0;
assert.equal(startDevonSlide(b,p),true);
for(let t=0;t<.4;t+=1/120)g.updateFighter(b,p,1,1/120);
assert.ok(b.slideTrail.length>=3,'travel emits several spaced afterimages');
for(let i=1;i<b.slideTrail.length;i++)assert.ok(Math.abs(b.slideTrail[i].x-b.slideTrail[i-1].x)>=85,'copies are at least 85 world pixels apart');
assert.ok(b.slideTrail.some(copy=>copy.x<b.x),'copies retain previous positions');
for(let t=0;t<.6;t+=1/120)g.updateFighter(b,p,1,1/120);
assert.equal(b.slideTrail.length,0,'afterimages expire after travel');
g.cpuEnabled=true;
const originalRandom=Math.random;
try{
 for(const roll of [0,.5,.99]){
  Math.random=()=>roll;
  for(const distance of [100,250,600]){
   for(const energy of [0,50]){
    b.x=700;p.x=700+distance;b.energy=energy;b.aiWait=0;b.slideCooldown=0;
    const input=g.getInput(b,p,1,1/60);
    assert.ok(!input.jump,'Devon AI never jumps');
    if(distance===250 && energy===50)assert.equal(input.slide,true,'boss prioritizes available slide');
   }
  }
 }
}finally{Math.random=originalRandom;}
g.destroy();console.log('PASS Devon profile, crossing, recovery and hit interruption in combat engine');
