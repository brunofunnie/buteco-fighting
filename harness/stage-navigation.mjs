import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.pad={index:0,id:'Stage nav test',connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.pad]});});
 const focused=()=>page.evaluate(()=>document.activeElement.id||document.activeElement.dataset.stage);
 const tap=async button=>{await page.evaluate(i=>pad.buttons[i].pressed=true,button);await page.waitForTimeout(110);await page.evaluate(i=>pad.buttons[i].pressed=false,button);await page.waitForTimeout(110);};
 await page.goto(process.env.GAME_URL||'http://localhost:3197');await page.waitForFunction(()=>window.__ui?.assets&&!document.querySelector('#titleStart').disabled);
 for(const s of ['#titleStart','[data-mode=free]','#fighterNext'])await page.click(s);

 assert.equal(await page.locator('#startButton').count(),0);
 await page.hover('[data-stage="2"]');assert.equal(await page.evaluate(()=>__ui.selection.stage),2);assert.equal(await page.evaluate(()=>__ui.screen),'stage');
 await page.locator('[data-stage="2"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await focused(),'3');assert.equal(await page.evaluate(()=>__ui.screen),'stage');
 await page.keyboard.press('ArrowDown');assert.equal(await focused(),'backButton');
 await page.keyboard.press('ArrowRight');assert.equal(await focused(),'controlsButton');
 await page.keyboard.press('Enter');assert.equal(await page.locator('#controlsDialog').isVisible(),true);
 await page.keyboard.press('Escape');await page.keyboard.press('ArrowUp');assert.equal(await focused(),'3');
 await page.keyboard.press('Enter');await page.waitForFunction(()=>__ui.screen==='versus');
 await page.evaluate(()=>__ui.backToMenu('stage'));await page.waitForFunction(()=>__ui.screen==='stage');
 await page.click('#backButton');await page.waitForFunction(()=>__ui.screen==='fighter');await page.click('#fighterNext');
 await page.locator('[data-stage="3"]').focus();await tap(14);assert.equal(await focused(),'2');assert.equal(await page.evaluate(()=>__ui.screen),'stage');
 await tap(13);assert.equal(await focused(),'backButton');await tap(15);assert.equal(await focused(),'controlsButton');
 await tap(0);assert.equal(await page.locator('#controlsDialog').isVisible(),true);
 await tap(1);assert.equal(await page.locator('#controlsDialog').isVisible(),false);
 await tap(12);assert.equal(await focused(),'2');await tap(0);await page.waitForFunction(()=>__ui.screen==='versus');
 await page.evaluate(()=>__ui.backToMenu('stage'));await page.waitForFunction(()=>__ui.screen==='stage');await page.click('[data-stage="1"]');await page.waitForFunction(()=>__ui.screen==='versus');
 assert.equal(await page.evaluate(()=>__ui.selection.stage),1);
 assert.deepEqual(errors,[]);
 console.log('PASS free match → stage → fighters, keyboard/gamepad arena and footer navigation, options and back');
}finally{await browser.close();}
