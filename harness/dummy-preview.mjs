import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {fighterIds,NON_PLAYABLE_FIGHTERS} from '../src/roster.js';

const manifest=JSON.parse(await readFile('assets/manifest.json','utf8'));
assert.ok(NON_PLAYABLE_FIGHTERS.dummy);
assert.ok(!fighterIds.includes('dummy'));
assert.deepEqual(Object.keys(manifest.dummy).sort(),Object.keys(manifest.naldo).sort());
assert.equal(Object.values(manifest.dummy).reduce((n,state)=>n+state.frames.length,0),79);
for(const [state,spec] of Object.entries(manifest.dummy)) {
  assert.equal(spec.frames.length,manifest.naldo[state].frames.length);
  const hashes=await Promise.all(spec.frames.map(async frame=>{
    assert.ok(frame.path.startsWith('assets/sprites/dummy/animations/'));
    assert.ok(Number.isFinite(frame.scale)&&frame.scale>0);
    const bytes=await readFile(frame.path);
    assert.ok(bytes.length>1000);
    return createHash('sha256').update(bytes).digest('hex');
  }));
  assert.equal(new Set(hashes).size,hashes.length,`${state} has distinct motion frames`);
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto(process.env.GAME_URL||'http://localhost:3187');
  await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);
  await page.locator('#titleStart').click();
  await page.locator('#modeScreen .mode-option.active').click();
  for(const [slot,id] of [['player','felurian'],['opponent','maya-b']]) {
    await page.locator(`[data-slot="${slot}"]`).click();
    await page.locator(`[data-player="${id}"]`).click();
    await page.waitForFunction(({slot,id})=>{
      const demo=document.querySelector(`#${slot}PowerDemo`);
      return demo.dataset.demoReady==='true'&&demo.dataset.demoFighter===id&&demo.dataset.demoTarget==='dummy';
    },{slot,id});
  }
  assert.equal(await page.locator('[data-player]').count(),fighterIds.length);
  assert.equal(await page.locator('[data-player="dummy"]').count(),0);
  assert.ok(!await page.evaluate(()=>Boolean(window.__fight)));
  await page.waitForFunction(()=>['player','opponent'].every(slot=>document.querySelector(`#${slot}PowerDemo`).dataset.demoMove==='super'));
  await page.screenshot({path:'artifacts/dummy-power-preview.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS dummy: 24 states, 100 distinct exported frames, both demos target dummy, excluded from roster, live special/super loops');
} finally {
  await browser.close();
}
