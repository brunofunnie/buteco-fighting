import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

await mkdir('artifacts/wes-pilot', {recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:'artifacts/wes-pilot',size:{width:1440,height:900}}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:3187');
  await page.waitForFunction(()=>window.__ui?.assets&&!document.querySelector('#titleStart').disabled);
  await page.click('#titleStart');
  await page.click('[data-mode="training"]');
  await page.locator('[data-player="wes"]').click();
  await page.click('#fighterNext');
  await page.click('[data-stage="0"]');
  await page.waitForFunction(()=>window.__fight?.fighters[0].id==='wes');
  await page.evaluate(()=>__fight.debugForce({phase:'fight',cpu:false}));
  const geometry=await page.evaluate(()=>{
    const g=__fight,a=g.assets.wes;
    return Object.fromEntries(['idle','walk','punch','kick','hurt'].map(state=>{
      const frames=a[state];
      const p=g.spritePlacement(a,frames[0],320),b=g.measureSprite(frames[0]);
      return [state,{count:frames.length,loaded:frames.every(f=>f.complete&&f.naturalWidth===1024),height:b.height*p.height/frames[0].naturalHeight}];
    }));
  });
  for(const [state,value]of Object.entries(geometry)){
    assert.equal(value.count,8,state);assert.ok(value.loaded,state);
    assert.ok(Math.abs(value.height-320)<2,`${state}: consistent guard scale ${value.height}`);
  }
  await page.screenshot({path:'artifacts/wes-pilot/idle.png'});
  for(const [key,state,delay]of [['d','walk',200],['j','punch',100],['k','kick',160]]){
    await page.evaluate(()=>__fight.debugForce({phase:'fight',fighters:[{x:400,y:590,action:null,stun:0,state:'idle',stateTime:0},{x:950,y:590}]}));
    await page.keyboard.down(key);await page.waitForTimeout(delay);
    assert.equal(await page.evaluate(()=>__fight.fighters[0].state),state);
    await page.screenshot({path:`artifacts/wes-pilot/${state}.png`});
    await page.keyboard.up(key);await page.waitForTimeout(650);
  }
  await page.evaluate(()=>__fight.debugForce({fighters:[{state:'hurt',stateTime:0,action:null,stun:.28}]}));
  await page.waitForTimeout(80);await page.screenshot({path:'artifacts/wes-pilot/hurt.png'});
  await page.waitForTimeout(600);
  await page.evaluate(()=>__fight.debugForce({fighters:[{x:1000,facing:-1},{x:600,facing:1}]}));
  await page.keyboard.down('j');await page.waitForTimeout(130);
  await page.screenshot({path:'artifacts/wes-pilot/punch-left.png'});
  await page.keyboard.up('j');await page.waitForTimeout(1000);
  assert.deepEqual(errors,[]);
  const video=page.video();await context.close();await video.saveAs('artifacts/wes-pilot/gameplay.webm');
  console.log('PASS WES: 40 native frames loaded, state scale, keyboard walk/punch/kick, hurt preview and facing left; no browser errors');
} finally {await browser.close();}
