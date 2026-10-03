import {attachTouchJoystick} from './touch-joystick.js';
import {alternateSprite} from './alternate-palette.js';
import {createSecretMenu,registerSecretAction} from './secret-menu.js';
import {COLLISION_DATA} from './collision-data.js';
import {createArcadeRun,winArcadeMatch,arcadeProgress} from './arcade-run.js';
import {getInputDevice,onInputDeviceChange} from './input-device.js';
import {navigateOptions,showOptionsTab,cancelGamepadBinding,captureGamepadBinding,isCapturingGamepad} from "./options-settings.js";
import {nextRosterCell} from "./roster-navigation.js";
import "./display-effects.js";
import {OnlineVersus} from "./online.js";
import {controlSettings, DEFAULT_CONTROLS, ACTION_LABELS, keyLabel, gamepadButtonLabel, gamepads} from "./controls.js";
import {audioDirector} from "./audio.js";
import { FightGame } from "./phaser-game.js";
import {FIGHTERS, NON_PLAYABLE_FIGHTERS, fighterIds, defaultOpponent} from "./roster.js";
import {PowerPreview} from "./power-preview.js";
let online;
const $ = (selector) => document.querySelector(selector);
const arcade = $("#arcade");
arcade.addEventListener('selectstart',event=>event.preventDefault());
arcade.addEventListener('dragstart',event=>event.preventDefault());
arcade.addEventListener('contextmenu',event=>event.preventDefault());
arcade.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a')event.preventDefault();
});
const sources = Object.fromEntries(fighterIds.map(id => [id, FIGHTERS[id].source]));
const stageArtSources = ["brazil/sao-paulo", "brazil/rio", "brazil/recife", "brazil/manaus", "devon/arena"];
// Shared duration for the pre-match presentation in every mode.
const VS_PRESENTATION_SECONDS = 3.5;
const stageNames = ["SÃO PAULO — MASP", "RIO — COPACABANA", "RECIFE ANTIGO", "MANAUS — ENCONTRO DAS ÁGUAS", "COVIL DO DEVON — GALPÃO ABANDONADO"];
const selection = {
  player: "maya",
  opponent: "bruno",
  mode: "arcade",
  stage: 0,
  difficulty: "normal",
};
let game,
  assets,
  overlayState,
  muted = false;
