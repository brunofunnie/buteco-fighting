import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.GAME_URL || 'http://127.0.0.1:3187';
const artifacts = process.env.OPTIONS_ARTIFACTS || '/tmp/buteco-options-layout';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
try {
  const errors = [];
  for (const [name,width,height] of [['desktop',1440,900],['laptop',1280,720],['mobile',390,844],['landscape',844,390]]) {
    const page = await browser.newPage({viewport:{width,height}});
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, { waitUntil:'networkidle' });
    await page.locator('#controlsButton').click();
    assert.equal(await page.evaluate(()=>document.activeElement.id),'muteButton');
    assert.equal(await page.locator('#muteButton .setting-copy strong').textContent(),'ÁUDIO');
    const state = await page.locator('#muteState').textContent();
    await page.keyboard.press('j');
    assert.notEqual(await page.locator('#muteState').textContent(),state);
    assert.equal(await page.locator('#muteButton .setting-copy strong').textContent(),'ÁUDIO');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#muteState').textContent(),state);
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'fullscreenButton');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'closeControls');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'muteButton');
    const geometry = await page.locator('#controlsDialog').evaluate(dialog=>({width:dialog.clientWidth,scrollWidth:dialog.scrollWidth,scrollHeight:dialog.scrollHeight,height:dialog.clientHeight,keys:dialog.querySelectorAll('kbd').length}));
    assert.ok(geometry.scrollWidth<=geometry.width+1,`${name}: horizontal overflow`);
    assert.ok(geometry.keys>=35,`${name}: missing key guide`);
    await page.screenshot({path:`${artifacts}/options-${name}.png`});
    await page.locator('.options-footer').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('.options-footer').isVisible());
    await page.locator('#fullscreenButton').scrollIntoViewIfNeeded();
    await page.locator('#fullscreenButton').click();
    await page.waitForTimeout(150);
    await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});
    await page.waitForTimeout(150);
    await page.locator('#closeControls').click();
    assert.ok(await page.locator('#controlsDialog').isHidden());
    assert.equal(await page.evaluate(()=>document.activeElement.id),'controlsButton');
    await page.locator('#controlsButton').click();
    await page.keyboard.press('Escape');
    assert.ok(await page.locator('#controlsDialog').isHidden());
    assert.equal(await page.evaluate(()=>document.activeElement.id),'controlsButton');
    await page.close();
    console.log(`${name}: layout, audio, navigation, fullscreen, back, Escape and focus restoration passed (${geometry.scrollHeight}px content / ${geometry.height}px viewport)`);
  }
  assert.deepEqual(errors,[]);
  console.log(`Screenshots: ${artifacts}`);
} finally { await browser.close(); }
