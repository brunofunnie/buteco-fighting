// Runtime verification uses actual generated ElevenLabs MP3 assets.
import {chromium} from 'playwright';
import {writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fighterIds} from '../src/roster.js';
const keys=['theme-menu','theme-fight','impact','block','jump','select','confirm','ko',...fighterIds.flatMap(id=>['attack','special','super'].map(action=>`${id}-${action}`))];
const manifest=JSON.parse(await readFile('assets/audio/v9/manifest.json','utf8'));
assert.equal(Object.keys(manifest).length,keys.length);
const hashes=[];for(const asset of Object.values(manifest)){const bytes=await readFile(asset.path);assert.ok(bytes.length>1000);hashes.push(createHash('sha256').update(bytes).digest('hex'));}assert.equal(new Set(hashes).size,keys.length);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://localhost:3187');await page.waitForFunction(()=>!document.querySelector('#titleStart').disabled);await page.locator('#titleStart').click();
 const checks=await page.evaluate(async({keys,ids})=>{
  const {audioDirector:a}=await import('/src/audio.js');await a.unlock();await Promise.all(keys.map(key=>a.load(key)));
  const checks=[];const check=(name,pass)=>checks.push({name,pass:!!pass});
  check('all real ElevenLabs files decoded',keys.every(key=>a.buffers.get(key)?.duration>.15));
  check('both full music themes decoded',a.buffers.get('theme-menu').duration>30&&a.buffers.get('theme-fight').duration>30);
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
 await page.evaluate(async()=>{
  const {audioDirector:a}=await import('/src/audio.js');window.__audioPlayed=[];const play=a.play.bind(a);a.play=(key,options)=>{const result=play(key,options);if(result)window.__audioPlayed.push(key);return result;};
  window.__ui.start({player:'maya',opponent:'bruno',mode:'versus',stage:0});window.__fight.debugForce({phase:'fight',energy:100,cpu:false});
 });
 await page.keyboard.press('j');await page.waitForTimeout(650);await page.keyboard.press('u');await page.waitForTimeout(1100);await page.evaluate(()=>window.__fight.debugForce({energy:100}));await page.keyboard.press('i');await page.waitForTimeout(1100);
 const played=await page.evaluate(()=>window.__audioPlayed);
 for(const key of ['maya-attack','maya-special','maya-super'])checks.push({name:`real gameplay triggers ${key}`,pass:played.includes(key)});
 await writeFile('artifacts/audio-real-v9.json',JSON.stringify({provider:'ElevenLabs actual MP3s',uniqueFiles:hashes.length,checks,errors},null,2));
 assert.ok(checks.every(c=>c.pass));assert.deepEqual(errors,[]);console.log(`PASS ${checks.length} audio routing/lifecycle checks`);
}finally{await browser.close();}
