import assert from 'node:assert/strict';
import {FightGame} from '../src/game.js';
globalThis.window={addEventListener(){},removeEventListener(){}};
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
const context=new Proxy({}, {get(o,key){return o[key]??(()=>{});}});
const game=new FightGame({getContext:()=>context});game.start({mode:'versus'});game.phase='fight';
game.drawStage=()=>{};game.drawPowerReflections=()=>{};game.drawHUD=()=>{};
const drawn=[];game.drawFighter=(_ctx,f)=>drawn.push(f);
for(const defeated of [0,1])for(const winnerY of [350,590]){
 const loser=game.fighters[defeated],winner=game.fighters[1-defeated];loser.health=0;loser.y=590;winner.health=100;winner.y=winnerY;
 drawn.length=0;game.draw();assert.deepEqual(drawn,[loser,winner],'defeated fighter must render behind winner regardless of player slot or jump');
}
for(const f of game.fighters)f.health=100;
game.fighters[0].y=590;game.fighters[1].y=350;drawn.length=0;game.draw();assert.deepEqual(drawn,[game.fighters[1],game.fighters[0]],'normal airborne layering is preserved');
game.destroy();console.log('PASS defeated fighter renders behind winner for both slots, grounded and airborne; normal combat keeps vertical ordering');
