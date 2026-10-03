import assert from 'node:assert/strict';
import * as arenas from '../src/stages.js';
const {drawArena}=arenas;
import {crowdLayouts} from '../src/crowd-layout.js';
const captures=[];function context(){const calls=[];const gradient={addColorStop(){}};const c=new Proxy({},{get(_,key){if(key==='createLinearGradient'||key==='createRadialGradient')return()=>gradient;return(...args)=>calls.push([key,...args]);},set(_,key,value){calls.push([key,value]);return true}});captures.push(calls);return c}
globalThis.document={createElement(){return {width:0,height:0,getContext:context}}};
assert.equal(crowdLayouts.length,4,'four region-specific crowds');
for(let stage=0;stage<4;stage++){assert.ok(arenas.arenaPalette(stage).ambient);drawArena(context(),{stage,time:2.4,cameraX:550});drawArena(context(),{stage,time:2.4,cameraX:550,art:{complete:true,naturalWidth:2048}})}
const first=context();drawArena(first,{stage:3,time:0,art:{complete:true,naturalWidth:2048}});const before=JSON.stringify(captures.at(-1));const second=context();drawArena(second,{stage:3,time:3,art:{complete:true,naturalWidth:2048}});assert.notEqual(before,JSON.stringify(captures.at(-1)),'Manaus water and boats animate');
console.log('PASS four arenas, fallback/art render paths, palettes, Manaus movement');

// Verify the actual painted panoramas in a browser, including the fixed floor.
const {chromium}=await import('playwright');
const {mkdir,writeFile}=await import('node:fs/promises');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.goto('http://localhost:3187');
const checks=await page.evaluate(async()=>{
  const {drawArena}=await import('/src/stages.js');
  const {FightGame}=await import('/src/game.js');
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
  Object.assign(canvas.style,{position:'fixed',inset:'0',width:'1280px',height:'720px',zIndex:'99999'});document.body.append(canvas);
  const context=canvas.getContext('2d');
  const checks=[];
  const paths=['brazil/sao-paulo','brazil/rio','brazil/recife','brazil/manaus'];
  const sample=(x,y,w,h)=>Array.from(context.getImageData(x,y,w,h).data).join(',');
  for(let stage=0;stage<4;stage++){
    const art=new Image();art.src=`/assets/stages/${paths[stage]}.png`;await art.decode();
    drawArena(context,{stage,art,cameraX:320,time:0});
    const floorBefore=sample(1100,610,100,80),sceneBefore=sample(0,330,1280,190);
    drawArena(context,{stage,art,cameraX:320,time:3.4});
    checks.push({name:`stage ${stage} moving regional details`,pass:sceneBefore!==sample(0,330,1280,190)});
    checks.push({name:`stage ${stage} fixed fighting floor`,pass:floorBefore===sample(1100,610,100,80)});
  }
  const simulation=new FightGame(document.createElement('canvas'));
  const colors=[];
  for(let stage=0;stage<4;stage++){simulation.stage=stage;colors.push(simulation.arenaPowerColor('#ee796a'));}
  checks.push({name:'power colors adapt to all four ambient temperatures',pass:new Set(colors).size===4});
  simulation.destroy();
  window.__arenaV8Canvas=canvas;
  return checks;
});
await mkdir('artifacts',{recursive:true});
await page.screenshot({path:'artifacts/arena-v8-manaus.png'});
await writeFile('artifacts/arena-v8.json',JSON.stringify({checks,errors},null,2));
await browser.close();
for(const check of checks){console.log(`${check.pass?'PASS':'FAIL'} ${check.name}`);assert.ok(check.pass,check.name);}
assert.deepEqual(errors,[],'no browser errors');
