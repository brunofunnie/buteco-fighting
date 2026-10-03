import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.GAME_URL||'http://127.0.0.1:3197'}/tools/voice-picker.html`);
 await page.waitForFunction(()=>!document.querySelector('#detect').disabled);
 const count=await page.locator('.clip').count();assert.ok(count>10&&count<100);
 await page.locator('.clip select').first().selectOption('round-1');
 await page.locator('.clip .play').first().click();await page.waitForFunction(()=>document.querySelector('.clip.playing'));
 await page.locator('.clip .stop').first().click();assert.equal(await page.locator('.playing').count(),0);
 await page.locator('.clip select').nth(1).selectOption('round-1');assert.equal(await page.locator('.clip.selected').count(),1);assert.equal(await page.locator('.clip select').first().inputValue(),'');
 await page.reload();await page.waitForFunction(()=>!document.querySelector('#detect').disabled);assert.equal(await page.locator('.clip select').nth(1).inputValue(),'round-1');
 const dl=page.waitForEvent('download');await page.click('#export');const exported=await dl;const data=JSON.parse(await readFile(await exported.path(),'utf8'));assert.equal(data.selected.length,1);assert.equal(data.selected[0].phrase,'round-1');
 const wave=page.waitForEvent('download');await page.locator('.clip .download').nth(1).click();const bytes=await readFile(await (await wave).path());assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WAVE');assert.ok(bytes.length>44);
 await page.locator('.clip .start').nth(1).fill('1000');await page.locator('.clip .start').nth(1).dispatchEvent('change');assert.ok(Number(await page.locator('.clip .start').nth(1).inputValue())<69);
 await page.locator('.clip .join').first().click();assert.equal(await page.locator('.clip').count(),count-1);
 await page.locator('#import').setInputFiles({name:'choices.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});assert.equal(await page.locator('.clip').count(),count);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'artifacts/voice-picker-mobile.png',fullPage:false});
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'artifacts/voice-picker-desktop.png',fullPage:false});assert.deepEqual(errors,[]);
 console.log(`PASS: ${count} suggested clips, playback, phrase selection, persistence, JSON import/export, WAV download, bounds validation, merging and mobile layout.`);
}finally{await browser.close();}
