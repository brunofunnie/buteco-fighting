import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const b=await chromium.launch({args:['--no-sandbox']});
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const p=await b.newPage({viewport});await p.goto(process.env.GAME_URL||'http://localhost:3197');await p.locator('#titleStart').click();await p.locator('#modeScreen .mode-option.active').click();await p.waitForTimeout(300);
  assert.equal(await p.locator('[data-random-pick="1"]').isVisible(),false);
  const cpu=await p.locator('[data-player=maya-b]').boundingBox();
  await p.locator('#backButton').click();await p.locator('[data-mode=versus]').click();await p.waitForTimeout(300);
  assert.equal(await p.locator('[data-random-pick="1"]').isVisible(),true);
  const human=await p.locator('[data-player=maya-b]').boundingBox();
  for(const key of ['x','y','width','height'])assert.ok(Math.abs(cpu[key]-human[key])<1,`${key}: grid shifts when random card visibility changes`);
  await p.screenshot({path:`artifacts/roster-reserved-random-${viewport.width}.png`});await p.close();
 }
 console.log('PASS stable grid placement with CPU or human rival on desktop and mobile');
}finally{await b.close();}
