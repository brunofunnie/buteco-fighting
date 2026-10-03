import assert from 'node:assert/strict';
import {AudioDirector} from '../src/audio.js';
import {chromium} from 'playwright';
const director=new AudioDirector(),calls=[];director.play=key=>{calls.push(key);return true;};
const fight={round:1,phase:'intro',phaseTime:2.5,mode:'versus',paused:false,options:{muted:false}};
director.announceIntro(fight);director.announceIntro(fight);fight.phaseTime=.99;director.announceIntro(fight);director.announceIntro(fight);fight.round=2;fight.phaseTime=2.5;director.announceIntro(fight);fight.phaseTime=.99;director.announceIntro(fight);assert.deepEqual(calls,['voice-round-1','voice-fight','voice-round-2','voice-fight']);
fight.round=3;fight.phaseTime=2.5;director.announceIntro(fight);assert.equal(calls.length,4);fight.phaseTime=.9;director.announceIntro(fight);assert.equal(calls.at(-1),'voice-fight');
fight.round=1;fight.introVoiceRound=null;fight.phaseTime=2.5;fight.paused=true;director.announceIntro(fight);assert.equal(calls.length,5);fight.paused=false;fight.mode='training';director.announceIntro(fight);assert.equal(calls.length,5);fight.mode='arcade';fight.options.muted=true;director.announceIntro(fight);assert.equal(calls.length,5);
const browser=await chromium.launch({headless:true});try{const page=await browser.newPage();await page.goto('http://localhost:3197');await page.click('#titleStart');const durations=await page.evaluate(async()=>{const {audioDirector:a}=await import('/src/audio.js');await a.unlock();return (await a.warmIntroVoices()).map(b=>b?.duration);});for(const [i,seconds] of [1.4,1.45,.66].entries())assert.ok(Math.abs(durations[i]-seconds)<.01);console.log('PASS: exact selected cuts decode; round/fight timing, once-only calls, third round, pause, training and mute guards.');}finally{await browser.close();}
