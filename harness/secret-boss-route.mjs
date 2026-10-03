import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Integration fixtures publish a boss using existing known-good combat frames.
// They exist only inside these intercepted responses; no stand-in is shipped.
const browser=await chromium.launch({args:['--no-sandbox']});
try{
  for(const missingFrame of [true,false]){
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/roster.js',async route=>{
      const response=await route.fetch();await route.fulfill({response,body:await response.text()+"\nNON_PLAYABLE_FIGHTERS.devon={...FIGHTERS.bruno,id:'devon',name:'Devon'};"});
    });
    await page.route('**/collision-data.js',async route=>{
      const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nCOLLISION_DATA.devon=COLLISION_DATA.bruno;'});
    });
    await page.route('**/assets/manifest.json',async route=>{
      const response=await route.fetch(),manifest=await response.json();manifest.devon=structuredClone(manifest.bruno);
      if(missingFrame)manifest.devon.idle.frames[0].path='assets/sprites/devon/missing-test-frame.png';
      await route.fulfill({response,json:manifest});
    });
    await page.goto(process.env.GAME_URL||'http://localhost:3197');
    await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);
    await page.click('#titleStart');await page.click('[data-mode=arcade]');
    await page.evaluate(()=>{window.__ui.selection.player='bruno';window.__ui.selection.stage=2;});
    for(const key of ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'])await page.keyboard.press(key);
    assert.equal(await page.locator('[data-secret-action="devon"]').isDisabled(),false);
    const selectedBefore=await page.evaluate(()=>({...__ui.selection}));
    await page.locator('[data-secret-action="devon"]').click();
    if(missingFrame){
      await page.waitForFunction(()=>document.querySelector('#secretMenuStatus').textContent.startsWith('Não foi possível carregar'));
      assert.equal(await page.locator('#secretMenu').isVisible(),true);
      assert.equal(await page.evaluate(()=>window.__ui.selection.opponent),selectedBefore.opponent,'Failed preparation preserves the selection');
      assert.equal(await page.evaluate(()=>window.__ui.game),undefined);
    }else{
      await page.waitForFunction(()=>window.__fight?.running);
      assert.equal(await page.locator('#secretMenu').isVisible(),false);
      assert.deepEqual(await page.evaluate(()=>window.__fight.fighters.map(f=>f.id)),[selectedBefore.player,'devon']);
      assert.equal(await page.evaluate(()=>window.__fight.stage),4);
      assert.equal(await page.evaluate(()=>window.__ui.campaign),null,'Direct boss access does not advance or fabricate an Arcade campaign');
      assert.equal(await page.locator('[data-player="devon"]').count(),0);
      await page.evaluate(()=>window.__ui.backToMenu());
      await page.locator('[data-mode="arcade"]').click();
      assert.notEqual(await page.evaluate(()=>window.__ui.selection.opponent),'devon','Returning to the roster restores a selectable rival');
      assert.equal(await page.locator('#fighterScreen').isVisible(),true);
    }
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS direct boss route with published-profile fixtures, preserved fighter/arena, no roster exposure and recoverable missing assets');
}finally{await browser.close();}
