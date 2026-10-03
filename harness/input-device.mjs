import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{window.pad={index:0,id:'Test',connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.pad]});});
 const mode=()=>p.locator('html').getAttribute('data-input-device');
 const tap=async n=>{await p.evaluate(n=>window.pad.buttons[n].pressed=true,n);await p.waitForTimeout(100);await p.evaluate(n=>window.pad.buttons[n].pressed=false,n);await p.waitForTimeout(100);};
 await p.goto(process.env.GAME_URL||'http://localhost:3197');await p.waitForFunction(()=>!document.querySelector('#titleStart').disabled);
 assert.equal(await mode(),'mouse');assert.match(await p.locator('#titleStart').textContent(),/CLIQUE/);
 await tap(15);assert.equal(await mode(),'gamepad');assert.match(await p.locator('#titleStart').textContent(),/A \/ ×/);
 await tap(0);assert.equal(await p.evaluate(()=>window.__ui.screen),'mode');assert.equal(await mode(),'gamepad');assert.equal(await p.locator('#backButton').getAttribute('data-input-prompt'),'B / ○');assert.match(await p.locator('#navigationHint').textContent(),/DIRECIONAL/);
 await p.mouse.move(800,700);assert.equal(await mode(),'mouse');assert.equal(await p.locator('#backButton').getAttribute('data-input-prompt'),null);assert.equal(await p.locator('#navigationHint').isVisible(),false);await p.waitForTimeout(300);assert.equal(await mode(),'mouse','idle connected pad cannot steal input');
 await p.keyboard.press('ArrowDown');assert.equal(await mode(),'keyboard');await tap(2);assert.equal(await mode(),'gamepad');assert.ok(await p.locator('#controlsDialog').isVisible());assert.match(await p.locator('.options-footer').textContent(),/B \/ ○/);
 await p.mouse.move(1000,300);assert.equal(await mode(),'mouse');assert.equal(await p.locator('.options-footer p').isVisible(),false);await p.locator('#closeControls').click();
 await p.locator('[data-mode=versus]').click();assert.equal(await p.locator('.roster-hint').isVisible(),false);
 await tap(15);assert.equal(await mode(),'gamepad');assert.match(await p.locator('.roster-hint').textContent(),/Y \/ △/);
 await p.mouse.move(500,200);assert.equal(await mode(),'mouse');assert.equal(await p.locator('.roster-hint').isVisible(),false);
 assert.equal(await p.locator('#navigationHint').isVisible(),false);assert.ok(await p.locator('#fighterScreen').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 await p.screenshot({path:'artifacts/input-device-selection.png'});assert.deepEqual(errors,[]);
 console.log('PASS active mouse/gamepad/keyboard detection, idle pad, synthetic menu events, title/menu/options/fighter hints and visible prompts');
}finally{await browser.close();}
