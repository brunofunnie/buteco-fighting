import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {FIGHTERS} from '../roster.js';

// Missing import or a stale Maya image must fail at the game's asset boundary.
const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
const manifest=JSON.parse(await readFile('assets/manifest.json','utf8'));
const baseline=JSON.parse(await readFile('harness/roster-baseline-v15.json','utf8'));
assert.ok(baseline.every(id=>FIGHTERS[id]),'preserve every existing fighter ID when importing a new batch');
const registryIndex=process.argv.indexOf('--registry');
const batch=registryIndex<0
  ? (await readdir('novos_player_para_implementar')).filter(name=>name.endsWith('.png')).map(file=>({name:file.slice(0,-4),suppliedReference:`novos_player_para_implementar/${file}`}))
  : Object.values(JSON.parse(await readFile(process.argv[registryIndex+1],'utf8')));
assert.deepEqual(Object.keys(manifest).sort(),Object.keys(FIGHTERS).sort(),'every selectable fighter has published animations');
for(const profile of batch) {
  const {name,suppliedReference}=profile;
  const fighter=profile.id?FIGHTERS[profile.id]:Object.values(FIGHTERS).find(f=>f.name.toLowerCase()===name.toLowerCase());
  assert.ok(fighter,`${name}: selectable fighter exists`);
  assert.equal(await hash(fighter.source),await hash(suppliedReference),`${name}: canonical portrait matches supplied image`);
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
assert.equal(Object.values(FIGHTERS).filter(f=>f.name.toLowerCase()==='cowboy').length,1,'Cowboy is replaced without a duplicate');
const cowboyBaseline=JSON.parse(await readFile('harness/cowboy-baseline-v15.json','utf8'));
const {identity,...cowboyGameplay}=FIGHTERS.cowboy;
assert.deepEqual(cowboyGameplay,cowboyBaseline,'Cowboy visual replacement preserves every gameplay attribute');
console.log(`PASS ${batch.length} supplied identities, portraits and animation sets`);
