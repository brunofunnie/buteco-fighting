import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.__pads=[];Object.defineProperty(navigator,'getGamepads',{value:()=>window.__pads});});
const tick=()=>page.waitForTimeout(100);
const button=async(index,n,down)=>{await page.evaluate(({index,n,down})=>window.__pads[index].buttons[n]={pressed:down,value:Number(down)},{index,n,down});await tick();};
const tap=async(index,n)=>{await button(index,n,true);await button(index,n,false);};
const bind=async(player,action,key)=>{await page.locator(`[data-bind-player="${player}"][data-bind-action="${action}"]`).click();await page.keyboard.press(key);};
try {
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:3187');
  await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);
  assert.equal(await page.locator('[data-title-player="miranda"]').evaluate(el=>getComputedStyle(el).scale),'0.9');
  await page.evaluate(()=>window.__pads=[0,1].map(index=>({index,id:`Test controller ${index}`,connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))})));
  await tick();await tap(0,0);assert.equal(await page.evaluate(()=>window.__ui.screen),'mode');
  await tap(0,3);
  await tap(0,2);assert.ok(await page.locator('#controlsDialog').isVisible());await page.locator('[data-options-tab=controls]').click();
  await bind(0,'punch','f');assert.match(await page.locator('#bindingStatus').textContent(),/salva/);
  await bind(0,'kick','f');assert.match(await page.locator('#bindingStatus').textContent(),/já usada/);
  await page.keyboard.press('Escape');assert.ok(await page.locator('#controlsDialog').isVisible());
  await bind(0,'right','h');await bind(0,'jump','t');
  await page.locator('#closeControls').click();await page.reload();
  await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);
  await page.locator('#titleStart').click();await page.locator('#controlsButton').click();await page.locator('[data-options-tab=controls]').click();
  assert.equal(await page.locator('[data-bind-player="0"][data-bind-action="punch"] kbd').textContent(),'F');
  await page.locator('#closeControls').click();await page.locator('[data-mode="versus"]').click();await page.locator('#fighterNext').click();
  for(const [index,path] of ['brazil/sao-paulo','brazil/rio','brazil/recife','brazil/manaus'].entries()){
    await page.locator(`[data-stage="${index}"]`).click();
    const style=await page.locator('#stageScreen').evaluate(el=>({image:getComputedStyle(el,'::before').backgroundImage,blur:getComputedStyle(el,'::before').filter}));
    assert.ok(style.image.includes(path));assert.match(style.blur,/blur\(12px\)/);
  }
  await page.waitForTimeout(500);
  await mkdir('/tmp/buteco-controls',{recursive:true});await page.screenshot({path:'/tmp/buteco-controls/stage.png'});
  await page.locator('#startButton').click();await page.waitForFunction(()=>window.__fight?.running&&window.__ui.screen==='fight');
  await page.evaluate(()=>{window.__fight.debugForce({phase:'fight',cpu:false});window.__fight.inspectionPaused=true;});
  // Deterministic actual combat steps retain the production input path.
  const step=()=>page.evaluate(()=>{const g=window.__fight;g.update(1/120);g.pressed.clear();return g.snapshot();});
  const reset=()=>page.evaluate(()=>{const g=window.__fight;g.resetRound();g.phase='fight';g.inspectionPaused=true;g.fighters[1].x=g.fighters[0].x+500;});
  await reset();await page.keyboard.down('d');let state=await step();const x=state.fighters[0].x;await step();assert.equal((await step()).fighters[0].x,x);await page.keyboard.up('d');
  await page.keyboard.down('h');assert.ok((await step()).fighters[0].x>x);await page.keyboard.up('h');
  for(const [key,action] of [['f','airPunch'],['k','airKick']]){
    await reset();await page.keyboard.down('t');await step();await page.keyboard.up('t');
    await page.keyboard.down(key);assert.equal((await step()).fighters[0].action,action);await page.keyboard.up(key);
  }
  await reset();await page.locator('[data-key="j"]').dispatchEvent('pointerdown',{pointerId:1});assert.equal((await step()).fighters[0].action,'punch');await page.locator('[data-key="j"]').dispatchEvent('pointerup',{pointerId:1});
  await page.evaluate(()=>window.__pads=[0,1].map(index=>({index,id:`Test controller ${index}`,connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))})));
  await reset();await step();await button(1,15,true);state=await step();assert.ok(state.fighters[1].x>state.fighters[0].x+500);await button(1,15,false);await step();
  for (const [action,n] of [['punch',0],['kick',1],['special',2],['super',3]]) {
    await reset();await page.evaluate(()=>window.__fight.fighters[0].energy=100);
    await button(0,n,true);assert.equal((await step()).fighters[0].action,action);await button(0,n,false);await step();
  }
  await reset();await page.evaluate(()=>window.__fight.hitstop=.02);await button(0,0,true);await step();
  assert.equal(await page.evaluate(()=>window.__fight.fighters[0].bufferedAction?.action),'punch');
  await button(0,0,false);await step();await step();assert.equal((await step()).fighters[0].action,'punch');
  await reset();await button(0,12,true);await step();await button(0,12,false);await button(0,0,true);assert.equal((await step()).fighters[0].action,'airPunch');await button(0,0,false);await step();
  await reset();await button(0,13,true);await button(0,4,true);assert.equal((await step()).fighters[0].state,'lowBlock');assert.equal((await step()).fighters[0].guard,true);await button(0,13,false);await button(0,4,false);
  await button(0,9,true);await step();assert.equal(await page.evaluate(()=>window.__fight.paused),true);await button(0,9,false);await tap(0,9);assert.equal(await page.evaluate(()=>window.__fight.paused),false);
  await reset();await button(0,15,true);await step();await page.evaluate(()=>window.__pads[0]=null);await step();assert.equal(await page.evaluate(()=>{const g=window.__fight;return g.getInput(g.fighters[0],g.fighters[1],0,1/120).move;}),0);
  await page.evaluate(()=>window.__ui.backToMenu());await page.locator('#controlsButton').click();await page.locator('[data-options-tab=controls]').click();await page.locator('#resetBindings').click();assert.equal(await page.locator('[data-bind-player="0"][data-bind-action="punch"] kbd').textContent(),'J');
  await page.screenshot({path:'/tmp/buteco-controls/options.png'});
  await page.locator('#closeControls').click();await page.locator('#modeScreen .mode-option.active').click();await page.locator('#fighterNext').click();
  for (const [width,height] of [[390,844],[844,390]]) {
    await page.setViewportSize({width,height});
    await page.locator('[data-stage="1"]').click();await page.locator('#controlsButton').click();await page.locator('[data-options-tab=controls]').click();
    assert.ok(await page.locator('#controlsDialog').isVisible());await page.keyboard.press('Escape');
    assert.ok(await page.locator('#startButton').isVisible());
    await page.screenshot({path:`/tmp/buteco-controls/stage-${width}.png`});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS title size, four stage backdrops, controller menus, saved remapping, conflicts, keyboard and controller air attacks, touch, P2, guard, pause, disconnect and reset');
}finally{await browser.close();}
