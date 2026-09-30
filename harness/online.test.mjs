import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {Client} from '@colyseus/sdk';
import {matchMaker} from '@colyseus/core';
const temp=await mkdtemp(path.join(tmpdir(),'buteco-online-'));
process.env.PORT='3195';process.env.RANKING_DB=path.join(temp,'ranking.sqlite');
const {gameServer,rankings}=await import('../server.mjs');
const endpoint='http://127.0.0.1:3195';
const profile=async name=>(await fetch(endpoint+'/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})})).json();
const a=await profile('Online host'),b=await profile('Online guest'),c=await profile('Other guest');
const client=new Client(endpoint),rooms=[];
const track=room=>{rooms.push(room);room.events=[];room.onMessage('*',(type,data)=>room.events.push({type,data}));return room;};
const until=async condition=>{for(let n=0;n<100;n++){if(await condition())return;await delay(30);}throw Error('Timed out');};
try {
  const host=track(await client.create('fight',{token:a.token,fighter:'maya'}));
  const guest=track(await client.joinById(host.roomId,{token:b.token,fighter:'bruno'}));
  await until(()=>host.events.some(e=>e.type==='lobby'&&e.data.players.length===2));
  await assert.rejects(client.joinById(host.roomId,{token:c.token}));
  const room=matchMaker.getLocalRoomById(host.roomId);assert.equal(room.members.size,2);
  guest.send('kick');guest.send('configure',{stage:3});guest.send('start');await delay(80);assert.equal(room.stage,0);assert.equal(room.members.size,2);assert.equal(room.phase,'waiting');
  host.send('kick');await until(()=>room.members.size===1);assert.equal(rankings.list().length,0);
  await assert.rejects(client.joinById(host.roomId,{token:b.token}));
  const challenger=track(await client.joinById(host.roomId,{token:c.token,fighter:'bruno'}));
  host.send('configure',{fighter:'__proto__'});challenger.send('configure',{fighter:'constructor'});await delay(40);assert.deepEqual([...room.members.values()].map(p=>p.fighter),['maya','bruno']);
  host.send('configure',{stage:2});await delay(60);host.send('ready');challenger.send('ready');await until(()=>[...room.members.values()].every(p=>p.ready));host.send('start');
  await until(()=>room.phase==='loading');host.send('loaded',{matchId:'old-match'});await delay(40);assert.equal([...room.members.values()][0].loaded,false);host.send('loaded',{matchId:room.matchId});challenger.send('loaded',{matchId:room.matchId});await until(()=>room.phase==='fighting');
  room.simulation.phase='fight';const x=room.simulation.fighters[1].x;
  challenger.send('input',['left']);await delay(120);assert.ok(room.simulation.fighters[1].x<x);assert.equal(room.simulation.fighters[0].x,670);
  challenger.send('input',[]);host.send('result',{winner:1,perfect:true});await delay(50);assert.equal(rankings.list().length,0);
  host.send('input',['not-an-action']);await delay(40);assert.ok(!room.inputs[0].held.has('not-an-action'));
  for(let n=0;n<2;n++) {
    room.simulation.fighters[0].health=100;room.simulation.fighters[1].health=0;room.simulation.finishRound();room.simulation.phaseTime=.001;
    await until(()=>n===0?room.simulation.round===2:room.phase==='finished');
  }
  const result=host.events.find(e=>e.type==='result').data;assert.equal(result.winner,0);assert.equal(result.perfect,true);
  assert.equal(rankings.list()[0].wins,1);assert.equal(rankings.list()[0].perfects,1);
  host.send('return');await until(()=>room.phase==='waiting');host.send('ready');challenger.send('ready');await until(()=>[...room.members.values()].every(p=>p.ready));host.send('start');await until(()=>room.phase==='loading');host.send('loaded',{matchId:room.matchId});challenger.send('loaded',{matchId:room.matchId});await until(()=>room.phase==='fighting');
  room.simulation.fighters[0].health=80;await until(()=>room.damaged[0]);
  for(let n=0;n<2;n++){room.simulation.fighters[1].health=0;room.simulation.finishRound();room.simulation.phaseTime=.001;await until(()=>n===0?room.simulation.round===2:room.phase==='finished');}
  assert.equal(rankings.list()[0].wins,2);assert.equal(rankings.list()[0].perfects,1);
  host.send('return');await until(()=>room.phase==='waiting');host.send('ready');challenger.send('ready');await until(()=>[...room.members.values()].every(p=>p.ready));host.send('start');await until(()=>room.phase==='loading');host.send('loaded',{matchId:room.matchId});challenger.send('loaded',{matchId:room.matchId});await until(()=>room.phase==='fighting');
  await challenger.leave();await until(()=>rankings.list()[0].wins===3);assert.equal(rankings.list()[0].perfects,1);
  const hostId=host.roomId;await host.leave();await until(()=>!matchMaker.getLocalRoomById(hostId));
  const list=await (await fetch(endpoint+'/api/ranking')).json();assert.equal(list[0].wins,3);assert.ok(!JSON.stringify(list).includes(a.token));
  assert.equal((await fetch(endpoint+'/data/ranking.sqlite')).status,403);
  console.log('PASS real Colyseus clients: create/join/full, ownership, kick/ban, waiting, ready/load/start, server input, forged-result rejection, perfects, forfeit, ranking and closure');
}finally{for(const room of rooms)try{if(room.connection.isOpen)await Promise.race([room.leave(),delay(200)]);}catch{}await gameServer.gracefullyShutdown(false);rankings.close();}
