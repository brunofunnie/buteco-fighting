import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({args:['--no-sandbox']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.GAME_URL||'http://localhost:3197');
  await page.locator('#titleStart').click();await page.locator('[data-mode="versus"]').click();
  await page.locator('#fighterNext').click();await page.locator('.arena.selected').click();await page.waitForFunction(()=>window.__fight?.running);
  await page.evaluate(()=>{const game=window.__fight;game.inspectionPaused=true;game.debugForce({phase:'fight',cpu:false});});
  const hit=async(index,blocked=false)=>page.evaluate(({index,blocked})=>{
    const game=window.__fight,target=game.fighters[1-index];target.guard=blocked;
    game.hitFighter(game.fighters[index],target,9,0);target.guard=false;game.draw();
  },{index,blocked});
  const lettering=async()=>page.evaluate(()=>{
    const game=window.__fight,ctx=game.ctx,original=ctx.fillText,labels=[];
    ctx.fillText=function(text,x,y,...args){
      const position=this.getTransform().transformPoint({x,y});
      labels.push({text:String(text),x:position.x,y:position.y,align:this.textAlign,font:this.font,alpha:this.globalAlpha});
      return original.call(this,text,x,y,...args);
    };
    try{game.draw();}finally{ctx.fillText=original;}
    return labels;
  });
  await hit(0);
  let labels=await lettering(),left=labels.find(l=>l.text==='1x');
  assert.ok(left,'The first successful hit displays 1x');
  assert.ok(left.x<128&&left.y>120&&left.y<350,'P1 counter stays at the left edge below the health HUD');
  assert.equal(left.align,'left');
  await hit(0,true);assert.equal(await page.evaluate(()=>window.__fight.fighters[0].combo),1,'A blocked hit does not increase the combo');
  await hit(0);await hit(0);await hit(1);await hit(1);
  labels=await lettering();
  assert.ok(labels.some(l=>l.text==='3x'&&l.x<128));
  assert.ok(labels.some(l=>l.text==='2x'&&l.x>1152&&l.align==='right'));
  assert.equal(labels.filter(l=>l.text==='HIT COMBO').length,2);
  assert.equal(labels.some(l=>/\d+ HITS$/.test(l.text)),false,'No duplicate counter floats above fighters');
  await page.screenshot({path:'artifacts/combo-hud-desktop.png'});
  const anchors=labels.filter(l=>l.text==='3x'||l.text==='2x').map(l=>l.x);
  await page.evaluate(()=>{const g=window.__fight;g.cameraX=0;g.fighters[0].x=200;g.fighters[1].x=500;g.draw();});
  assert.deepEqual((await lettering()).filter(l=>l.text==='3x'||l.text==='2x').map(l=>l.x),anchors,'Camera and fighter positions do not move the HUD');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/combo-hud-mobile.png'});
  await page.evaluate(()=>{
    const g=window.__fight;g.hitstop=0;g.shake=0;
    for(let frame=0;frame<220;frame++){g.update(1/120);g.pressed.clear();}
    g.draw();
  });
  assert.equal((await lettering()).some(l=>/^\d+x$/.test(l.text)),false,'Combo lettering expires after the hit sequence');
  await hit(0);assert.ok((await lettering()).some(l=>l.text==='1x'),'The next sequence starts at one');
  await page.evaluate(()=>{window.__fight.resetRound();window.__fight.draw();});
  assert.equal((await lettering()).some(l=>/^\d+x$/.test(l.text)),false,'New rounds clear both counters');
  assert.deepEqual(errors,[]);
  console.log('PASS first hit, per-player combos, blocked hits, screen-edge placement, camera independence, expiry, round reset and desktop/mobile rendering');
}finally{await browser.close();}
