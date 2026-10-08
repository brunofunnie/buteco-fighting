import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runtimeAssets} from '../build/runtime-assets.mjs';
const used=await runtimeAssets(),found=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())await walk(p);else found.push(p);}}
await walk('assets');assert.deepEqual(found.sort(),[...used].sort(),'assets must contain exactly the runtime dependency set (plus required font license)');
for(const [file,sha256]of Object.entries(JSON.parse(await readFile('harness/fixtures/asset-hashes.json','utf8'))))assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),sha256,file);
console.log('PASS '+used.size+' runtime assets: complete dependencies, no unused files, identical original binary bytes');
