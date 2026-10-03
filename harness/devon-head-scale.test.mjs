import assert from 'node:assert/strict';
import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync(process.argv[2]||'assets/manifest.json'));
const heads=JSON.parse(fs.readFileSync('assets/sprites/devon/head-calibration.json'));
const reference=manifest.devon[heads.reference.state].frames[heads.reference.frame];
const expected=heads.reference.box[2]*reference.scale;
assert.equal(heads.uppercut.length,manifest.devon.uppercut.frames.length);
manifest.devon.uppercut.frames.forEach((frame,i)=>{
  const width=heads.uppercut[i].box[2]*frame.scale;
  assert.ok(Math.abs(width/expected-1)<.005,`uppercut frame ${i}: head width ${width.toFixed(2)}, idle ${expected.toFixed(2)}`);
});
console.log('PASS all four uppercut heads retain the idle head size within 0.5%');
