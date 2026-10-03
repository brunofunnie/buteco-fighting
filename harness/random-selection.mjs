import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const b=await chromium.launch({args:['--no-sandbox']});
try {
 const p=await b.newPage({viewport:{width:1440,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL||'http://localhost:3197');await p.locator('#titleStart').click();await p.locator('#modeScreen .mode-option.active').click();
 assert.equal(await p.locator('[data-random-pick]:visible').count(),1);
 assert.equal(await p.locator('[data-random-pick="1"]').isVisible(),false);
 for(const [side,id]of [['0','king-luiz']]){
  const random=await p.locator(`[data-random-pick="${side}"]`).boundingBox(),fighter=await p.locator(`[data-player="${id}"]`).boundingBox();
  assert.ok(random.y+random.height/2<fighter.y+fighter.height/2);
  assert.ok(Math.abs(random.x+random.width/2-fighter.x-fighter.width/2)<20);
 }
 await p.locator('[data-slot=opponent]').click();assert.equal(await p.locator('[data-random-pick]:visible').count(),1);assert.equal(await p.locator('[data-random-pick="1"]').isVisible(),false);
 await p.locator('[data-slot=player]').click();
 await p.evaluate(async()=>{
  const {audioDirector}=await import('./src/audio.js');const play=audioDirector.play.bind(audioDirector);window.selectionSounds=0;audioDirector.play=(key,...args)=>{if(key==='select')window.selectionSounds++;return play(key,...args);};
  window.cursorPicks=[];window.cursorObserver=new MutationObserver(()=>{const selected=document.querySelector('.random-cursor');if(selected)window.cursorPicks.push(selected.dataset.player)});window.cursorObserver.observe(document.querySelector('#fighterScreen'),{subtree:true,attributes:true,attributeFilter:['class']});
 });
 const original=await p.locator('#playerName').textContent();
 await p.locator('[data-random-pick="0"]').hover();
 await p.waitForFunction(()=>document.querySelector('#playerPreview').dataset.previewState==='random');
 assert.equal(await p.locator('#playerName').textContent(),'Aleatório');
 assert.equal(await p.locator('#fighterScreen').getAttribute('aria-busy'),null,'hover does not start the roulette');
 await p.mouse.move(720,100);
 await p.waitForFunction(()=>document.querySelector('#playerName').textContent!=='Aleatório');
 assert.equal(await p.locator('#playerName').textContent(),original);
 const start=Date.now();
 await p.locator('[data-random-pick="0"]').click();assert.equal(await p.locator('#fighterNext').isDisabled(),true);
 await p.waitForTimeout(1400);assert.equal(await p.locator('#playerName').textContent(),'Aleatório');
 assert.equal(await p.locator('#playerPreview').getAttribute('data-preview-state'),'random');
 assert.equal(await p.locator('#opponentPreview').getAttribute('data-preview-state'),'portrait');
 const silhouette=await p.locator('#playerPreview').evaluate(c=>{
  const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let black=0,gold=0;
  for(let i=0;i<d.length;i+=4){if(d[i+3]>200&&d[i]<5&&d[i+1]<5&&d[i+2]<5)black++;if(d[i+3]>200&&d[i]>200&&d[i+1]>100&&d[i+1]<220&&d[i+2]<70)gold++;}
  return {black,gold};
 });assert.ok(silhouette.black>5000&&silhouette.gold>500,'black dummy and gold question mark');
 await p.screenshot({path:'artifacts/random-dummy-silhouette.png'});
 await p.waitForFunction(()=>!document.querySelector('#fighterScreen').hasAttribute('aria-busy'));
 assert.ok(Date.now()-start>=2900&&Date.now()-start<4200);
 assert.ok(await p.evaluate(()=>window.selectionSounds>=20&&new Set(window.cursorPicks).size>=10));
 assert.equal(await p.locator('.random-cursor').count(),0);assert.equal(await p.locator('#fighterNext').isDisabled(),false);
 await p.screenshot({path:'artifacts/random-selection-desktop.png'});
 await p.locator('[data-random-pick="0"]').focus();assert.equal(await p.locator('#playerName').textContent(),'Aleatório');await p.keyboard.press('Enter');assert.equal(await p.locator('#fighterScreen').getAttribute('aria-busy'),'true');
 await p.locator('#backButton').click();await p.waitForTimeout(3200);assert.equal(await p.locator('.random-cursor').count(),0);
 await p.locator('[data-mode=versus]').click();assert.equal(await p.locator('[data-random-pick]:visible').count(),2);
 for(const [side,id]of [['0','king-luiz'],['1','maya-b']]){
  const random=await p.locator(`[data-random-pick="${side}"]`).boundingBox(),fighter=await p.locator(`[data-player="${id}"]`).boundingBox();
  assert.ok(random.y+random.height/2<fighter.y+fighter.height/2);
  assert.ok(Math.abs(random.x+random.width/2-fighter.x-fighter.width/2)<20);
 }
 const p1=await p.evaluate(()=>window.__ui.selection.player);
 assert.ok(await p.locator('[data-slot=player]').evaluate(el=>el.classList.contains('active')));
 await p.locator('[data-random-pick="1"]').hover();assert.equal(await p.locator('#opponentName').textContent(),'Aleatório');
 assert.equal(await p.evaluate(()=>window.__ui.selection.player),p1);
 await p.locator('[data-random-pick="1"]').click();await p.waitForTimeout(800);assert.equal(await p.locator('#opponentPreview').getAttribute('data-preview-state'),'random');await p.waitForFunction(()=>!document.querySelector('#fighterScreen').hasAttribute('aria-busy'));assert.equal(await p.evaluate(()=>window.__ui.selection.player),p1);assert.notEqual(await p.locator('#opponentName').textContent(),'Aleatório');
 await p.setViewportSize({width:390,height:844});assert.ok(await p.locator('#arcade').evaluate(el=>el.scrollWidth<=el.clientWidth));await p.screenshot({path:'artifacts/random-selection-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS immediate hover/focus silhouette and Aleatório label, side-specific P1/P2 cards, hidden for CPU, three-second cursor/sound roulette, delayed commit, keyboard activation, cancellation, human P2 and mobile');
}finally{await b.close();}
