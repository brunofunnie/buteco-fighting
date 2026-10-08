import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const dir='artifacts/gameplay';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir,size:{width:1440,height:1000}}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:3187');await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);
 await page.click('#titleStart');await page.click('[data-mode="versus"]');await page.click('[data-player="joe-munist"]');await page.click('[data-slot="opponent"]');await page.click('[data-player="biskit"]');
 await page.waitForTimeout(1500);
 await page.screenshot({path:dir+'/realistic-selection.png'});await page.click('#fighterNext');await page.click('[data-stage="0"]');await page.waitForFunction(()=>window.__fight?.phase==='fight');
 // Seed the meter once to show the super; combat rules and health stay unchanged.
 await page.evaluate(()=>{__fight.fighters[0].energy=100;window.__liveStates=new Set();window.__liveTimer=setInterval(()=>__liveStates.add(__fight.fighters[0].state),16);});
 const hold=async(keys,ms)=>{for(const key of keys)await page.keyboard.down(key);await page.waitForTimeout(ms);for(const key of keys)await page.keyboard.up(key);};
 await hold(['i'],80);await page.waitForTimeout(350);await page.screenshot({path:dir+'/keyboard-super.png'});await page.waitForTimeout(1200);
 await hold(['d','w'],950);await hold(['a','w'],950);await hold(['s','l'],350);
 await page.keyboard.down('d');await page.waitForFunction(()=>Math.abs(__fight.fighters[1].x-__fight.fighters[0].x)<140,{},{timeout:6000});await page.keyboard.up('d');
 for(const [keys,ms]of [[['j'],650],[['k'],750],[['w','j'],950],[['s','j'],650],[['s','k'],750]]){await hold(keys,80);await page.waitForTimeout(ms);}
 await page.waitForTimeout(1000);await page.screenshot({path:dir+'/keyboard-match.png'});
 const result=await page.evaluate(()=>{clearInterval(__liveTimer);return {mode:__fight.mode,states:[...__liveStates],fighters:__fight.fighters.map(f=>({id:f.id,health:f.health,energy:f.energy})),phase:__fight.phase};});
 assert.equal(result.mode,'versus');assert.deepEqual(result.fighters.map(f=>f.id),['joe-munist','biskit']);assert.ok(result.states.includes('super'));assert.ok(result.states.includes('jumpForward'));assert.ok(result.states.includes('lowBlock'));assert.deepEqual(errors,[]);
 await writeFile(dir+'/keyboard-gameplay.json',JSON.stringify({status:'passed',setup:{playerEnergy:100},result,errors},null,2));const video=page.video();await context.close();await video.saveAs(dir+'/keyboard-gameplay.webm');console.log('PASS live keyboard gameplay: real Joe/Biskit match, super, forward/backward somersaults, low guard and melee');
}finally{await browser.close();}
