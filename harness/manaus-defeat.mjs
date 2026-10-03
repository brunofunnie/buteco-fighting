import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const b=await chromium.launch({args:['--no-sandbox']});
try{
 const p=await b.newPage({viewport:{width:1440,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL||'http://localhost:3197');await p.locator('#titleStart').click();await p.locator('[data-mode=versus]').click();await p.locator('[data-player=ghostly]').click();await p.locator('#fighterNext').click();await p.locator('[data-stage="3"]').click();await p.locator('#startButton').click();await p.waitForFunction(()=>window.__fight?.fighters?.length===2);
 const info=await p.evaluate(async()=>{
  const g=window.__fight;g.freezeForInspection(true);g.stage=3;g.cameraX=0;g.phase='fight';g.particles=[];g.elapsed=0;
  const f=g.fighters[0];f.x=700;f.y=590;f.state='idle';f.stateTime=0;g.draw();
  const {crowdLayouts}=await import('./src/crowd-layout.js');
  const people=crowdLayouts[3].map(person=>{
   const im=g.options.crowdArt[person.id][0],m=im.spriteMeta;
   const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const d=ctx.getImageData(0,0,c.width,c.height).data;let sole=0;
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]>120)sole=y;
   return {height:((sole+1)-m.bodyHeadTopY)*person.height*m.scale,foot:person.y+((sole+1)-c.height*m.anchorY)*person.height*m.scale,anchor:person.y};
  });
  const asset=g.assets.ghostly,ko=asset.ko[3];const placement=g.spritePlacement(asset,ko,320);
  return {people,koWidth:placement.width*(352/384)};
 });
 for(const person of info.people){assert.ok(Math.abs(person.height-230)<2);assert.ok(Math.abs(person.foot-person.anchor)<1.5);}
 assert.ok(info.koWidth<340,'Ghostly final lying pose has normal body length');
 await p.screenshot({path:'artifacts/manaus-crowd-scaled.png'});
 await p.evaluate(()=>{const g=window.__fight,f=g.fighters[0];f.health=0;f.stun=.825;g.setState(f,'ko');f.stateTime=2;g.draw();});
 await p.screenshot({path:'artifacts/ghostly-ko-normal.png'});
 assert.deepEqual(errors,[]);console.log('PASS Manaus full-size spectators with grounded feet, normal Ghostly KO length and no browser errors');
}finally{await b.close();}
