import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
try{
  await page.goto('http://127.0.0.1:3187');
  await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);
  await page.locator('#titleStart').click();await page.locator('#modeNext').click();await page.locator('#fighterNext').click();await page.locator('#startButton').click();
  await page.waitForFunction(()=>window.__fight?.fighters?.length===2);
  const checks=await page.evaluate(()=>{
    const g=window.__fight;g.paused=true;
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d');const checks=[];
    const changed=(a,b,y0,y1)=>{let n=0;for(let y=y0;y<y1;y++)for(let x=0;x<1280;x++){const p=(y*1280+x)*4;if(Math.max(...[0,1,2].map(k=>Math.abs(a[p+k]-b[p+k])))>12)n++}return n};
    for(let stage=0;stage<4;stage++){
      g.stage=stage;g.elapsed=0;g.drawStage(ctx);const a=ctx.getImageData(0,0,1280,720).data;
      const signX=[1497,1497,1185,1452][stage]-320,signY=[502,520,220,529][stage];
      const signBefore=ctx.getImageData(signX-36,signY-11,72,22).data;
      g.elapsed=.7;g.drawStage(ctx);const b=ctx.getImageData(0,0,1280,720).data;
      const crowdPixels=changed(a,b,380,550);checks.push({name:`stage ${stage} patrons visibly change pose`,pass:crowdPixels>250,crowdPixels});
      g.elapsed=.2;g.drawStage(ctx);const c=ctx.getImageData(0,0,1280,720).data;
      const signAfter=ctx.getImageData(signX-36,signY-11,72,22).data;let signPixels=0;
      for(let p=0;p<signBefore.length;p+=4)if(Math.max(...[0,1,2].map(k=>Math.abs(signBefore[p+k]-signAfter[p+k])))>12)signPixels++;checks.push({name:`stage ${stage} embedded signs animate`,pass:signPixels>20,signPixels});
    }
    checks.push({name:'illustrated crowd frames loaded',pass:['woman_clap','woman_shout','woman_toast','man_cheer','man_drink','man_toast','goth_woman','goth_man','pedestrian','seated_adult'].every(s=>g.options.crowdArt?.[s]?.length===4&&g.options.crowdArt[s].every(i=>i.naturalWidth>0))});
    return checks;
  });
  await writeFile('artifacts/stages-v5.json',JSON.stringify({checks},null,2));console.log(checks);assert(checks.every(c=>c.pass),'Stage crowd and signs must visibly animate');
}finally{await browser.close()}
