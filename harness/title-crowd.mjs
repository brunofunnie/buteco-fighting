import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{for(const [width,height] of [[1440,900],[390,844],[844,390]]){
 const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://localhost:3197');await page.waitForFunction(()=>window.__ui?.assets&&!document.querySelector('#titleStart').disabled);await page.waitForTimeout(950);
 for(const selector of ['.title-crowd-background','.title-villain img','.title-game-logo','.title-brand img'])assert.ok(await page.locator(selector).evaluate(img=>img.complete&&img.naturalWidth>0),selector);
 assert.equal(await page.locator('.title-team').count(),0);
 assert.ok((await page.locator('.title-crowd-background').getAttribute('src')).endsWith('seven-crowd-background.png'));
 assert.ok((await page.locator('.title-brand img').getAttribute('src')).endsWith('logo_buteco_games.png'));
 const logo=await page.locator('.title-game-logo').boundingBox(),button=await page.locator('#titleStart').boundingBox();assert.ok(logo.y+logo.height<button.y);
 await page.screenshot({path:`artifacts/title-crowd-${width}.png`});await page.click('#titleStart');await page.waitForFunction(()=>__ui.screen==='mode');assert.deepEqual(errors,[]);await page.close();
}console.log('PASS: illustrated crowd background, separate Devon/logo/studio mark, startup loading and start navigation at three viewport sizes.');}finally{await browser.close();}