let stageArt = [];
let crowdArt = {};
try {
  muted = localStorage.getItem("after-hours-muted") === "true";
} catch {}
function applyMute() {
  audioDirector.setMuted(muted);
  const muteLabel=$("#muteState") || $("#muteButton");
  muteLabel.textContent = muted ? "SOM: DESLIGADO" : "SOM: LIGADO";
  $("#muteButton").setAttribute("aria-pressed", String(muted));
  $("#muteButton").title = muted ? "Ativar som" : "Desativar som";
  if (game) {
    game.options.muted = muted;
    if (game.setMuted) game.setMuted(muted);
  }
  window.dispatchEvent(new CustomEvent("game-mute", { detail: muted }));
}
function image(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Não foi possível carregar ${path}`));
    img.src = path;
  });
}
let startupProgress = 0;
function updateStartupProgress(value) {
  startupProgress = Math.max(startupProgress, Math.min(100, Math.floor(value)));
  $("#titleProgress").setAttribute("aria-valuenow", startupProgress);
  $("#loadPercent").textContent = `${startupProgress}%`;
  document.querySelectorAll('.beer-mug').forEach((mug,index)=>mug.style.setProperty('--fill',`${Math.max(0,Math.min(100,(startupProgress-index*10)*10))}%`));
}
async function loadAssets() {
  const result = {};
  let manifest = {};
  try {
    const response = await fetch("assets/manifest.json");
    if (response.ok) manifest = await response.json();
  } catch {}
  spriteManifest = manifest;
  updateStartupProgress(2);
  let portraitsLoaded = 0;
  Object.assign(result, Object.fromEntries(await Promise.all([selection.player,selection.opponent].map(async name => {
    const portrait = await image(sources[name]);
    updateStartupProgress(2 + ++portraitsLoaded / 2 * 80);
    return [name, {idle:[portrait]}];
  }))));
  basePortraits.set("dummy", await image(NON_PLAYABLE_FIGHTERS.dummy.source));
  assets = result;
  for(const id of Object.keys(result)) {
    const portrait=result[id].idle[0];
    basePortraits.set(id,portrait);
  }
  await Promise.all([$(".title-villain img").decode(), $(".title-brand img").decode(), $(".title-game-logo").decode(), $(".title-crowd-background").decode()]);
  updateStartupProgress(99);
  return result;
}
let battleArtLoading;
function loadBattleArt() {
  if(battleArtLoading)return battleArtLoading;
  battleArtLoading=(async()=>{
  stageArt = await Promise.all(
    stageArtSources.map(name =>
      image(`assets/stages/${name}.png`).catch(() => null)),
  );

  try {
    const response = await fetch("assets/stages/public-v6/crowd-manifest.json");
    if (response.ok) {
      const crowdManifest = await response.json();
      crowdArt = Object.fromEntries(await Promise.all(Object.entries(crowdManifest).map(async ([action, data]) => {
        const loaded = await Promise.allSettled(data.frames.map(async frame => {
          const img = await image(frame.path);
          img.spriteMeta = {...frame};
          return img;
        }));
        const frames = loaded.filter(item => item.status === "fulfilled").map(item => item.value);
        frames.animation = {fps:data.fps || 3, loop:true};
        return [action, frames];
      })));
    }
  } catch {}

  try {
    const response = await fetch("assets/stages/brazil/npcs/crowd-manifest.json");
    if(response.ok) {
      const manifest = await response.json();
      for(const [id,spec] of Object.entries(manifest)) {
        const frames = await Promise.all(spec.frames.map(async entry=>{const img=await image(entry.path);img.spriteMeta={...entry};return img}));
        frames.animation={fps:spec.fps || 3,loop:true};crowdArt[id]=frames;
      }
    }
  } catch {}
    stageArt.forEach((art,index)=>{
      const preview=document.querySelector(`[data-stage="${index}"] .arena-art`);
      if(art&&preview){preview.style.background=`url("${art.src}") center / cover`;for(const detail of preview.querySelectorAll('i'))detail.hidden=true;}
    });
  })().catch(error=>{battleArtLoading=null;throw error;});
  return battleArtLoading;
}
const portraitLoading=new Map();
function loadPortrait(id){
  if(basePortraits.has(id))return Promise.resolve(basePortraits.get(id));
  if(portraitLoading.has(id))return portraitLoading.get(id);
  const promise=image((FIGHTERS[id]||NON_PLAYABLE_FIGHTERS[id]).source).then(img=>{
    basePortraits.set(id,img);if(!assets[id])assets[id]={idle:[img]};return img;
  }).catch(error=>{portraitLoading.delete(id);throw error;});
  portraitLoading.set(id,promise);return promise;
}
let spriteManifest = {}, fighterLoading = new Map();
const loadedFighters = new Set(), basePortraits = new Map();
async function loadFighter(name, onFrameLoaded) {
  if (fighterLoading.has(name)) return fighterLoading.get(name);
  const promise = (async () => {
    if (!spriteManifest[name]?.idle) throw new Error("As animações deste lutador ainda não estão disponíveis.");
    const profile=FIGHTERS[name]||NON_PLAYABLE_FIGHTERS[name];
    if(!assets[name]&&profile?.source)assets[name]={idle:[await image(profile.source)]};
    const result = assets[name];
    if(!result)throw new Error('Perfil de lutador indisponível.');
    if (!basePortraits.has(name)) basePortraits.set(name,result.idle[0]);
    for (const [state, paths] of Object.entries(spriteManifest[name] || {})) {
      const files = Array.isArray(paths) ? paths : paths.frames || [];
      const loaded = await Promise.all(files.map(async file => {
        const img = await image(typeof file === "string" ? file : file.path);
        onFrameLoaded?.();
        if (typeof file === "object") img.spriteMeta = {scale:file.scale,anchorX:file.anchorX,anchorY:file.anchorY};
        return img;
      }));
      if (loaded.length) {
        loaded.animation = {fps:paths.fps,loop:paths.loop};
        result[state] = loaded;
      }
    }
    loadedFighters.add(name);
    return result;
  })();
  fighterLoading.set(name,promise);
  try {return await promise;} catch(error) {fighterLoading.delete(name);throw error;}
}
function trimFighterCache(pair) {
  const keep = new Set(["maya","bruno",...pair]);
  for (const id of loadedFighters) {
    if (keep.has(id)) continue;
    assets[id] = {idle:[basePortraits.get(id)]};
    fighterLoading.delete(id);
    loadedFighters.delete(id);
  }
}
let selectionSlot = "player", battleLoading = false, launchToken = 0;
const randomSelections={};
let randomPreviewSlot=null, randomConfirmDisabled=false;
const randomActive=()=>Object.keys(randomSelections).length>0;
const randomSlot=slot=>Boolean(randomSelections[slot])||randomPreviewSlot===slot;
const idlePreviews = new Map();
const powerPreviewAssets = new Map();
let powerPreviews = [];
let powerPreviewRequests = [];
let previewAnimation, previewGeneration = 0;
function stopSelectionPreviews() {
  cancelAnimationFrame(previewAnimation);
  for(const preview of powerPreviews) preview?.destroy();
  powerPreviews=[];
  powerPreviewRequests=[];
}
async function preparePowerPreviewAssets(id) {
  if(powerPreviewAssets.has(id))return powerPreviewAssets.get(id);
  const states=id==='dummy'?['idle','hurt','ko','jump','land']:['idle','special','super','hurt'];
  const pending=Promise.all(states.map(async state=>{
    const spec=spriteManifest[id]?.[state] || (state==="super" ? spriteManifest[id]?.special : null);
    if(!spec?.frames?.length)throw new Error(`Missing ${id} ${state}`);
    const frames=await Promise.all(spec.frames.map(async frame=>{
      const img=await image(frame.path);img.spriteMeta={...frame};return img;
    }));
    frames.animation={fps:spec.fps,loop:spec.loop};
    return [state,frames];
  })).then(Object.fromEntries).catch(error=>{powerPreviewAssets.delete(id);throw error});
  powerPreviewAssets.set(id,pending);return pending;
}
const portraitMeasurements = new WeakMap();
function portraitBounds(img) {
  if(portraitMeasurements.has(img))return portraitMeasurements.get(img);
  const probe=document.createElement("canvas");probe.width=img.naturalWidth;probe.height=img.naturalHeight;
  const ctx=probe.getContext("2d");ctx.drawImage(img,0,0);
  const pixels=ctx.getImageData(0,0,probe.width,probe.height).data;
  let left=probe.width,right=0,top=probe.height,bottom=0;
  for(let y=0;y<probe.height;y++)for(let x=0;x<probe.width;x++)if(pixels[(y*probe.width+x)*4+3]>32){left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);}
  const bounds={x:left,y:top,width:right-left,height:bottom-top};portraitMeasurements.set(img,bounds);return bounds;
}
async function prepareIdlePreview(id) {
  if(idlePreviews.has(id))return idlePreviews.get(id);
  const spec=spriteManifest[id]?.idle;if(!spec)return;
  const load=async frame=>{const img=await image(frame.path);img.spriteMeta=frame;return img;};
  const pending=load(spec.frames[0]).then(first=>{
    const preview={frames:[first],fps:spec.fps||6,referenceHeight:portraitBounds(first).height};
    // The first pose is usable immediately; the remaining poses never block either player.
    Promise.allSettled(spec.frames.slice(1).map(load)).then(results=>{
      preview.frames=[first,...results.filter(r=>r.status==="fulfilled").map(r=>r.value)];
    });
    return preview;
  }).catch(()=>{idlePreviews.delete(id);return null});
  idlePreviews.set(id,pending);return pending;
}
const portraitTransitions = new WeakMap();
function drawSelectionPortrait(canvas, id, now) {
  const slot=canvas.id==='playerPreview'?'player':'opponent';
  if(randomSlot(slot))id='random-dummy';
  const ctx=canvas.getContext("2d");
  let state=portraitTransitions.get(canvas);
  if(!state || state.id!==id){
    state={id,previous:id==='random-dummy'?null:state?.id,started:now};
    portraitTransitions.set(canvas,state);
  }
  const elapsed=now-state.started;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const outgoing=state.previous && !reduced && elapsed<220;
  const progress=reduced || !state.previous ? 1 : Math.min(1,Math.max(0,(elapsed-220)/430));
  const shown=outgoing?state.previous:id;
  const randomPortrait=shown==='random-dummy';
  const portrait=basePortraits.get(randomPortrait?"dummy":shown);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(portrait?.naturalWidth){
    const box=portraitBounds(portrait),scale=Math.min(350/box.height,(canvas.width-16)/box.width);
    const eased=1-Math.pow(1-progress,3);
    ctx.globalAlpha=outgoing?1-elapsed/220:eased;
    // The rival canvas is mirrored in CSS, reversing this offset on screen.
    const slide=outgoing?0:-(1-eased)*45;
    if(randomPortrait)ctx.filter="brightness(0) blur(3px)";
    ctx.drawImage(slot==='opponent'&&selection.player===selection.opponent&&!randomPortrait?alternateSprite(portrait):portrait,box.x,box.y,box.width,box.height,(canvas.width-box.width*scale)/2+slide,canvas.height-12-box.height*scale,box.width*scale,box.height*scale);
    ctx.filter="none";
    if(randomPortrait){
      ctx.save();
      ctx.translate(canvas.width/2+slide,canvas.height-12-box.height*scale*.52);
      // Keep the glyph readable on the mirrored rival canvas.
      if(slot==='opponent')ctx.scale(-1,1);
      ctx.font='72px "Press Start 2P",monospace';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillStyle='#ffb522';ctx.shadowColor='#030712';ctx.shadowBlur=6;
      ctx.fillText('?',0,0);
      ctx.restore();
    }
    ctx.globalAlpha=1;
  }
  canvas.dataset.previewState=id==='random-dummy'?"random":"portrait";
  canvas.setAttribute('aria-label',id==='random-dummy'?'Personagem aleatório':FIGHTERS[id].name);
  canvas.dataset.previewFighter=id;
  canvas.dataset.transitionPhase=outgoing?'out':progress<1?'in':'settled';
}
function animateSelectionPreviews() {
  cancelAnimationFrame(previewAnimation);
  const generation=++previewGeneration,chosen=[selection.player,selection.opponent];
  for(const id of powerPreviewAssets.keys()) {
    if(powerPreviewAssets.size<=4)break;
    if(id!=='dummy'&&!chosen.includes(id))powerPreviewAssets.delete(id);
  }
  for(const [index,prefix] of ["player","opponent"].entries()) {
    const id=chosen[index];
    if(powerPreviewRequests[index]?.id===id)continue;
    const request={id};
    powerPreviewRequests[index]=request;
    powerPreviews[index]?.destroy();
    powerPreviews[index]=null;
    const canvas=$("#"+prefix+"PowerDemo"),label=$("#"+prefix+"DemoLabel");
    canvas.dataset.demoReady="false";
    canvas.dataset.demoFighter=chosen[index];
    canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height);
    delete label.dataset.move;delete label.dataset.moveLabel;
    label.textContent="ESPECIAL / SUPER";
    const decodedPair=Promise.all([id,'dummy'].map(async assetId=>[assetId,await preparePowerPreviewAssets(assetId)])).then(Object.fromEntries);
    decodedPair.then(decoded=>{
      if(powerPreviewRequests[index]!==request||screen!=="fighter")return;
      const demo=new PowerPreview(canvas,decoded,{player:chosen[index],facing:index?-1:1,onMove:({move,label:moveLabel})=>{
        label.dataset.move=move;label.dataset.moveLabel=moveLabel;label.dataset.demoPlayer=index;
        refreshDemoHint(label);
        canvas.setAttribute("aria-label",`${FIGHTERS[chosen[index]].name}: ${moveLabel}`);
      }});
      powerPreviews[index]=demo;
    }).catch(()=>{
      if(powerPreviewRequests[index]===request){
        label.textContent="PRÉVIA INDISPONÍVEL";
        powerPreviewRequests[index]=null;
      }
    });
  }
  const started=performance.now();
  let last=started;
  function draw(now) {
    if(generation!==previewGeneration||screen!=="fighter")return;
    const dt=Math.min(Math.max((now-last)/1000,0),.05);last=now;
    for(const demo of powerPreviews){if(demo){demo.tick(dt);demo.draw();}}
    for(const [index,prefix] of ["player","opponent"].entries()) {
      drawSelectionPortrait($("#"+prefix+"Preview"),chosen[index],now);
    }
    previewAnimation=requestAnimationFrame(draw);
  }
  draw(started);
}
function renderSelection() {
  if(assets)for(const id of [selection.player,selection.opponent])loadPortrait(id).catch(()=>{});
  const network=selection.mode==="online"&&!!online?.room;
  for(const prefix of ["player","opponent"])$("#"+prefix+"Preview").parentElement.querySelector("small").hidden=!network;
  audioDirector.warmFighter(selection.player);audioDirector.warmFighter(selection.opponent);
  const p = FIGHTERS[selection.player], rival = FIGHTERS[selection.opponent];
  for (const [prefix,f] of [["player",p],["opponent",rival]]) {
    $("#"+prefix+"Preview").setAttribute("aria-label",f.name);
    $("#"+prefix+"Name").textContent = randomSlot(prefix)?"Aleatório":f.name;
    $("#"+prefix+"Power").textContent = f.power.label + " / " + f.power.superLabel;
    $("#"+prefix+"Description").textContent = f.power.description;
    const marquee=$("#"+prefix+"Description").closest('.power-marquee');
    marquee.querySelector('.marquee-copy').textContent=f.power.label+" / "+f.power.superLabel+" · "+f.power.description;
  }
  for (const item of document.querySelectorAll("[data-player]")) {
    item.disabled=Boolean(randomSelections[selectionSlot])||(network&&online.slot===null);
    item.classList.toggle("selected",item.dataset.player===selection.player);
    item.classList.toggle("opponent-selected",item.dataset.player===selection.opponent);
    item.setAttribute("aria-pressed",String(item.dataset.player===selection[selectionSlot]));
    item.querySelector(".pick-badge").textContent = [item.dataset.player===selection.player?"P1":"",item.dataset.player===selection.opponent?((selection.mode==="versus"||network)?"P2":"CPU"):""].filter(Boolean).join(" · ");
  }
  for(const button of document.querySelectorAll('[data-random-pick]')) {
    const slot=randomCardSlot(button);
    button.hidden=!canRandomizeSlot(slot);
    button.disabled=Boolean(randomSelections[slot])||(network&&online.lobby?.phase!=='fighters');
    button.classList.toggle('random-preview-selected',randomSlot(slot));
    button.setAttribute('aria-pressed',String(randomSlot(slot)));
    button.setAttribute('aria-label',`Sortear personagem do jogador ${slot==='player'?'1':'2'} em três segundos`);
  }
  $("#opponentSlot").textContent = (selection.mode==="versus"||network)?"JOGADOR 2":selection.mode==="training"?"RIVAL / TREINO":"RIVAL";
  $("#fighterHeading").textContent = network&&online.slot===null?"ASSISTINDO À SELEÇÃO":selectionSlot==="player"?"ESCOLHA SEU LUTADOR":"ESCOLHA O RIVAL";
  for(const button of document.querySelectorAll("[data-slot]")){button.classList.toggle("active",button.dataset.slot===selectionSlot);button.disabled=(network&&(online.slot===null||button.dataset.slot!==(online.slot===0?"player":"opponent")));}
  $(".roster-hint").textContent=network&&online.slot===null?"ESPECTADOR · SELEÇÃO AO VIVO":network?"CADA JOGADOR ESCOLHE SEU LUTADOR · SELEÇÃO AO VIVO":fighterInputHint();
  if (spriteManifest.maya) animateSelectionPreviews();
}
// Portrait positions follow novo-menu-idea.png, independently of combat roster order.
const selectionLeftIds = ['maya','bruno','viihuugo','joke-l','king-luiz',
  'mr-funnie','baiano-m','cowboy','henry-k','jamal',
  'bento','deve-ras','ana','miranda','naldo',
  'cody','d-nelson','daddy-ianky','felurian','gabiest',
  'mr-g','musashi','p-d-r','prefeito','r1sen',
  'gus','kalango','miss-laura','s3rious'];
const selectionRightIds = fighterIds.filter(id=>!selectionLeftIds.includes(id));
const fighterScreen = $("#fighterScreen");
fighterScreen.innerHTML = `<header class="screen-heading"><h2 id="fighterHeading">ESCOLHA SEU LUTADOR</h2></header>
<div class="fighter-selection"><div class="fighter-preview"><canvas id="playerPreview" width="420" height="400" role="img"></canvas><small hidden></small><strong id="playerName"></strong><figure class="power-demo"><canvas id="playerPowerDemo" role="img" width="1280" height="720"></canvas><figcaption id="playerDemoLabel">ESPECIAL / SUPER</figcaption></figure><div class="power-marquee"><div class="marquee-track"><div class="marquee-message"><span id="playerPower"></span><span aria-hidden="true"> · </span><span id="playerDescription"></span></div><div class="marquee-message marquee-copy" aria-hidden="true"></div></div></div></div>
<div class="fighter-picks"><div class="pick-tabs"><button data-slot="player" class="active">JOGADOR 1</button><button data-slot="opponent" id="opponentSlot">RIVAL</button></div>${[selectionLeftIds,selectionRightIds].map((ids,side)=>`<div class="fighter-list roster-grid roster-${side===0?'left':'right'}"><button class="roster-fighter random-pick" data-random-pick="${side}" aria-label="Sortear personagem em três segundos"><span aria-hidden="true">?</span></button>${ids.map((id,index)=>`<button class="roster-fighter" style="--roster-row:${Math.floor(index/5)+2};--roster-column:${index%5+1};--mobile-row:${Math.floor(index/3)+2};--mobile-column:${index%3+1}" data-player="${id}" aria-label="Selecionar ${FIGHTERS[id].name}"><img loading="lazy" src="${FIGHTERS[id].source}" alt="${FIGHTERS[id].name}"><span class="pick-badge"></span></button>`).join("")}</div>`).join("")}<p class="roster-hint">Q TROCA P1 / RIVAL · U ESPECIAL · I SUPER</p></div>
<div class="fighter-preview rival-preview"><canvas id="opponentPreview" width="420" height="400" role="img"></canvas><small hidden></small><strong id="opponentName"></strong><figure class="power-demo"><canvas id="opponentPowerDemo" role="img" width="1280" height="720"></canvas><figcaption id="opponentDemoLabel">ESPECIAL / SUPER</figcaption></figure><div class="power-marquee"><div class="marquee-track"><div class="marquee-message"><span id="opponentPower"></span><span aria-hidden="true"> · </span><span id="opponentDescription"></span></div><div class="marquee-message marquee-copy" aria-hidden="true"></div></div></div></div></div><button class="confirm-button" id="fighterNext">CONFIRMAR LUTADORES</button>`;
function setSelectionSlot(slot) {
  if(randomSelections[slot])return;
  if(selection.mode==="online"&&online?.room&&(online.slot===null||slot!==(online.slot===0?"player":"opponent")))return;
  selectionSlot=slot;
  randomPreviewSlot=null;
  renderSelection();
  document.querySelector(`[data-player="${selection[selectionSlot]}"]`)?.scrollIntoView({block:"nearest",inline:"nearest"});
}
for (const button of document.querySelectorAll("[data-slot]")) button.addEventListener("click",()=>setSelectionSlot(button.dataset.slot));
renderSelection();
let screen = "title", transitionTimer, campaign = null, campaignComplete = false;
function refreshDemoHint(label){
  if(!label.dataset.move)return;
  const {move,moveLabel,demoPlayer:player}=label.dataset,device=getInputDevice();
  const key=device==='gamepad'?controlSettings.gamepad[player][move].map(gamepadButtonLabel).join(' / '):device==='keyboard'?keyLabel([controlSettings.keyboard[player][move]].flat()[0]):'';
  label.textContent=`${key?key+' · ':''}${move==='super'?'SUPER':'ESPECIAL'} · ${moveLabel}`;
}
function fighterInputHint(){
  const device=getInputDevice();
  return device==='gamepad'?'DIRECIONAL: LUTADOR · Y / △: P1 / RIVAL':device==='keyboard'?'':device==='touch'?'ESCOLHA O LUTADOR E O JOGADOR COM UM TOQUE':'';
}
function refreshInputHints(){
  const device=getInputDevice(),pad=device==='gamepad',keyboard=device==='keyboard';
  document.querySelectorAll('[data-move-label]').forEach(refreshDemoHint);
  const confirm=pad?'A / ×':keyboard?'ENTER':'';
  for(const [id,prompt]of [['backButton',pad?'B / ○':keyboard?'ESC':''],['controlsButton',pad?'X / □':''],['fighterNext',confirm],['arcadeContinue',confirm],['closeControls',pad?'B / ○':keyboard?'ESC':'']]){
    const button=$('#'+id);if(button){if(prompt)button.dataset.inputPrompt=prompt;else delete button.dataset.inputPrompt;}
  }
  const hint=$('#navigationHint');
  if(hint){hint.hidden=device==='mouse'||keyboard;hint.textContent=pad?'DIRECIONAL: NAVEGAR · A / ×: CONFIRMAR · B / ○: VOLTAR':keyboard?'':device==='touch'?'TOQUE PARA SELECIONAR':'';}
  const footer=$('.options-footer p');if(footer){footer.hidden=device==='mouse'||keyboard;footer.textContent=pad?'DIRECIONAL: NAVEGAR · A / ×: ENTRAR · B / ○: VOLTAR':keyboard?'':device==='touch'?'TOQUE NAS OPÇÕES · VOLTAR PARA SAIR':'';}
  const title=$('#titleStart');if(title&&!title.disabled)title.textContent=pad?'A / × PARA COMEÇAR':keyboard?'ENTER PARA COMEÇAR':device==='touch'?'TOQUE PARA COMEÇAR':'CLIQUE PARA COMEÇAR';
  if($('.roster-hint')&&!randomActive()&&selection.mode!=='online')$('.roster-hint').textContent=fighterInputHint();
}
onInputDeviceChange(refreshInputHints);
const screenIds = {title:"titleScreen",mode:"modeScreen",fighter:"fighterScreen",stage:"stageScreen",progress:"arcadeScreen",online:"onlineScreen",versus:"versusScreen"};
const menuActions=document.querySelector(".menu-footer");
let dockedConfirm;
function dockMenuActions(next) {
  if(dockedConfirm) {
    $("#"+screenIds[dockedConfirm.screen]).append(dockedConfirm.button);
    dockedConfirm=null;
  }
  menuActions.hidden=next==="title" || next==="versus";
  $("#controlsButton").hidden=menuActions.hidden;
  const target=$("#"+screenIds[next]);
  target.append(menuActions);
  const id={fighter:"fighterNext",progress:"arcadeContinue"}[next];
  if(id){const button=$("#"+id);menuActions.append(button);dockedConfirm={screen:next,button};}
}
dockMenuActions("title");
function setModeCursor(button) {
  const previous=document.querySelector('#modeScreen .mode-cursor');
  if(previous!==button&&button)audioDirector.play('select',{volume:.22});
  document.querySelectorAll('#modeScreen .mode-cursor').forEach(item=>item.classList.remove('mode-cursor'));
  if(button)button.classList.add('mode-cursor');
  $('#modeScreen').classList.toggle('has-mode-cursor',Boolean(button));
}
for(const button of [...document.querySelectorAll('[data-mode]'),$('#backButton'),$('#controlsButton')]) {
  if(!button.matches('[data-mode]')){
    const mug=document.querySelector('.mode-toast').cloneNode(true);
    mug.classList.add('footer-toast');
    button.prepend(mug);
  }
  const highlight=()=>{
    if(screen!=='mode'||!$('#controlsDialog').hidden)return;
    if(button.matches('[data-mode]'))highlightMode(button);
    setModeCursor(button);
  };
  button.addEventListener('focus',highlight);
  button.addEventListener('mouseenter',()=>{if(screen==='mode'&&$('#controlsDialog').hidden)button.focus({preventScroll:true});});
}
function updateStageBackdrop() {
  const path = stageArtSources[selection.stage];
  $("#stageScreen").style.setProperty("--stage-background", `url("/assets/stages/${path}.png")`);
}
let versusEntranceFrame;
function stopVersusEntrance(){
  cancelAnimationFrame(versusEntranceFrame);
  $('#versusEntrance')?.remove();
  for(const id of ['versusLeft','versusRight'])$('#'+id).style.visibility='';
}
function startVersusEntrance(){
  stopVersusEntrance();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const panel=$('#versusScreen'),canvas=document.createElement('canvas');
  canvas.id='versusEntrance';canvas.setAttribute('aria-hidden','true');panel.append(canvas);
  const ctx=canvas.getContext('2d'),started=performance.now(),duration=1050;
  const fighters=[['versusLeft',selection.player,1],['versusRight',selection.opponent,-1]];
  for(const [id]of fighters)$('#'+id).style.visibility='hidden';
  function draw(now){
    if(screen!=='versus'){stopVersusEntrance();return;}
    const progress=Math.max(0,Math.min(1,(now-started)/duration)),panelBox=panel.getBoundingClientRect();
    canvas.width=panelBox.width;canvas.height=panelBox.height;
    for(const [id,fighter,side]of fighters){
      const portrait=$('#'+id),rect=portrait.getBoundingClientRect(),original=basePortraits.get(fighter)||assets[fighter].idle[0];
      const originalBounds=portraitBounds(original),fit=Math.min(rect.width/original.naturalWidth,rect.height/original.naturalHeight);
      const height=originalBounds.height*fit;
      const finalX=rect.left-panelBox.left+rect.width/2;
      const finalY=rect.bottom-panelBox.top-(original.naturalHeight-originalBounds.y-originalBounds.height)*fit;
      const asset=assets[fighter],frames=asset.jumpForward||asset.jump||asset.idle;
      const landing=progress>.88&&asset.land?.length;
      const sequence=landing?asset.land:frames;
      const frame=sequence[Math.max(0,Math.min(sequence.length-1,Math.floor((landing?(progress-.88)/.12:progress/.88)*sequence.length)))]||asset.idle[0];
      const reference=asset.idle[0],bounds=portraitBounds(reference);
      const drawHeight=height/(bounds.height/reference.naturalHeight)*(frame.spriteMeta?.scale||1);
      const drawWidth=drawHeight*frame.naturalWidth/frame.naturalHeight;
      const anchorX=frame.spriteMeta?.anchorX??.5,anchorY=frame.spriteMeta?.anchorY??((bounds.y+bounds.height)/reference.naturalHeight);
      const approach=1-Math.pow(1-progress,2);
      const x=finalX-side*(1-approach)*panelBox.width*.6;
      const y=finalY-Math.sin(Math.PI*Math.min(1,progress/.88))*Math.min(130,panelBox.height*.18);
      ctx.save();ctx.translate(x,y);ctx.scale(side,1);
      const image=side<0&&selection.player===selection.opponent?alternateSprite(frame):frame;
      ctx.drawImage(image,-drawWidth*anchorX,-drawHeight*anchorY,drawWidth,drawHeight);ctx.restore();
    }
    canvas.dataset.progress=String(progress);
    if(progress<1)versusEntranceFrame=requestAnimationFrame(draw);else stopVersusEntrance();
  }
  versusEntranceFrame=requestAnimationFrame(draw);
}
function showScreen(next) {
  stopVersusEntrance();
  randomPreviewSlot=null;
  cancelRandomSelection();
  if (next === "stage") {
    loadBattleArt().catch(()=>{});
    updateStageBackdrop();
    if(selection.mode!=='online') {for(const button of document.querySelectorAll('[data-stage]'))button.disabled=false;$('#matchLoadStatus').textContent='';}
  }
  if(next==='fighter'&&selection.mode!=='online'){$('#fighterNext').disabled=false;$('#fighterNext').textContent='CONFIRMAR LUTADORES';}
  stopSelectionPreviews();
  previewGeneration++;
  if (next !== "versus") launchToken++;
  clearTimeout(transitionTimer);
  screen = next;
  dockMenuActions(next);
  audioDirector.setScene("menu");
  for (const [name,id] of Object.entries(screenIds)) $("#"+id).hidden = name !== next;
  $("#backButton").hidden = next === "title" || next === "versus";
  $("#navigationHint").textContent = next === "title" ? "ENTER / TOQUE PARA COMEÇAR" : next === "versus" ? "PREPARE-SE PARA LUTAR" : "";
  if(next === "versus"){
    audioDirector.warmStage(selection.stage);
    const thumbnail=$('#versusStageThumbnail');
    thumbnail.src=stageArt[selection.stage]?.src || '';
    thumbnail.alt=stageNames[selection.stage];
    thumbnail.hidden=!stageArt[selection.stage];
    const state=['SÃO PAULO','RIO DE JANEIRO','PERNAMBUCO','AMAZONAS',''][selection.stage]||'';
    $('#versusStageState').textContent=state;
    $('#versusStageState').hidden=!state;
    $('#versusStage').textContent=['MASP','COPACABANA','RECIFE ANTIGO','ENCONTRO DAS ÁGUAS','COVIL DO DEVON — GALPÃO ABANDONADO'][selection.stage];
  }
  if(next === "fighter")renderSelection();
  if(next === "progress")renderArcadeProgress();
  refreshInputHints();
  if(next==='versus'&&selection.player===selection.opponent){const image=basePortraits.get(selection.opponent);if(image?.naturalWidth)$('#versusRight').src=alternateSprite(image).toDataURL();}
  if(next==='versus')for(const id of ['versusLeft','versusRight']){
    $('#'+id.replace('versus','versusLed')).src=$('#'+id).src;
  }
  if(next==='versus')startVersusEntrance();
  if(next === "mode")document.querySelector(`[data-mode="${selection.mode}"]`)?.focus();
  if(next === "stage"){
    for(const button of document.querySelectorAll('[data-stage]'))button.classList.toggle('selected',Number(button.dataset.stage)===selection.stage);
    document.querySelector(`[data-stage="${selection.stage}"]`)?.focus({preventScroll:true});
  }
}
const arcadePortraits=new WeakMap();
function fittedArcadePortrait(original){
  if(arcadePortraits.has(original))return arcadePortraits.get(original);
  const bounds=portraitBounds(original);
  if(!bounds.width||!bounds.height)return original.src;
  const padding=Math.ceil(Math.max(bounds.width,bounds.height)*.025);
  const left=Math.max(0,bounds.x-padding),top=Math.max(0,bounds.y-padding);
  const width=Math.min(original.naturalWidth-left,bounds.width+padding*2);
  const height=Math.min(original.naturalHeight-top,bounds.height+padding*2);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  canvas.getContext('2d').drawImage(original,left,top,width,height,0,0,width,height);
  const source=canvas.toDataURL();arcadePortraits.set(original,source);return source;
}
function renderArcadeProgress(){
  if(!campaign)return;
  const progress=arcadeProgress(campaign);
  $('#arcadeTitle').textContent=progress.complete?'DEVON DERROTADO':progress.currentIsBoss?'O CHEFÃO ESPERA':'CAMINHO ATÉ DEVON';
  const list=$('#arcadeOpponents');list.replaceChildren();
  for(const entry of progress.opponents){
    const profile=FIGHTERS[entry.id]||NON_PLAYABLE_FIGHTERS[entry.id];
    const item=document.createElement('li');item.dataset.opponent=entry.id;item.dataset.status=entry.status;item.className=`arcade-rival ${entry.boss?'arcade-boss':''}`;
    const image=document.createElement('img');image.alt='';
    const portrait=basePortraits.get(entry.id);
    if(portrait?.naturalWidth)image.src=fittedArcadePortrait(portrait);
    else{
      image.addEventListener('load',()=>{image.src=fittedArcadePortrait(image);},{once:true});
      image.src=profile?.source||'assets/sprites/devon/base-source.png';
    }
    const name=document.createElement('strong');name.textContent=profile?.name||'Devon';
    const status=document.createElement('span');status.textContent=entry.status==='defeated'?'DERROTADO':entry.status==='current'?'PRÓXIMO DESAFIO':entry.boss?'CHEFÃO':'AGUARDANDO';
    const marker=document.createElement("span");marker.className="route-marker";marker.setAttribute("aria-hidden","true");if(entry.boss)marker.textContent="♛";
    item.append(image,name,status,marker);list.append(item);
  }
  $('#arcadeContinue').disabled=false;
  $('#arcadeContinue').textContent=progress.complete?'VOLTAR AO MENU':progress.currentIsBoss?'ENFRENTAR DEVON':'PRÓXIMA LUTA';
  $('#arcadeLoadStatus').textContent='';
}
function showArcadeProgress(){
  game?.destroy();game=null;overlayState=null;
  document.body.classList.remove('in-match','overlay-open');
  $('#gameScreen').hidden=true;$('#matchOverlay').hidden=true;$('#menu').hidden=false;
  showScreen('progress');$('#arcadeContinue').focus();
}
function renderTrainingSettings() {
  $('#trainingCpu').setAttribute('aria-checked',String(game?.cpuEnabled===true));
  $('#trainingDifficulty strong').textContent={easy:'INICIANTE',normal:'NORMAL',hard:'DESAFIANTE'}[game?.difficulty]||'NORMAL';
}
$('#trainingCpu').addEventListener('click',()=>{
  if(game?.mode!=='training')return;
  game.cpuEnabled=game.cpuEnabled!==true;
  renderTrainingSettings();
});
$('#trainingDifficulty').addEventListener('click',()=>{
  if(game?.mode!=='training')return;
  const levels=['easy','normal','hard'];
  game.difficulty=levels[(levels.indexOf(game.difficulty)+1)%levels.length];
  renderTrainingSettings();
});
function setOverlay(state, winner) {
  resetTouchJoystick();
  audioDirector.setScene("pause");
  document.body.classList.add("overlay-open");
  overlayState = state;
  $("#trainingSettings").hidden=state!=="pause"||game?.mode!=="training";
  renderTrainingSettings();
  $("#matchOverlay").hidden = false;
  $("#resumeButton").hidden = state !== "pause";
  $("#rematchButton").hidden = state !== "end";
  const won = winner && winner !== "draw" && String(winner.id || winner.name || winner).toLowerCase() === selection.player;
  if(state==='end'&&campaign&&won)winArcadeMatch(campaign,selection.opponent);
  const advancing = state === "end" && campaign && won && !campaign.complete;
  const champion = state === "end" && campaign && won && campaign.complete;
  $('#rematchButton').hidden=state!=='end';
  $('#rematchButton').dataset.returnSelection=String(state==='end'&&selection.mode==='arcade'&&Boolean(won));
  campaignComplete = Boolean(champion);
  $("#nextStageButton").hidden = !advancing && !champion;
  $("#nextStageButton").textContent = champion ? "VER CONQUISTA" : "PRÓXIMA LUTA";
  $("#rematchButton").textContent = $("#rematchButton").dataset.returnSelection==="true" ? "VOLTAR À SELEÇÃO DE PERSONAGENS" : "REVANCHE";
  $("#overlayEyebrow").textContent = "";
  $("#overlayTitle").textContent = state === "pause" ? "PAUSADO" : "";
  $("#overlayTitle").hidden = state !== "pause";
  $("#overlayDescription").textContent = state === "pause" && game?.options.online ? "A partida online continua. Seu lutador fica parado enquanto este menu está aberto." : "";
  $("#overlayEyebrow").hidden = !$("#overlayEyebrow").textContent;
  $("#overlayDescription").hidden = !$("#overlayDescription").textContent;
  (state === "pause" ? $("#resumeButton") : advancing ? $("#nextStageButton") : $("#rematchButton")).focus();
}
async function versus(config = {}, newCampaign = false) {
  if (!assets || battleLoading) return;
  Object.assign(selection, config);
  if(selection.opponent==='devon')selection.stage=4;
  if (newCampaign) {
    campaign = selection.mode === "arcade" ? createArcadeRun({player:selection.player,firstRival:selection.opponent,stage:selection.stage,fighterIds,stageCount:stageNames.length-1,bossStage:4,randomStages:true}) : null;
    campaignComplete=false;
    if(campaign){showArcadeProgress();return;}
  }
  if (campaign){selection.opponent = campaign.opponents[campaign.index];selection.stage=campaign.stages[campaign.index];}
  const token = ++launchToken;
  const match = {...selection};
  battleLoading = true;
  const progressLaunch=screen==='progress';
  if(progressLaunch){$('#arcadeContinue').disabled=true;$('#arcadeContinue').textContent='PREPARANDO LUTADORES…';$('#arcadeLoadStatus').textContent='';}


  $("#matchLoadStatus").textContent = "";
  try {await Promise.all([loadFighter(match.player),loadFighter(match.opponent),loadBattleArt()]);} catch(error) {
    if(progressLaunch){$('#arcadeLoadStatus').textContent='Não foi possível preparar os lutadores. Tente novamente.';$('#arcadeContinue').disabled=false;$('#arcadeContinue').textContent='TENTAR NOVAMENTE';}
    $("#matchLoadStatus").textContent = "Não foi possível preparar os lutadores. Tente novamente.";

    battleLoading = false; return;
  }
  battleLoading = false;
  if(progressLaunch)$('#arcadeContinue').disabled=false;
  if (token !== launchToken) {
    trimFighterCache(game?.fighters?.map(f=>f.id) || []);
    return;
  }
  Object.assign(selection,match);
  game?.destroy(); game = null;
  document.body.classList.remove("in-match");
  $("#gameScreen").hidden = true;
  $("#menu").hidden = false;
  $("#versusLeft").src = sources[selection.player];
  const opponent = selection.opponent;
  $("#versusRight").src = sources[opponent]||(FIGHTERS[opponent]||NON_PLAYABLE_FIGHTERS[opponent]).source;
  $("#versusLeftName").textContent = FIGHTERS[selection.player].name.toUpperCase();
  $("#versusRightName").textContent = (FIGHTERS[opponent]||NON_PLAYABLE_FIGHTERS[opponent]).name.toUpperCase();
  $("#versusOpponent").textContent = selection.opponent==='devon'?'CHEFÃO':selection.mode === "versus" ? "PLAYER 2" : selection.mode === "training" ? "TRAINING PARTNER" : "CPU";
  $("#versusStage").textContent = stageNames[selection.stage];
  showScreen("versus");
  transitionTimer = setTimeout(() => start(), VS_PRESENTATION_SECONDS * 1000);
}
function start(config = {}) {
  audioDirector.setScene("fight",selection.stage);
  document.body.classList.remove("overlay-open");
  if (!assets) return;
  clearTimeout(transitionTimer); screen = "fight";
  Object.assign(selection, config);
  selection.difficulty = $("#difficulty").value;
  game?.destroy();
  trimFighterCache([selection.player,selection.opponent]);
  document.body.classList.add("in-match");
  $("#menu").hidden = true;
  $("#gameScreen").hidden = false;
  $("#matchOverlay").hidden = true;
  overlayState = null;
  $("#matchLabel").textContent =
    `${selection.mode === "training" ? "TREINO" : selection.mode === "versus" ? "VERSUS LOCAL" : selection.mode === "free" ? "MODO LIVRE" : "ARCADE"} / ${stageNames[selection.stage]}`;
  game = new FightGame($("#gameCanvas"), assets, {
    stageArt,
    crowdArt,
    debugHitboxes:new URLSearchParams(location.search).has("hitboxes"),
    onEnd: (winner) => setOverlay("end", winner),
    onPause: () => setOverlay("pause"),
    muted,
  });
  game.start({ ...selection });
  applyMute();
  $("#gameCanvas").focus();
  window.scrollTo(0, 0);
}
function resume() {
  audioDirector.setScene("fight",selection.stage);
  if (overlayState !== "pause") return;
  $("#matchOverlay").hidden = true;
  overlayState = null;
  document.body.classList.remove("overlay-open");
  game?.resume();
  $("#gameCanvas").focus();
}
function pause() {
  if (!game || !$("#matchOverlay").hidden) return;
  game.pause();
  setOverlay("pause");
}
function backToMenu(destination = "mode") {
  resetTouchJoystick();
  if (game?.options.online) { online.leave(); return; }
  document.body.classList.remove("overlay-open");
  document.body.classList.remove("in-match");
  game?.destroy();
  game = null;
  $("#gameScreen").hidden = true;
  $("#menu").hidden = false;
  $("#matchOverlay").hidden = true;
  overlayState = null;
  campaign = null;
  if(!fighterIds.includes(selection.opponent))selection.opponent=defaultOpponent(selection.player);
  if(selection.stage===4)selection.stage=0;
  if(destination==="fighter")selectionSlot="player";
  showScreen(destination);
  document.querySelector(destination==="fighter"?`[data-player="${selection.player}"]`:destination==="stage"?`[data-stage="${selection.stage}"]`:`[data-mode="${selection.mode}"]`)?.focus();
}
function chooseFighter(id) {
  randomPreviewSlot=null;
  if(selection.mode==='online'&&online?.room){if(online.lobby?.phase==='fighters')online.room.send('configure',{fighter:id});renderSelection();return;}
  selection[selectionSlot]=id;
  if(selection.mode!=='versus'&&selection.opponent===selection.player)selection.opponent=defaultOpponent(selection.player);
  renderSelection();
}
function cancelRandomSelection(render=true,slot=null){
  if(!randomActive())return;
  for(const key of slot?[slot]:Object.keys(randomSelections)){
    const request=randomSelections[key];if(!request)continue;
    clearInterval(request.tick);clearTimeout(request.finish);delete randomSelections[key];
    document.querySelectorAll('.random-cursor-'+key).forEach(item=>{item.classList.remove('random-cursor-'+key);if(!item.matches('.random-cursor-player,.random-cursor-opponent'))item.classList.remove('random-cursor');});
  }
  if(!randomActive()){$('#fighterNext').disabled=randomConfirmDisabled;fighterScreen.removeAttribute('aria-busy');}
  randomPreviewSlot=null;
  if(render)renderSelection();
}
function randomCardSlot(button) { return button.dataset.randomPick==='0'?'player':'opponent'; }
function canRandomizeSlot(slot) {
  if(selection.mode==='online'&&online?.room)return online.slot!==null&&slot===(online.slot===0?'player':'opponent');
  return slot==='player'||selection.mode==='versus';
}
function previewRandomCard(button) {
  const slot=randomCardSlot(button);
  if(randomSelections[slot]||button.hidden||button.disabled||!canRandomizeSlot(slot))return;
  randomPreviewSlot=slot;
  selectionSlot=slot;
  renderSelection();
}
function clearRandomCardPreview(button) {
  if(randomSelections[randomCardSlot(button)]||randomPreviewSlot!==randomCardSlot(button))return;
  randomPreviewSlot=null;
  renderSelection();
}
function startRandomSelection(slot) {
  if(randomSelections[slot]||screen!=='fighter')return;
  const network=selection.mode==='online'&&!!online?.room;
  if(!canRandomizeSlot(slot)||(network&&online.lobby?.phase!=='fighters'))return;
  selectionSlot=slot;
  randomPreviewSlot=null;
  if(!randomActive())randomConfirmDisabled=$('#fighterNext').disabled;
  const request={slot,id:null};
  randomSelections[slot]=request;
  $('#fighterNext').disabled=true;
  fighterScreen.setAttribute('aria-busy','true');
  renderSelection();
  $('.roster-hint').textContent='SORTEANDO LUTADOR…';
  const step=()=>{
    document.querySelectorAll('.random-cursor-'+slot).forEach(item=>{item.classList.remove('random-cursor-'+slot);if(!item.matches('.random-cursor-player,.random-cursor-opponent'))item.classList.remove('random-cursor');});
    const candidates=fighterIds.filter(id=>id!==request.id);
    request.id=candidates[Math.floor(Math.random()*candidates.length)];
    document.querySelector(`[data-player="${request.id}"]`).classList.add('random-cursor','random-cursor-'+slot);
    audioDirector.play('select',{volume:.22});
  };
  step();
  request.tick=setInterval(step,120);
  request.finish=setTimeout(()=>{
    if(randomSelections[slot]!==request)return;
    const chosen=request.id;
    cancelRandomSelection(false,slot);
    if(network)online.room.send('configure',{fighter:chosen});else selection[slot]=chosen;
    if(selection.mode!=='versus'&&selection.mode!=='online'&&selection.opponent===selection.player)selection.opponent=defaultOpponent(selection.player);
    renderSelection();
    if(!randomActive())document.querySelector(`[data-player="${chosen}"]`)?.focus({preventScroll:true});
  },3000);
}
for(const button of document.querySelectorAll('[data-random-pick]')) {
  button.addEventListener('mouseenter',()=>previewRandomCard(button));
  button.addEventListener('focus',()=>previewRandomCard(button));
  button.addEventListener('mouseleave',()=>{if(document.activeElement!==button)clearRandomCardPreview(button);});
  button.addEventListener('blur',()=>{if(!button.matches(':hover'))clearRandomCardPreview(button);});
  button.addEventListener('click',()=>startRandomSelection(randomCardSlot(button)));
}
for (const button of document.querySelectorAll("[data-player]"))
  button.addEventListener("click", () => {
    if(randomSelections[selectionSlot])return;
    chooseFighter(button.dataset.player);
  });
function highlightMode(button) {
  if(selection.mode===button.dataset.mode)return;
  selection.mode=button.dataset.mode;
  for(const item of document.querySelectorAll('[data-mode]')){
    item.classList.toggle('active',item===button);
    item.setAttribute('aria-pressed',String(item===button));
  }
  selectionSlot='player';renderSelection();
}
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>{
  highlightMode(button);
  if(selection.mode==='online'){showScreen('online');online.open();}else showScreen('fighter');
});
function markArena(button) {
  if(button.disabled||battleLoading)return;
  const stage=Number(button.dataset.stage);
  if(selection.mode==='online'&&online?.room){
    if(online.room.sessionId!==online.lobby?.host)return;
    if(selection.stage!==stage)online.room.send('configure',{stage});
  }
  selection.stage=stage;updateStageBackdrop();
  for(const item of document.querySelectorAll('[data-stage]')){
    const chosen=item===button;item.classList.toggle('selected',chosen);item.setAttribute('aria-pressed',String(chosen));
  }
}
function confirmArena(){
  if(!assets||battleLoading||screen!=='stage')return;
  if(selection.mode==='online'&&online.room){if(online.room.sessionId===online.lobby?.host)online.room.send('start');}
  else versus({},true);
}
for(const button of document.querySelectorAll('[data-stage]')){
  button.addEventListener('pointerenter',()=>markArena(button));
  button.addEventListener('click',()=>{if(button.disabled)return;markArena(button);confirmArena();});
}
$("#titleStart").addEventListener("click", () => showScreen("mode"));
$("#fighterNext").addEventListener("click", () => {if(randomActive())return;if(selection.mode==="online"&&online.room)online.room.send("ready");else if(selection.mode==="arcade")versus({},true);else showScreen("stage");});
$("#backButton").addEventListener("click", async () => { if(screen==="progress"){backToMenu("fighter");return;}if(selection.mode==="online"&&online.room&&["fighter","stage","versus"].includes(screen)){if(online.slot===null){await online.leave();showScreen("online");return;}online.room.send(screen==="stage"&&online.room.sessionId===online.lobby.host?"previous":"cancelSelection");return;}if(screen==="online"){await online.leave();showScreen("mode");return;}showScreen({mode:"title",fighter:"mode",stage:"fighter"}[screen] || "title"); });
$('#arcadeContinue').addEventListener('click',()=>{if(campaign?.complete)backToMenu();else if(campaign)versus();});
$("#nextStageButton").addEventListener("click", () => {if(campaign)showArcadeProgress();});
$("#resumeButton").addEventListener("click", resume);
$("#rematchButton").addEventListener("click", () => { if(game?.options.online){online.returnToLobby();return;} if($("#rematchButton").dataset.returnSelection==="true")backToMenu("fighter");else versus(); });
$("#menuButton").addEventListener("click", () => backToMenu());
$("#pauseButton").addEventListener("click", pause);
let optionsReturnFocus;
let bindingTarget = null;
function renderBindings() {
  document.querySelectorAll('.keyboard-controls').forEach((panel,player) => {
    const groups=[['Mover','left','right'],['Pular / agachar','jump','crouch'],['Soco / chute','punch','kick'],['Defesa','guard'],['Especial / super','special','super']];
    panel.querySelector('dl').innerHTML=groups.map(([label,...actions])=>`<div><dt>${label}</dt><dd>${actions.map(action=>`<button class="key-binding" data-bind-player="${player}" data-bind-action="${action}" aria-label="P${player+1}: ${ACTION_LABELS[action]}. Alterar tecla"><kbd>${[controlSettings.keyboard[player][action]].flat().map(keyLabel).join(' / ')}</kbd></button>`).join('')}</dd></div>`).join('');
  });
  const k=action=>`<kbd>${keyLabel([controlSettings.keyboard[0][action]].flat()[0])}</kbd>`;
  const combos=[`${k('jump')} + ${k('left')} / ${k('right')}`,`${k('jump')} + ${k('punch')} / ${k('kick')}`,`${k('crouch')} + ${k('punch')} / ${k('kick')}`,`${k('crouch')} + ${k('special')} / ${k('super')}`,`${k('crouch')} + ${k('guard')}`,`${k('left')}${k('left')} / ${k('right')}${k('right')}`];
  document.querySelectorAll('.combo-grid b').forEach((el,i)=>el.innerHTML=combos[i]);
  $('.combo-note').textContent='P2: use as teclas configuradas acima nas mesmas combinações.';
}
function cancelBinding() {
  bindingTarget?.classList.remove('binding-active');bindingTarget=null;
  $('#bindingStatus').textContent='Clique em uma tecla para alterá-la. ESC cancela. As mudanças são salvas neste navegador.';
}
$('#controlsDialog').addEventListener('click',event=>{
  if(event.target.closest('[data-options-tab],[data-controls-tab],[data-pad-action]'))cancelBinding();
  const button=event.target.closest('[data-bind-action]');if(!button)return;
  cancelBinding();bindingTarget=button;button.classList.add('binding-active');
  $('#bindingStatus').textContent=`P${Number(button.dataset.bindPlayer)+1}: ${ACTION_LABELS[button.dataset.bindAction]} — pressione a nova tecla (ESC cancela).`;
});
$('#resetBindings').addEventListener('click',()=>{
  cancelBinding();const saved=controlSettings.reset();renderBindings();
  $('#bindingStatus').textContent=saved?'Teclas padrão restauradas e salvas.':'Teclas restauradas. O navegador não permitiu salvar.';
});
renderBindings();
function openOptions() {
  optionsReturnFocus = document.activeElement;
  if (game) pause();
  $("#controlsDialog").hidden = false;
  document.querySelector('[data-options-tab][aria-selected="true"]').focus();
}
function closeOptions() {
  cancelBinding();
  cancelGamepadBinding();
  $("#controlsDialog").hidden = true;
  optionsReturnFocus?.focus();
}
$("#controlsButton").addEventListener("click", openOptions);
$("#pauseOptionsButton").addEventListener("click", openOptions);
$("#closeControls").addEventListener("click", closeOptions);
$("#muteButton").addEventListener("click", () => {
  muted = !muted;
  try {
    localStorage.setItem("after-hours-muted", String(muted));
  } catch {}
  applyMute();
});
$("#fullscreenButton").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    $("#fullscreenButton").title = "Tela cheia indisponível neste navegador";
  }
});
window.addEventListener("keydown", (event) => {
  if($('#createRoomDialog').open){
    event.stopImmediatePropagation();
    if(event.key==='Escape'){event.preventDefault();$('#createRoomDialog').close();return;}
    if(event.target===window){
      event.preventDefault();const elements=[...$('#createRoomDialog').querySelectorAll('input,button')];
      if(event.key==='Enter'){if(document.activeElement.tagName==='INPUT')$('#createRoomForm').requestSubmit();else document.activeElement.click();}
      else if(event.key.startsWith('Arrow')){const delta=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;elements[(elements.indexOf(document.activeElement)+delta+elements.length)%elements.length]?.focus();}
    }
    return;
  }
  if (!$("#controlsDialog").hidden) {
    if(isCapturingGamepad()){
      event.preventDefault();event.stopImmediatePropagation();
      if(event.key==='Escape'){cancelGamepadBinding();$('#gamepadBindingStatus').textContent='Alteração cancelada.';}
      return;
    }
    if (bindingTarget) {
      event.preventDefault();event.stopImmediatePropagation();
      if (event.key === 'Escape') { cancelBinding(); return; }
      if (event.repeat) return;
      const player=Number(bindingTarget.dataset.bindPlayer),action=bindingTarget.dataset.bindAction;
      const result=controlSettings.bind(player,action,event.code);
      if (!result.ok) { $('#bindingStatus').textContent=result.message;return; }
      cancelBinding();renderBindings();
      document.querySelector(`[data-bind-player="${player}"][data-bind-action="${action}"]`).focus();
      $('#bindingStatus').textContent=result.saved?'Tecla alterada e salva.':'Tecla alterada. O navegador não permitiu salvar; valerá até recarregar.';
      return;
    }
    event.stopImmediatePropagation();
    const key = event.key.toLowerCase();
    const active=document.activeElement;
    if(navigateOptions(event))return;
    if(active?.matches('[data-options-tab]')&&['a','d','arrowleft','arrowright'].includes(key)){
      event.preventDefault();const tabs=[...document.querySelectorAll('[data-options-tab]')],delta=['a','arrowleft'].includes(key)?-1:1;
      const next=tabs[(tabs.indexOf(active)+delta+tabs.length)%tabs.length];
      cancelBinding();showOptionsTab(next.dataset.optionsTab);next.focus();return;
    }
    if(active?.matches('input[type=range]')&&['a','d','arrowleft','arrowright','enter',' ','j','1'].includes(key)){
      event.preventDefault();if(event.repeat)return;
      const delta=['a','arrowleft'].includes(key)?-1:1;
      active.value=Math.max(Number(active.min),Math.min(Number(active.max),Number(active.value)+delta*Number(active.step)));
      active.dispatchEvent(new Event('input',{bubbles:true}));return;
    }
    if(document.activeElement?.id==='difficulty'&&['a','d','arrowleft','arrowright','enter',' ','j','1'].includes(key)){
      event.preventDefault();
      if(event.repeat)return;
      const field=$('#difficulty'),delta=['a','arrowleft'].includes(key)?-1:1;
      field.selectedIndex=(field.selectedIndex+delta+field.options.length)%field.options.length;
      field.dispatchEvent(new Event('change',{bubbles:true}));
      return;
    }
    if (["escape","k","2"].includes(key)) { event.preventDefault(); closeOptions(); }
    else if (["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright","tab"].includes(key)) {
      event.preventDefault();
      const buttons = [...$("#controlsDialog").querySelectorAll("button,select,input")].filter(el=>!el.disabled&&el.getClientRects().length);
      const delta = event.shiftKey || ["w","a","arrowup","arrowleft"].includes(key) ? -1 : 1;
      buttons[(buttons.indexOf(document.activeElement)+delta+buttons.length)%buttons.length].focus();
    } else if (["enter"," ","j","1"].includes(key)) { event.preventDefault(); if(!event.repeat) document.activeElement.click(); }
    return;
  }
  if(screen==='online' && !game) {
    const key=event.key.toLowerCase(),active=document.activeElement;
    if(key==='escape'){event.preventDefault();$('#backButton').click();return;}
    if(active?.tagName==='INPUT'&&event.target===active&&key!=='tab')return;
    if(active?.tagName==='SELECT') {
      const delta=['arrowleft','arrowup','a','w'].includes(key)?-1:['arrowright','arrowdown','d','s'].includes(key)?1:0;
      if(delta){event.preventDefault();active.selectedIndex=(active.selectedIndex+delta+active.options.length)%active.options.length;active.dispatchEvent(new Event('change',{bubbles:true}));return;}
    }
    if(['arrowleft','arrowup','arrowright','arrowdown','tab'].includes(key)) {
      event.preventDefault();const controls=[...$('#onlineScreen').querySelectorAll('button,select,input')].filter(el=>!el.disabled&&el.getClientRects().length);
      const delta=event.shiftKey||['arrowleft','arrowup'].includes(key)?-1:1;controls[(controls.indexOf(active)+delta+controls.length)%controls.length]?.focus();return;
    }
    if(['enter',' '].includes(key)&&active?.tagName==='BUTTON'){event.preventDefault();if(!event.repeat)active.click();}
    return;
  }
  const footerAction=event.target.closest?.(".menu-footer button")||document.activeElement?.closest(".menu-footer button");
  if (footerAction && !footerAction.disabled && footerAction.getClientRects().length && ["enter"," ","j","1"].includes(event.key.toLowerCase())) {
    event.preventDefault();
    if(!event.repeat)footerAction.click();
    return;
  }
  const navigationKey = ({w:"ArrowUp",s:"ArrowDown",a:"ArrowLeft",d:"ArrowRight"})[event.key.toLowerCase()] || event.key;
  if (overlayState && !$("#matchOverlay").hidden) {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(navigationKey)) {
      event.preventDefault();event.stopImmediatePropagation();
      const buttons=[...document.querySelectorAll("#matchOverlay button")].filter(b=>!b.hidden&&b.getClientRects().length);
      const current=buttons.indexOf(document.activeElement),delta=["ArrowUp","ArrowLeft"].includes(navigationKey)?-1:1;
      buttons[(current+delta+buttons.length)%buttons.length]?.focus();return;
    }
    if(["enter"," ","j","1"].includes(event.key.toLowerCase())){event.preventDefault();event.stopImmediatePropagation();if(!event.repeat && document.activeElement?.closest("#matchOverlay"))document.activeElement.click();return;}
  }
  if (!game && screen !== "fight") {
    if(event.target.tagName==="SELECT") {
      const key=event.key.toLowerCase();
      if(["w","a","s","d"].includes(key)) {
        event.preventDefault();
        const field=event.target,delta=["w","a"].includes(key)?-1:1;
        field.selectedIndex=(field.selectedIndex+delta+field.options.length)%field.options.length;
        field.dispatchEvent(new Event("change",{bubbles:true}));return;
      }
      if(!["j","1","k","2"].includes(key))return;
    }
    if(screen==='mode'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab'].includes(navigationKey)){
      event.preventDefault();
      const buttons=[...document.querySelectorAll('[data-mode]'),$('#backButton'),$('#controlsButton')].filter(button=>!button.disabled&&button.getClientRects().length);
      const focused=buttons.indexOf(document.activeElement);
      const current=focused>=0?focused:buttons.findIndex(button=>button.classList.contains('active'));
      const delta=event.shiftKey||['ArrowLeft','ArrowUp'].includes(navigationKey)?-1:1;
      const next=buttons[(current+delta+buttons.length)%buttons.length];
      next.focus({preventScroll:true});
      return;
    }
    if(screen==='mode'&&document.activeElement?.matches('[data-mode]')&&['enter',' ','j','1'].includes(event.key.toLowerCase())){
      event.preventDefault();
      if(!event.repeat)document.activeElement.click();
      return;
    }
    if(screen==='stage'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab'].includes(navigationKey)){
      event.preventDefault();
      const arenas=[...document.querySelectorAll('[data-stage]')].filter(button=>!button.disabled&&button.getClientRects().length);
      const footer=[$('#backButton'),$('#controlsButton')].filter(button=>!button.disabled&&button.getClientRects().length);
      const active=document.activeElement,arenaIndex=arenas.indexOf(active),footerIndex=footer.indexOf(active);
      let next;
      if(navigationKey==='Tab'){
        const all=[...arenas,...footer],index=all.indexOf(active),delta=event.shiftKey?-1:1;
        next=all[(index+delta+all.length)%all.length];
      }else if(footerIndex>=0){
        if(navigationKey==='ArrowUp')next=arenas.find(button=>Number(button.dataset.stage)===selection.stage)||arenas[0];
        else if(navigationKey==='ArrowLeft'||navigationKey==='ArrowRight')next=footer[(footerIndex+(navigationKey==='ArrowLeft'?-1:1)+footer.length)%footer.length];
      }else if(navigationKey==='ArrowDown')next=footer[0];
      else if(arenas.length){
        const current=arenaIndex>=0?arenaIndex:arenas.findIndex(button=>Number(button.dataset.stage)===selection.stage);
        const delta=navigationKey==='ArrowRight'?1:-1;
        next=arenas[(current+delta+arenas.length)%arenas.length];
      }
      if(next){if(next.matches('[data-stage]'))markArena(next);next.focus({preventScroll:true});}
      return;
    }
    if(screen==='progress'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(navigationKey)){
      event.preventDefault();const buttons=[...menuActions.querySelectorAll('button')].filter(button=>!button.hidden&&!button.disabled);
      const delta=['ArrowLeft','ArrowUp'].includes(navigationKey)?-1:1;buttons[(buttons.indexOf(document.activeElement)+delta+buttons.length)%buttons.length]?.focus();return;
    }
    if(screen==='stage'&&['enter',' ','j','1'].includes(event.key.toLowerCase())){event.preventDefault();if(!event.repeat)confirmArena();return;}
    const confirm = {title:"titleStart",fighter:"fighterNext",progress:"arcadeContinue"};
    if (screen === "fighter" && event.key === "Enter" && event.target.closest?.("[data-slot]")) return;
    if (screen === "fighter" && event.key.toLowerCase() === "q") {
      event.preventDefault();setSelectionSlot(selectionSlot === "player" ? "opponent" : "player");return;
    }
        if(screen==='fighter'&&document.activeElement?.matches('[data-random-pick]')&&["enter"," ","j","1"].includes(event.key.toLowerCase())){event.preventDefault();if(!event.repeat)document.activeElement.click();return;}
    if (["enter"," ","j","1"].includes(event.key.toLowerCase()) && confirm[screen]) { event.preventDefault(); if(!event.repeat) $("#"+confirm[screen]).click(); return; }
    if (["escape","k","2"].includes(event.key.toLowerCase())) { event.preventDefault(); $("#backButton").click(); return; }
    if(screen==='fighter'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(navigationKey)){
      event.preventDefault();
      const groups=[...document.querySelectorAll('#fighterScreen .roster-grid')].map(grid=>[...grid.querySelectorAll('button')].filter(button=>!button.hidden&&!button.disabled).map(button=>{
        const style=getComputedStyle(button);
        return {button,row:Number(style.gridRowStart),column:Number(style.gridColumnStart)};
      }));
      const cells=groups.flat();
      const current=cells.find(cell=>cell.button===document.activeElement)||cells.find(cell=>cell.button.dataset.player===selection[selectionSlot]);
      const next=nextRosterCell(groups,current,navigationKey)?.button;
      if(!next)return;
      if(!next.matches('[data-random-pick]'))next.click();
      next.focus({preventScroll:true});
      next.scrollIntoView({block:'nearest',inline:'nearest'});
      return;
    }
    return;
  }
  if (event.key !== "Escape") return;
  event.stopImmediatePropagation(); event.preventDefault();
  if (event.repeat || overlayState === "end") return;
  if (overlayState === "pause") resume(); else pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
const resetTouchJoystick=attachTouchJoystick($('#touchJoystick'),{bindings:()=>controlSettings.keyboard[0],enabled:()=>Boolean(game?.running&&!game.paused&&!overlayState)});
for (const button of document.querySelectorAll("[data-key]")) {
  const key = button.dataset.key;
  const action = Object.keys(DEFAULT_CONTROLS[0]).find(action => [DEFAULT_CONTROLS[0][action]].flat().includes(`Key${key.toUpperCase()}`));
  let heldCode;
  const send = (type) => {
    const code = type === 'keydown' ? [controlSettings.keyboard[0][action]].flat()[0] : heldCode;
    if (!code) return;
    heldCode = type === 'keydown' ? code : null;
    window.dispatchEvent(
      new KeyboardEvent(type, {
        key,
        code,
        bubbles: true,
      }),
    );
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    send("keydown");
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(type, () => send("keyup"));
}
online=new OnlineVersus({
  selection: lobby => {
    if(!online.room)return;
    if(lobby.phase==='waiting'){
      if(selection.mode==='online'&&['fighter','stage','versus','fight'].includes(screen)){
        game?.destroy();game=null;$('#gameScreen').hidden=true;$('#matchOverlay').hidden=true;$('#menu').hidden=false;overlayState=null;document.body.classList.remove('in-match','overlay-open');showScreen('online');
      }
      return;
    }
    if(!['fighters','stage'].includes(lobby.phase))return;
    const [p1,p2]=lobby.players;const changed=selection.player!==p1.fighter||selection.opponent!==p2.fighter;
    Object.assign(selection,{mode:'online',player:p1.fighter,opponent:p2.fighter,stage:lobby.stage});
    selectionSlot=online.slot===0?'player':'opponent';
    if(lobby.phase==='fighters'){
      if(screen!=='fighter')showScreen('fighter');else if(changed)renderSelection();
      const self=lobby.players.find(p=>p.slot===online.slot);
      $('#fighterNext').disabled=!self||!!self.ready;$('#fighterNext').textContent=!self?'ASSISTINDO À SELEÇÃO…':self.ready?'AGUARDANDO O OUTRO JOGADOR…':'CONFIRMAR LUTADOR';
      $('#playerPreview').parentElement.querySelector('small').textContent=`P1 · ${p1.name}${p1.ready?' · PRONTO':''}`;
      $('#opponentPreview').parentElement.querySelector('small').textContent=`P2 · ${p2.name}${p2.ready?' · PRONTO':''}`;
    }else{
      if(screen!=='stage')showScreen('stage');updateStageBackdrop();
      const host=online.room.sessionId===lobby.host;
      for(const button of document.querySelectorAll('[data-stage]')){button.disabled=!host;button.classList.toggle('selected',Number(button.dataset.stage)===lobby.stage);button.setAttribute('aria-pressed',String(Number(button.dataset.stage)===lobby.stage));}
      $('#matchLoadStatus').textContent=host?'Escolha a arena para os dois jogadores.':'O anfitrião está escolhendo a arena.';
    }
  },
  prepare: async ({players,stage,matchId}) => {
    const validPhase=()=>online.lobby?.phase==='loading'||(online.slot===null&&online.lobby?.phase==='fighting');
    const room=online.room;
    await Promise.all([...players.map(p=>loadFighter(p.fighter)),loadBattleArt()]);
    if(online.room!==room||!validPhase()||online.lobby.matchId!==matchId) return false;
    campaign=null;Object.assign(selection,{player:players[0].fighter,opponent:players[1].fighter,stage,mode:'online'});
    $('#versusLeft').src=sources[selection.player];$('#versusRight').src=sources[selection.opponent];
    $('#versusLeftName').textContent=players[0].name;$('#versusRightName').textContent=players[1].name;$('#versusOpponent').textContent='PLAYER 2';$('#versusStage').textContent=stageNames[stage];
    showScreen('versus');await new Promise(resolve=>setTimeout(resolve,VS_PRESENTATION_SECONDS * 1000));
    if(online.room!==room||!validPhase()||online.lobby.matchId!==matchId)return false;
    game?.destroy();document.body.classList.add('in-match');document.body.classList.remove('overlay-open');
    $('#menu').hidden=true;$('#gameScreen').hidden=false;$('#matchOverlay').hidden=true;overlayState=null;screen='fight';
    $('#matchLabel').textContent=`VERSUS ONLINE · ${online.slot===null?'ESPECTADOR':'VOCÊ: P'+(online.slot+1)} / ${stageNames[stage]}`;
    game=new FightGame($('#gameCanvas'),assets,{stageArt,crowdArt,muted,online:true,debugHitboxes:new URLSearchParams(location.search).has('hitboxes'),onInput:held=>online.sendInput(held),onPause:()=>setOverlay('pause')});
    game.start({...selection,mode:'versus'});game.phase='intro';$('#gameCanvas').focus();applyMute();return true;
  },
  frame: snapshot => {
    if(!game?.options.online)return;
    const previous=game.fighters;
    Object.assign(game,snapshot);
    game.projectiles=snapshot.projectiles.map(p=>({...p,owner:game.fighters[p.owner],hitTargets:new Set()}));
    game.fighters.forEach((f,i)=>{if(previous[i]?.health>f.health)game.sound(f.guard?'block':'hit',f);else if(f.action&&f.action!==previous[i]?.action)game.sound(f.action==='super'?'super':f.action==='special'?'special':'punch',f);});
  },
  result: result => {
    if(!game?.options.online)return;
    game.options.onInput?.([]);game.paused=true;
    setOverlay('end',selection[result.winner===0?'player':'opponent']);
    $('#rematchButton').textContent='VOLTAR À SALA';
  },
  exit: () => {
    if(game?.options.online){game.destroy();game=null;$('#gameScreen').hidden=true;$('#matchOverlay').hidden=true;$('#menu').hidden=false;overlayState=null;document.body.classList.remove('in-match','overlay-open');showScreen('online');}
  },
});
let controllerSummary='';
let secretPausedGame=null;
function devonUnavailable(){
  if(online?.room||game?.options.online)return 'Disponível fora das partidas online.';
  if(!assets||battleLoading||screen==='versus')return 'Aguarde o carregamento do jogo.';
  if(!(FIGHTERS.devon||NON_PLAYABLE_FIGHTERS.devon)||!spriteManifest.devon?.idle||!COLLISION_DATA.devon)return 'Devon em preparação: o chefão ainda não foi integrado ao jogo.';
  return '';
}
registerSecretAction({
  id:'devon',label:'ENFRENTAR DEVON',description:'Ir direto ao covil do chefão com o personagem atual.',
  available:devonUnavailable,
  async run(){
    const reason=devonUnavailable();if(reason)throw new Error(reason);
    // Load first: a failure keeps the current fight and Arcade progress intact.
    await Promise.all([loadFighter(selection.player),loadFighter('devon')]);
    campaign=null;campaignComplete=false;
    await versus({mode:'arcade',opponent:'devon'});
    if(screen!=='versus')throw new Error('Não foi possível iniciar o desafio. Tente novamente.');
    return true;
  },
});
const secretMenu=createSecretMenu({
  parent:arcade,
  canOpen:()=>$('#controlsDialog').hidden&&!$('#createRoomDialog').open&&!battleLoading&&screen==='fighter'&&!online?.room,
  onOpen(){
    cancelRandomSelection();
    secretPausedGame=game?.running&&!game.paused&&!game.options.online?game:null;
    secretPausedGame?.pause();
  },
  onClose(){
    if(secretPausedGame===game&&game?.running&&!overlayState)game.resume();
    secretPausedGame=null;
  },
});
function menuGamepads() {
  if (!game?.running || game.paused) {
    const frames=gamepads.poll();
    const summary=frames.map((p,i)=>`P${i+1}: ${p.connected?p.id:'não conectado'}`).join(' · ');
    if (summary!==controllerSummary) { $('#controllerStatus').textContent=summary;controllerSummary=summary; }
    if(captureGamepadBinding(frames)){requestAnimationFrame(menuGamepads);return;}
    for (const frame of frames) {
      if (!frame.connected || document.hidden) continue;
      const pressed=frame.menuPressed||frame.pressed;
      if (bindingTarget) { if(pressed.has('kick'))cancelBinding();continue; }
      if (!secretMenu.isOpen && pressed.has('special') && !$('#createRoomDialog').open && !$('#controlsButton').hidden && $('#controlsDialog').hidden) { openOptions(); break; }
      if (!secretMenu.isOpen && pressed.has('super') && screen==='fighter' && $('#controlsDialog').hidden) { setSelectionSlot(selectionSlot==='player'?'opponent':'player'); break; }
      if (!secretMenu.isOpen && pressed.has('pause') && overlayState==='pause' && $('#controlsDialog').hidden) { resume(); break; }
      const actions=[['left','ArrowLeft'],['right','ArrowRight'],['jump','ArrowUp'],['crouch','ArrowDown'],['punch','Enter'],['kick','Escape'],['pause','Enter']];
      for(const [action,key] of actions)if(pressed.has(action)) {
        window.dispatchEvent(new KeyboardEvent('keydown',{key,code:key,bubbles:true}));
        window.dispatchEvent(new KeyboardEvent('keyup',{key,code:key,bubbles:true}));
        break;
      }
      if (actions.some(([action])=>pressed.has(action))) break;
    }
  }
  requestAnimationFrame(menuGamepads);
}
requestAnimationFrame(menuGamepads);
const unlockSound=()=>audioDirector.unlock().then(()=>{audioDirector.warmFighter(selection.player);audioDirector.warmFighter(selection.opponent);}).catch(()=>{});
window.addEventListener("pointerdown",unlockSound,{capture:true});
window.addEventListener("keydown",unlockSound,{capture:true});
document.addEventListener("click",event=>{const button=event.target.closest?.("button");if(button)audioDirector.play(button.matches("[data-mode],[data-stage]")||/Next|Start/.test(button.id)?"confirm":"select",{volume:.22});});
applyMute();
loadAssets()
  .then(async (loaded) => {
    assets = loaded;
    const animated = Object.values(assets).some(
      (fighter) => Object.keys(fighter).length > 1,
    );
    updateStartupProgress(100);
    await new Promise(resolve=>setTimeout(resolve,300));
    $("#titleScreen").classList.remove("is-loading");
    $("#titleScreen").classList.add("is-ready");
    $("#titleScreen").setAttribute("aria-busy","false");
    $("#titleLoading").hidden = true;
    $("#loadStatus").textContent = "";
    $("#titleStart").textContent = "APERTE START";
    $("#titleStart").disabled = false;
    refreshInputHints();

  })
  .catch((error) => {
    $("#loadStatus").textContent = error.message;
  });
window.__ui = {
  start,
  loadFighter,
  pause,
  resume,
  backToMenu,
  get game() {
    return game;
  },
  get assets() {
    return assets;
  },
  selection,
  get screen() { return screen; },
  get campaign() { return campaign; },
  online,
};
