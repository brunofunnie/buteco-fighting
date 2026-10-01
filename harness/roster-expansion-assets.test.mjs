import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {FIGHTERS} from '../roster.js';

// Missing import or a stale Maya image must fail at the game's asset boundary.
const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
const manifest=JSON.parse(await readFile('assets/manifest.json','utf8'));
const files=(await readdir('novos_player_para_implementar')).filter(name=>name.endsWith('.png'));
assert.equal(Object.keys(FIGHTERS).length,50,'the complete roster contains 50 fighters');
assert.deepEqual(Object.keys(manifest).sort(),Object.keys(FIGHTERS).sort(),'every selectable fighter has published animations');
for(const file of files) {
  const name=file.slice(0,-4);
  const fighter=Object.values(FIGHTERS).find(f=>f.name===name);
  assert.ok(fighter,`${name}: selectable fighter exists`);
  assert.equal(await hash(fighter.source),await hash(`novos_player_para_implementar/${file}`),`${name}: canonical portrait matches supplied image`);
  assert.equal(Object.keys(manifest[fighter.id]||{}).length,24,`${name}: all combat states published`);
  for(const [state,animation] of Object.entries(manifest[fighter.id])) {
    assert.equal(animation.frames.length,['walk','backwalk'].includes(state)?6:4,`${name}/${state}: complete motion`);
    for(const frame of animation.frames) {
      await readFile(frame.path);
      assert.ok(['scale','anchorX','anchorY'].every(key=>Number.isFinite(frame[key])),`${name}/${state}: valid geometry`);
    }
  }
}
assert.equal(Object.values(FIGHTERS).filter(f=>f.name==='Maya B').length,1,'Maya B is replaced without a duplicate');
console.log(`PASS ${files.length} supplied identities, portraits and animation sets`);
