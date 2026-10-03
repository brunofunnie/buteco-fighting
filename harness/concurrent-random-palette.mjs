import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const b=await chromium.launch({args:['--no-sandbox']});
try{
 const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL||'http://localhost:3197');await p.locator('#titleStart').click();await p.locator('[data-mode=versus]').click();
 await p.locator('[data-random-pick="0"]').click();await p.waitForTimeout(600);await p.locator('[data-random-pick="1"]').click();
 assert.equal(await p.locator('#playerName').textContent(),'Aleatório');assert.equal(await p.locator('#opponentName').textContent(),'Aleatório');assert.equal(await p.locator('.random-cursor-player').count(),1);assert.equal(await p.locator('.random-cursor-opponent').count(),1);
 await p.waitForFunction(()=>document.querySelector('#playerName').textContent!=='Aleatório');assert.equal(await p.locator('#fighterNext').isDisabled(),true);assert.equal(await p.locator('#opponentName').textContent(),'Aleatório');
 const p1=await p.evaluate(()=>window.__ui.selection.player);await p.waitForFunction(()=>!document.querySelector('#fighterScreen').hasAttribute('aria-busy'));assert.equal(await p.evaluate(()=>window.__ui.selection.player),p1);assert.equal(await p.locator('#fighterNext').isDisabled(),false);assert.equal(await p.locator('.random-cursor').count(),0);
 await p.locator('[data-slot=player]').click();await p.locator('[data-player=bruno]').click();await p.locator('[data-slot=opponent]').click();await p.locator('[data-player=bruno]').click();await p.waitForTimeout(800);
 assert.deepEqual(await p.evaluate(()=>[window.__ui.selection.player,window.__ui.selection.opponent]),['bruno','bruno']);
 await p.screenshot({path:'artifacts/mirror-palette-selection.png'});
 const delta=await p.evaluate(async()=>{const {alternateSprite}=await import('./src/alternate-palette.js');const image=new Image();image.src=document.querySelector('[data-player=bruno] img').src;await image.decode();const alternate=alternateSprite(image),c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const original=ctx.getImageData(0,0,c.width,c.height).data,next=alternate.getContext('2d').getImageData(0,0,c.width,c.height).data;let changed=0;for(let i=0;i<next.length;i+=4){if(original[i]!==next[i])changed++;if(original[i+3]!==next[i+3])throw new Error('alpha changed');}return changed;});assert.ok(delta>1000);
 await p.locator('#fighterNext').click();await p.locator('[data-stage="0"]').click();await p.waitForFunction(()=>window.__fight?.running);await p.evaluate(()=>{window.__fight.inspectionPaused=true;window.__fight.debugForce({phase:'fight',cpu:false});window.__fight.draw();});await p.screenshot({path:'artifacts/mirror-palette-fight.png'});assert.deepEqual(errors,[]);
 console.log('PASS concurrent independent random selection, staggered finish/confirmation, mirror selection, cached clothing tint with preserved alpha, battle rendering');
}finally{await b.close();}
