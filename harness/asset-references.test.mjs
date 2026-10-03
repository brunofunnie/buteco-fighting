import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {FIGHTERS,NON_PLAYABLE_FIGHTERS} from '../src/roster.js';
const root=path.resolve(import.meta.dirname,'..');
const manifest=JSON.parse(await readFile(path.join(root,'assets/manifest.json'),'utf8'));
let count=0;
for(const [id,states] of Object.entries(manifest))for(const [state,spec]of Object.entries(states))for(const frame of spec.frames||spec){
 const file=typeof frame==='string'?frame:frame.path;
 assert.ok(file,`${id}/${state} path`);await access(path.join(root,file));count++;
}
for(const fighter of Object.values({...FIGHTERS,...NON_PLAYABLE_FIGHTERS}))await access(path.join(root,fighter.source));
for(const file of ['assets/stages/public-v6/crowd-manifest.json','assets/stages/brazil/npcs/crowd-manifest.json']){
 const crowd=JSON.parse(await readFile(path.join(root,file),'utf8'));
 for(const spec of Object.values(crowd))for(const frame of spec.frames)await access(path.join(root,frame.path));
}
console.log(`PASS ${count} sprite frames, fighter sources and animated crowd references`);
