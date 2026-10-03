import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.pad={index:0,id:'Test',connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.pad]});});
 const tap=async n=>{await page.evaluate(n=>window.pad.buttons[n].pressed=true,n);await page.waitForTimeout(80);await page.evaluate(n=>window.pad.buttons[n].pressed=false,n);await page.waitForTimeout(80);};
 const focus=()=>page.evaluate(()=>document.activeElement.id||document.activeElement.dataset.bindAction||document.activeElement.dataset.padAction);
 await page.goto(process.env.GAME_URL||'http://localhost:3197');await page.locator('#titleStart').click();await page.locator('#controlsButton').click();
 await page.evaluate(async()=>{const {audioDirector}=await import('./src/audio.js');const play=audioDirector.play.bind(audioDirector);window.selectionSounds=0;audioDirector.play=(key,options)=>{if(key==='select')window.selectionSounds++;return play(key,options);};});
 await tap(0);assert.equal(await focus(),'difficulty');assert.equal(await page.evaluate(()=>window.selectionSounds),1);await tap(12);assert.equal(await focus(),'options-tab-gameplay');assert.equal(await page.evaluate(()=>window.selectionSounds),2);await tap(0);assert.equal(await focus(),'difficulty');await tap(1);assert.equal(await focus(),'options-tab-gameplay');
 await tap(15);assert.equal(await focus(),'options-tab-controls');await tap(0);assert.equal(await focus(),'controls-tab-keyboard');
 await tap(15);assert.equal(await focus(),'controls-tab-gamepad');assert.ok(await page.locator('#gamepadBindings').isVisible());assert.ok(await page.locator('.keyboard-controls').first().isHidden());
 await tap(0);assert.equal(await focus(),'left');await tap(13);assert.equal(await focus(),'right');await tap(15);assert.equal(await page.evaluate(()=>document.activeElement.dataset.padPlayer),'1');
 await tap(1);assert.equal(await focus(),'controls-tab-gamepad');await tap(14);await tap(0);assert.equal(await focus(),'left');assert.ok(await page.locator('#gamepadBindings').isHidden());
 await tap(1);assert.equal(await focus(),'controls-tab-keyboard');await tap(1);assert.equal(await focus(),'options-tab-controls');await tap(15);await tap(0);assert.equal(await focus(),'muteButton');
 await tap(13);assert.equal(await focus(),'musicVolume');const value=await page.locator('#musicVolume').inputValue();await tap(14);assert.equal(Number(await page.locator('#musicVolume').inputValue()),Number(value)-5);await tap(13);assert.equal(await focus(),'effectsVolume');
 await tap(1);assert.equal(await focus(),'options-tab-audio');await tap(1);assert.ok(await page.locator('#controlsDialog').isHidden());
 assert.deepEqual(errors,[]);console.log('PASS real controller: enter tabs/subtabs, spatial P1/P2 navigation, volume adjustment, hierarchical back and close');
}finally{await browser.close();}
