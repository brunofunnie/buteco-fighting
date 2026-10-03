import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.setDefaultTimeout(30000);
page.on('pageerror',e=>errors.push(e.message));
const screen=async name=>{await page.waitForFunction(name=>window.__ui?.screen===name,name);console.log('screen:',name);};
async function fight(){await screen('fight');await page.waitForFunction(()=>window.__fight?.running);}
async function decide(winner){
 await page.evaluate(winner=>{const g=window.__fight;g.inspectionPaused=false;g.paused=false;g.phase='fight';g.hitstop=0;g.wins=winner===0?[1,0]:[0,1];g.cpuEnabled=false;g.fighters.forEach((f,i)=>{f.health=i===winner?100:0;f.action=null;f.slide=null;f.stun=0;});},winner);
 await page.waitForFunction(()=>!document.querySelector('#matchOverlay').hidden);
}
try{
 await fs.mkdir('artifacts',{recursive:true});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:3197');
 await page.waitForFunction(()=>window.__ui?.assets&&!document.querySelector('#titleStart').disabled);
 await page.click('#titleStart');await page.click('[data-mode="arcade"]');await page.click('[data-slot=opponent]');await page.click('[data-player=king-luiz]');const selectedRival=await page.evaluate(()=>__ui.selection.opponent);assert.equal(await page.locator('.fighter-preview > small:visible').count(),0);await page.click('#fighterNext');await screen('progress');
 const route=await page.evaluate(()=>structuredClone(__ui.campaign));
 assert.equal(route.opponents[0],selectedRival);assert.equal(route.opponents.length,6);assert.equal(new Set(route.opponents).size,6);assert.equal(route.opponents[5],'devon');assert.equal(route.opponents.includes(await page.evaluate(()=>__ui.selection.player)),false);
 assert.equal(await page.locator('.arcade-rival').count(),6);assert.equal(await page.locator('.arcade-rival[data-status="current"]').count(),1);
 await page.screenshot({path:'artifacts/arcade-progress.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/arcade-progress-mobile.png'});
 assert.ok(await page.locator('#arcadeOpponents').evaluate(e=>e.getBoundingClientRect().right<=innerWidth));
 await page.setViewportSize({width:1440,height:900});await page.keyboard.press('Enter');await fight();
 await decide(1);assert.equal(await page.evaluate(()=>__ui.campaign.index),0);assert.equal(await page.locator('#nextStageButton').isVisible(),false);
 await page.click('#rematchButton');await fight();assert.equal(await page.evaluate(()=>__ui.selection.opponent),route.opponents[0]);
 for(let i=0;i<5;i++){
  assert.equal(await page.evaluate(()=>__ui.selection.stage),route.stages[i]);await decide(0);
  assert.equal(await page.locator('#rematchButton').textContent(),'VOLTAR À SELEÇÃO DE PERSONAGENS');assert.equal(await page.locator('#overlayTitle').isVisible(),false);
  assert.equal(await page.evaluate(()=>__ui.campaign.defeated.length),i+1);
  await page.click('#nextStageButton');await screen('progress');
  assert.equal(await page.locator('.arcade-rival[data-status="defeated"]').count(),i+1);
  assert.match(await page.locator('.arcade-rival[data-status="defeated"] img').first().evaluate(e=>getComputedStyle(e).filter),/grayscale\(1\)/);
  await page.keyboard.press('Enter');await fight();
 }
 assert.equal(await page.evaluate(()=>__fight.opponent),'devon');assert.equal(await page.evaluate(()=>__fight.stage),4);assert.equal(await page.evaluate(()=>__ui.campaign.index),5);
 await page.evaluate(()=>{const g=__fight;g.inspectionPaused=true;g.phase='fight';g.fighters[1].energy=50;});
 await page.screenshot({path:'artifacts/devon-boss.png'});
 await decide(1);await page.click('#rematchButton');await fight();assert.equal(await page.evaluate(()=>__ui.campaign.index),5);
 await decide(0);assert.equal(await page.evaluate(()=>__ui.campaign.complete),true);assert.equal(await page.locator('#overlayTitle').isVisible(),false);
 await page.click('#nextStageButton');await screen('progress');assert.equal(await page.locator('.arcade-rival[data-status="defeated"]').count(),6);
 await page.screenshot({path:'artifacts/arcade-complete.png'});await page.click('#arcadeContinue');await screen('mode');assert.equal(await page.evaluate(()=>__ui.campaign),null);
 await page.click('[data-mode=arcade]');
 for(const key of ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'])await page.keyboard.press(key);
 assert.equal(await page.locator('[data-secret-action="devon"]').isDisabled(),false);
 await page.click('[data-secret-action="devon"]');await fight();assert.equal(await page.evaluate(()=>__fight.opponent),'devon');assert.equal(await page.evaluate(()=>__fight.stage),4);assert.equal(await page.evaluate(()=>__ui.campaign),null);
 assert.equal(await page.locator('[data-player="devon"]').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS six-match Arcade, unique rivals, responsive progression, grayscale victories, loss/retry, Devon finale and real Konami shortcut');
}finally{await fs.writeFile('artifacts/campaign-errors.json',JSON.stringify(errors));await browser.close();}
