import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const manifest=JSON.parse(await readFile('assets/manifest.json','utf8'));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const report={checks:[],errors:[]};page.on('pageerror',e=>report.errors.push(e.message));
const check=(name,pass,details)=>{report.checks.push({name,pass:!!pass,details});assert.ok(pass,name);};
let releaseFirst,releaseOthers;
const firstGate=new Promise(r=>releaseFirst=r),othersGate=new Promise(r=>releaseOthers=r);
for(const [index,frame] of manifest['joke-l'].idle.frames.entries())await page.route('**/'+frame.path,async route=>{await(index?othersGate:firstGate);await route.continue();});
try{
 await page.goto('http://localhost:3187',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);
 for(const [name,width,height] of [['desktop',1280,720],['tall-desktop',1280,1024],['landscape',844,390],['portrait',390,844]]){
  await page.setViewportSize({width,height});
  const result=await page.locator('[data-title-player="alex-sebas"]').evaluate(canvas=>{const r=canvas.getBoundingClientRect(),p=canvas.parentElement.getBoundingClientRect();return {fits:r.left>=p.left-1&&r.right<=p.right+1&&r.top>=0&&r.bottom<=innerHeight,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};});
  check(`Sebas full silhouette fits ${name}`,result.fits,result.rect);
  const heights=await page.locator('.title-team canvas:not(.team-leader)').evaluateAll(items=>items.map(e=>e.getBoundingClientRect().height));
  check(`supporting cast keeps modest perspective scale ${name}`,Math.max(...heights)/Math.min(...heights)<1.35);
  await page.screenshot({path:`artifacts/title-${name}-v9.png`});
 }
 await page.setViewportSize({width:1280,height:720});await page.locator('#titleStart').click();await page.locator('#modeScreen .mode-option.active').click();
 await page.locator('[data-player="joke-l"]').click();
 const initial=await page.locator('#playerPreview').evaluate(c=>{const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return {state:c.dataset.previewState,id:c.dataset.previewFighter,visible:data.some((a,i)=>i%4===3&&a>100)};});
 check('blocked idle immediately shows selected portrait',initial.state==='portrait'&&initial.id==='joke-l'&&initial.visible);
 await page.waitForFunction(()=>document.querySelector('#opponentPreview').dataset.previewState==='animated');
 check('rival animates independently of blocked player',true);
 releaseFirst();await page.waitForFunction(()=>document.querySelector('#playerPreview').dataset.previewState==='idle');
 check('first idle displays before remaining frames arrive',true);
 releaseOthers();await page.waitForFunction(()=>document.querySelector('#playerPreview').dataset.previewState==='animated');
 check('remaining frames enable animation',true);
 await page.locator('[data-player="alex-sebas"]').click();await page.locator('[data-player="dark-wong"]').click();
 await page.waitForFunction(()=>document.querySelector('#playerPreview').dataset.previewFighter==='dark-wong'&&document.querySelector('#playerPreview').dataset.previewState==='animated');
 check('rapid switching keeps latest selected fighter',true);
 check('no browser errors',report.errors.length===0);
}finally{releaseFirst();releaseOthers();await writeFile('artifacts/previews-v9.json',JSON.stringify(report,null,2));await browser.close();}
console.log(`PASS ${report.checks.length} preview checks`);
