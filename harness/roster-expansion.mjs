import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

// Catch a narrow roster column, clipped controls, and arrows skipping the wrong row.
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await mkdir('artifacts',{recursive:true});
try {
await page.goto(process.env.GAME_URL||'http://127.0.0.1:3188');
  await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);
  await page.locator('#titleStart').click();
  await page.locator('#modeNext').click();
  for(const [name,width,height] of [['desktop',1440,900],['landscape',844,390],['portrait',390,844],['small-portrait',320,568],['compact-landscape',568,320],['mid-size',1024,650],['large-desktop',1920,1080]]) {
    await page.setViewportSize({width,height});
    await page.waitForTimeout(300);
    const layout=await page.evaluate(()=>{
      const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
      const grid=document.querySelector('.roster-grid');
      return {grid:rect(grid),scrollHeight:grid.scrollHeight,clientHeight:grid.clientHeight,previews:[...document.querySelectorAll('.fighter-preview')].map(rect),actions:[...document.querySelectorAll('#fighterScreen .menu-footer button')].map(rect),cols:getComputedStyle(grid).gridTemplateColumns.split(' ').length};
    });
    assert.ok(layout.grid.width>=width*.88,`${name}: roster occupies full width`);
    if(name==='desktop'||name==='large-desktop')assert.ok(layout.scrollHeight<=layout.clientHeight+1,`${name}: entire roster fits without scrolling`);
    assert.ok(layout.previews.every(r=>r.bottom<=layout.grid.top),`${name}: both previews sit above roster`);
    assert.ok(layout.actions.slice(0,2).every(r=>r.bottom<=layout.previews[0].top),`${name}: Back and Options stay above previews`);
    assert.ok([layout.grid,...layout.previews,...layout.actions].every(r=>r.left>=0&&r.right<=width+1&&r.top>=0&&r.bottom<=height+1),`${name}: content and controls fit viewport`);
    await page.locator('[data-slot="player"]').click();
    const first=page.locator('[data-player]').first();
    await first.click();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(()=>window.__ui.selection.player),await page.locator('[data-player]').nth(layout.cols).getAttribute('data-player'),`${name}: down moves one visible row`);
    const count=await page.locator('[data-player]').count();
    const column=2;
    const lastInColumn=column+Math.floor((count-1-column)/layout.cols)*layout.cols;
    await page.locator('[data-player]').nth(column).click();
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.evaluate(()=>window.__ui.selection.player),await page.locator('[data-player]').nth(lastInColumn).getAttribute('data-player'),`${name}: up wraps within the same column`);
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(()=>window.__ui.selection.player),await page.locator('[data-player]').nth(column).getAttribute('data-player'),`${name}: down skips empty cells and wraps within the same column`);
    await page.locator('[data-player="maya-b"]').click();
    await page.locator('[data-slot="opponent"]').click();
    await page.locator('[data-player="astha"]').click();
    await page.waitForFunction(()=>['player','opponent'].every(prefix=>document.querySelector(`#${prefix}PowerDemo`).dataset.demoReady==='true'));
    await page.screenshot({path:`artifacts/roster-expansion-${name}.png`});
  }
  assert.deepEqual(errors,[],'no browser errors');
  await writeFile('artifacts/roster-expansion.json',JSON.stringify({passed:true,errors},null,2));
  console.log('PASS full-width roster, responsive layout and row navigation');
} finally {await browser.close();}
