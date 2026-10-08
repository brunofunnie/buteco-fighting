import assert from 'node:assert/strict';
import {INTRO_SECONDS,fightIntro} from '../src/fight-intro.js';
import {FightGame} from '../src/game.js';
assert.equal(fightIntro(INTRO_SECONDS).call,null);assert.equal(fightIntro(INTRO_SECONDS).zoom,1.12);
assert.equal(fightIntro(3.5).call,'round');assert.equal(fightIntro(3.5).zoom,1);
assert.equal(fightIntro(1.51).call,'round');assert.equal(fightIntro(1.5).call,'fight');
globalThis.window={addEventListener(){},removeEventListener(){}};
const game=new FightGame({getContext:()=>({})},{},{headless:true,interactive:false});game.start();const positions=game.fighters.map(f=>f.x);for(let i=0;i<659;i++)game.update(1/120);assert.equal(game.phase,'intro');assert.equal(game.timer,99);assert.deepEqual(game.fighters.map(f=>f.x),positions);for(let i=0;i<2;i++)game.update(1/120);assert.equal(game.phase,'fight');console.log('PASS: 2s zoom, 2s round, 1.5s fight call, combat locked during intro.');
