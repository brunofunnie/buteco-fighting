import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const b=await chromium.launch({args:['--no-sandbox']});
try{
 const p=await b.newPage({viewport:{width:1440,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{
  window.testPads=[0,1].map(index=>({index,id:`test controller ${index}`,mapping:'standard',connected:true,axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}));
  Object.defineProperty(navigator,'getGamepads',{value:()=>window.testPads});
 });
 await p.goto(process.env.GAME_URL||'http://localhost:3197');await p.locator('#titleStart').click();await p.locator('#controlsButton').click();
 assert.equal(await p.locator('.options-panel:visible').count(),1);assert.equal(await p.locator('#difficulty').isVisible(),true);
 await p.locator('[data-options-tab=audio]').click();assert.equal(await p.locator('#difficulty').isVisible(),false);assert.equal(await p.locator('#muteButton').isVisible(),true);
 for(const [kind,value]of [['music',35],['effects',65]])await p.locator(`#${kind}Volume`).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},value);
 assert.equal(await p.locator('#musicVolumeValue').textContent(),'35%');assert.equal(await p.locator('#effectsVolumeValue').textContent(),'65%');
 const audio=await p.evaluate(async()=>{const {audioDirector:a}=await import('./src/audio.js');await a.unlock();return {music:a.musicVolume,effects:a.effectsVolume,musicGain:a.musicBus.gain.value,effectsGain:a.effectsBus.gain.value};});
 assert.equal(audio.music,.35);assert.equal(audio.effects,.65);assert.ok(Math.abs(audio.musicGain-.35)<.001);assert.ok(Math.abs(audio.effectsGain-.65)<.001);
 await p.locator('#musicVolume').focus();await p.keyboard.press('ArrowRight');assert.equal(await p.locator('#musicVolume').inputValue(),'40');assert.equal(await p.locator('#effectsVolume').inputValue(),'65');
 await p.locator('[data-options-tab=controls]').click();await p.locator('[data-controls-tab=gamepad]').click();await p.locator('[data-pad-player="0"][data-pad-action=punch]').click();await p.waitForTimeout(100);
 await p.evaluate(()=>window.testPads[0].buttons[7].pressed=true);await p.waitForFunction(()=>document.querySelector('#gamepadBindingStatus').textContent.includes('salvo'));
 await p.evaluate(()=>window.testPads[0].buttons[7].pressed=false);
 assert.equal(await p.locator('[data-pad-player="0"][data-pad-action=punch]').textContent(),'RT / R2');assert.equal(await p.locator('[data-pad-player="1"][data-pad-action=punch]').textContent(),'A / ×');
 await p.locator('[data-pad-player="1"][data-pad-action=kick]').click();await p.waitForTimeout(100);await p.keyboard.press('Escape');assert.equal(await p.locator('#controlsDialog').isVisible(),true);assert.equal(await p.locator('.binding-active').count(),0);
 await p.reload();await p.locator('#titleStart').click();await p.locator('#controlsButton').click();await p.locator('[data-options-tab=audio]').click();assert.equal(await p.locator('#musicVolume').inputValue(),'40');assert.equal(await p.locator('#effectsVolume').inputValue(),'65');
 await p.locator('[data-options-tab=controls]').click();await p.locator('[data-controls-tab=gamepad]').click();assert.equal(await p.locator('[data-pad-player="0"][data-pad-action=punch]').textContent(),'RT / R2');
 await p.locator('#resetGamepadBindings').click();assert.equal(await p.locator('[data-pad-player="0"][data-pad-action=punch]').textContent(),'A / ×');
 await p.locator('[data-options-tab=audio]').focus();await p.keyboard.press('ArrowRight');assert.equal(await p.locator('[data-options-tab=video]').getAttribute('aria-selected'),'true');assert.equal(await p.locator('#fullscreenButton').isVisible(),true);assert.equal(await p.locator('.display-settings').isVisible(),true);
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  await p.setViewportSize(viewport);
  for(const key of ['gameplay','controls','audio','video']){
   await p.locator(`[data-options-tab=${key}]`).click();assert.equal(await p.locator('.options-panel:visible').count(),1);assert.ok(await p.locator('#controlsDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await p.screenshot({path:`artifacts/options-${key}-${viewport.width}.png`});
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS tab categories, independent live/persisted audio gains, slider keyboard, gamepad capture/cancel/reset/persistence, fixed menu controls and responsive layout');
}finally{await b.close();}
