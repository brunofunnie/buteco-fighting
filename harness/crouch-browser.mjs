import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const ids=Object.keys(JSON.parse(await readFile('assets/manifest.json','utf8')));
const dir='artifacts/crouch-low-block-fix';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://localhost:3187');await page.waitForFunction(()=>window.__ui?.assets&&!document.querySelector('#titleStart').disabled);
 await page.click('#titleStart');await page.click('[data-mode="versus"]');await page.click('#fighterNext');await page.click('[data-stage="0"]');await page.waitForFunction(()=>window.__fight?.fighters?.length===2);
 for(const id of ids){
  const result=await page.evaluate(async id=>{
   await Promise.all([__ui.loadFighter(id),__ui.loadFighter('joe-munist')]);__ui.start({player:id,opponent:'joe-munist',mode:'versus',stage:0});const g=__fight;g.debugForce({phase:'fight',cpu:false});g.freezeForInspection();const f=g.fighters[0];
   const manifest=await (await fetch('/assets/manifest.json')).json();const cases=[];
   for(const facing of [1,-1])for(const guard of [false,true]){
    g.keys.clear();g.pressed.clear();Object.assign(f,{state:'idle',stateTime:0,y:590,vy:0,vx:0,stun:0,knockdown:0,action:null,health:100,landTime:0,turnTime:0,facing,x:facing===1?600:1300});g.fighters[1].x=facing===1?1200:700;
    g.keys.add('KeyS');if(guard)g.keys.add('KeyL');g.update(1/120);g.draw();
    cases.push({facing,guard,state:f.state,paths:g.assets[id][f.state].map(s=>s.src),sourceKeys:manifest[id][f.state].frames.map(s=>s.sourceKey)});
   }
   const airKick=g.assets[id].airKick.map(sprite=>{const current=g.spritePlacement(g.assets[id],sprite,320),meta=sprite.spriteMeta;sprite.spriteMeta={...meta,scale:meta.scale/.9};const previous=g.spritePlacement(g.assets[id],sprite,320);sprite.spriteMeta=meta;return current.height/previous.height;});
   return {id,cases,airKick};
  },id);
  for(const c of result.cases){const expected=c.guard?'lowBlock':'crouch';assert.equal(c.state,expected);assert.ok(c.paths.every(p=>p.includes('/animations/'+(expected==='lowBlock'?'low-block':expected)+'/')));assert.ok(c.sourceKeys.every(k=>k.startsWith(c.guard?'agachar/':'defesa_agachado/')));}
  for(const ratio of result.airKick)assert.ok(Math.abs(ratio-.9)<1e-10);
  checks.push(result);
  if(id==='ana')for(const state of ['crouch','lowBlock']){await page.evaluate(state=>{const g=__fight;Object.assign(g.fighters[0],{state,stateTime:.15,facing:1,x:650});g.draw();},state);await page.screenshot({path:dir+'/ana-'+state+'.png'});}
 }
 assert.deepEqual(errors,[]);await writeFile(dir+'/report.json',JSON.stringify({status:'passed',checks,errors},null,2));console.log('PASS '+checks.length+' characters: crouch/lowBlock inputs, corrected sprite names, both facings and airKick reduced 10%');
}finally{await browser.close();}
