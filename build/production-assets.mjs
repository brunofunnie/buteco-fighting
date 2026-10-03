import sharp from 'sharp';
import {readFile,writeFile,copyFile,mkdir,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {brotliCompressSync,gzipSync,constants} from 'node:zlib';
import {FIGHTERS,NON_PLAYABLE_FIGHTERS} from '../src/roster.js';
const root=path.resolve(import.meta.dirname,'..');
const output=path.resolve(process.argv[2]||path.join(root,'dist'));
if(output===root||['assets','src','styles','build','data'].some(dir=>output===path.join(root,dir)||output.startsWith(path.join(root,dir)+path.sep)))throw Error('Output must not overwrite source files');
sharp.concurrency(1);sharp.cache(false);
const assets=new Set();
function add(file){
 const clean=file.replace(/^\//,'').split('?')[0];
 if(!clean.startsWith('assets/')||clean.includes('..'))throw Error(`Invalid asset path: ${file}`);
 assets.add(clean);
}
function references(value){
 if(Array.isArray(value)){for(const entry of value)references(entry);return;}
 if(value&&typeof value==='object')for(const[key,entry]of Object.entries(value)){
  if(key==='path'&&typeof entry==='string')add(entry);else references(entry);
 }
}
for(const file of ['assets/manifest.json','assets/stages/public-v6/crowd-manifest.json','assets/stages/brazil/npcs/crowd-manifest.json','assets/audio/v9/manifest.json']){
 add(file);references(JSON.parse(await readFile(path.join(root,file),'utf8')));
}
for(const fighter of Object.values({...FIGHTERS,...NON_PLAYABLE_FIGHTERS}))add(fighter.source);
const app=await readFile(path.join(root,'src/app.js'),'utf8');
const stagePaths=app.match(/const stageArtSources\s*=\s*(\[[^;]+\])/)[1];
for(const match of stagePaths.matchAll(/["']([^"']+)["']/g))add(`assets/stages/${match[1]}.png`);
for(const name of ['sao-paulo','rio','recife','manaus'])add(`assets/audio/stages/${name}/theme.mp3`);
add('assets/audio/devon/theme-rock.wav');
// Retain the deliberately disabled voice clips for future reuse, without their production recordings.
for(const name of ['round-1','round-2','fight'])add(`assets/audio/selected-voices/${name}.wav`);
for(const dir of ['assets/interface','assets/social','assets/fonts'])for(const file of await readdir(path.join(root,dir)))if(/\.(png|webp|ttf|txt)$/.test(file))add(`${dir}/${file}`);
for(const name of ['seven-crowd-background.png','devon-main-illustrated.png','buteco-fighting-logo.png','logo_buteco_games.png'])add(`assets/title/${name}`);
add('assets/stages/devon/approach.png');
const html=await readFile(path.join(root,'index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href|content)="((?:assets\/|https:\/\/fighting\.butecodosdevs\.com\/assets\/)[^"]+)"/g))add(match[1].startsWith('https:')?new URL(match[1]).pathname:match[1]);
for(const name of await readdir(path.join(root,'styles'))){
 const css=await readFile(path.join(root,'styles',name),'utf8');
 for(const match of css.matchAll(/url\(['"]?([^'"\s)]+)['"]?\)/g)){
  if(/^(https?:|data:)/.test(match[1]))continue;
  add(match[1].startsWith('/')?match[1]:path.relative(root,path.resolve(root,'styles',match[1])));
 }
}
let beforeBytes=0,afterBytes=0,optimized=0,completed=0;
const assetMap={};
const queue=[...assets].sort(),workers=Math.max(1,Math.min(8,Number(process.env.ASSET_WORKERS)||4));
await mkdir(output,{recursive:true});
async function worker(){
 while(queue.length){
  const file=queue.shift(),source=path.join(root,file);
  let targetFile=file;
  const original=await readFile(source);beforeBytes+=original.length;await mkdir(path.dirname(path.join(output,file)),{recursive:true});
  let result=original;
  if(file.endsWith('.png')&&!file.startsWith('assets/social/')){
   const candidate=await sharp(original).keepIccProfile().webp({lossless:true,effort:4}).toBuffer();
   if(candidate.length<original.length){
    const sourcePixels=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const targetPixels=await sharp(candidate).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    if(JSON.stringify(sourcePixels.info)!==JSON.stringify(targetPixels.info))throw Error(`Image dimensions changed: ${file}`);
    for(let i=0;i<sourcePixels.data.length;i+=4){
      if(sourcePixels.data[i+3]!==targetPixels.data[i+3]||(sourcePixels.data[i+3]>0&&[0,1,2].some(c=>sourcePixels.data[i+c]!==targetPixels.data[i+c])))throw Error(`Lossless pixel validation failed: ${file}`);
    }
    result=candidate;targetFile=file.replace(/\.png$/,'.webp');optimized++;
   }
  }
  await writeFile(path.join(output,targetFile),result);afterBytes+=result.length;completed++;
  assetMap['/'+file]={file:targetFile,etag:createHash('sha256').update(result).digest('hex')};
  if(completed%500===0)console.log(`Assets: ${completed}/${assets.size}`);
 }
}
await Promise.all(Array.from({length:workers},worker));
for(const directory of ['src','styles']){
 await mkdir(path.join(output,directory),{recursive:true});
 for(const name of await readdir(path.join(root,directory)))if((await stat(path.join(root,directory,name))).isFile())await copyFile(path.join(root,directory,name),path.join(output,directory,name));
}
for(const name of ['index.html','server.mjs','package.json','package-lock.json'])await copyFile(path.join(root,name),path.join(output,name));
await writeFile(path.join(output,'production-assets.json'),JSON.stringify(assetMap));
async function compressText(dir){
 for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){await compressText(file);continue;}
  if(!/\.(js|css|html|json)$/.test(file))continue;const bytes=await readFile(file);if(bytes.length<1024)continue;
  await writeFile(file+'.br',brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:5}}));await writeFile(file+'.gz',gzipSync(bytes,{level:9}));
 }
}
await compressText(output);
const report={assetCount:assets.size,losslessWebpImages:optimized,inputBytes:beforeBytes,outputBytes:afterBytes,savedBytes:beforeBytes-afterBytes,pixels:'Validated identical visible RGBA pixels for every lossless WebP; fully transparent RGB is ignored',dimensions:'Unchanged',originalFiles:'Read only'};
await writeFile(path.join(output,'build-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
