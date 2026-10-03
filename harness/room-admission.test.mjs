import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createConnection} from 'node:net';
import {matchMaker} from '@colyseus/core';
const directory=await mkdtemp(path.join(tmpdir(),'buteco-admission-'));
process.env.NODE_ENV='test';process.env.PORT='3195';process.env.RANKING_DB=path.join(directory,'ranking.sqlite');process.env.TRUSTED_PROXY_IPS='127.0.0.1';
const {gameServer,rankings}=await import('../server.mjs');
const endpoint='http://127.0.0.1:3195';
const profile=()=>rankings.register('Admission tester');
const rooms=()=>matchMaker.query({name:'fight'});
const request=async (body,ip='203.0.113.1',method='create',headers={})=>{
 const response=await fetch(`${endpoint}/matchmake/${method}/fight`,{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':ip,...headers},body:typeof body==='string'?body:JSON.stringify(body)});
 return {status:response.status,body:await response.json(),retry:response.headers.get('retry-after')};
};
const dispose=async id=>{await matchMaker.getLocalRoomById(id)?.disconnect();};
const disposeAll=async()=>{await Promise.all((await rooms()).map(room=>dispose(room.roomId)));};
after(async()=>{await disposeAll();await gameServer.gracefullyShutdown(false);rankings.close();await rm(directory,{recursive:true,force:true});});

test('invalid identity is rejected before allocating any room',async()=>{
 const result=await request({token:'invalid'});assert.equal(result.status,401);assert.equal((await rooms()).length,0);
});
test('one identity cannot reserve concurrent rooms, including from different IPs',async()=>{
 const p=profile(),first=await request({token:p.token},'203.0.113.2');assert.equal(first.status,200);
 try{const duplicate=await request({token:p.token},'203.0.113.3');assert.equal(duplicate.status,409);assert.equal((await rooms()).length,1);}finally{await disposeAll();}
 assert.equal((await request({token:p.token},'203.0.113.2')).status,200);await disposeAll();
});
test('the fourth rapid create is refused even after earlier rooms were closed',async()=>{
 const p=profile();for(let n=0;n<3;n++){assert.equal((await request({token:p.token},'203.0.113.4')).status,200);await disposeAll();}
 const fourth=await request({token:p.token},'203.0.113.4');assert.equal(fourth.status,429);assert.ok(Number(fourth.retry)>0);assert.equal((await rooms()).length,0);
});
test('shared IP allows four creators and recovers a slot after room disposal',async()=>{
 const opened=[];try{
 for(let n=0;n<4;n++){const result=await request({token:profile().token},'203.0.113.5');assert.equal(result.status,200);opened.push(result.body.roomId);}
 const fifth=await request({token:profile().token},'203.0.113.5');assert.equal(fifth.status,429);assert.equal((await rooms()).length,4);
 await dispose(opened[0]);assert.equal((await request({token:profile().token},'203.0.113.5')).status,200);
 }finally{await disposeAll();}
});
test('invalid tokens consume the IP attempt budget and forwarded headers cannot override it',async()=>{
 for(let n=0;n<10;n++)assert.equal((await request({token:'invalid'},'203.0.113.6','create',{'X-Forwarded-For':`198.51.100.${n+1}`})).status,401);
 const result=await request({token:profile().token},'203.0.113.6');assert.equal(result.status,429);assert.ok(Number(result.retry)>0);assert.equal((await rooms()).length,0);
});
test('parallel requests for one identity allocate only one room',async()=>{
 const p=profile();try{
 const results=await Promise.all(Array.from({length:10},(_,n)=>request({token:p.token},`203.0.113.${20+n}`)));
 assert.equal(results.filter(r=>r.status===200).length,1);assert.ok(results.filter(r=>r.status!==200).every(r=>[409,429].includes(r.status)));assert.equal((await rooms()).length,1);
 }finally{await disposeAll();}
});
test('alternate creation route, malformed JSON and oversized options cannot allocate rooms',async()=>{
 assert.equal((await request({token:profile().token},'203.0.113.7','joinOrCreate')).status,403);
 assert.equal((await request('{bad','203.0.113.7')).status,400);
 assert.equal((await request({token:profile().token,padding:'x'.repeat(3000)},'203.0.113.7')).status,413);
 assert.equal((await rooms()).length,0);
});
test('global capacity includes HTTP reservations before any WebSocket connects',async()=>{
 try{for(let n=0;n<50;n++){const result=await request({token:profile().token},`198.51.100.${n+1}`);assert.equal(result.status,200);}
 const result=await request({token:profile().token},'198.51.100.51');assert.equal(result.status,503);assert.equal((await rooms()).length,50);
 }finally{await disposeAll();}
});

test('direct matchmaking calls cannot bypass admission',async()=>{
 await assert.rejects(matchMaker.create('fight',{token:profile().token}),e=>e.code===403);
 assert.equal((await rooms()).length,0);
});

test('aborted option uploads do not allocate rooms or stop the server',async()=>{
 await new Promise(resolve=>{const socket=createConnection(3195,'127.0.0.1',()=>{socket.write('POST /matchmake/create/fight HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n{');setTimeout(()=>{socket.destroy();resolve();},20);});});
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal((await fetch(endpoint+'/api/rooms')).status,200);assert.equal((await rooms()).length,0);
});
