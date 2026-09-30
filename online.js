import {FIGHTERS} from './roster.js';
const $=s=>document.querySelector(s);
const identityKey='buteco-online-profile-v1';
export class OnlineVersus {
  constructor({prepare,frame,result,exit}) {
    this.callbacks={prepare,frame,result,exit};this.lastInput='';this.lastSend=0;this.connectionGeneration=0;
    this.client=new window.Colyseus.Client(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}`);
    try{this.profile=JSON.parse(localStorage.getItem(identityKey)||'null');}catch{}
    $('#onlineName').value=this.profile?.name||'';
    $('#onlineName').disabled=!!this.profile;
    for(const [id,f] of Object.entries(FIGHTERS)){const option=document.createElement('option');option.value=id;option.textContent=f.name;$('#onlineFighter').append(option);}
    $('#createRoom').onclick=()=>this.connect('create');$('#joinRoom').onclick=()=>this.connect('join', $('#roomCode').value.trim());
    $('#onlineFighter').onchange=()=>this.room?.send('configure',{fighter:$('#onlineFighter').value});
    $('#onlineStage').onchange=()=>this.room?.send('configure',{stage:Number($('#onlineStage').value)});
    $('#onlineReady').onclick=()=>this.room?.send('ready');$('#onlineStart').onclick=()=>this.room?.send('start');$('#onlineKick').onclick=()=>this.room?.send('kick');
    $('#leaveRoom').onclick=()=>this.leave();$('#refreshRooms').onclick=()=>this.refresh();$('#refreshRanking').onclick=()=>this.refreshRanking();
    $('#copyRoom').onclick=async()=>{try{await navigator.clipboard.writeText(`${location.origin}/?room=${encodeURIComponent(this.room.roomId)}`);this.status('Convite copiado. Envie para o desafiante.');}catch{this.status(`Código da sala: ${this.room.roomId}`);}};
    $('#roomCode').value=new URLSearchParams(location.search).get('room')||'';
  }
  status(message){$('#onlineStatus').textContent=message;}
  async identity() {
    const response=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:this.profile?.token,name:$('#onlineName').value})});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível salvar seu jogador.');
    this.profile=data;try{localStorage.setItem(identityKey,JSON.stringify(data));}catch{}
    $('#onlineName').value=data.name;$('#onlineName').disabled=true;return data;
  }
  async connect(type,id) {
    if(this.busy||this.room)return;if(type==='join'&&!id){this.status('Informe o código da sala.');return;}
    const generation=++this.connectionGeneration;this.resultMessage=null;
    this.busy=true;this.status('Conectando…');$('#createRoom').disabled=true;$('#joinRoom').disabled=true;
    try {
      const profile=await this.identity();if(generation!==this.connectionGeneration)return;const options={token:profile.token,fighter:$('#onlineFighter').value};
      const room=type==='create'?await this.client.create('fight',options):await this.client.joinById(id,options);
      if(generation!==this.connectionGeneration){await room.leave();return;}
      this.room=room;this.lobby=null;
      room.onMessage('seat',data=>this.slot=data.slot);
      room.onMessage('lobby',lobby=>this.renderLobby(lobby));
      room.onMessage('notice',message=>{this.notice=message;this.status(message);});
      room.onMessage('prepare',async config=>{
        try{const prepared=await this.callbacks.prepare(config);if(prepared&&this.room===room&&this.lobby?.matchId===config.matchId&&this.lobby.phase==='loading')room.send('loaded',{matchId:config.matchId});}catch{if(this.room===room&&this.lobby?.matchId===config.matchId){this.status('Erro ao carregar a luta. Saia e tente novamente.');await this.leave();}}
      });
      room.onMessage('frame',snapshot=>this.callbacks.frame(snapshot));
      room.onMessage('result',result=>{this.resultMessage=`${result.name} venceu${result.perfect?' com PERFECT':''}${result.reason==='disconnect'?' por desconexão':''}. Resultado registrado no ranking. `;this.callbacks.result(result);this.refreshRanking();});
      room.onLeave(()=>{
        if(this.room!==room)return;this.room=null;this.lobby=null;this.renderEmpty();this.callbacks.exit();this.status((this.resultMessage||'')+(this.notice||'Você saiu da sala.'));this.notice=null;this.refresh();
      });
      // Lobby messages are sent after the Colyseus handshake; request a fresh copy as well.
      room.send('configure',{});
    }catch(e){this.status(`Não foi possível conectar: ${e.message}`);}
    finally{this.busy=false;$('#createRoom').disabled=false;$('#joinRoom').disabled=false;}
  }
  renderEmpty(){$('#onlineEntry').hidden=false;$('#onlineRoom').hidden=true;}
  renderLobby(lobby) {
    this.lobby=lobby;const self=lobby.players.find(p=>p.sessionId===this.room?.sessionId);if(self)this.slot=self.slot;
    $('#onlineEntry').hidden=true;$('#onlineRoom').hidden=false;$('#roomId').textContent=lobby.id;
    const host=this.room?.sessionId===lobby.host;
    $('#onlineStage').value=String(lobby.stage);$('#onlineStage').disabled=!host||lobby.phase!=='waiting';
    $('#onlineFighter').disabled=lobby.phase!=='waiting';
    $('#onlineName').disabled=true;
    $('#roomPlayers').replaceChildren(...lobby.players.map(p=>{const row=document.createElement('p');row.textContent=`P${p.slot+1} · ${p.name} · ${FIGHTERS[p.fighter].name} · ${p.ready?'PRONTO':'PREPARANDO'}${p.sessionId===lobby.host?' · ANFITRIÃO':''}`;return row;}));
    $('#onlineReady').textContent=self?.ready?'CANCELAR PRONTO':'ESTOU PRONTO';$('#onlineReady').disabled=lobby.phase!=='waiting';
    $('#onlineStart').hidden=!host;$('#onlineStart').disabled=lobby.phase!=='waiting'||lobby.players.length!==2||!lobby.players.every(p=>p.ready);
    $('#onlineKick').hidden=!host;$('#onlineKick').disabled=lobby.phase!=='waiting'||lobby.players.length<2;
    if(lobby.phase==='waiting') { this.callbacks.exit(true);this.status((this.resultMessage||'')+(lobby.players.length===1?'Aguardando desafiante. Copie o convite e compartilhe.':'Os dois jogadores devem confirmar que estão prontos.')); }
    else if(lobby.phase==='loading'){this.resultMessage=null;this.status('Preparando lutadores nos dois dispositivos…');}
  }
  sendInput(held) {
    if(!this.room||this.lobby?.phase!=='fighting')return;
    const value=JSON.stringify(held),now=performance.now();
    if(value!==this.lastInput||now-this.lastSend>=100){this.room.send('input',held);this.lastInput=value;this.lastSend=now;}
  }
  returnToLobby(){this.room?.send('return');}
  async leave(){this.connectionGeneration++;const room=this.room;if(!room)return;this.room=null;this.lobby=null;await room.leave();this.renderEmpty();this.callbacks.exit();this.refresh();}
  async refresh() {
    try {
      const response=await fetch('/api/rooms');if(!response.ok)throw Error();const rooms=await response.json();
      $('#roomList').replaceChildren(...rooms.map(room=>{const button=document.createElement('button');button.className='room-list-item';button.textContent=`${room.name} · ${room.clients}/2 · ${room.id}`;button.disabled=room.clients>=2||!!this.room;button.onclick=()=>this.connect('join',room.id);return button;}));
      if(!rooms.length)$('#roomList').textContent='Nenhuma sala aberta. Crie a sua!';
    }catch{$('#roomList').textContent='Não foi possível carregar as salas. Use ATUALIZAR para tentar novamente.';}
    await this.refreshRanking();
  }
  async refreshRanking() {
    try{const response=await fetch('/api/ranking');if(!response.ok)throw Error();const rows=await response.json();$('#rankingRows').replaceChildren(...rows.map((p,i)=>{const row=document.createElement('tr');for(const value of [i+1,p.name,p.wins,p.perfects,p.losses]){const cell=document.createElement('td');cell.textContent=String(value);row.append(cell);}return row;}));if(!rows.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=5;cell.textContent='As primeiras vitórias vão aparecer aqui.';row.append(cell);$('#rankingRows').append(row);}}catch{$('#rankingRows').textContent='Ranking indisponível. Tente atualizar.';}
  }
}
