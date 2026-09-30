import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const pages=[await browser.newPage({viewport:{width:1440,height:900}}),await browser.newPage({viewport:{width:1280,height:720}})];
const errors=[];pages.forEach(p=>p.on('pageerror',e=>errors.push(e.message)));
const base=process.env.GAME_URL||'http://127.0.0.1:3194';
const enter=async(page,name)=>{await page.goto(base);await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);await page.locator('#titleStart').click();await page.locator('[data-mode="online"]').click();await page.locator('#modeNext').click();await page.locator('#onlineName').fill(name);};
try {
  const [host,guest]=pages;
  await Promise.all([enter(host,'Host browser'),enter(guest,'Guest browser')]);
  assert.equal(await host.locator('meta[property="og:image"]').getAttribute('content'),'https://fighting.butecodosdevs.com/assets/social/buteco-fighting-og.png');
  const image=await host.request.get(base+'/assets/social/buteco-fighting-og.png');assert.equal(image.status(),200);assert.equal(image.headers()['content-type'],'image/png');
  await host.locator('#createRoom').click();await host.waitForFunction(()=>window.__ui.online.room&&window.__ui.online.lobby?.players.length===1);
  const id=await host.locator('#roomId').textContent();await guest.locator('#roomCode').fill(id);await guest.locator('#joinRoom').click();
  await host.waitForFunction(()=>window.__ui.online.lobby?.players.length===2);await guest.waitForFunction(()=>window.__ui.online.slot===1);
  assert.ok(await guest.locator('#onlineStart').isHidden());assert.ok(await guest.locator('#onlineKick').isHidden());assert.ok(await guest.locator('#onlineStage').isDisabled());
  await host.locator('#onlineKick').click();await guest.waitForFunction(()=>!window.__ui.online.room);assert.match(await guest.locator('#onlineStatus').textContent(),/expulso/);
  await guest.locator('#joinRoom').click();await guest.waitForFunction(()=>document.querySelector('#onlineStatus').textContent.includes('Não foi possível'));assert.match(await guest.locator('#onlineStatus').textContent(),/expulso/);
  const challenger=await browser.newPage({viewport:{width:390,height:844}});pages.push(challenger);challenger.on('pageerror',e=>errors.push(e.message));
  await enter(challenger,'Challenger browser');await challenger.locator('#roomCode').fill(id);await challenger.locator('#joinRoom').click();await host.waitForFunction(()=>window.__ui.online.lobby?.players.length===2);
  await host.locator('#onlineStage').selectOption('1');await challenger.waitForFunction(()=>window.__ui.online.lobby?.stage===1);
  assert.equal(await challenger.locator('#onlineScreen').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  await mkdir('/tmp/buteco-online',{recursive:true});await host.screenshot({path:'/tmp/buteco-online/lobby.png'});await challenger.screenshot({path:'/tmp/buteco-online/lobby-mobile.png'});
  if(process.env.ONLINE_SMOKE==='1'){await challenger.locator('#leaveRoom').click();await host.locator('#leaveRoom').click();console.log('PASS public OG, two-client Colyseus lobby, ownership, kick/ban and stage sync');}
  else {
    await host.locator('#onlineReady').click();await challenger.locator('#onlineReady').click();await host.locator('#onlineStart').click();
    await Promise.all([host.waitForFunction(()=>window.__fight?.options.online&&window.__ui.online.lobby?.phase==='fighting'),challenger.waitForFunction(()=>window.__fight?.options.online&&window.__ui.online.lobby?.phase==='fighting')]);
    await host.waitForFunction(()=>window.__fight.phase==='fight');
    const x=await challenger.evaluate(()=>window.__fight.fighters[1].x);await challenger.keyboard.down('ArrowLeft');await challenger.waitForTimeout(200);
    assert.equal(await challenger.evaluate(()=>window.__fight.fighters[1].x),x,'P2 keyboard map must not drive remote opponent');await challenger.keyboard.up('ArrowLeft');
    await challenger.keyboard.down('a');await challenger.waitForTimeout(200);await challenger.keyboard.up('a');
    assert.ok(await host.evaluate(x=>window.__fight.fighters[1].x<x,x),'challenger uses their own P1 settings, server maps seat P2');
    await host.keyboard.press('w');await host.waitForFunction(()=>window.__fight.fighters[0].y<590);
    await host.keyboard.press('j');await host.waitForFunction(()=>window.__fight.fighters[0].action==='airPunch');
    await host.keyboard.press('Escape');assert.ok(await host.locator('#matchOverlay').isVisible());assert.match(await host.locator('#overlayDescription').textContent(),/continua/);await host.keyboard.press('Escape');
    await host.screenshot({path:'/tmp/buteco-online/fight.png'});
    await challenger.close();await host.waitForFunction(()=>document.querySelector('#rankingRows').textContent.includes('Host browser'));
    assert.match(await host.locator('#rankingRows').textContent(),/Host browser/);
    await host.locator('#leaveRoom').click();await host.locator('#onlineEntry').waitFor({state:'visible'});
    await host.reload();await host.waitForFunction(()=>!document.querySelector('#titleStart').disabled);await host.locator('#titleStart').click();await host.locator('[data-mode="online"]').click();await host.locator('#modeNext').click();assert.equal(await host.locator('#onlineName').inputValue(),'Host browser');
    // Returning during a pending connection must dispose the late room.
    await host.evaluate(()=>{const online=window.__ui.online,create=online.client.create.bind(online.client);online.client.create=async(...args)=>{window.__pendingCreate=true;await new Promise(resolve=>window.__releaseCreate=resolve);return create(...args);};});
    await host.locator('#createRoom').click();await host.waitForFunction(()=>window.__pendingCreate);await host.locator('#backButton').click();await host.evaluate(()=>window.__releaseCreate());await host.waitForFunction(()=>!window.__ui.online.busy);
    assert.equal(await host.evaluate(()=>window.__ui.screen),'mode');assert.ok(!(await host.evaluate(()=>window.__ui.online.room)));
    // A canceled match must not reopen once asynchronous preparation finishes.
    await host.reload();await host.waitForFunction(()=>!document.querySelector('#titleStart').disabled);await host.locator('#titleStart').click();await host.locator('[data-mode="online"]').click();await host.locator('#modeNext').click();
    await host.locator('#createRoom').click();await host.waitForFunction(()=>window.__ui.online.lobby?.players.length===1);const nextId=await host.locator('#roomId').textContent();
    await guest.locator('#roomCode').fill(nextId);await guest.locator('#joinRoom').click();await host.waitForFunction(()=>window.__ui.online.lobby?.players.length===2);
    await host.evaluate(()=>{const online=window.__ui.online,prepare=online.callbacks.prepare;online.callbacks.prepare=async config=>{window.__pendingPrepare=true;await new Promise(resolve=>window.__releasePrepare=resolve);return prepare(config);};});
    await host.locator('#onlineReady').click();await guest.locator('#onlineReady').click();await host.locator('#onlineStart').click();await host.waitForFunction(()=>window.__pendingPrepare);
    await guest.evaluate(()=>window.__ui.online.leave());await host.waitForFunction(()=>window.__ui.online.lobby?.phase==='waiting');await host.evaluate(()=>window.__releasePrepare());await host.waitForTimeout(100);
    assert.equal(await host.evaluate(()=>window.__ui.screen),'online');assert.ok(!(await host.evaluate(()=>window.__ui.game)));await host.locator('#leaveRoom').click();
    console.log('PASS OG image/meta, online mode, two-browser lobby, kick/ban, permissions, stage sync, responsive layout, real network fight, local controls, pause notice, forfeit ranking, identity persistence and canceled connection/loading races');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
