import {randomUUID} from 'node:crypto';
import {isIP} from 'node:net';

export class AdmissionError extends Error {
  constructor(code,message,retryAfter=0){super(message);this.code=code;this.retryAfter=retryAfter;}
}
const normalize=ip=>typeof ip==='string'?ip.replace(/^::ffff:/,''):'';
export function createClientIpResolver(peers='') {
  const trusted=new Set(peers.split(',').map(value=>normalize(value.trim())).filter(Boolean));
  return req=>{
    const peer=normalize(req.socket.remoteAddress);
    const forwarded=normalize(req.headers['cf-connecting-ip']);
    return trusted.has(peer)&&isIP(forwarded)?forwarded:peer;
  };
}

// One process owns matchmaking. Pending admissions count towards capacity too.
export class RoomAdmission {
  constructor(now=Date.now){this.now=now;this.attempts=new Map();this.tickets=new Map();}
  prune(){
    const now=this.now();
    for(const [key,times]of this.attempts){const recent=times.filter(time=>now-time<60000);if(recent.length)this.attempts.set(key,recent);else this.attempts.delete(key);}
    for(const [id,ticket]of this.tickets)if(!ticket.roomId&&now-ticket.at>=30000)this.tickets.delete(id);
  }
  attempt(key,limit){
    const times=this.attempts.get(key)||[];
    if(times.length>=limit)throw new AdmissionError(429,'Muitas tentativas de criar sala. Aguarde e tente novamente.',Math.max(1,Math.ceil((times[0]+60000-this.now())/1000)));
    times.push(this.now());this.attempts.set(key,times);
  }
  checkIp(ip){this.prune();this.attempt('global',120);this.attempt(`ip:${ip}`,10);}
  reserve(ip,player){
    this.prune();this.attempt(`player:${player}`,3);
    const slots=[...this.tickets.values()];
    if(slots.some(slot=>slot.player===player))throw new AdmissionError(409,'Você já tem uma sala aberta. Encerre-a antes de criar outra.');
    if(slots.filter(slot=>slot.ip===ip).length>=4)throw new AdmissionError(429,'Sua rede já tem quatro salas abertas. Encerre uma antes de criar outra.',15);
    if(slots.length>=50)throw new AdmissionError(503,'O servidor atingiu o limite de salas. Tente novamente em alguns instantes.',15);
    const id=randomUUID();this.tickets.set(id,{ip,player,at:this.now(),roomId:null});return id;
  }
  consume(id,player,roomId){
    this.prune();const ticket=this.tickets.get(id);
    if(!ticket||ticket.player!==player||ticket.roomId)throw new AdmissionError(403,'Criação de sala não autorizada. Use o menu online.');
    ticket.roomId=roomId;
  }
  cancelPending(id){if(!this.tickets.get(id)?.roomId)this.tickets.delete(id);}
  releaseRoom(roomId){for(const [id,ticket]of this.tickets)if(ticket.roomId===roomId)this.tickets.delete(id);}
}

function readOptions(req){
  return new Promise((resolve,reject)=>{
    let size=0;const chunks=[];
    const finish=(error,body)=>{clearTimeout(timer);req.removeListener('data',data);req.removeListener('end',end);req.removeListener('aborted',aborted);req.removeListener('error',aborted);if(error){req.resume();reject(error);}else resolve(body);};
    const data=chunk=>{size+=chunk.length;if(size>2048)finish(new AdmissionError(413,'Dados da sala excedem o limite permitido.'));else chunks.push(chunk);};
    const end=()=>{try{const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();finish(null,body);}catch{finish(new AdmissionError(400,'Dados da sala inválidos.'));}};
    const aborted=()=>finish(new AdmissionError(400,'Solicitação interrompida.'));
    const timer=setTimeout(()=>finish(new AdmissionError(408,'Tempo de solicitação excedido.')),5000);
    req.on('data',data);req.once('end',end);req.once('aborted',aborted);req.once('error',aborted);
  });
}

// Colyseus handles matchmaking ahead of Express, so guard the raw HTTP listener.
export function installRoomAdmission(server,admission,rankings,clientIp){
  const handlers=server.listeners('request');server.removeAllListeners('request');
  const forward=(req,res)=>{for(const handler of handlers)handler.call(server,req,res);};
  server.on('request',async(req,res)=>{
    let ticket;
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(req.method!=='POST'||!pathname.startsWith('/matchmake/'))return forward(req,res);
      const [,method,name]=pathname.split('/').slice(1);
      if(method==='joinOrCreate')throw new AdmissionError(403,'Crie uma sala pelo menu online.');
      const creating=method==='create';const ip=clientIp(req);
      if(creating){admission.checkIp(ip);if(name!=='fight')throw new AdmissionError(404,'Tipo de sala inválido.');}
      const options=await readOptions(req);
      if(req.aborted||res.destroyed)return;
      if(creating){
        const player=rankings.identify(options.token);
        if(!player)throw new AdmissionError(401,'Identidade inválida. Reabra o menu online.');
        if(options.spectator===true)throw new AdmissionError(403,'Espectadores devem entrar em uma sala existente.');
        ticket=admission.reserve(ip,player.id);
        req.body={token:options.token,fighter:options.fighter,spectator:false,_roomAdmission:ticket};
        const cancel=()=>admission.cancelPending(ticket);res.once('finish',cancel);res.once('close',cancel);
      }else req.body=options;
      forward(req,res);
    }catch(error){
      if(ticket)admission.cancelPending(ticket);
      req.resume();
      if(res.destroyed||res.headersSent)return;
      const status=error instanceof AdmissionError?error.code:400;
      res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...(error.retryAfter?{'Retry-After':String(error.retryAfter)}:{})});
      res.end(JSON.stringify({code:status,error:error instanceof AdmissionError?error.message:'Solicitação inválida.'}));
    }
  });
}
