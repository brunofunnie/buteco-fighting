import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.GAME_URL||'http://127.0.0.1:3199';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage(),session=await page.context().newCDPSession(page),requests=[];
 let bytes=0,finished=0;
 await session.send('Network.enable');
 session.on('Network.loadingFinished',event=>{bytes+=event.encodedDataLength;finished++;});
 page.on('request',request=>requests.push(new URL(request.url()).pathname));
 const started=Date.now();
 await page.goto(base);await page.waitForFunction(()=>window.__ui?.assets&&!document.querySelector('#titleStart').disabled);
 await page.waitForTimeout(500);
 assert.ok(bytes<20*1024*1024,`Startup transferred ${bytes} bytes`);
 assert.ok(!requests.some(path=>/\/animations\//.test(path)),'Combat animations must wait for selection or battle');
 assert.ok(!requests.some(path=>/\/assets\/stages\/.*\.(png|webp)$/.test(path)),'Arena art must wait for arena selection or battle');
 assert.ok(!requests.some(path=>/\/sprites\/joke-l\//.test(path)),'Unselected fighter must not load at startup');
 const first=await fetch(base+'/assets/title/crowd.png');assert.equal(first.status,200);assert.ok(first.headers.get('etag'));await first.arrayBuffer();
 const cached=await fetch(base+'/assets/title/crowd.png',{headers:{'If-None-Match':first.headers.get('etag')}});assert.equal(cached.status,304);assert.equal((await cached.arrayBuffer()).byteLength,0);
 const compressed=await fetch(base+'/src/collision-data.js',{headers:{'Accept-Encoding':'gzip'}});assert.equal(compressed.status,200);assert.equal(compressed.headers.get('content-encoding'),'gzip');assert.match(await compressed.text(),/COLLISION_DATA/);
 console.log(JSON.stringify({requests:finished,bytes,readyMs:Date.now()-started}));
 await page.click('#titleStart');await page.click('[data-mode="free"]');await page.click('[data-player="joke-l"]');
 await page.waitForTimeout(800);
 await page.waitForFunction(()=>{const c=document.querySelector('#playerPreview'),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let count=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>32)count++;return window.__ui.selection.player==='joke-l'&&count>1000;});
 console.log('PASS deferred combat/arena/unselected portraits, lazy selected portrait, bounded startup transfer, conditional cache and compressed code');
}finally{await browser.close();}
