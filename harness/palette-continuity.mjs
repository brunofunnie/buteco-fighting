import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({args:['--no-sandbox']});
try{
  const page=await browser.newPage();
  await page.goto(process.env.GAME_URL||'http://localhost:3197');
  const result=await page.evaluate(async()=>{
    const {alternateSprite}=await import('./src/alternate-palette.js');
    const source=document.createElement('canvas');source.width=100;source.height=100;
    const ctx=source.getContext('2d');
    ctx.fillStyle='#505050';ctx.fillRect(15,15,25,75); // Continuous shoulder and jacket.
    ctx.fillRect(65,5,15,15); // Separate neutral hair region.
    ctx.fillStyle='#b87546';ctx.fillRect(45,15,15,70); // Warm skin.
    const image=new Image();image.src=source.toDataURL();await image.decode();
    const tint=alternateSprite(image),next=tint.getContext('2d');
    const pixel=(context,x,y)=>Array.from(context.getImageData(x,y,1,1).data);
    const original=ctx.getImageData(0,0,100,100).data,output=next.getImageData(0,0,100,100).data;
    let alphaPreserved=true;for(let i=3;i<original.length;i+=4)if(original[i]!==output[i])alphaPreserved=false;
    return {shoulder:pixel(next,20,20),lower:pixel(next,20,70),hair:pixel(next,70,10),skin:pixel(next,50,40),alphaPreserved,cached:alternateSprite(image)===tint};
  });
  assert.deepEqual(result.shoulder,result.lower,'The continuous jacket must have the same tint above and below the neck cutoff');
  assert.deepEqual(result.lower,[40,84,128,255]);
  assert.deepEqual(result.hair,[80,80,80,255]);
  assert.deepEqual(result.skin,[184,117,70,255]);
  assert.ok(result.alphaPreserved);assert.ok(result.cached);
  console.log('PASS continuous jacket tint above shoulders, isolated hair and skin preservation, unchanged lower tint, alpha and cache');
}finally{await browser.close();}
