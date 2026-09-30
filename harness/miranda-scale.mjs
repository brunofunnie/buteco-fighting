import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const runtime=JSON.parse(await readFile('assets/sprites/miranda/runtime-manifest.json','utf8'));
const published=JSON.parse(await readFile('assets/manifest.json','utf8')).miranda;
const metrics=JSON.parse(await readFile('assets/sprites/miranda/runtime-metrics.json','utf8'));
assert.deepEqual(published,runtime,'published and source manifests must agree');
for(const [state,spec] of Object.entries(runtime)) {
  for(const [index,frame] of spec.frames.entries()) assert.equal(frame.scale,metrics[state][index].scale,`${state}/${index}: publication would undo calibration`);
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
  const page=await browser.newPage({viewport:{width:2100,height:2400}});
  await page.goto('http://localhost:3187');
  await page.waitForFunction(()=>window.__ui?.assets);
  const result=await page.evaluate(async ()=>{
    await window.__ui.loadFighter('miranda');
    const {FightGame}=await import('/game.js');
    const {FIGHTERS}=await import('/roster.js');
    const renderer=Object.create(FightGame.prototype);
    renderer.spriteBounds=new WeakMap();
    renderer.assets=window.__ui.assets;
    const asset=renderer.assets.miranda;
    const frames=[];
    for(const [state,sprites] of Object.entries(asset)) {
      if(!Array.isArray(sprites))continue;
      sprites.forEach((sprite,index)=>{
        const placement=renderer.spritePlacement(asset,sprite,FIGHTERS.miranda.visualHeight);
        const bounds=renderer.measureSprite(sprite);
        frames.push({state,index,visibleHeight:bounds.height*placement.height/sprite.naturalHeight,
          footOffset:placement.y+bounds.bottom*placement.height/sprite.naturalHeight});
      });
    }
    // Exercise actual state-to-frame selection, rather than metadata alone.
    const canvas=document.createElement('canvas');canvas.width=800;canvas.height=720;
    const ctx=canvas.getContext('2d');const original=ctx.drawImage.bind(ctx);
    const draws=[];ctx.drawImage=(sprite,...args)=>{draws.push(sprite);original(sprite,...args);};
    for(const [state,sprites] of Object.entries(asset)) {
      if(!Array.isArray(sprites))continue;
      for(let tick=0;tick<=120;tick++) {
        const fighter=renderer.makeFighter('miranda',400,1);
        fighter.state=state;fighter.stateTime=tick/120;
        if(state==='jump'||state==='jumpForward')fighter.vy=-850+1700*tick/120;
        renderer.drawFighter(ctx,fighter);
      }
      if(!sprites.every(sprite=>draws.includes(sprite)))throw new Error(`${state}: renderer skipped frames`);
    }
    window.mirandaReview={renderer,asset,height:FIGHTERS.miranda.visualHeight};
    return frames;
  });
  assert.equal(result.length,100);
  assert.equal(new Set(result.map(f=>f.state)).size,24);
  const idle=result.find(f=>f.state==='idle');
  const standing=['idle','walk','backwalk','block','hurt','turn'];
  for(const frame of result) {
    assert.ok(Math.abs(frame.footOffset)<.001,`${frame.state}/${frame.index}: ground anchor shifted`);
    if(standing.includes(frame.state)) assert.ok(Math.abs(frame.visibleHeight-idle.visibleHeight)<2,`${frame.state}/${frame.index}: standing body grew or shrank`);
  }
  for(const state of ['jump','jumpForward','crouch','lowBlock','land']) assert.ok(Math.min(...result.filter(f=>f.state===state).map(f=>f.visibleHeight))<idle.visibleHeight*.92,`${state}: folded pose stretched to standing height`);
  for(let group=0;group<4;group++) {
    await page.evaluate(group=>{
      document.body.innerHTML='<canvas id="audit" width="2100" height="2400"></canvas>';
      const ctx=document.getElementById('audit').getContext('2d');
      ctx.fillStyle='#182230';ctx.fillRect(0,0,2100,2400);
      const {renderer,asset,height}=window.mirandaReview;
      const states=Object.entries(asset).filter(([,frames])=>Array.isArray(frames)).slice(group*6,group*6+6);
      for(const [row,[state,sprites]] of states.entries()) {
        [asset.idle[0],...sprites].forEach((sprite,col)=>{
          const p=renderer.spritePlacement(asset,sprite,height);
          const x=150+col*300,y=row*400+382;
          ctx.drawImage(sprite,x+p.x,y+p.y,p.width,p.height);
          ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.fillText(col?`${state} ${col-1}`:'idle reference',col*300+8,row*400+22);
          ctx.strokeStyle='#688';ctx.beginPath();ctx.moveTo(col*300,y);ctx.lineTo(col*300+300,y);ctx.stroke();
        });
      }
    },group);
    await page.screenshot({path:`artifacts/miranda-body-review-${group}.png`});
  }
  await writeFile('artifacts/miranda-scale.json',JSON.stringify(result,null,2)+'\n');
  console.log('PASS: all 100 frames / 24 states selected by the runtime renderer; standing sizes, folded poses, foot anchors, and publication consistency checked. Four visual review sheets saved.');
} finally {await browser.close();}
