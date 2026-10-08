import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {FIGHTERS,NON_PLAYABLE_FIGHTERS} from '../src/roster.js';

// Packaging and cleanup must agree on the game's complete asset dependency set.
export async function runtimeAssets(root=path.resolve(import.meta.dirname,'..')) {
 const assets=new Set();
 const add=file=>{
  const clean=file.replace(/^\//,'').split('?')[0];
  if(!clean.startsWith('assets/')||clean.split('/').includes('..'))throw Error(`Invalid asset path: ${file}`);
  assets.add(clean);
 };
 const references=value=>{
  if(Array.isArray(value)){value.forEach(references);return;}
  if(value&&typeof value==='object')for(const [key,entry]of Object.entries(value)){
   if(key==='path'&&typeof entry==='string')add(entry);else references(entry);
  }
 };
 const text=file=>readFile(path.join(root,file),'utf8');
 for(const file of ['assets/manifest.json','assets/crowd/public/manifest.json','assets/crowd/regional/manifest.json','assets/audio/manifest.json']){
  add(file);references(JSON.parse(await text(file)));
 }
 for(const fighter of Object.values({...FIGHTERS,...NON_PLAYABLE_FIGHTERS}))add(fighter.source);
 const app=await text('src/app.js');
 const stages=app.match(/const stageArtSources\s*=\s*(\[[^;]+\])/)[1];
 for(const match of stages.matchAll(/["']([^"']+)["']/g))add(`assets/stages/${match[1]}.png`);
 for(const name of ['sao-paulo','rio','recife','manaus'])add(`assets/audio/music/${name}.mp3`);
 add('assets/audio/music/devon.wav');
 add('assets/stages/devon-approach.png');
 add('assets/fonts/press-start-2p-OFL.txt');
 const html=await text('index.html');
 for(const match of html.matchAll(/(?:src|href|content)="((?:assets\/|https:\/\/fighting\.butecodosdevs\.com\/assets\/)[^"]+)"/g))add(match[1].startsWith('https:')?new URL(match[1]).pathname:match[1]);
 for(const name of await readdir(path.join(root,'styles'))){
  if(!name.endsWith('.css'))continue;
  for(const match of (await text('styles/'+name)).matchAll(/url\(['"]?([^'"\s)]+)['"]?\)/g)){
   if(/^(https?:|data:)/.test(match[1]))continue;
   add(match[1].startsWith('/')?match[1]:path.relative(root,path.resolve(root,'styles',match[1])));
  }
 }
 return assets;
}
