import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
try {
 await page.goto('http://127.0.0.1:3187');await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);
 await page.locator('#titleStart').click();await page.locator('#modeNext').click();await page.locator('#fighterNext').click();await page.locator('#startButton').click();await page.waitForFunction(()=>window.__fight?.fighters?.length===2);
 const checks=await page.evaluate(async()=>{
  const {crowdLayouts}=await import('./crowd-layout.js');const art=window.__fight.options.crowdArt;const checks=[];const hashes=new Map();const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d',{willReadFrequently:true});
  for(const [stage,people] of crowdLayouts.entries()){
   checks.push({name:`stage ${stage} regional distinct identities`,pass:people.length===[4,4,6,4][stage]&&new Set(people.map(p=>p.id)).size===people.length});
   for(const p of people){
    const images=art[p.id]||[];checks.push({name:`stage ${stage} ${p.id} four loaded poses`,pass:images.length===4&&images.every(i=>i.naturalWidth)});
    for(const [frame,img] of images.entries()){
     canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
     let sole=-1;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>120)sole=y;
     const m=img.spriteMeta;const scale=p.height*m.scale;const footY=p.y+((sole+1)-canvas.height*m.anchorY)*scale;
     const bodyHeight=((sole+1)-m.bodyHeadTopY)*scale;
     checks.push({name:`stage ${stage} ${p.id}/${frame} sole touches ground`,pass:Number.isFinite(footY)&&Math.abs(footY-p.y)<1.5,footY,groundY:p.y});
     checks.push({name:`stage ${stage} ${p.id}/${frame} adult body scale`,pass:Number.isFinite(bodyHeight)&&Math.abs(bodyHeight-p.height)<2,bodyHeight,target:p.height});
     {const digest=await crypto.subtle.digest('SHA-256',pixels);const hash=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');hashes.set(`${p.id}/${frame}`,hash)}
    }
   }
  }
  checks.push({name:'40 different illustrated poses',pass:hashes.size===40&&new Set(hashes.values()).size===40});return checks;
 });
 for(let frame=0;frame<4;frame++){
  await page.evaluate(frame=>{const g=window.__fight;g.freezeForInspection(true);g.stage=0;g.cameraX=320;g.elapsed=frame/3;g.phase='fight';g.particles=[];g.draw();},frame);
  await page.waitForTimeout(40);await page.screenshot({path:`artifacts/masp-walk-v12-${frame}.png`});
 }
 await writeFile('artifacts/crowd-v6.json',JSON.stringify({checks},null,2));console.log({checks:checks.length,failed:checks.filter(c=>!c.pass)});assert(checks.every(c=>c.pass),'Crowd identity, body proportions and opaque sole contact');
}finally{await browser.close()}
