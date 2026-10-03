import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({args:['--no-sandbox']});
const sequence=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  await page.route('**/assets/manifest.json',async route=>{const response=await route.fetch(),manifest=await response.json();delete manifest.devon;await route.fulfill({response,json:manifest});});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.GAME_URL||'http://localhost:3197');
  await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);
  const enterCode=async()=>{await page.waitForTimeout(80);for(const key of sequence)await page.keyboard.press(key);};
  await enterCode();assert.equal(await page.locator('#secretMenu').isVisible(),false,'Title rejects code');
  await page.click('#titleStart');await enterCode();assert.equal(await page.locator('#secretMenu').isVisible(),false,'Mode selection rejects code');
  await page.click('[data-mode=versus]');await page.locator('#fighterNext').focus();await enterCode();
  assert.equal(await page.locator('#secretMenu').isVisible(),true,'Konami Code opens the tools popup');
  assert.equal(await page.locator('[data-secret-action="devon"]').isDisabled(),true,'Unpublished Devon cannot start a substitute fight');
  assert.match(await page.locator('#secretMenu').innerText(),/Devon.*preparação/s);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#secretMenu').isVisible(),false);
  assert.equal(await page.evaluate(()=>Boolean(document.activeElement.closest('#fighterScreen'))),true,'Closing restores focus to character selection');
  await page.keyboard.press('ArrowUp');await page.keyboard.press('x');for(const key of sequence.slice(1))await page.keyboard.press(key);
  assert.equal(await page.locator('#secretMenu').isVisible(),false,'Wrong sequence does not open popup');
  await page.evaluate(async()=>{
    const {registerSecretAction}=await import('./src/secret-menu.js');
    window.removeSecretAction=registerSecretAction({id:'test-tool',label:'Ferramenta de teste',description:'Ação registrada sem alterar o popup.',run:async()=>{window.secretCalls=(window.secretCalls||0)+1;await new Promise(resolve=>setTimeout(resolve,80));throw new Error('Falha recuperável');}});
  });
  await enterCode();assert.equal(await page.locator('[data-secret-action="test-tool"]').isVisible(),true);
  await page.locator('[data-secret-action="test-tool"]').click();
  await page.waitForFunction(()=>document.querySelector('#secretMenuStatus').textContent==='Falha recuperável');
  assert.equal(await page.evaluate(()=>window.secretCalls),1);assert.equal(await page.locator('#secretMenu').isVisible(),true);
  await page.evaluate(()=>window.removeSecretAction());assert.equal(await page.locator('[data-secret-action="test-tool"]').count(),0);
  await page.keyboard.press('Escape');await enterCode();
  await page.screenshot({path:'artifacts/konami-menu.png'});await page.keyboard.press('Escape');

  await page.locator('#fighterNext').click();await page.locator('.arena.selected').click();await page.waitForFunction(()=>window.__fight?.running);
  await page.evaluate(()=>window.__fight.debugForce({phase:'fight',cpu:false}));await enterCode();
  assert.equal(await page.locator('#secretMenu').isVisible(),false,'Fight rejects code');
  assert.equal(await page.evaluate(()=>window.__fight.paused),false);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__fight.paused),true);
  const paintedPause=await page.evaluate(()=>{
    const game=window.__fight,ctx=game.ctx,original=ctx.fillText,texts=[];
    ctx.fillText=function(text,...args){texts.push(String(text));return original.call(this,text,...args);};
    try{game.draw();}finally{ctx.fillText=original;}
    return texts.some(text=>text==='PAUSADO'||text==='ESC PARA CONTINUAR');
  });
  assert.equal(paintedPause,false,'Paused canvas must not paint another pause prompt behind the front menu');
  assert.equal(await page.locator('#overlayTitle').textContent(),'PAUSADO');
  await page.screenshot({path:'artifacts/pause-single-menu.png'});
  await enterCode();assert.equal(await page.locator('#secretMenu').isVisible(),false,'Pause rejects code');
  await page.click('#menuButton');await page.click('[data-mode=versus]');
  await page.setViewportSize({width:390,height:844});await enterCode();
  assert.ok(await page.locator('#secretMenu').evaluate(el=>el.getBoundingClientRect().width<=innerWidth));
  await page.screenshot({path:'artifacts/konami-menu-mobile.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS Konami recognition, modal focus, unavailable boss, extensible actions, recoverable failures, selection-only access, unchanged pause and mobile layout');
}finally{await browser.close();}
