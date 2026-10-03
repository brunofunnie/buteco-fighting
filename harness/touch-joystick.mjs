import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://localhost:3197');await page.waitForFunction(()=>__ui.assets&&!document.querySelector('#titleStart').disabled);
 await page.click('#titleStart');await page.click('[data-mode=training]');await page.click('#fighterNext');await page.click('[data-stage="0"]');await page.waitForFunction(()=>__ui.game?.running);
 await page.evaluate(()=>__ui.game.debugForce({phase:'fight'}));
 assert.equal(await page.locator('.dpad').count(),0);
 const box=await page.locator('#touchJoystick').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
 const cdp=await page.context().newCDPSession(page);
 const touch=async(type,points)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({...p,radiusX:2,radiusY:2}))});await page.waitForTimeout(60);};
 const held=action=>page.evaluate(action=>__ui.game.inputHeld(0,action),action);
 await touch('touchStart',[{id:1,x,y}]);assert.equal(await held('right'),false);assert.equal(await held('jump'),false);
 await touch('touchMove',[{id:1,x:x+35,y}]);assert.equal(await held('right'),true);
 await touch('touchMove',[{id:1,x:x-35,y:y-35}]);assert.equal(await held('left'),true);assert.equal(await held('jump'),true);assert.equal(await held('right'),false);
 await touch('touchMove',[{id:1,x,y:y+35}]);assert.equal(await held('crouch'),true);assert.equal(await held('jump'),false);
 const attack=await page.locator('[data-key=j]').boundingBox(),ax=attack.x+attack.width/2,ay=attack.y+attack.height/2;
 await touch('touchStart',[{id:1,x,y:y+35},{id:2,x:ax,y:ay}]);assert.equal(await held('crouch'),true);assert.equal(await held('punch'),true);
 await touch('touchEnd',[{id:1,x,y:y+35}]);assert.equal(await held('crouch'),false);assert.equal(await held('punch'),true);
 await touch('touchEnd',[]);assert.equal(await held('punch'),false);
 await touch('touchStart',[{id:1,x:x+35,y}]);await page.evaluate(()=>__ui.pause());assert.equal(await held('right'),false);await touch('touchEnd',[]);await page.evaluate(()=>__ui.resume());
 await touch('touchStart',[{id:1,x:x+35,y}]);await touch('touchCancel',[]);assert.equal(await held('right'),false);
 await page.screenshot({path:'artifacts/touch-joystick-844.png'});
 assert.deepEqual(errors,[]);console.log('PASS touch dead zone, directions/diagonals, multi-touch attacks, release, cancellation and pause cleanup');
}finally{await browser.close();}
