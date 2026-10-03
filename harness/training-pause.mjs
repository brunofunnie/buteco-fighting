import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch();
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://localhost:3197');
 await page.waitForFunction(()=>window.__ui?.assets&&!document.querySelector('#titleStart').disabled);
 await page.click('#titleStart');await page.click('[data-mode=training]');await page.click('#fighterNext');await page.click('[data-stage="0"]');
 await page.waitForFunction(()=>__ui.game?.mode==='training');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#trainingSettings').isVisible(),true);
 assert.equal(await page.locator('#trainingCpu').getAttribute('aria-checked'),'false');
 assert.deepEqual(await page.evaluate(()=>{const g=__ui.game;return g.getInput(g.fighters[1],g.fighters[0],1,1/60)}),{move:0,guard:false});
 await page.locator('#trainingCpu').focus();await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>__ui.game.cpuEnabled),true);
 assert.notEqual(await page.evaluate(()=>{const g=__ui.game;return g.getInput(g.fighters[1],g.fighters[0],1,1/60).move}),0);
 await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.id),'trainingDifficulty');
 await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>__ui.game.difficulty),'hard');
 await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>__ui.game.difficulty),'easy');
 await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>__ui.game.difficulty),'normal');
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 assert.equal(await page.locator('#trainingCpu').getAttribute('aria-checked'),'true');
 await page.click('#trainingCpu');assert.equal(await page.evaluate(()=>__ui.game.cpuEnabled),false);
 for(const [width,height]of [[1440,900],[844,390],[390,844]]){await page.setViewportSize({width,height});await page.screenshot({path:`artifacts/training-pause-${width}.png`});}
 await page.evaluate(()=>__ui.backToMenu());await page.click('[data-mode=free]');await page.click('#fighterNext');await page.click('[data-stage="0"]');await page.waitForFunction(()=>__ui.game?.mode==='free');await page.keyboard.press('Escape');
 assert.equal(await page.locator('#trainingSettings').isVisible(),false);
 await page.keyboard.press('ArrowUp');assert.equal(await page.evaluate(()=>document.activeElement.id),'menuButton');
 assert.equal(await page.evaluate(()=>__ui.game.cpuEnabled),true);
 assert.deepEqual(errors,[]);
 console.log('PASS training CPU toggle, AI responds only when enabled, difficulty, keyboard navigation, pause persistence, hidden outside training');
}finally{await browser.close();}
