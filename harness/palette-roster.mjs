import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {FIGHTERS,fighterIds} from '../src/roster.js';

const directory='artifacts/palette-roster';
await fs.mkdir(directory,{recursive:true});
const manifest=JSON.parse(await fs.readFile('assets/manifest.json','utf8'));
const browser=await chromium.launch({args:['--no-sandbox']});
const report=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(process.env.GAME_URL||'http://localhost:3197');
  for(const id of fighterIds){
    const paths=[{state:'portrait',path:FIGHTERS[id].source},...Object.entries(manifest[id]||{}).flatMap(([state,value])=>value.frames?.[0]?[{state,path:value.frames[0].path}]:[])];
    const samples=await page.evaluate(async paths=>{
      const {alternateSprite}=await import('./src/alternate-palette.js');
      const samples=[];
      for(const {state,path} of paths){
        const image=new Image();image.src=path;await image.decode();
        const source=document.createElement('canvas');source.width=image.naturalWidth;source.height=image.naturalHeight;
        const ctx=source.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
        const original=ctx.getImageData(0,0,source.width,source.height).data;
        const start=performance.now(),alternate=alternateSprite(image),elapsed=performance.now()-start;
        const output=alternate.getContext('2d').getImageData(0,0,source.width,source.height).data;
        let changed=0,visible=0,alphaChanges=0,warmChanges=0;
        for(let i=0;i<original.length;i+=4){
          if(original[i+3])visible++;
          if(original[i+3]!==output[i+3])alphaChanges++;
          const different=original[i]!==output[i]||original[i+1]!==output[i+1]||original[i+2]!==output[i+2];
          if(different){changed++;if(Math.max(original[i],original[i+1],original[i+2])-Math.min(original[i],original[i+1],original[i+2])>38)warmChanges++;}
        }
        samples.push({state,path,changed,visible,percent:Number((100*changed/visible).toFixed(1)),alphaChanges,warmChanges,cached:alternateSprite(image)===alternate,elapsed:Math.round(elapsed),png:['portrait','idle'].includes(state)?alternate.toDataURL().split(',')[1]:null});
      }
      return samples;
    },paths);
    for(const sample of samples){
      assert.equal(sample.alphaChanges,0,`${id}/${sample.state}: transparency changed`);
      assert.equal(sample.warmChanges,0,`${id}/${sample.state}: saturated colors changed`);
      assert.ok(sample.cached,`${id}/${sample.state}: missing cache`);
      if(sample.png){await fs.writeFile(`${directory}/${id}-${sample.state}.png`,Buffer.from(sample.png,'base64'));delete sample.png;}
    }
    report.push({id,name:FIGHTERS[id].name,samples});
    console.log(`${id}: ${samples.length} poses checked; portrait ${samples[0].percent}% recolored; idle ${samples.find(s=>s.state==='idle')?.percent??'missing'}%`);
  }
  await fs.writeFile(`${directory}/report.json`,JSON.stringify(report,null,2));
  const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  await fs.writeFile(`${directory}/index.html`,`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Teste de cores — elenco completo</title><style>body{font:16px system-ui;background:#181818;color:#eee;margin:24px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}article{border:1px solid #555;padding:12px}h2{font-size:18px;margin:0 0 8px}figure{margin:0;text-align:center}section{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}img{width:100%;height:220px;object-fit:contain}figcaption,p{font-size:12px;color:#ccc}</style><h1>Cor alternativa: ${report.length} personagens</h1><p>Original e P2 azul, no retrato e no primeiro frame parado. A mesma recoloração já está ativa para todos quando P1 e P2 escolhem o mesmo personagem.</p><main>${report.map(({id,name,samples})=>`<article><h2>${escape(name)}</h2><section><figure><img src="../../${FIGHTERS[id].source}"><figcaption>Retrato original</figcaption></figure><figure><img src="${id}-portrait.png"><figcaption>Retrato P2</figcaption></figure>${samples.some(s=>s.state==='idle')?`<figure><img src="../../${samples.find(s=>s.state==='idle').path}"><figcaption>Luta original</figcaption></figure><figure><img src="${id}-idle.png"><figcaption>Luta P2</figcaption></figure>`:''}</section><p>${samples.length} poses verificadas · ${samples[0].percent}% do retrato recolorido</p></article>`).join('')}</main></html>`);
  await page.goto(`${process.env.GAME_URL||'http://localhost:3197'}/${directory}/index.html`);
  await page.evaluate(async()=>Promise.all([...document.images].map(img=>img.decode())));
  for(let group=0;group<Math.ceil(report.length/9);group++){
    await page.evaluate(group=>{document.querySelectorAll('article').forEach((card,i)=>card.hidden=Math.floor(i/9)!==group);},group);
    await page.screenshot({path:`${directory}/comparison-${group+1}.png`,fullPage:true});
  }
  console.log(`PASS ${report.length} characters, ${report.reduce((n,r)=>n+r.samples.length,0)} representative poses; gallery: ${directory}/index.html`);
}finally{await browser.close();}
