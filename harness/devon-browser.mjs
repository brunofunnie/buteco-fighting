import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:3197');await page.waitForFunction(()=>window.__ui?.assets);
 await page.click('#titleStart');await page.click('[data-mode=arcade]');
 for(const key of ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'])await page.keyboard.press(key);
 await page.click('[data-secret-action="devon"]');await page.waitForFunction(()=>window.__fight?.running);
 const states=await page.evaluate(()=>Object.keys(__ui.assets.devon).filter(state=>Array.isArray(__ui.assets.devon[state])));
 const result=await page.evaluate(async()=>{
  const {startDevonSlide}=await import('./src/devon-slide.js');const g=__fight;g.inspectionPaused=true;g.phase='fight';g.cpuEnabled=false;
  const [p,b]=g.fighters;p.x=950;b.x=700;b.energy=50;const before=p.x;
  startDevonSlide(b,p);const crossed=[];
  for(let i=0;i<100;i++){g.updateFighter(b,p,1,1/120);g.resolveBodies();g.draw();if(b.slide?.phase==='travel')crossed.push(b.x);}
  return {boss:b.x,player:p.x,before,phase:b.slide,energy:b.energy,crossed,facing:b.facing};
 });
 assert.ok(result.boss>result.player);assert.equal(result.player,result.before);assert.equal(result.phase,null);assert.equal(result.energy,25);assert.equal(result.facing,-1);assert.ok(result.crossed.some(x=>x<950)&&result.crossed.some(x=>x>950));
 const trail=await page.evaluate(async()=>{
  const {startDevonSlide}=await import('./src/devon-slide.js');const g=__fight,[p,b]=g.fighters;
  p.x=950;b.x=700;b.energy=50;b.slideCooldown=0;b.action=null;b.stun=0;
  startDevonSlide(b,p);
  for(let i=0;i<44;i++)g.updateFighter(b,p,1,1/120);
  g.draw();return {phase:b.slide?.phase,copies:b.slideTrail.length};
 });
 assert.equal(trail.phase,'travel');assert.ok(trail.copies>1);
 await page.locator('#gameCanvas').screenshot({path:'artifacts/devon-slide-trail.png'});
 await page.evaluate(()=>{const g=__fight;for(let i=0;i<90;i++)g.updateFighter(g.fighters[1],g.fighters[0],1,1/120);});
 await page.evaluate(()=>{__fight.fighters[0].x=650;__fight.fighters[1].x=1150;});
 await fs.mkdir('artifacts/devon-states',{recursive:true});
 for(const state of states){
  await page.evaluate(state=>{const g=__fight,b=g.fighters[1];b.action=['punch','kick','special','super','airPunch','airKick','crouchPunch','crouchKick','uppercut','sweep'].includes(state)?state:null;b.actionTime=0;b.state=state;b.stateTime=0;g.draw();},state);
  await page.locator('#gameCanvas').screenshot({path:`artifacts/devon-states/${state}.png`});
 }
 await page.evaluate(()=>{const g=__fight,b=g.fighters[1];b.action=null;b.state='idle';g.draw();});await page.screenshot({path:'artifacts/devon-boss.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/devon-boss-mobile.png'});
 assert.deepEqual(errors,[]);console.log(`PASS real Devon slide/render, ${states.length} runtime animations and mobile boss view`);
}finally{await browser.close();}
