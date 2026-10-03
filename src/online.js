const $=s=>document.querySelector(s);
const identityKey='buteco-online-profile-v1';
export class OnlineVersus {
  constructor({prepare,frame,result,exit,selection}) {
    this.callbacks={prepare,frame,result,exit,selection};this.rankingAt=0;this.lastInput='';this.lastSend=0;this.connectionGeneration=0;
    this.client=new window.Colyseus.Client(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}`);
    try{this.profile=JSON.parse(localStorage.getItem(identityKey)||'null');}catch{}
    $('#onlineName').value=this.profile?.name||'';
    $('#createRoom').onclick=()=>{if(this.busy||this.room)return;$('#onlineName').value=this.profile?.name||'';$('#createRoomDialog').showModal();$('#onlineName').focus();};
    $('#cancelCreateRoom').onclick=()=>$('#createRoomDialog').close();
    $('#createRoomForm').onsubmit=event=>{event.preventDefault();$('#createRoomDialog').close();this.connect('create');};
    $('#watchRoom').onclick=()=>this.connect('watch', $('#roomCode').value.trim());
    $('#joinRoom').onclick=()=>this.connect('join', $('#roomCode').value.trim());
    $('#onlineStart').onclick=()=>this.room?.send('start');$('#onlineKick').onclick=()=>this.room?.send('kick');
    $('#leaveRoom').onclick=()=>this.leave();$('#refreshRooms').onclick=()=>this.refresh();
    $('#copyRoom').onclick=async()=>{try{await navigator.clipboard.writeText(`${location.origin}/?room=${encodeURIComponent(this.room.roomId)}`);this.status('Convite copiado. Envie para o desafiante.');}catch{this.status(`Código da sala: ${this.room.roomId}`);}};
    $('#roomCode').value=new URLSearchParams(location.search).get('room')||'';
  }
  status(message){$('#onlineStatus').textContent=message;}
  async identity(type) {
    const response=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:this.profile?.token,...(type==='create'?{name:$('#onlineName').value}:{guest:true})})});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível salvar seu jogador.');
    this.profile=data;try{localStorage.setItem(identityKey,JSON.stringify(data));}catch{}
    $('#onlineName').value=data.name;return data;
  }
  async connect(type,id) {
    if(this.busy||this.room)return;if(type!=='create'&&!id){this.status('Informe o código da sala.');return;}
    const generation=++this.connectionGeneration;this.resultMessage=null;
    this.busy=true;this.status('Conectando…');$('#createRoom').disabled=true;$('#joinRoom').disabled=true;
    try {
      const profile=await this.identity(type);if(generation!==this.connectionGeneration)return;const options={token:profile.token,spectator:type==='watch'};
      const room=type==='create'?await this.client.create('fight',options):await this.client.joinById(id,options);
      if(generation!==this.connectionGeneration){await room.leave();return;}
      this.room=room;this.lobby=null;this.slot=type==='watch'?null:undefined;this.pendingFrame=null;
      room.onMessage('seat',data=>this.slot=data.slot);
      room.onMessage('probe',probe=>room.send('pong',probe));
      room.onMessage('latency',players=>{if(this.lobby){for(const update of players){const player=[...this.lobby.players,...(this.lobby.spectators||[])].find(p=>p.sessionId===update.sessionId);if(player)player.ping=update.ping;}this.renderPlayers();}});
      room.onMessage('lobby',lobby=>this.renderLobby(lobby));
      room.onMessage('notice',message=>{this.notice=message;this.status(message);});
      room.onMessage('prepare',async config=>{
        this.pendingFrame=null;
        try{const prepared=await this.callbacks.prepare(config);if(prepared&&this.room===room&&this.lobby?.matchId===config.matchId){if(this.slot!==null&&this.lobby.phase==='loading')room.send('loaded',{matchId:config.matchId});if(this.pendingFrame)this.callbacks.frame(this.pendingFrame);}}catch{if(this.room===room&&this.lobby?.matchId===config.matchId){this.status('Erro ao carregar a luta. Saia e tente novamente.');await this.leave();}}
      });
      room.onMessage('frame',snapshot=>{this.pendingFrame=snapshot;this.callbacks.frame(snapshot);});
      room.onMessage('result',result=>{this.resultMessage=`${result.name} venceu${result.perfect?' com PERFECT':''}${result.reason==='disconnect'?' por desconexão':''}. Resultado registrado no ranking. `;this.callbacks.result(result);this.rankingAt=0;this.refreshRanking();});
      room.onLeave(()=>{
        if(this.room!==room)return;this.room=null;this.lobby=null;this.renderEmpty();this.callbacks.exit();this.status((this.resultMessage||'')+(this.notice||'Você saiu da sala.'));this.notice=null;this.refresh();
      });
      // Lobby messages are sent after the Colyseus handshake; request a fresh copy as well.
      room.send('sync');
    }catch(e){this.status(`Não foi possível conectar: ${e.message}`);}
    finally{this.busy=false;$('#createRoom').disabled=false;$('#joinRoom').disabled=false;}
  }
  renderEmpty(){$('#onlineEntry').hidden=false;$('#onlineRoom').hidden=true;}
  renderLobby(lobby) {
    this.lobby=lobby;const self=lobby.players.find(p=>p.sessionId===this.room?.sessionId);this.slot=self?self.slot:null;
    $('#onlineEntry').hidden=true;$('#onlineRoom').hidden=false;$('#roomId').textContent=lobby.id;
    const host=this.room?.sessionId===lobby.host;
    this.renderPlayers();
    $('#onlineStart').hidden=!host;$('#onlineStart').disabled=lobby.phase!=='waiting'||lobby.players.length!==2;
    $('#onlineKick').hidden=!host;$('#onlineKick').disabled=lobby.phase!=='waiting'||lobby.players.length<2;
    this.callbacks.selection(lobby);
    if(lobby.phase==='waiting') { this.callbacks.exit(true);this.status((this.resultMessage||'')+(lobby.players.length===1?'Aguardando desafiante. Copie o convite e compartilhe.':'Desafiante conectado. O anfitrião pode iniciar a seleção de personagens.')); }
    else if(lobby.phase==='loading'){this.resultMessage=null;this.status('Preparando lutadores nos dois dispositivos…');}
  }
  renderPlayers() {
    if(!this.lobby)return;
    $('#roomPlayers').replaceChildren(...[...this.lobby.players,...(this.lobby.spectators||[])].map(p=>{
      const row=document.createElement('div');row.className='room-player';
      const label=document.createElement('span');label.textContent=`${p.slot===null?'ESPECTADOR':'P'+(p.slot+1)} · ${p.name}${p.sessionId===this.lobby.host?' · ANFITRIÃO':''}`;
      const ping=document.createElement('span');ping.className='player-ping';
      const level=p.ping===null||p.ping===undefined?0:p.ping<=80?4:p.ping<=160?3:p.ping<=300?2:1;
      ping.dataset.quality=['pending','poor','slow','fair','good'][level];ping.setAttribute('aria-label',p.ping==null?'Medindo conexão':`Ping: ${p.ping} milissegundos`);
      const bars=document.createElement('span');bars.className='signal-bars';bars.setAttribute('aria-hidden','true');
      for(let i=1;i<=4;i++){const bar=document.createElement('i');bar.className=i<=level?'lit':'';bars.append(bar);}
      const text=document.createElement('span');text.textContent=p.ping==null?'Medindo…':`${p.ping} ms`;ping.append(bars,text);row.append(label,ping);return row;
    }));
  }
  open() {this.refresh();this.refreshRanking();}
  sendInput(held) {
    if(!this.room||this.slot===null||this.lobby?.phase!=='fighting')return;
    const value=JSON.stringify(held),now=performance.now();
    if(value!==this.lastInput||now-this.lastSend>=100){this.room.send('input',held);this.lastInput=value;this.lastSend=now;}
  }
  returnToLobby(){this.room?.send('return');}
  async leave(){this.connectionGeneration++;const room=this.room;if(!room)return;this.room=null;this.lobby=null;await room.leave();this.renderEmpty();this.callbacks.exit();this.refresh();}
  async refresh() {
    try {
      const response=await fetch('/api/rooms');if(!response.ok)throw Error();const rooms=await response.json();
      $('#roomList').replaceChildren(...rooms.map(room=>{
        const row=document.createElement('div');row.className='room-list-row';
        const label=document.createElement('span');label.textContent=`${room.name} · ${room.players}/2 · ${room.spectators}/10 espectadores · ${room.phase==='waiting'?'LOBBY':'EM PARTIDA'} · ${room.id}`;
        const join=document.createElement('button');join.className='room-list-item';join.textContent='ENTRAR';join.disabled=room.players>=2||room.phase!=='waiting'||!!this.room;join.onclick=()=>this.connect('join',room.id);
        const watch=document.createElement('button');watch.textContent='ASSISTIR';watch.disabled=room.spectators>=10||!!this.room;watch.onclick=()=>this.connect('watch',room.id);
        row.append(label,join,watch);return row;
      }));
      if(!rooms.length)$('#roomList').textContent='Nenhuma sala aberta. Crie a sua!';
    }catch{$('#roomList').textContent='Não foi possível carregar as salas. Use ATUALIZAR para tentar novamente.';}
  }
  async refreshRanking() {
    if(this.rankingPending||Date.now()-this.rankingAt<10000)return;
    this.rankingPending=true;this.rankingAt=Date.now();
    try{const response=await fetch('/api/ranking');if(!response.ok)throw Error();const rows=await response.json();$('#rankingRows').replaceChildren(...rows.map((p,i)=>{const row=document.createElement('tr');for(const value of [i+1,p.name,p.wins,p.perfects,p.losses]){const cell=document.createElement('td');cell.textContent=String(value);row.append(cell);}return row;}));if(!rows.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=5;cell.textContent='As primeiras vitórias vão aparecer aqui.';row.append(cell);$('#rankingRows').append(row);}}catch{$('#rankingRows').textContent='Ranking indisponível. Reabra o multiplayer para tentar novamente.';}finally{this.rankingPending=false;}
  }
}
