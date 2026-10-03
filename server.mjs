import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {gzipSync} from 'node:zlib';
import { fileURLToPath } from "node:url";
import {Server, matchMaker} from '@colyseus/core';
import {WebSocketTransport} from '@colyseus/ws-transport';
import {Rankings} from './src/ranking.js';
import {createFightRoom} from './src/online-room.js';
import {RoomAdmission,createClientIpResolver,installRoomAdmission} from './src/room-admission.js';
const admission=new RoomAdmission();
const clientIp=createClientIpResolver(process.env.TRUSTED_PROXY_IPS);
const rankings=new Rankings(process.env.RANKING_DB || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'rankings.sqlite'));
const rate=new Map();
let rankingCache,rankingCacheAt=0,rankingVersion=-1;
const root = path.dirname(fileURLToPath(import.meta.url));
const productionAssets=await readFile(path.join(root,'production-assets.json'),'utf8').then(JSON.parse).catch(()=>({}));
const compressedScripts=new Map();
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ttf": "font/ttf",
};
const handleRequest = async (req, res) => {
    try {
      const pathname=new URL(req.url,'http://localhost').pathname;
      if(pathname==='/api/ranking'&&req.method==='GET'){if(Date.now()-rankingCacheAt>10000||!rankingCache||rankingVersion!==rankings.revision){rankingCache=JSON.stringify(rankings.list());rankingCacheAt=Date.now();rankingVersion=rankings.revision;}res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-cache'});res.end(rankingCache);return;}
      if(pathname==='/api/rooms'&&req.method==='GET'){const rooms=await matchMaker.query({name:'fight',private:false});res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(rooms.map(r=>({id:r.roomId,clients:r.clients,name:r.metadata.name,stage:r.metadata.stage,phase:r.metadata.phase,players:r.metadata.players||0,spectators:r.metadata.spectators||0}))));return;}
      if(pathname==='/api/profile'&&req.method==='POST'){
        const ip=clientIp(req),now=Date.now(),entries=(rate.get(ip)||[]).filter(t=>now-t<60000);
        if(entries.length>=30){res.writeHead(429);res.end('Aguarde um minuto.');return;}
        entries.push(now);rate.set(ip,entries);if(rate.size>10000)rate.clear();
        let body=typeof req.body==='object'?JSON.stringify(req.body):req.body;
        if(body===undefined){body='';for await(const part of req){body+=part;if(body.length>2048)break;}}
        if(body.length>2048){res.writeHead(413);res.end();return;}
        try {const data=JSON.parse(body),existing=rankings.identify(data.token),profile=existing?(data.name?rankings.rename(data.token,data.name):existing):rankings.register(data.guest?'Desafiante '+Math.random().toString(36).slice(2,6).toUpperCase():data.name);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({...profile,...(data.token&&rankings.identify(data.token)?{token:data.token}:{})}));}catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}return;
      }
      const route = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const asset=productionAssets[route];
      const file = path.resolve(
        root,
        asset ? asset.file : "." + (route === "/" ? "/index.html" : route),
      );
      if (
        !file.startsWith(root + path.sep) ||
        ["/data", "/harness", "/docs", "/.git"].some(prefix=>route===prefix||route.startsWith(prefix+"/")) ||
        /\.(sqlite|sqlite-wal|sqlite-shm|mjs)$/.test(route) ||
        route.split("/").some((p) => p.startsWith("."))
      ) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const details=await stat(file);
      if (!details.isFile()) throw new Error("Missing");
      const etag=`W/"${asset?.etag||`${details.size}-${details.mtimeMs}`}"`;
      const headers={
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "public, max-age=0, must-revalidate",
        "ETag":etag,
        "Vary":"Accept-Encoding",
      };
      if(req.headers['if-none-match']?.split(/\s*,\s*/).some(value=>value===etag||value==='*')){res.writeHead(304,headers);res.end();return;}
      let bytes;
      const accepted=(req.headers['accept-encoding']||'').split(',').map(part=>part.trim().split(';')).filter(([,q])=>!q||Number(q.trim().replace('q=',''))>0).map(([name])=>name);
      if(/\.(js|css|html|json)$/.test(file)){
        for(const [encoding,suffix]of [['br','.br'],['gzip','.gz']])if(accepted.includes(encoding)){
          try{bytes=await readFile(file+suffix);headers['Content-Encoding']=encoding;break;}catch{}
        }
        if(!bytes&&accepted.includes('gzip')&&details.size>=1024){
          const key=file+etag;
          bytes=compressedScripts.get(key);
          if(!bytes){bytes=gzipSync(await readFile(file));if(compressedScripts.size>=32)compressedScripts.delete(compressedScripts.keys().next().value);compressedScripts.set(key,bytes);}
          headers['Content-Encoding']='gzip';
        }
      }
      bytes ||= await readFile(file);
      headers['Content-Length']=bytes.length;
      res.writeHead(200,headers);
      res.end(req.method==='HEAD'?undefined:bytes);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  };
const httpServer=http.createServer();
const gameServer=new Server({transport:new WebSocketTransport({server:httpServer,maxPayload:4096}),greet:false,gracefullyShutdown:process.env.NODE_ENV!=='test',express:app=>app.use(handleRequest)});
gameServer.define('fight',createFightRoom(rankings,admission));
await gameServer.listen(Number(process.env.PORT)||3187,'0.0.0.0');
installRoomAdmission(httpServer,admission,rankings,clientIp);
console.log(`Buteco Fighting + Colyseus: port ${Number(process.env.PORT)||3187}`);
export {gameServer,rankings};
