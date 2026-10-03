import assert from 'node:assert/strict';import {chromium} from 'playwright';
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://localhost:3197');await page.waitForFunction(()=>__ui.assets&&!document.querySelector('#titleStart').disabled);
 await page.click('#titleStart');await page.click('[data-mode=free]');await page.click('#fighterNext');await page.click('[data-stage="0"]');await page.waitForFunction(()=>__ui.screen==='versus');
 await page.waitForFunction(()=>Number(document.querySelector('#versusEntrance')?.dataset.progress)>.25);
 assert.equal(await page.locator('#versusLeft').evaluate(e=>e.style.visibility),'hidden');
 await page.screenshot({path:'artifacts/versus-jump-arrival.png'});
 await page.waitForFunction(()=>!document.querySelector('#versusEntrance'));
 assert.equal(await page.evaluate(()=>__ui.screen),'versus');
 assert.equal(await page.locator('#versusLeft').evaluate(e=>getComputedStyle(e).visibility),'visible');
 assert.equal(await page.locator('#versusRight').evaluate(e=>getComputedStyle(e).visibility),'visible');
 await page.screenshot({path:'artifacts/versus-jump-idle.png'});
 await page.waitForFunction(()=>__ui.screen==='fight');assert.deepEqual(errors,[]);
 console.log('PASS jump arrival, landing in static idle, presentation duration preserved, no runtime errors');
}finally{await browser.close();}
