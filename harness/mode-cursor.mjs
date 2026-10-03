import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const b=await chromium.launch({args:['--no-sandbox']});
try{
 const p=await b.newPage({viewport:{width:1440,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL||'http://localhost:3197');await p.locator('#titleStart').click();
 assert.equal(await p.locator('#modeNext').count(),0);
 await p.evaluate(async()=>{const {audioDirector}=await import('./src/audio.js');const play=audioDirector.play.bind(audioDirector);window.modeSounds=[];audioDirector.play=(key,...args)=>{window.modeSounds.push(key);return play(key,...args);};});
 assert.equal(await p.evaluate(()=>document.activeElement.dataset.mode),'arcade');
 const expected=['versus','online','training','backButton','controlsButton','arcade'];
 for(const id of expected){
  const sounds=await p.evaluate(()=>window.modeSounds.length);
  await p.keyboard.press('ArrowDown');
  assert.equal(await p.evaluate(()=>window.modeSounds.length),sounds+1);
  assert.equal(await p.evaluate(()=>window.modeSounds.at(-1)),'select');
  assert.equal(await p.evaluate(()=>document.activeElement.dataset.mode||document.activeElement.id),id);
  assert.equal(await p.locator('#modeScreen .mode-cursor').count(),1);
  assert.equal(await p.locator('#modeScreen .mode-toast:visible').count(),1);
 }
 await p.keyboard.press('ArrowUp');assert.equal(await p.evaluate(()=>document.activeElement.id),'controlsButton');
 await p.screenshot({path:'artifacts/mode-options-cursor.png'});
 await p.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true})));
 assert.equal(await p.locator('#controlsDialog').isVisible(),true);
 await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.id),'controlsButton');
 await p.keyboard.press('ArrowUp');assert.equal(await p.evaluate(()=>document.activeElement.id),'backButton');
 await p.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true})));
 assert.equal(await p.evaluate(()=>window.__ui.screen),'title');
 await p.locator('#titleStart').click();await p.locator('[data-mode=versus]').focus();await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>window.__ui.screen),'fighter');assert.equal(await p.evaluate(()=>window.__ui.selection.mode),'versus');
 await p.locator('#backButton').click();
 await p.locator('[data-mode=training]').hover();
 assert.equal(await p.evaluate(()=>window.__ui.screen),'mode');assert.equal(await p.evaluate(()=>window.__ui.selection.mode),'training');
 assert.ok(await p.locator('[data-mode=training]').evaluate(el=>el.classList.contains('mode-cursor')));
 await p.locator('[data-mode=training]').click();assert.equal(await p.evaluate(()=>window.__ui.screen),'fighter');
 assert.deepEqual(errors,[]);console.log('PASS mode hover/click and direct keyboard/gamepad confirmation; back/options navigation sounds, single beer marker and focus restoration');
}finally{await b.close();}
