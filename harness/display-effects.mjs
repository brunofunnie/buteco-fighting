import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://localhost:3197');
 assert.equal(await page.locator('#arcade > .cabinet-noise').getAttribute('data-scanlines'),'default');
 assert.ok((await page.locator('#loadPercent').evaluate(el=>getComputedStyle(el).fontFamily)).includes('Press Start 2P'));
 await page.locator('#titleStart').click();
 await page.locator('#controlsButton').click();await page.locator('[data-options-tab=video]').click();
 const modes=['default','none','2x','3x','vignette','crt'];
 for(const mode of modes) {
  await page.locator(`[data-scanline-mode="${mode}"]`).click();
  assert.equal(await page.locator(`[data-scanline-mode="${mode}"]`).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-scanline-mode][aria-pressed=true]').count(),1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('buteco-scanlines')),mode);
  for(const layer of await page.locator('.cabinet-noise').all())assert.equal(await layer.getAttribute('data-scanlines'),mode);
  if(mode==='none')assert.equal(await page.locator('#arcade > .cabinet-noise').evaluate(el=>getComputedStyle(el).display),'none');
  await page.locator('.display-settings').screenshot({path:`artifacts/scanlines-${mode}.png`});
 }
 const ink=await page.locator('#arcade > .cabinet-noise canvas').evaluate(canvas=>{
  const bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  return bytes.some((v,i)=>i%4===3&&v>0);
 });assert.ok(ink,'CRT paints curved scanlines');
 await page.reload();
 assert.equal(await page.locator('#arcade > .cabinet-noise').getAttribute('data-scanlines'),'crt');
 await page.locator('#titleStart').click();
 await page.locator('#controlsButton').click();await page.locator('[data-options-tab=video]').click();
 await page.setViewportSize({width:390,height:844});
 await page.locator('.display-settings').scrollIntoViewIfNeeded();
 assert.ok(await page.locator('#controlsDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 await page.locator('.display-settings').screenshot({path:'artifacts/scanlines-mobile.png'});
 await page.locator('[data-scanline-mode=default]').focus();
 await page.keyboard.press('ArrowRight');
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.scanlineMode),'none');
 await page.keyboard.press('Enter');
 assert.equal(await page.locator('#arcade > .cabinet-noise').getAttribute('data-scanlines'),'none');
 await page.locator('#closeControls').click();
 assert.equal(await page.locator('#controlsDialog').isVisible(),false);
 assert.deepEqual(errors,[]);
 console.log('PASS six modes, live preview, persisted selection, CRT canvas, mobile layout, keyboard and loading font');
} finally {await browser.close();}
