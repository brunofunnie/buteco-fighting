import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto('http://localhost:3187');
  await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);
  for(const key of ['Enter','Space','j','1']) {
    await page.locator('#titleStart').click();
    await page.locator('#backButton').focus();await page.keyboard.press(key);
    assert.equal(await page.evaluate(()=>window.__ui.screen),'title',`${key}: focused Back returns from mode`);
    await page.locator('#titleStart').click();await page.locator('#modeNext').click();
    await page.locator('#backButton').focus();await page.keyboard.press(key);
    assert.equal(await page.evaluate(()=>window.__ui.screen),'mode',`${key}: focused Back returns from fighters`);
    await page.locator('#modeNext').click();await page.locator('#fighterNext').click();
    await page.locator('#backButton').focus();await page.keyboard.press(key);
    assert.equal(await page.evaluate(()=>window.__ui.screen),'fighter',`${key}: focused Back returns from stages`);
    await page.locator('#controlsButton').focus();await page.keyboard.press(key);
    assert.equal(await page.locator('#controlsDialog').isVisible(),true,`${key}: focused Options opens the dialog`);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'controlsButton');
    await page.locator('#backButton').click();await page.locator('#backButton').click();
  }
  assert.deepEqual(errors,[]);
  console.log('PASS focused footer actions with Enter, Space, J and 1 across all menus');
} finally {await browser.close();}
