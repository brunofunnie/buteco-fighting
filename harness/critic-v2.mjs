import fs from 'node:fs/promises';
import {chromium} from '/tmp/before-dawn-tools/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:3187',{waitUntil:'networkidle'});
await page.screenshot({path:'artifacts/critic-title.png'});
await page.locator('#titleStart').click();
await page.locator('[data-mode="versus"]').click();
await page.screenshot({path:'artifacts/critic-select.png'});
await page.locator('#fighterNext').click();await page.locator('#startButton').click();
await page.waitForFunction(()=>window.__fight?.fighters.length===2);
await page.waitForTimeout(3000);
await page.evaluate(()=>{const g=window.__fight;g.freezeForInspection?.();g.debugForce({phase:'fight',cpu:false});g.paused=false;});
const results=[];
for(const state of ['idle','punch','kick','airPunch','airKick','crouchPunch','crouchKick','uppercut','sweep','dash','backwalk','lowBlock']){
const info=await page.evaluate(state=>{const g=window.__fight;for(const f of g.fighters){Object.assign(f,{state,action:['punch','kick','airPunch','airKick','crouchPunch','crouchKick','uppercut','sweep'].includes(state)?state:null,stateTime:.2,actionTime:.19,x:f.id==='maya'?400:880,y:590,health:100,stun:0});}g.draw();return Object.entries(g.assets).map(([id,a])=>{const frames=a[state];return {id,state,frames:frames?.length,heights:frames?.map(img=>{const idle=a.idle[0],b=g.measureSprite(idle),s=g.measureSprite(img);return 320/(b.height/idle.naturalHeight)*(img.spriteMeta?.scale||1)*s.height/img.naturalHeight;})};});},state);
results.push(info);await page.locator('#gameCanvas').screenshot({path:`artifacts/critic-${state}.png`});
}
await fs.writeFile('artifacts/critic-v2.json',JSON.stringify({errors,results},null,2));console.log(JSON.stringify({errors,results}));await browser.close();
