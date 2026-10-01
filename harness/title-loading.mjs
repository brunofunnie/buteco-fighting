import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({args:['--no-sandbox']});
try {
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]) {
  const page=await browser.newPage({viewport});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let release;const blocked=new Promise(resolve=>release=resolve);
  await page.route('**/assets/manifest.json',async route=>{await blocked;await route.continue();});
  await page.goto(process.env.GAME_URL||'http://localhost:3197',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('[data-title-player]').length===54);
  assert.equal(await page.locator('#titleScreen').getAttribute('aria-busy'),'true');
  assert.equal(await page.locator('.title-villain').evaluate(el=>getComputedStyle(el).opacity),'0');
  assert.equal(await page.locator('.title-team').first().evaluate(el=>getComputedStyle(el).opacity),'0');
  assert.equal(await page.locator('#titleStart').isVisible(),false);
  assert.equal(await page.locator('.beer-mug').count(),10);
  await page.screenshot({path:`artifacts/loading-${viewport.width}.png`});
  release();
  await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled,null,{timeout:120000});
  assert.equal(await page.locator('#titleProgress').getAttribute('aria-valuenow'),'100');
  assert.equal(await page.locator('#titleLoading').isVisible(),false);
  assert.equal(await page.locator('#titleScreen').getAttribute('aria-busy'),'false');
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.title-villain').evaluate(el=>getComputedStyle(el).opacity),'1');
  assert.ok(await page.locator('.title-villain img').evaluate(el=>el.complete&&el.naturalWidth>0));
  const geometry=await page.locator('.title-villain').evaluate(el=>{const r=el.getBoundingClientRect();return r.width/r.height;});
  assert.ok(Math.abs(geometry-1122/1402)<.002);
  assert.equal(await page.locator('.devon-eyes').evaluate(el=>getComputedStyle(el).animationName),'devonEyes');
  await page.screenshot({path:`artifacts/devon-animated-${viewport.width}.png`});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.devon-eyes').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.locator('#titleStart').click();
  assert.equal(await page.locator('#modeScreen').isVisible(),true);
  assert.deepEqual(errors,[]);
  await page.close();
 }
 console.log('PASS loading gate, ten mugs, completion, Devon image/effects alignment, reduced motion and navigation at three viewports');
} finally {await browser.close();}
