import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const manifest = JSON.parse(await readFile(new URL('../assets/audio/stages/manifest.json', import.meta.url)));
const hashes = new Set();
for (const track of Object.values(manifest)) {
  assert.equal(track.sections.length, 4);
  assert.ok(track.sections.every(section => section.seconds === 24));
  assert.ok(track.runtimeDurationSeconds >= 85 && track.runtimeDurationSeconds <= 100);
  hashes.add(createHash('sha256').update(await readFile(track.path)).digest('hex'));
}
assert.equal(hashes.size, 4);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:3197');
  await page.click('#titleStart');
  const results = await page.evaluate(async () => {
    const { audioDirector: audio, STAGE_MUSIC } = await import('/src/audio.js');
    await audio.unlock();
    const tracks = [];
    for (let stage = 0; stage < STAGE_MUSIC.length; stage++) {
      const buffer = await audio.warmStage(stage);
      audio.setScene('fight', stage);
      tracks.push({ stage, key: audio.musicKey, duration: buffer?.duration, channels: buffer?.numberOfChannels, loop: audio.music?.loop });
    }
    audio.setVolume('music', .4);
    await new Promise(resolve => setTimeout(resolve, 100));
    const volume = audio.musicBus.gain.value;
    audio.setScene('menu');
    return { tracks, volume, menu: audio.musicKey };
  });
  const keys = ['theme-sao-paulo', 'theme-rio', 'theme-recife', 'theme-manaus', 'theme-devon'];
  for (const track of results.tracks) {
    assert.equal(track.key, keys[track.stage]);
    assert.equal(track.loop, true);
    assert.equal(track.channels, 2);
    if (track.stage < 4) assert.ok(track.duration >= 85 && track.duration <= 100);
    else assert.ok(Math.abs(track.duration - 70.524) < .1);
  }
  assert.ok(Math.abs(results.volume - .4) < .001);
  assert.equal(results.menu, 'theme-menu');
  assert.deepEqual(errors, []);
  console.log('PASS: four distinct stage themes, durations, stereo decoding, stage routing, looping, volume, menu return and preserved Devon theme.');
  console.log(JSON.stringify(results.tracks, null, 2));
} finally {
  await browser.close();
}
