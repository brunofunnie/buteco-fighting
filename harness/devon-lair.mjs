import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.GAME_URL||'http://localhost:3197');await page.waitForFunction(()=>window.__ui?.assets&&!document.querySelector('#titleStart').disabled);
 for(const selector of ['#titleStart','[data-mode="arcade"]','#fighterNext'])await page.click(selector);
 await page.waitForFunction(()=>__ui.screen==='progress');
 assert.equal(await page.locator('#arcadeCount').count(),0);
 assert.equal(await page.locator('#arcadeScreen .screen-heading>span').count(),0);
 assert.equal(await page.locator('#navigationHint').isVisible(),false);
 assert.equal(await page.locator('.arcade-rival').count(),6);
 const stages=await page.evaluate(()=>__ui.campaign.stages);assert.equal(stages[5],4);assert.ok(stages.slice(0,5).every(stage=>stage<4));
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(300);
  assert.ok(await page.locator('#arcadeOpponents').evaluate(e=>e.getBoundingClientRect().right<=innerWidth));
  for(const selector of ['#backButton','#controlsButton','#arcadeContinue'])assert.ok(await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),selector);
  assert.ok(await page.locator('#arcadeContinue').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
  await page.screenshot({path:`artifacts/devon-path-${viewport.width}.png`});
 }
 await page.setViewportSize({width:1440,height:900});
 await page.click('#backButton');await page.waitForFunction(()=>__ui.screen==='fighter');
 for(const key of ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'])await page.keyboard.press(key);
 await page.click('[data-secret-action="devon"]');await page.waitForFunction(()=>__ui.screen==='versus');
 assert.match(await page.locator('#versusStageThumbnail').getAttribute('src'),/stages\/devon\.png/);
 await page.waitForFunction(()=>window.__fight?.running);assert.equal(await page.evaluate(()=>__fight.stage),4);
 const animation=await page.evaluate(async()=>{
  const {drawDevonLair,LAIR_MONITORS}=await import('./src/devon-lair.js');const g=__fight;g.inspectionPaused=true;g.phase='fight';g.elapsed=1;g.draw();
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=720;const c=canvas.getContext('2d');
  const art=g.options.stageArt[4];drawDevonLair(c,{worldWidth:1920,width:1920,time:0,art});
  const before=c.getImageData(0,0,1920,720).data.slice();drawDevonLair(c,{worldWidth:1920,width:1920,time:1,art});const after=c.getImageData(0,0,1920,720).data;
  return {monitors:LAIR_MONITORS.length,animated:before.some((v,i)=>v!==after[i]),loaded:art.complete&&art.naturalWidth>0};
 });
 assert.deepEqual(animation,{monitors:4,animated:true,loaded:true});
 await page.locator('#gameCanvas').screenshot({path:'artifacts/devon-lair-arena.png'});
 assert.deepEqual(errors,[]);await fs.access('assets/stages/devon-approach.png');
 console.log('PASS responsive Devon path, removed labels, exclusive boss stage, loaded warehouse art and animated monitors');
}finally{await browser.close();}
