import {Room,ServerError} from '@colyseus/core';
import {randomUUID} from 'node:crypto';
import {FightGame} from './game.js';
import {FIGHTERS} from './roster.js';
import {ACTION_LABELS} from './controls.js';
const allowed=new Set(Object.keys(ACTION_LABELS));
const validFighter=id=>typeof id==='string'&&Object.hasOwn(FIGHTERS,id);
const neutral=()=>({held:new Set(),pressed:new Set()});
export function createFightRoom(rankings) {
  return class OnlineFightRoom extends Room {
    maxClients=2;
    maxMessagesPerSecond=180;
    onCreate() {
      this.onMessage('*',()=>{});
      this.members=new Map();this.banned=new Set();this.phase='waiting';this.stage=0;this.inputs=[neutral(),neutral()];this.damaged=[false,false];
      this.onMessage('configure',(client,data)=>{
        const member=this.members.get(client.sessionId);if(!member||this.phase!=='waiting')return;
        if(data&&validFighter(data.fighter)){member.fighter=data.fighter;member.ready=false;}
        if(client.sessionId===this.host&&Number.isInteger(data?.stage)&&data.stage>=0&&data.stage<4){this.stage=data.stage;for(const p of this.members.values())p.ready=false;}
        this.publishLobby();
      });
      this.onMessage('ready',client=>{const member=this.members.get(client.sessionId);if(member&&this.phase==='waiting'){member.ready=!member.ready;this.publishLobby();}});
      this.onMessage('kick',client=>{
        if(client.sessionId!==this.host||this.phase!=='waiting')return;
        const guest=this.clients.find(c=>c.sessionId!==this.host);if(!guest)return;
        this.banned.add(this.members.get(guest.sessionId).id);guest.send('notice','Você foi expulso desta sala.');guest.leave(4001);
      });
      this.onMessage('start',client=>{
        if(client.sessionId!==this.host||this.phase!=='waiting'||this.members.size!==2||![...this.members.values()].every(p=>p.ready))return;
        this.startMatch();
      });
      this.onMessage('loaded',(client,data)=>{const p=this.members.get(client.sessionId);if(this.phase==='loading'&&p&&data?.matchId===this.matchId){p.loaded=true;if([...this.members.values()].every(m=>m.loaded))this.beginSimulation();}});
      this.onMessage('input',(client,data)=>{
        if(this.phase!=='fighting'||!Array.isArray(data)||data.length>9||!data.every(a=>allowed.has(a)))return;
        const member=this.members.get(client.sessionId);if(!member)return;
        const input=this.inputs[member.slot],next=new Set(data);
        for(const action of next)if(!input.held.has(action))input.pressed.add(action);
        input.held=next;input.at=Date.now();
      });
      this.onMessage('return',()=>{if(this.phase==='finished')this.resetLobby();});
      this.clock.setInterval(()=>{
        if(this.phase==='waiting'&&Date.now()-this.lastActivity>15*60*1000)this.disconnect();
        if(this.phase==='loading'&&Date.now()-this.loadingAt>30000){this.broadcast('notice','O carregamento demorou demais. Tente iniciar novamente.');this.resetLobby();}
      },5000);
      this.lastActivity=Date.now();
    }
    onAuth(client,options) {
      const player=rankings.identify(options?.token);
      if(!player)throw new ServerError(401,'Identidade inválida. Reabra o menu online.');
      if(this.banned.has(player.id))throw new ServerError(403,'Você foi expulso desta sala.');
      if([...this.members.values()].some(m=>m.id===player.id))throw new ServerError(409,'Esta identidade já está na sala.');
      if(this.phase!=='waiting')throw new ServerError(409,'A partida já começou.');
      return player;
    }
    onJoin(client,options,auth) {
      const slot=this.members.size?1:0;if(!slot)this.host=client.sessionId;
      this.members.set(client.sessionId,{...auth,sessionId:client.sessionId,slot,fighter:validFighter(options.fighter)?options.fighter:slot?'bruno':'maya',ready:false});
      client.send('seat',{slot});this.publishLobby();
    }
    publishLobby() {
      this.lastActivity=Date.now();
      const players=[...this.members.values()].sort((a,b)=>a.slot-b.slot);
      const lobby={matchId:this.matchId,id:this.roomId,host:this.host,phase:this.phase,stage:this.stage,players};
      this.setMetadata({name:players[0]?.name||'Sala',stage:this.stage,phase:this.phase});
      this.broadcast('lobby',lobby);
    }
    startMatch() {
      this.lock();this.phase='loading';this.loadingAt=Date.now();
      this.matchId=randomUUID();this.damaged=[false,false];this.inputs=[neutral(),neutral()];
      for(const p of this.members.values())p.loaded=false;
      this.publishLobby();this.broadcast('prepare',{matchId:this.matchId,players:[...this.members.values()].sort((a,b)=>a.slot-b.slot),stage:this.stage});
    }
    beginSimulation() {
      this.phase='fighting';
      const players=[...this.members.values()].sort((a,b)=>a.slot-b.slot);
      this.simulation=new FightGame({getContext:()=>({})},{},{interactive:false,headless:true,muted:true,onEnd:()=>this.complete(this.simulation.wins[0]>=2?0:1)});
      this.simulation.start({player:players[0].fighter,opponent:players[1].fighter,mode:'versus',stage:this.stage});
      let ticks=0, accumulator=0;
      this.setSimulationInterval(delta=>{
        if(this.phase!=='fighting')return;
        accumulator=Math.min(accumulator+delta/1000,.1);
        const g=this.simulation;
        while(accumulator>=1/120 && this.phase==='fighting'){
        accumulator-=1/120;
        for(let i=0;i<2;i++)if(Date.now()-(this.inputs[i].at||0)>350)this.inputs[i]=neutral();
        g.padFrames=this.inputs;g.update(1/120);for(const input of this.inputs)input.pressed.clear();
        g.fighters.forEach((f,i)=>{if(f.health<100)this.damaged[i]=true;});
        if(++ticks%4===0)this.sendSnapshot();
        }
      },1000/60);
      this.publishLobby();this.sendSnapshot();
    }
    sendSnapshot() {
      const g=this.simulation;if(!g)return;
      const snapshot=Object.fromEntries(['fighters','wins','round','timer','phase','phaseTime','elapsed','cameraX','hitstop','shake','roundWinner','powerEffects','particles','stage'].map(k=>[k,g[k]]));
      snapshot.projectiles=g.projectiles.map(p=>({...p,owner:g.fighters.indexOf(p.owner),hitTargets:[]}));
      this.broadcast('frame',snapshot);
    }
    complete(slot,reason='ko') {
      if(this.phase!=='fighting')return;
      this.phase='finished';this.simulation.running=false;
      const players=[...this.members.values()].sort((a,b)=>a.slot-b.slot),winner=players[slot],loser=players[1-slot];
      const perfect=reason==='ko'&&!this.damaged[slot];
      rankings.record(this.matchId,winner.id,loser.id,perfect,reason);
      this.sendSnapshot();this.broadcast('result',{winner:slot,name:winner.name,perfect,reason});this.publishLobby();
    }
    resetLobby() {
      this.simulation?.destroy();this.simulation=null;this.matchId=null;this.phase='waiting';this.inputs=[neutral(),neutral()];
      for(const p of this.members.values()){p.ready=false;p.loaded=false;}
      this.unlock();this.publishLobby();
    }
    onLeave(client) {
      const member=this.members.get(client.sessionId);if(!member)return;
      if(this.phase==='fighting')this.complete(1-member.slot,'disconnect');
      this.members.delete(client.sessionId);
      if(client.sessionId===this.host){this.broadcast('notice','O anfitrião encerrou a sala.');this.disconnect();}
      else {this.resetLobby();}
    }
    onDispose(){this.simulation?.destroy();}
  };
}
