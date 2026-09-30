import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const host=await browser.newPage({viewport:{width:1440,height:900}}),guest=await browser.newPage({viewport:{width:1280,height:720}});
const viewer=await browser.newPage({viewport:{width:1280,height:720}});
const errors=[];for(const page of [host,guest,viewer])page.on('pageerror',e=>errors.push(e.message));
const base=process.env.GAME_URL||'http://127.0.0.1:3194';
let rankingRequests=0;host.on('request',req=>{if(req.url().endsWith('/api/ranking'))rankingRequests++;});
const enter=async page=>{await page.goto(base);await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);await page.locator('#titleStart').click();await page.locator('[data-mode="online"]').click();await page.locator('#modeNext').click();};
const create=async name=>{await host.locator('#createRoom').click();await host.locator('#createRoomDialog').waitFor({state:'visible'});await host.locator('#onlineName').fill(name);await host.locator('#confirmCreateRoom').click();await host.waitForFunction(()=>window.__ui.online.lobby?.players.length===1);return host.locator('#roomId').textContent();};
try {
  await Promise.all([enter(host),enter(guest)]);assert.ok(await host.locator('#onlineName').isHidden());assert.equal(await host.locator('#refreshRanking').count(),0);
  await host.waitForFunction(()=>!window.__ui.online.rankingPending); // Rapid reopen uses cached state.
  assert.equal(rankingRequests,1);await host.locator('#backButton').click();await host.locator('#modeNext').click();assert.equal(rankingRequests,1);
  await host.locator('#createRoom').click();await host.keyboard.press('Escape');assert.ok(await host.locator('#createRoomDialog').isHidden());
  await host.setViewportSize({width:390,height:844});
  await host.locator('#createRoom').click();await host.locator('#createRoomDialog').waitFor({state:'visible'});
  assert.equal(await host.locator('#createRoomDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  await mkdir('/tmp/buteco-online',{recursive:true});await host.screenshot({path:'/tmp/buteco-online/nickname-mobile.png'});await host.locator('#cancelCreateRoom').click();
  const id=await create('Flow host');await guest.locator('#roomCode').fill(id);await guest.locator('#joinRoom').click();await host.waitForFunction(()=>window.__ui.online.lobby?.players.length===2);
  assert.equal(await guest.evaluate(()=>window.__ui.screen),'online');assert.equal(await guest.locator('#onlineStart').isHidden(),true);assert.equal(await host.locator('#onlineFighter').count(),0);assert.equal(await host.locator('#onlineStage').count(),0);
  await host.waitForFunction(()=>window.__ui.online.lobby.players.every(p=>typeof p.ping==='number'));
  assert.equal(await host.locator('.player-ping').count(),2);assert.match(await host.locator('#roomPlayers').textContent(),/\d+ ms/);
  assert.equal(await host.locator('#onlineScreen').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  assert.ok(await host.locator('.player-ping:is([data-quality="good"], [data-quality="fair"], [data-quality="slow"], [data-quality="poor"])').count()>0);
  await host.screenshot({path:'/tmp/buteco-online/lobby-ping-mobile.png'});await host.setViewportSize({width:1440,height:900});
  await enter(viewer);await viewer.locator('#refreshRooms').click();
  const listing=viewer.locator('.room-list-row').filter({hasText:id});await listing.getByRole('button',{name:'ASSISTIR',exact:true}).click();
  await viewer.waitForFunction(()=>window.__ui.online.slot===null&&window.__ui.online.lobby?.spectators.length===1);
  await host.locator('#onlineStart').click();await Promise.all([host.waitForFunction(()=>window.__ui.screen==='fighter'),guest.waitForFunction(()=>window.__ui.screen==='fighter')]);
  await viewer.waitForFunction(()=>window.__ui.screen==='fighter');assert.ok(await viewer.locator('#fighterNext').isDisabled());
  assert.ok(await host.locator('#opponentSlot').isDisabled());assert.ok(await guest.locator('[data-slot="player"]').isDisabled());
  await host.locator('[data-player="bruno"]').click();await guest.waitForFunction(()=>window.__ui.selection.player==='bruno');
  await guest.locator('[data-player="miranda"]').click();await host.waitForFunction(()=>window.__ui.selection.opponent==='miranda');assert.equal(await host.evaluate(()=>window.__ui.selection.player),'bruno');
  await host.locator('#fighterNext').click();await host.waitForFunction(()=>document.querySelector('#fighterNext').disabled);assert.equal(await guest.evaluate(()=>window.__ui.screen),'fighter');
  await guest.locator('#fighterNext').click();await Promise.all([host.waitForFunction(()=>window.__ui.screen==='stage'),guest.waitForFunction(()=>window.__ui.screen==='stage')]);
  assert.ok(await guest.locator('#startButton').isDisabled());assert.ok(await guest.locator('[data-stage="1"]').isDisabled());
  await host.locator('[data-stage="1"]').click();await guest.waitForFunction(()=>window.__ui.selection.stage===1);assert.match(await guest.locator('#stageScreen').evaluate(el=>el.style.getPropertyValue('--stage-background')),/rio/);
  await viewer.waitForFunction(()=>window.__ui.screen==='stage'&&window.__ui.selection.stage===1);assert.ok(await viewer.locator('#startButton').isDisabled());
  await viewer.locator('#backButton').click();await viewer.waitForFunction(()=>!window.__ui.online.room);assert.equal(await host.evaluate(()=>window.__ui.online.lobby.phase),'stage');
  await mkdir('/tmp/buteco-online',{recursive:true});await host.screenshot({path:'/tmp/buteco-online/shared-stage.png'});
  if(process.env.ONLINE_SMOKE==='1'){
    await host.locator('#backButton').click();await host.waitForFunction(()=>window.__ui.screen==='fighter');await host.locator('#backButton').click();await host.waitForFunction(()=>window.__ui.screen==='online');
    assert.equal(await host.locator('#roomId').textContent(),id);await host.locator('#onlineKick').click();await guest.waitForFunction(()=>!window.__ui.online.room);await host.locator('#leaveRoom').click();
    console.log('PASS public nickname modal, cached ranking, server ping, shared character/stage selection, host permissions and same-room cancellation');
  }else{
    await host.locator('#startButton').click();await host.waitForFunction(()=>window.__ui.screen==='versus');await guest.waitForFunction(()=>window.__ui.screen==='versus');
    await host.waitForFunction(()=>window.__ui.online.lobby.phase==='fighting');await host.waitForFunction(()=>window.__fight.phase==='fight');
    await enter(viewer);await viewer.locator('#roomCode').fill(id);await viewer.locator('#watchRoom').click();
    await viewer.waitForFunction(()=>window.__ui.screen==='fight'&&window.__fight.phase==='fight');
    assert.match(await viewer.locator('#matchLabel').textContent(),/ESPECTADOR/);
    assert.equal(await viewer.evaluate(()=>window.__ui.online.slot),null);
    await viewer.keyboard.press('j');await viewer.evaluate(()=>window.__ui.online.room.send('cancelSelection'));
    await host.waitForFunction(()=>window.__ui.online.lobby.spectators.length===1);assert.equal(await host.evaluate(()=>window.__ui.online.lobby.phase),'fighting');
    await viewer.screenshot({path:'/tmp/buteco-online/spectator-fight.png'});
    await host.keyboard.press('w');await host.waitForFunction(()=>window.__fight.fighters[0].y<590);await host.keyboard.press('j');await host.waitForFunction(()=>window.__fight.fighters[0].action==='airPunch');
    await guest.close();await host.waitForFunction(()=>window.__ui.screen==='online'&&window.__ui.online.lobby.players.length===1);assert.equal(await host.locator('#roomId').textContent(),id);assert.match(await host.locator('#onlineStatus').textContent(),/venceu/);
    await viewer.waitForFunction(()=>window.__ui.screen==='online');assert.equal(await viewer.locator('#roomId').textContent(),id);
    await viewer.locator('#leaveRoom').click();assert.equal(await host.evaluate(()=>window.__ui.online.lobby.phase),'waiting');
    await host.locator('#leaveRoom').click();await host.locator('#onlineEntry').waitFor({state:'visible'});
    // Modal creation and the canceled connection still use one generation.
    await host.evaluate(()=>{const online=window.__ui.online,create=online.client.create.bind(online.client);online.client.create=async(...args)=>{window.__pendingCreate=true;await new Promise(resolve=>window.__releaseCreate=resolve);return create(...args);};});
    await host.locator('#createRoom').click();await host.locator('#onlineName').fill('Flow host');await host.locator('#confirmCreateRoom').click();await host.waitForFunction(()=>window.__pendingCreate);await host.locator('#backButton').click();await host.evaluate(()=>window.__releaseCreate());await host.waitForFunction(()=>!window.__ui.online.busy);assert.equal(await host.evaluate(()=>window.__ui.screen),'mode');assert.ok(!(await host.evaluate(()=>window.__ui.online.room)));
    console.log('PASS modal-only nickname, automatic/throttled ranking, independent shared selections, host-only stage, versus, live fight, ping and same-room result return');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
