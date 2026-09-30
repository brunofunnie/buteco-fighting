import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {fighterIds} from '../roster.js';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const report={checks:[],errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
const check=(name,pass)=>{report.checks.push({name,pass:!!pass});assert.ok(pass,name);};
try{
 await page.goto('http://localhost:3187');await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);
 check('external system bar removed',await page.locator('.system-bar').count()===0);
 await page.locator('#controlsButton').click();
 check('options live inside arcade',await page.locator('#arcade #controlsDialog').isVisible());
 await page.keyboard.press('j');
 check('movement confirm toggles sound',await page.locator('#muteButton').getAttribute('aria-pressed')==='true');
 await page.keyboard.press('j');
 check('sound can be restored',await page.locator('#muteButton').getAttribute('aria-pressed')==='false');
 await page.keyboard.press('s');
 check('movement navigates fullscreen setting',await page.locator('#fullscreenButton').evaluate(e=>e===document.activeElement));
 await page.keyboard.press('Escape');
 check('Escape closes options',!await page.locator('#controlsDialog').isVisible());
 await page.locator('#titleStart').focus();
 check('full roster appears in two equal title teams',await page.locator('.title-team canvas').count()===fighterIds.length&&await page.locator('.title-team').count()===2&&await page.locator('.title-team.left canvas').count()===14&&await page.locator('.title-team.right canvas').count()===14);
 for(const [name,width,height] of [['desktop',1280,720],['landscape',844,390],['portrait',390,844]]){
  await page.setViewportSize({width,height});await page.screenshot({path:`artifacts/title-${name}-v8.png`});
 }
 await page.setViewportSize({width:1280,height:720});await page.keyboard.press('Enter');
 check('Enter starts title',await page.evaluate(()=>window.__ui.screen==='mode'));
 for(const [name,width,height] of [['desktop',1440,900],['desktop-small',1280,720],['landscape',844,390],['portrait',390,844]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(260);
  const clipped=await page.evaluate(()=>[...document.querySelectorAll('.mode-option,#modeNext,#difficulty')].filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1}).map(e=>e.dataset.mode||e.id));
  check(`enlarged mode selection fits ${name}`,clipped.length===0);await page.screenshot({path:`artifacts/modes-${name}-v13.png`});
  check(`mode selection expands across ${name}`,await page.locator('.mode-list').evaluate(e=>e.getBoundingClientRect().width>innerWidth*.9));
  check(`mode actions share its layout in ${name}`,await page.evaluate(()=>{
    const bar=document.querySelector('#modeScreen>.menu-footer');
    if(!bar||!bar.contains(document.querySelector('#modeNext')))return false;
    const rects=[...bar.querySelectorAll('button')].map(e=>e.getBoundingClientRect());
    return rects.every(r=>r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth)&&rects.every((a,i)=>rects.slice(i+1).every(b=>a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1));
  }));
 }
 await page.setViewportSize({width:1280,height:720});

 await page.locator('#difficulty').focus();await page.keyboard.press('w');
 check('W changes focused CPU difficulty',await page.locator('#difficulty').inputValue()==='easy');
 await page.keyboard.press('s');await page.locator('[data-mode="arcade"]').focus();
 await page.keyboard.press('s');check('S selects versus',await page.locator('[data-mode="versus"]').evaluate(e=>e.classList.contains('active')));
 await page.keyboard.press('w');await page.keyboard.press('ArrowDown');await page.keyboard.press('j');
 check('J confirms mode',await page.evaluate(()=>window.__ui.screen==='fighter'));
 for(const [name,width,height] of [['desktop',1440,900],['desktop-small',1280,720],['landscape',844,390],['portrait',390,844]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(260);
  const clipped=await page.evaluate(()=>[...document.querySelectorAll('.roster-grid,#fighterNext,.fighter-preview canvas')].filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1}).map(e=>e.id||e.className));
  check(`enlarged character selection fits ${name}`,clipped.length===0);await page.screenshot({path:`artifacts/selection-${name}-v13.png`});
  check(`character selection expands across ${name}`,await page.locator('.fighter-selection').evaluate(e=>e.getBoundingClientRect().width>innerWidth*.9));
  check(`fighter actions share its layout in ${name}`,await page.evaluate(()=>{
    const bar=document.querySelector('#fighterScreen>.menu-footer');
    if(!bar||!bar.contains(document.querySelector('#fighterNext')))return false;
    const rects=[...bar.querySelectorAll('button')].map(e=>e.getBoundingClientRect());
    return rects.every(r=>r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth)&&rects.every((a,i)=>rects.slice(i+1).every(b=>a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1));
  }));
  const rowsSeparate=await page.evaluate(()=>{
    const rows=[...document.querySelectorAll('.roster-fighter')].filter((_,i)=>i%4===0).map(e=>e.getBoundingClientRect());
    return rows.slice(1).every((row,i)=>row.top>=rows[i].bottom-1);
  });
  check(`roster rows do not overlap in ${name}`,rowsSeparate);
  await page.keyboard.press('ArrowLeft');
  const selectedVisible=await page.evaluate(()=>{
    const grid=document.querySelector('.roster-grid').getBoundingClientRect();
    const selected=document.querySelector(`[data-player="${window.__ui.selection.player}"]`).getBoundingClientRect();
    return selected.top>=grid.top-1&&selected.bottom<=grid.bottom+1;
  });
  check(`keyboard keeps last roster choice visible in ${name}`,selectedVisible);
  await page.keyboard.press('q');
  check(`switching sides keeps rival visible in ${name}`,await page.evaluate(()=>{
    const grid=document.querySelector('.roster-grid').getBoundingClientRect();
    const selected=document.querySelector(`[data-player="${window.__ui.selection.opponent}"]`).getBoundingClientRect();
    return selected.top>=grid.top-1&&selected.bottom<=grid.bottom+1;
  }));
  await page.keyboard.press('q');
  await page.keyboard.press('ArrowRight');
 }
 await page.setViewportSize({width:1280,height:720});

 await page.keyboard.press('d');check('D chooses Waggy',await page.evaluate(()=>window.__ui.selection.player==='bruno'));
 await page.keyboard.press('a');await page.keyboard.press('q');await page.keyboard.press('ArrowRight');
 check('arrows navigate rival after Q',await page.evaluate(()=>window.__ui.selection.opponent==='viihuugo'));
 await page.keyboard.press('ArrowLeft');await page.keyboard.press('Enter');
 check('Enter confirms fighters',await page.evaluate(()=>window.__ui.screen==='stage'));
 check('four arenas available',await page.locator('[data-stage]').count()===4);
 for(const [name,width,height] of [['desktop',1280,720],['landscape',844,390],['portrait',390,844]]){
  await page.setViewportSize({width,height});
  const clipped=await page.evaluate(()=>[...document.querySelectorAll('[data-stage],#startButton')].filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1}).map(e=>e.dataset.stage||e.id));
  check(`four arenas and start fit ${name}`,clipped.length===0);await page.screenshot({path:`artifacts/stage-select-${name}-v8.png`});
 }
 await page.setViewportSize({width:1280,height:720});await page.keyboard.press('a');
 check('A wraps to Manaus',await page.locator('[data-stage="3"]').evaluate(e=>e.classList.contains('selected')));
 await page.keyboard.press('k');check('K returns to fighter selection',await page.evaluate(()=>window.__ui.screen==='fighter'));
 await page.keyboard.press('j');await page.keyboard.press('j');await page.waitForFunction(()=>!!window.__ui.game,{},{timeout:60000});
 check('keyboard starts Manaus match',await page.evaluate(()=>window.__ui.game.stage===3));
 await page.keyboard.press('Escape');await page.keyboard.press('s');
 check('S navigates pause actions',await page.evaluate(()=>document.activeElement.id==='pauseOptionsButton'));
 await page.keyboard.press('w');await page.keyboard.press('Enter');
 check('Enter resumes selected pause action',await page.locator('#matchOverlay').isHidden());
 await page.keyboard.press('Escape');await page.keyboard.press('ArrowDown');await page.keyboard.press('j');
 check('pause opens in-game options',await page.locator('#controlsDialog').isVisible());
 await page.keyboard.press('Escape');await page.keyboard.press('ArrowDown');await page.keyboard.press('j');
 check('J confirms menu action',await page.evaluate(()=>window.__ui.screen==='mode'&&!window.__ui.game));
 check('no browser errors',report.errors.length===0);
}finally{await writeFile('artifacts/ui-v8.json',JSON.stringify(report,null,2));await browser.close();}
console.log(`PASS ${report.checks.length} UI checks`);
