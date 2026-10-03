import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fighterIds} from '../src/roster.js';

const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:1440,height:900}});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(process.env.GAME_URL || 'http://localhost:3187');
  await page.waitForFunction(() => !document.querySelector('#titleStart').disabled);
  await page.locator('#titleStart').click();
  await page.locator('[data-mode="versus"]').click();
  for (const slot of ['player','opponent']) {
    await page.locator(`[data-slot="${slot}"]`).click();
    for (const id of fighterIds) {
      await page.locator(`[data-player="${id}"]`).click();
      await page.waitForFunction(({slot,id}) => {
        const canvas=document.querySelector(`#${slot}Preview`);
        return canvas.dataset.previewFighter === id && canvas.dataset.transitionPhase === 'settled';
      }, {slot,id});
      const visible = await page.locator(`#${slot}Preview`).evaluate(canvas => {
        const pixels = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        let opaque = 0;
        for (let i=3;i<pixels.length;i+=4) if (pixels[i]>32) opaque++;
        return opaque>1000;
      });
      assert.ok(visible, `${slot}: ${id} must display a visible base portrait`);
    }
    const canvas = page.locator(`#${slot}Preview`);
    const before = await canvas.evaluate(c => c.toDataURL());
    await page.waitForTimeout(250);
    assert.equal(await canvas.evaluate(c => c.toDataURL()), before, `${slot}: portrait stays static`);
  }
  assert.deepEqual(errors, []);
  console.log(`PASS visible base portraits for ${fighterIds.length} fighters in both slots; static images; no page errors`);
} finally {
  await browser.close();
}
