import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {FightGame} from '../game.js';
globalThis.window={addEventListener(){},removeEventListener(){}};
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
const checks=[];const check=(name,pass)=>{checks.push({name,pass:!!pass});assert.ok(pass,name);};
function fight(){const g=new FightGame({getContext:()=>({})});g.start({mode:'versus'});g.debugForce({phase:'fight',cpu:false});g.fighters[0].x=600;g.fighters[1].x=700;return g;}
for(const direction of [-1,1]){
 const g=fight(),[a,t]=g.fighters;a.facing=direction;
 g.hitFighter(a,t,12,45,175);
 check(`damaging hit creates blood facing ${direction}`,t.health===88&&g.particles.some(p=>p.kind==='bloodSplash')&&g.particles.filter(p=>p.kind==='blood').every(p=>Math.sign(p.vx)===direction));
 check(`ordinary hit replaces old spark burst ${direction}`,g.particles.every(p=>p.kind.startsWith('blood')));
 for(let n=0;n<100;n++)g.update(.016);
 check(`blood expires ${direction}`,g.particles.every(p=>!p.kind?.startsWith('blood')));
}
const guarded=fight();guarded.fighters[1].guard=true;guarded.hitFighter(...guarded.fighters,10);
check('guard reduces damage and emits no shield/blood burst',guarded.fighters[1].health===99.2&&guarded.particles.length===0);
const dead=fight();dead.fighters[1].health=0;dead.hitFighter(...dead.fighters,10);check('zero health loss produces no blood',dead.particles.length===0);
const armored=fight();armored.fighters[1].armorTime=1;armored.hitFighter(...armored.fighters,10);check('armor still produces blood for actual damage',armored.fighters[1].health===95.5&&armored.particles.length>0);
const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://localhost:3187');await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);await page.locator('#titleStart').click();
 await page.evaluate(()=>window.__ui.start({mode:'versus',player:'maya',opponent:'bruno'}));await page.waitForTimeout(200);
 await page.evaluate(()=>{const g=window.__fight;g.freezeForInspection();g.debugForce({phase:'fight',cpu:false,fighters:[{x:780,action:'punch',actionTime:.12},{x:860,health:100,guard:false}]});g.hitFighter(...g.fighters,12,20,205);});
 await page.waitForTimeout(100);await page.screenshot({path:'artifacts/blood-v10-hit.png'});
 const visible=await page.evaluate(()=>{const g=window.__fight,c=document.createElement('canvas');c.width=1280;c.height=720;g.drawStage(c.getContext('2d'));const before=c.getContext('2d').getImageData(0,0,1280,720).data;g.draw();const after=g.ctx.getImageData(0,0,1280,720).data;let red=0;for(let y=355;y<410;y++)for(let x=470;x<565;x++){const p=(y*1280+x)*4;if(after[p]>after[p+1]*1.8&&after[p]>after[p+2]*1.3&&Math.abs(after[p]-before[p])>15)red++;}return red;});
 check('actual impact visibly renders dark red blood',visible>15);
 await page.evaluate(()=>{const g=window.__fight;g.particles=[];g.fighters[0].action=null;g.fighters[1].guard=true;g.fighters[1].state='block';const calls=[],gradient={addColorStop(){}};const c=new Proxy({},{get:(_,key)=>key==='createRadialGradient'?()=>gradient:(...args)=>calls.push([key,...args]),set:()=>true});g.drawFighter(c,g.fighters[1]);window.__shieldCalls=calls.filter(call=>call[0]==='ellipse'&&call[3]===37&&call[4]===88);});
 check('blocking draws no shield ellipse',await page.evaluate(()=>window.__shieldCalls.length===0));await page.waitForTimeout(50);await page.screenshot({path:'artifacts/blood-v10-block.png'});
 check('no browser errors',errors.length===0);
}finally{await writeFile('artifacts/blood-v10.json',JSON.stringify({checks,errors},null,2));await browser.close();}
console.log(`PASS ${checks.length} blood/block checks`);
