import assert from 'node:assert/strict';
import {FightGame} from '../src/game.js';
globalThis.window={addEventListener(){},removeEventListener(){}};
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
function game(mode='versus'){const g=new FightGame({getContext:()=>({})});g.start({mode});g.sound=()=>{};g.phase='fight';return g;}
const g=game();const f=g.fighters[0];g.pressed.add('KeyW');g.keys.add('KeyW');g.update(1/120);g.pressed.clear();g.keys.clear();
let time=1/120,lowest=f.y,landed=false;
while(time<2){g.update(1/120);time+=1/120;lowest=Math.min(lowest,f.y);if(f.y===590){landed=true;break;}}
assert.ok(landed);assert.ok(time>.8&&time<.9,`jump airtime ${time} stays subtle but faster than previous ~.94s`);assert.ok(590-lowest>165,'jump still has useful height');assert.equal(f.state,'land');
for(const mode of ['training','arcade','versus']){
 const g=game(mode),texts=[];
 const ctx=new Proxy({fillText(text){texts.push(String(text));},measureText(){return {width:20};}}, {get(o,k){return k in o?o[k]:()=>{};}});
 g.drawHUD(ctx);
 assert.equal(texts.some(text=>text.startsWith('ROUND')),mode!=='training');
 if(mode==='training')assert.ok(texts.includes('∞'));
 g.destroy();
}
g.destroy();console.log(`PASS training HUD hides round and keeps infinite timer; jump lands in ${time.toFixed(3)}s with ${Math.round(590-lowest)}px height`);
