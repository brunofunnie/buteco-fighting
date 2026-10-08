import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {animationIndex} from '../src/collision.js';
const source=JSON.parse(await readFile('harness/fixtures/animation-layout.json','utf8')).movements;
const roster=Object.keys(JSON.parse(await readFile('assets/manifest.json','utf8'))).map(id=>({id})).filter(f=>!process.argv[2]||process.argv.slice(2).includes(f.id));
const manifest=JSON.parse(await readFile('assets/manifest.json','utf8'));
for(const states of Object.values(manifest))assert.ok(!states.dash);
for(const {id}of roster){
assert.equal(animationIndex({id,state:'jumpForward',jumpElapsed:.56,jumpBackward:false,vy:-850},6),4,'Headless forward jump uses production animation metadata');
assert.equal(animationIndex({id,state:'jumpForward',jumpElapsed:.56,jumpBackward:true,vy:-850},6),1,'Headless backward jump preserves reversed order');
assert.ok(Object.keys(manifest[id]).length>=23);assert.equal(source.reduce((n,m)=>n+manifest[id][m.name].frames.length,0),79);for(const m of source)for(const f of manifest[id][m.name].frames){assert.ok(f.scale>0);assert.equal(f.pixelArt,false);assert.ok(!f.path.includes('experiments'));}
for(const m of source)assert.deepEqual(manifest[id][m.name].frames.map(f=>f.sourceKey),m.frames.map(f=>f.key));}
const dir='artifacts/roster-animations';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir,size:{width:1440,height:1000}}});const page=await context.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:3187');await page.waitForFunction(()=>window.__ui?.assets&&!document.querySelector('#titleStart').disabled);await page.click('#titleStart');await page.click('[data-mode="versus"]');await page.click('#fighterNext');await page.click('[data-stage="0"]');await page.waitForFunction(()=>window.__fight?.fighters?.length===2);
 for(const fighter of roster){
  const result=await page.evaluate(async ({id,motions})=>{
   await Promise.all([__ui.loadFighter(id),__ui.loadFighter('joe-munist')]);__ui.start({player:id,opponent:'joe-munist',mode:'versus',stage:0});const g=__fight;g.debugForce({phase:'fight',cpu:false});g.freezeForInspection();const f=g.fighters[0],enemy=g.fighters[1],assets=g.assets[id];
   const {animationIndex}=await import('/src/collision.js');
   const rendered=[];for(const m of motions){const frames=assets[m.name];if(frames.length!==m.frames.length||!frames.every(s=>s.complete&&s.naturalWidth===384&&s.naturalHeight===384))throw Error(m.name+' frame assets');
    for(let i=0;i<frames.length;i++){const duration={hurt:.28,ko:.65,block:.22,lowBlock:.28,crouch:.3,celebrate:.8,land:.11,turn:.14}[m.name];Object.assign(f,{state:m.name,stateTime:duration?(i+.5)/frames.length*duration:(i+.5)/frames.animation.fps,jumpElapsed:(i+.5)/frames.length*.84,jumpBackward:false,action:null,health:100,stun:0,y:590});if(animationIndex(f,frames.length,frames.animation.fps)!==i)throw Error('frame playback '+m.name+'/'+i);g.draw();rendered.push(m.name+'/'+i);}
   }
   function reset(facing=1){g.debugForce({phase:'fight',cpu:false});g.keys.clear();g.pressed.clear();g.projectiles=[];g.hitstop=0;Object.assign(f,{x:facing===1?600:1300,y:590,vy:0,vx:0,stun:0,health:100,guard:false,crouch:false,action:null,state:'idle',stateTime:0,facing,turnTime:0,landTime:0,energy:100});Object.assign(enemy,{x:facing===1?1200:700,y:590,health:100,stun:0,knockdown:0,vy:0,guard:false,crouch:false,state:'idle',stateTime:0,action:null});}
   const step=()=>{g.update(1/120);g.pressed.clear();};const jumps=[];
   for(const facing of [1,-1])for(const direction of [1,-1]){reset(facing);g.keys.add(direction===1?'KeyD':'KeyA');g.pressed.add('KeyW');step();const order=[];for(let i=0;i<115;i++){if(f.state==='jumpForward'){const frame=animationIndex(f,6);if(order.at(-1)!==frame)order.push(frame);if(f.facing!==facing)throw Error('jump facing');}step();}jumps.push({facing,direction,order});}
   const attacks=[];for(const [codes,state]of [[['KeyJ'],'punch'],[['KeyK'],'kick'],[['KeyW','KeyJ'],'airPunch'],[['KeyW','KeyK'],'airKick'],[['KeyS','KeyJ'],'crouchPunch'],[['KeyS','KeyK'],'crouchKick'],[['KeyS','KeyU'],'uppercut'],[['KeyS','KeyI'],'sweep'],[['KeyU'],'special'],[['KeyI'],'super']]){reset();for(const key of codes){g.keys.add(key);g.pressed.add(key);}step();if(f.state!==state)throw Error('attack '+state);g.keys.clear();for(let i=0;i<150;i++)step();attacks.push(state);}
   for(const facing of [1,-1]){reset(facing);const key=facing===1?'KeyD':'KeyA';g.keys.add(key);g.pressed.add(key);step();g.keys.clear();for(let i=0;i<10;i++)step();g.keys.add(key);g.pressed.add(key);step();if(['dash'].includes(f.state)||f.dashTime)throw Error('dash persists');}
   reset();f.guard=true;g.hitFighter(enemy,f,10,0,180);const chip=100-f.health;reset();g.hitFighter(enemy,f,10,0,180);const damage=100-f.health;reset();enemy.health=0;g.finishRound();const victory=f.state,ko=enemy.state;reset();g.draw();
   return {id,pixelMotion:f.pixelMotion,frames:rendered.length,jumps,attacks,chip,damage,victory,ko};
  },{id:fighter.id,motions:source});
  assert.equal(result.frames,79);assert.equal(result.pixelMotion,true);for(const t of result.jumps)assert.deepEqual(t.order,t.direction*t.facing<0?[5,4,3,2,1,0]:[0,1,2,3,4,5]);assert.ok(result.chip<result.damage);assert.equal(result.victory,'celebrate');assert.equal(result.ko,'ko');checks.push(result);
  await page.screenshot({path:`${dir}/${fighter.id}-idle.png`});await page.evaluate(()=>{const g=__fight,f=g.fighters[0];Object.assign(f,{state:'jumpForward',jumpElapsed:.42,jumpBackward:false,y:480,vy:0});g.draw();});await page.screenshot({path:`${dir}/${fighter.id}-somersault.png`});
 }
 assert.deepEqual(errors,[]);await writeFile(dir+'/report.json',JSON.stringify({status:'passed',checks,errors},null,2));const video=page.video();await context.close();await video.saveAs(dir+'/complete-roster.webm');console.log('PASS '+checks.length+' real fighters: 23 states/79 native detailed frames each, all ten attacks, four complete jump orders, no dash, defense/damage/KO/victory');
}finally{await browser.close();}
