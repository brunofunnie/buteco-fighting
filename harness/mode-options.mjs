import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const b=await chromium.launch({args:['--no-sandbox']});
try{
 const p=await b.newPage({viewport:{width:1440,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL||'http://localhost:3197');await p.locator('#titleStart').click();
 assert.equal(await p.locator('.mode-number').count(),0);assert.equal(await p.locator('#modeScreen #difficulty').count(),0);assert.equal(await p.locator('.mode-toast:visible').count(),1);
 await p.locator('#controlsButton').click();assert.equal(await p.locator('#controlsDialog #difficulty').count(),1);await p.locator('#difficulty').selectOption('hard');await p.locator('#difficulty').focus();await p.keyboard.press('ArrowLeft');assert.equal(await p.locator('#difficulty').inputValue(),'normal');await p.keyboard.press('Enter');assert.equal(await p.locator('#difficulty').inputValue(),'hard');
 await p.keyboard.press('Escape');await p.screenshot({path:'artifacts/modes-without-numbers.png'});
 await p.locator('#modeScreen .mode-option.active').click();await p.locator('#fighterNext').click();await p.locator('#startButton').click();await p.waitForFunction(()=>window.__fight?.fighters?.length===2);
 assert.equal(await p.evaluate(()=>window.__fight.difficulty),'hard');assert.deepEqual(errors,[]);console.log('PASS unnumbered modes, selected beer mug, CPU difficulty moved to options, keyboard editing and hard difficulty applied to match');
}finally{await b.close();}
