import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto((process.env.GAME_URL||'http://127.0.0.1:3197')+'/?hitboxes=1');
  await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);
  await page.locator('#titleStart').click();await page.locator('[data-mode="training"]').click();
  await page.locator('[data-player="miranda"]').click();await page.locator('#fighterNext').click();await page.locator('#startButton').click();
  await page.waitForFunction(()=>window.__fight?.fighters?.length===2);
  const report=await page.evaluate(()=>{
    const g=window.__fight;g.freezeForInspection();g.paused=false;g.phase='fight';g.options.debugHitboxes=true;
    const f=g.fighters[0];f.facing=1;f.x=700;f.y=590;f.stun=0;
    const report=[];
    for(const state of ['idle','punch','kick','airPunch','airKick','crouchPunch','crouchKick','uppercut','sweep','hurt','jump','lowBlock']){
      Object.assign(f,{state,stateTime:.18,action:['idle','hurt','jump','lowBlock'].includes(state)?null:state,actionTime:state==='uppercut'?.2:state==='punch'||state.includes('Punch')?.15:.23,hit:false,vy:0});
      let image;const original=g.ctx.drawImage.bind(g.ctx);
      g.ctx.drawImage=(...args)=>{image=args[0];original(...args);};
      g.drawFighter(g.ctx,f);g.ctx.drawImage=original;
      const frame=g.combatBoxes(f).frame;const expected=g.assets[f.id][state][frame];
      report.push({state,frame,same:image===expected,hurt:g.combatBoxes(f).hurt.length});
    }
    f.state='punch';f.action='punch';f.actionTime=.15;f.hit=false;g.draw();return report;
  });
  assert.ok(report.every(r=>r.same&&r.hurt>0),JSON.stringify(report));assert.equal(await page.evaluate(()=>window.__fight.options.debugHitboxes),true);
  await page.screenshot({path:'artifacts/collisions/miranda-live.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS rendered Miranda poses use identical collision frame, query debug overlay and no browser errors');
}finally{await browser.close();}
