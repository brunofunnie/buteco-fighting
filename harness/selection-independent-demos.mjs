import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto(process.env.GAME_URL||'http://localhost:3187');
  await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);
  await page.locator('#titleStart').click();
  await page.locator('#modeScreen .mode-option.active').click();
  for(const [slot,other,id] of [['player','opponent','felurian'],['opponent','player','maya-b']]) {
    await page.locator(`[data-slot="${slot}"]`).click();
    await page.waitForFunction(other=>document.querySelector(`#${other}PowerDemo`).dataset.demoMove==='super',other);
    await page.evaluate(other=>{
      window.demoResets=[];
      window.demoObserver?.disconnect();
      window.demoObserver=new MutationObserver(changes=>window.demoResets.push(...changes.map(c=>c.attributeName)));
      window.demoObserver.observe(document.querySelector(`#${other}PowerDemo`),{attributes:true,attributeFilter:['data-demo-ready','data-demo-fighter']});
    },other);
    await page.locator(`[data-player="${id}"]`).click();
    await page.waitForFunction(({slot,id})=>{
      const c=document.querySelector(`#${slot}PowerDemo`);
      return c.dataset.demoReady==='true'&&c.dataset.demoFighter===id;
    },{slot,id});
    assert.deepEqual(await page.evaluate(()=>window.demoResets),[],`${slot} selection must not restart ${other} demo`);
    assert.equal(await page.locator(`#${other}PowerDemo`).getAttribute('data-demo-move'),'super');
  }
  await page.locator('[data-slot="player"]').click();
  await page.locator('[data-player="naldo"]').click();
  await page.locator('[data-slot="opponent"]').click();
  await page.locator('[data-player="ana"]').click();
  await page.waitForFunction(()=>['player','opponent'].every((slot,i)=>{
    const c=document.querySelector(`#${slot}PowerDemo`);
    return c.dataset.demoReady==='true'&&c.dataset.demoFighter===['naldo','ana'][i];
  }));
  await page.locator('#backButton').click();
  for(const slot of ['player','opponent'])assert.equal(await page.locator(`#${slot}PowerDemo`).getAttribute('data-demo-ready'),'false');
  await page.locator('#modeScreen .mode-option.active').click();
  await page.waitForFunction(()=>['player','opponent'].every(slot=>document.querySelector(`#${slot}PowerDemo`).dataset.demoReady==='true'));
  assert.deepEqual(errors,[]);
  console.log('PASS independent demos, preserved super playback, rapid changes across slots, cleanup and re-entry');
} finally {
  await browser.close();
}
