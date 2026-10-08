import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {fighterIds} from '../src/roster.js';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const report={checks:[],errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
const check=(name,pass)=>{report.checks.push({name,pass:!!pass});assert.ok(pass,name);};
try {
  await page.goto('http://localhost:3187');
  await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);
  const cast=await page.locator('[data-title-player]').evaluateAll(items=>items.map(e=>e.dataset.titlePlayer));
  check('title contains every fighter exactly once',cast.length===fighterIds.length&&new Set(cast).size===fighterIds.length&&fighterIds.every(id=>cast.includes(id)));
  check('title splits roster equally',Math.abs(await page.locator('.title-team.left canvas').count()-await page.locator('.title-team.right canvas').count())<=1);
  await page.locator('#titleStart').click();await page.locator('#modeScreen .mode-option.active').click();
  await page.waitForFunction(()=>document.querySelector('#playerPowerDemo').dataset.demoReady==='true'&&document.querySelector('#opponentPowerDemo').dataset.demoReady==='true',null,{timeout:5000});
  check('both original fighters have live demos',true);
  check('menu demos do not own the playable fight',await page.evaluate(()=>!window.__fight));
  check('demo is below description',await page.evaluate(()=>['player','opponent'].every(prefix=>document.querySelector(`#${prefix}PowerDemo`).getBoundingClientRect().top>=document.querySelector(`#${prefix}Description`).getBoundingClientRect().bottom)));
  await page.waitForFunction(()=>document.querySelector('#playerPowerDemo').dataset.demoMove==='super');
  check('super label names the move and control',/I · SUPER · Rajada Sabre/.test(await page.locator('#playerDemoLabel').textContent()));
  await page.screenshot({path:'artifacts/selection-demo-super.png'});
  await page.waitForFunction(()=>document.querySelector('#playerPowerDemo').dataset.demoMove==='special');
  check('special returns after super',/U · ESPECIAL · Corte de energia/.test(await page.locator('#playerDemoLabel').textContent()));
  await page.locator('[data-player="naldo"]').click();
  await page.locator('[data-player="ana"]').click();
  await page.waitForFunction(()=>document.querySelector('#playerPowerDemo').dataset.demoReady==='true'&&document.querySelector('#playerPowerDemo').dataset.demoFighter==='ana');
  check('rapid selection uses the latest fighter',/Pulso gamer/.test(await page.locator('#playerDemoLabel').textContent()));
  check('published portraits populate all roster cards',await page.locator('[data-player]>img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0&&/assets\/sprites\/[^/]+\/portrait\.png$/.test(img.getAttribute('src')))));
  for(const [name,width,height] of [['desktop',1440,900],['landscape',844,390],['portrait',390,844]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(150);
    check(`demos and descriptions fit ${name}`,await page.evaluate(()=>[...document.querySelectorAll('.power-demo,.fighter-preview>p')].every(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1})));
    check(`cards are separated with compact gaps ${name}`,await page.evaluate(()=>{const g=document.querySelector('.roster-grid'),r=g.children[0].getBoundingClientRect();return parseFloat(getComputedStyle(g).gap)<=4&&r.height>=58}));
    await page.screenshot({path:`artifacts/selection-demo-${name}.png`});
  }
  await page.locator('#backButton').click();
  const before=await page.locator('#playerPowerDemo').evaluate(c=>c.toDataURL());
  await page.waitForTimeout(250);
  check('hidden demos stop rendering',before===await page.locator('#playerPowerDemo').evaluate(c=>c.toDataURL()));
  check('no page errors',report.errors.length===0);
} finally {
  await writeFile('artifacts/selection-demo.json',JSON.stringify(report,null,2));
  await browser.close();
}
console.log(`PASS ${report.checks.length} selection demonstration checks`);
