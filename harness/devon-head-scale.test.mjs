import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(fs.readFileSync(process.argv[2]||'assets/manifest.json'));
const heads=JSON.parse(fs.readFileSync('harness/fixtures/devon-head-calibration.json'));
const reference=manifest.devon[heads.reference.state].frames[heads.reference.frame];
const axis=heads.metric==='height'?3:2,tolerance=heads.tolerance??.005;
const expected=heads.reference.box[axis]*reference.scale;
if(heads.reference.sha256)assert.equal(createHash('sha256').update(fs.readFileSync(reference.path)).digest('hex'),heads.reference.sha256);
assert.equal(heads.uppercut.length,manifest.devon.uppercut.frames.length);
manifest.devon.uppercut.frames.forEach((frame,i)=>{
  if(heads.uppercut[i].sha256)assert.equal(createHash('sha256').update(fs.readFileSync(frame.path)).digest('hex'),heads.uppercut[i].sha256);
  const size=heads.uppercut[i].box[axis]*frame.scale;
  assert.ok(Math.abs(size/expected-1)<tolerance,`uppercut frame ${i}: head ${heads.metric||'width'} ${size.toFixed(2)}, idle ${expected.toFixed(2)}`);
});
console.log(`PASS all ${heads.uppercut.length} reviewed uppercut heads retain the idle head size within ${tolerance*100}%`);
