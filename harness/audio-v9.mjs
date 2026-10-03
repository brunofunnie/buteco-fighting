// Runtime verification uses an explicit synthetic fixture, not generated assets.
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fighterIds} from '../src/roster.js';
const samples=22050,wav=Buffer.alloc(44+samples*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(22050,24);wav.writeUInt32LE(44100,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);
for(let i=0;i<samples;i++)wav.writeInt16LE(Math.round(Math.sin(i/22050*440*Math.PI*2)*1500),44+i*2);
const keys=['theme-menu','theme-fight','impact','block','jump','select','confirm','ko',...fighterIds.flatMap(id=>['attack','special','super'].map(action=>`${id}-${action}`))];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/assets/audio/v9/manifest.json',r=>r.fulfill({json:Object.fromEntries(keys.map(key=>[key,{path:'/fixture-audio.wav'}]))}));
await page.route('**/fixture-audio.wav',r=>r.fulfill({contentType:'audio/wav',body:wav}));
try{
 await page.goto('http://localhost:3187');await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);await page.locator('#titleStart').click();
 const checks=await page.evaluate(async({keys,ids})=>{
  const {audioDirector:a}=await import('/src/audio.js');await a.unlock();await Promise.all(keys.map(key=>a.load(key)));
  const checks=[];const check=(name,pass)=>checks.push({name,pass:!!pass});
  a.setScene('menu');check('menu theme starts',a.musicKey==='theme-menu');const menu=a.music;a.setScene('menu');check('same scene does not restart music',a.music===menu);
  a.setScene('fight',3);check('fight theme replaces menu',a.musicKey==='theme-fight'&&a.music!==menu);
  a.setScene('pause');check('pause stops theme',!a.music);
  a.setScene('menu');check('menu theme resumes',a.musicKey==='theme-menu');
  for(const id of ids)for(const kind of ['punch','airKick','special','super'])check(`${id} ${kind} routed to decoded sound`,a.combat(kind,{id,x:600},320));
  check('effect voices limited to twelve',a.voices.size<=12);
  a.setMuted(true);await new Promise(r=>setTimeout(r,30));check('mute silences master bus',a.master.gain.value===0);check('mute suppresses new effects',!a.play('impact'));
  a.setMuted(false);await new Promise(r=>setTimeout(r,30));check('unmute restores audio',a.master.gain.value===1&&a.play('block'));
  check('unknown asset returns false for synth fallback',!a.play('missing-fixture'));
  a.setScene('pause');for(const voice of a.voices)voice.stop();return checks;
 },{keys,ids:fighterIds});
 await writeFile('artifacts/audio-v9.json',JSON.stringify({fixture:'synthetic WAV; verifies wiring only, no ElevenLabs quality claim',checks,errors},null,2));
 assert.ok(checks.every(c=>c.pass));assert.deepEqual(errors,[]);console.log(`PASS ${checks.length} audio routing/lifecycle checks`);
}finally{await browser.close();}
