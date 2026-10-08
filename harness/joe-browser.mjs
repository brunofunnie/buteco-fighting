import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const runtime=JSON.parse(await readFile('assets/manifest.json','utf8'))['joe-munist'];
const detailed=runtime.idle.frames[0].pixelArt===false,nativeCell=detailed?384:192;
const base=process.env.GAME_URL||'http://127.0.0.1:3187',dir='artifacts/joe';await mkdir(dir,{recursive:true});
const approved=JSON.parse(await readFile('harness/fixtures/animation-layout.json','utf8'));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir,size:{width:1440,height:1000}}});const page=await context.newPage(),errors=[],productionRequests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>productionRequests.push(r.url()));
 await page.goto(base);await page.waitForFunction(()=>window.__ui?.assets&&!document.querySelector('#titleStart').disabled);
 await page.click('#titleStart');await page.click('[data-mode="versus"]');await page.click('[data-player="joe-munist"]');await page.click('#fighterNext');await page.click('[data-stage="0"]');await page.waitForFunction(()=>window.__fight?.fighters[0].id==='joe-munist');
 await page.evaluate(()=>{__fight.debugForce({phase:'fight',cpu:false});__fight.freezeForInspection();});
 assert.ok(!productionRequests.some(p=>p.includes('/experiments/')));
 const runtimeRequests=[...productionRequests];
 const geometry=await page.evaluate(cell=>{const g=__fight,a=g.assets['joe-munist'];return Object.fromEntries(Object.entries(a).filter(([s])=>s!=='projectile').map(([s,frames])=>[s,{count:frames.length,loaded:frames.every(f=>f.complete&&f.naturalWidth===cell&&f.naturalHeight===cell),poses:frames.map(f=>{const p=g.spritePlacement(a,f,324),b=g.measureSprite(f);return {placement:p,bodyHeight:b.height*p.height/f.naturalHeight,footY:p.y+b.bottom*p.height/f.naturalHeight};})}]));},nativeCell);
 for(const m of approved.movements.filter(m=>m.name!=='dash')){assert.equal(geometry[m.name].count,m.frames.length);assert.ok(geometry[m.name].loaded);for(const [i,f]of m.frames.entries()){const p=geometry[m.name].poses[i],b=f.sourceBBox,scale=detailed&&m.name==='airKick'?.9:1;assert.ok(Math.abs(p.bodyHeight-(b[3]-b[1])*324/94*scale)<.05,`${m.name}/${i} body proportions`);assert.ok(Math.abs(p.footY+(184-b[3])*324/94*scale)<.05,`${m.name}/${i} floor offset`);}}
 for(const m of approved.movements.filter(m=>m.name!=='dash')){await page.evaluate(state=>{const g=__fight;Object.assign(g.fighters[0],{state,stateTime:.1,action:null,x:800,y:590,stun:0,facing:1});g.draw();},m.name);await page.screenshot({path:`${dir}/${m.name}.png`});}
 const result=await page.evaluate(async()=>{
  const {animationIndex}=await import('/src/collision.js');const g=__fight,traces=[];const step=()=>{g.update(1/120);g.pressed.clear();};
  function reset(facing=1){g.debugForce({phase:'fight',cpu:false});g.keys.clear();g.pressed.clear();g.projectiles=[];g.hitstop=0;Object.assign(g.fighters[0],{x:facing===1?600:1300,y:590,health:100,displayHealth:100,combo:0,comboTime:0,stun:0,action:null,state:'idle',stateTime:0,facing,turnTime:0,landTime:0,energy:100,vx:0,vy:0});Object.assign(g.fighters[1],{x:facing===1?1200:700,y:590,health:100,displayHealth:100,combo:0,comboTime:0,stun:0,action:null,guard:false,crouch:false,state:'idle',stateTime:0,vy:0,knockdown:0});}
  for(const facing of [1,-1])for(const dir of [1,-1]){reset(facing);const f=g.fighters[0];g.keys.add(dir===1?'KeyD':'KeyA');g.pressed.add('KeyW');step();const order=[];for(let i=0;i<115;i++){if(f.state==='jumpForward'){const index=animationIndex(f,6);if(order.at(-1)!==index)order.push(index);if(f.facing!==facing)throw Error('air facing');}step();}traces.push({facing,dir,order});}
  const attacks=[];for(const [codes,state]of [[['KeyJ'],'punch'],[['KeyK'],'kick'],[['KeyW','KeyJ'],'airPunch'],[['KeyW','KeyK'],'airKick'],[['KeyS','KeyJ'],'crouchPunch'],[['KeyS','KeyK'],'crouchKick'],[['KeyS','KeyU'],'uppercut'],[['KeyS','KeyI'],'sweep'],[['KeyU'],'special'],[['KeyI'],'super']]){reset();for(const c of codes){g.keys.add(c);g.pressed.add(c);}step();const f=g.fighters[0];if(f.action!==state)throw Error(state);g.keys.clear();const cost=f.energy;let launch;for(let i=0;i<150;i++){step();if(!launch&&g.projectiles.length)launch={frame:animationIndex(f,6,10,{active:(state==='super'?.3:.23)*1.02,duration:state==='super'?.89046:.61302}),count:g.projectiles.length,positions:g.projectiles.map(p=>({x:p.x,y:p.y,vx:p.vx,vy:p.vy}))};}attacks.push({state,cost,launch});}
  reset();g.keys.add('KeyL');step();const block=g.fighters[0].state;g.keys.add('KeyS');step();const lowBlock=g.fighters[0].state;
  reset();g.fighters[1].health=1;g.releasePower(g.fighters[0],g.fighters[1],false);const p=g.projectiles[0];p.x=g.fighters[1].x;p.y=430;g.updateProjectiles(0);for(let i=0;i<150;i++)step();const ko={health:g.fighters[1].health,state:g.fighters[1].state,winner:g.roundWinner,winnerState:g.fighters[0].state,phase:g.phase};
  reset();g.draw();return {traces,attacks,block,lowBlock,ko};
 });
 for(const t of result.traces)assert.deepEqual(t.order,t.dir*t.facing<0?[5,4,3,2,1,0]:[0,1,2,3,4,5]);assert.equal(result.block,'block');assert.equal(result.lowBlock,'lowBlock');
 for(const [state,count,frame,cost]of [['special',1,3,75],['super',3,5,0]]){const a=result.attacks.find(a=>a.state===state);assert.equal(a.cost,cost);assert.equal(a.launch.count,count);assert.equal(a.launch.frame,frame);}
 assert.equal(result.ko.health,0);assert.equal(result.ko.state,'ko');assert.equal(result.ko.winner,0);assert.equal(result.ko.winnerState,'celebrate');
 await page.screenshot({path:dir+'/real-match.png'});
 await page.evaluate(()=>{const g=__fight,f=g.fighters[0];f.action='super';f.actionTime=.306;f.state='super';g.projectiles=[];g.releasePower(f,g.fighters[1],true);g.draw();});await page.screenshot({path:dir+'/super-formation.png'});
 assert.deepEqual(errors,[]);await writeFile(dir+'/report.json',JSON.stringify({geometry,result,errors,productionRequests:runtimeRequests},null,2));const video=page.video();await context.close();await video.saveAs(dir+'/gameplay.webm');console.log('PASS Joe real match: all 23 states, 10 attacks, four six-frame jumps, guards, costs, synchronized powers, KO; captures and video saved');
}finally{await browser.close();}
