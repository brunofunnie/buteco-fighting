import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
const checks=[];
try {
  await page.goto('http://127.0.0.1:3187');
  const result=await page.evaluate(async()=>{
    const {FightGame}=await import('./src/game.js');
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
    const ctx=canvas.getContext('2d');
    const g=new FightGame(canvas);g.start({mode:'versus'});g.paused=true;
    g.fighters.forEach(f=>{f.health=0;f.displayHealth=0;f.energy=0});
    ctx.clearRect(0,0,1280,720);g.drawHUD(ctx);
    const alpha=(x,y)=>ctx.getImageData(x,y,1,1).data[3];
    const samples={openTop:alpha(300,30),openUnderBars:alpha(300,114),emptyHealth:alpha(200,75),emptyEnergy:alpha(200,646)};
    g.fighters[0].health=50;g.fighters[0].displayHealth=50;g.fighters[0].energy=50;
    ctx.clearRect(0,0,1280,720);g.drawHUD(ctx);
    samples.filledHealth=alpha(100,75);samples.filledEnergy=alpha(100,646);
    g.destroy();return samples;
  });
  for(const key of ['openTop','openUnderBars','emptyHealth','emptyEnergy']){
    checks.push({name:key,pass:result[key]===0,value:result[key]});
  }
  for(const key of ['filledHealth','filledEnergy'])checks.push({name:key,pass:result[key]>0,value:result[key]});
  await mkdir('artifacts',{recursive:true});
  await writeFile('artifacts/hud-v4.json',JSON.stringify({checks},null,2));
  console.log(JSON.stringify(checks,null,2));assert(checks.every(c=>c.pass),'HUD fills must represent values without background panels');
}finally{await browser.close()}
