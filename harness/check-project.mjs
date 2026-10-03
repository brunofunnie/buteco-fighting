import {readdir,readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const files=['server.mjs',...(await readdir(path.join(root,'build'))).filter(f=>f.endsWith('.mjs')).map(f=>'build/'+f),...(await readdir(path.join(root,'src'))).filter(f=>f.endsWith('.js')).map(f=>'src/'+f),...(await readdir(path.join(root,'tools'))).filter(f=>f.endsWith('.js')).map(f=>'tools/'+f)];
for(const file of files){
 const result=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});
 if(result.status!==0)throw Error(result.stderr);
 const content=await readFile(path.join(root,file),'utf8');
 for(const match of content.matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g))await access(path.resolve(root,path.dirname(file),match[1]));
}
const html=await readFile(path.join(root,'index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="([^"?#]+)"/g)){if(/^(https?:|data:|app:)/.test(match[1]))continue;await access(path.join(root,match[1]));}
for(const name of(await readdir(path.join(root,'styles'))).filter(f=>f.endsWith('.css'))){
 const content=await readFile(path.join(root,'styles',name),'utf8');
 for(const match of content.matchAll(/url\(['"]?([^'"\s)]+)['"]?\)/g)){
  if(/^(https?:|data:)/.test(match[1]))continue;
  await access(match[1].startsWith('/')?path.join(root,match[1]):path.resolve(root,'styles',match[1]));
 }
}
console.log(`PASS syntax (${files.length} modules), relative imports, HTML resources and stylesheet URLs`);
