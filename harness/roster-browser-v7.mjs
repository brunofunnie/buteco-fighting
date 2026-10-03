import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {FIGHTERS,fighterIds} from '../src/roster.js';
const testedFighters=process.env.ROSTER_TEST_FIGHTERS?.split(',')||fighterIds;
if(testedFighters.some(id=>!FIGHTERS[id]))throw new Error('Unknown fighter in ROSTER_TEST_FIGHTERS');
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:1440,height:900}});
const report={checks:[],errors:[],screenshots:[]};
page.on('pageerror',e=>report.errors.push(e.message));
const check=(name,pass,details)=>report.checks.push({name,pass:Boolean(pass),details});
report.testedFighters=testedFighters;
const snap=()=>page.evaluate(()=>window.__fight.snapshot());
async function capture(name){const path=`artifacts/${name}.png`;await page.screenshot({path});report.screenshots.push(path);}
async function menu(){await page.locator('#pauseButton').click();await page.locator('#menuButton').click();}
async function select(player,opponent,mode='versus'){
 if(await page.locator('#titleStart').isVisible())await page.locator('#titleStart').click();
 await page.locator(`[data-mode="${mode}"]`).click();
 await page.locator('[data-slot="player"]').click();await page.locator(`[data-player="${player}"]`).click();
 await page.locator('[data-slot="opponent"]').click();await page.locator(`[data-player="${opponent}"]`).click();
 await page.locator('#fighterNext').click();await page.locator('#startButton').click();
 await page.waitForFunction(({player,opponent})=>window.__fight?.fighters?.[0]?.id===player&&window.__fight?.fighters?.[1]?.id===opponent,{player,opponent},{timeout:60000});
}
try {
 await page.goto(process.env.GAME_URL||'http://localhost:3187');await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);
 await page.locator('#titleStart').click();await page.locator('#modeScreen .mode-option.active').click();
 check('all roster choices',await page.locator('[data-player]').count()===fighterIds.length);
 check('both renamed fighters visible',(await page.locator('[data-player="maya"]').innerText()).toUpperCase().includes('RINA SABRE')&&(await page.locator('[data-player="bruno"]').innerText()).toUpperCase().includes('WAGGY'));
 check('startup only decodes original pair',await page.evaluate(()=>Object.entries(window.__ui.assets).filter(([,a])=>Object.keys(a).length>1).length===2));
 for(const [name,width,height] of [['desktop',1440,900],['landscape',844,390],['portrait',390,844]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(100);
  const clipped=await page.evaluate(()=>[...document.querySelectorAll('.roster-grid,#fighterNext')].filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+.1||r.top<0||r.bottom>innerHeight}).map(e=>e.id||e.className));
  check(`scrollable roster viewport and confirmation fit ${name}`,clipped.length===0,clipped);await capture(`roster-${name}-v7`);
 }
 await page.setViewportSize({width:1440,height:900});
 await page.locator('[data-slot="player"]').click();await page.locator('[data-player="maya"]').click();await page.keyboard.press('ArrowDown');
 check('arrow down advances one grid row',await page.evaluate(ids=>window.__ui.selection.player===ids[getComputedStyle(document.querySelector('.roster-grid')).gridTemplateColumns.split(' ').length],fighterIds));
 await page.keyboard.press('q');await page.keyboard.press('ArrowRight');check('Q lets keyboard choose rival',await page.evaluate(()=>window.__ui.selection.opponent==='viihuugo'));
 await page.locator('#backButton').click();
 const manifest=JSON.parse(await fs.readFile('assets/manifest.json','utf8'));
 const firstFrame='**/'+manifest.viihuugo.idle.frames[0].path;
 await page.route(firstFrame,route=>route.abort('failed'));
 await page.locator('[data-mode="versus"]').click();
 await page.locator('[data-slot="player"]').click();await page.locator('[data-player="viihuugo"]').click();
 await page.locator('[data-slot="opponent"]').click();await page.locator('[data-player="joke-l"]').click();
 await page.locator('#fighterNext').click();await page.locator('#startButton').click();
 await page.waitForFunction(()=>document.querySelector('#matchLoadStatus').textContent.length>0);
 check('failed animation stays in menu with retry',await page.evaluate(()=>window.__ui.screen==='stage'&&!window.__ui.game&&!document.querySelector('#startButton').disabled));
 await page.unroute(firstFrame);await page.locator('#startButton').click();
 await page.waitForFunction(()=>window.__fight?.fighters?.[0]?.id==='viihuugo');
 check('retry successfully starts selected pair',(await snap()).fighters[1].id==='joke-l');await menu();
 let releaseFrame,frameRequested;
 const blockedFrame=new Promise(resolve=>{releaseFrame=resolve});
 const requestedFrame=new Promise(resolve=>{frameRequested=resolve});
 const kingFrame='**/'+manifest['king-luiz'].idle.frames[0].path;
 await page.route(kingFrame,async route=>{frameRequested();await blockedFrame;await route.continue()});
 await page.locator('[data-mode="versus"]').click();
 await page.locator('[data-slot="player"]').click();await page.locator('[data-player="king-luiz"]').click();
 await page.locator('[data-slot="opponent"]').click();await page.locator('[data-player="maya-b"]').click();
 await page.locator('#fighterNext').click();await page.locator('#startButton').click();await requestedFrame;
 await page.locator('#backButton').click();releaseFrame();
 await page.waitForFunction(()=>!document.querySelector('#startButton').disabled);
 check('back cancels pending match without late auto-start',await page.evaluate(()=>window.__ui.screen==='fighter'&&!window.__ui.game));
 check('cancelled loading releases unselected animation cache',await page.evaluate(()=>Object.values(window.__ui.assets).filter(a=>Object.keys(a).length>1).length===2));
 await page.unroute(kingFrame);await page.locator('#backButton').click();
 for(const id of testedFighters){
  const opponent=fighterIds[(fighterIds.indexOf(id)+1)%fighterIds.length];await select(id,opponent);
  let s=await snap();check(`${id}: selected pair starts`,s.fighters[0].id===id&&s.fighters[1].id===opponent);
  check(`${id}: catalog names reach HUD`,await page.evaluate(names=>window.__fight.fighters.every((f,i)=>f.name===names[i].toUpperCase()),[FIGHTERS[id].name,FIGHTERS[opponent].name]));
  const animation=await page.evaluate(id=>Object.fromEntries(Object.entries(window.__ui.assets[id]).map(([state,frames])=>[state,{count:frames.length,ready:frames.every(f=>f.complete&&f.naturalWidth&&f.spriteMeta&&Number.isFinite(f.spriteMeta.scale))}])),id);
  const expected=id==='maya'||id==='bruno'?23:24;
  check(`${id}: complete actual animation set`,Object.keys(animation).length===expected&&Object.values(animation).every(a=>a.count>=4&&a.ready),animation);
  check(`${id}: cache stays within four animated fighters`,await page.evaluate(()=>Object.values(window.__ui.assets).filter(a=>Object.keys(a).length>1).length<=4));
  await page.evaluate(()=>window.__fight.debugForce({phase:'fight',energy:100,fighters:[{x:850,y:590,facing:1,health:100,action:null,stun:0},{x:1100,y:590,facing:-1,health:100,action:null,stun:0}]}));
  await page.keyboard.press('u');await page.waitForTimeout(110);
  check(`${id}: keyboard enters special animation`,(await snap()).fighters[0].state==='special');
  await page.waitForTimeout(210);
  await capture(`roster-${id}-special-v7`);await page.waitForTimeout(1500);
  check(`${id}: actual special hurts rival`,(await snap()).fighters[1].health<100);
  await page.evaluate(()=>window.__fight.debugForce({phase:'fight',energy:100,fighters:[{x:850,y:590,facing:1,health:100,action:null,stun:0},{x:1100,y:590,facing:-1,health:100,action:null,stun:0}]}));
  await page.keyboard.press('i');await page.waitForTimeout(160);check(`${id}: keyboard enters super animation`,(await snap()).fighters[0].state==='super');
  await page.waitForTimeout(175);
  await capture(`roster-${id}-super-v7`);await page.waitForTimeout(1500);check(`${id}: actual super hurts rival`,(await snap()).fighters[1].health<100);
  await page.evaluate(()=>{
    const g=window.__fight;g.projectiles=[];g.powerEffects=[];for(const f of g.fighters){f.powerState=null;f.armorTime=0;}
    g.debugForce({phase:'fight',energy:100,fighters:[{x:850,y:590,facing:1,health:100,action:null,stun:0},{x:1100,y:590,facing:-1,health:100,action:null,stun:0}]});
  });
  await page.keyboard.press('4');await page.waitForTimeout(110);check(`${opponent}: P2 enters its own special`,(await snap()).fighters[1].state==='special');await page.waitForTimeout(1600);
  check(`${opponent}: P2 special attacks left correctly`,(await snap()).fighters[0].health<100);
  await menu();
 }
 await select('maya-b','maya-b');check('versus allows mirrored fighters',(await snap()).fighters.every(f=>f.id==='maya-b'));await menu();
 await select('dark-wong','mr-funnie','arcade');
 const rivals=await page.evaluate(()=>window.__ui.campaign.opponents);check('arcade rotates three distinct eligible rivals',new Set(rivals).size===3&&!rivals.includes('dark-wong'),rivals);
 check('no runtime browser errors',report.errors.length===0,report.errors);
} catch(error){report.errors.push(error.stack);check('browser run completed',false,error.message);}
await fs.writeFile('artifacts/roster-browser-v7-report.json',JSON.stringify(report,null,2));await browser.close();
const failed=report.checks.filter(c=>!c.pass);console.log(JSON.stringify({passed:report.checks.length-failed.length,failed:failed.length,errors:report.errors,failures:failed},null,2));if(failed.length||report.errors.length)process.exitCode=1;
