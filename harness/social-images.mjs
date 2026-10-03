import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const variants=[['buteco-fighting-og.png',1200,630],['buteco-fighting-twitter.png',1200,675],['buteco-fighting-square.png',1200,1200]];
const server=createServer(async(req,res)=>{
 try{
  const route=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(route==='/'?'/tools/social-cover.html':route));
  if(!file.startsWith(root+path.sep))throw Error('Invalid path');
  const data=await readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'image/png');res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch();
try{
 await mkdir(path.join(root,'assets/social'),{recursive:true});
 for(const[name,width,height]of variants){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode()));await document.fonts.ready;});
  const bounds=await page.locator('.identity').boundingBox();
  assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<height-30,'Branding safe area');
  await page.screenshot({path:path.join(root,'assets/social',name)});
  const png=await readFile(path.join(root,'assets/social',name));assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);assert.deepEqual(errors,[]);
  console.log(`PASS ${name}: ${width} × ${height}, original art/logos loaded, branding within margins`);
  await page.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
