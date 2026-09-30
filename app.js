import {OnlineVersus} from "./online.js";
import {controlSettings, DEFAULT_CONTROLS, ACTION_LABELS, keyLabel, gamepads} from "./controls.js";
import {audioDirector} from "./audio.js";
import { FightGame } from "./phaser-game.js";
import {FIGHTERS, fighterIds, defaultOpponent} from "./roster.js";
import {PowerPreview} from "./power-preview.js";
let online;
const $ = (selector) => document.querySelector(selector);
const sources = Object.fromEntries(fighterIds.map(id => [id, FIGHTERS[id].source]));
const supportingCast = fighterIds.filter(id=>id!=="maya"&&id!=="bruno");
const titleTeams = [["maya",...supportingCast.filter((_,i)=>i%2===0)],["bruno",...supportingCast.filter((_,i)=>i%2===1)]];
for (const [index,ids] of titleTeams.entries()) {
  const team = document.createElement("div");
  team.className = `title-team ${index ? "right" : "left"}`;
  team.setAttribute("aria-hidden","true");
  team.innerHTML = [...ids].reverse().map(id=>{
    const position=ids.indexOf(id);
    return `<canvas data-title-player="${id}" aria-hidden="true" class="${position===0?"team-leader":""}" style="--cast-index:${position};--cast-row:${Math.floor(position/5)};--cast-column:${position%5};--cast-total:${ids.length}"></canvas>`;
  }).join("");
  $("#titleScreen").prepend(team);
}
const stageArtSources = ["v8/sao-paulo", "v8/rio", "recife", "v8/manaus"];
const stageNames = ["SÃO PAULO — MASP", "RIO — COPACABANA", "RECIFE ANTIGO", "MANAUS — ENCONTRO DAS ÁGUAS"];
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
async function loadAssets() {
  const result = {};
  let manifest = {};
  try {
    const response = await fetch("assets/manifest.json");
    if (response.ok) manifest = await response.json();
  } catch {}
  spriteManifest = manifest;
  Object.assign(result, Object.fromEntries(await Promise.all(fighterIds.map(async name => [name, {idle:[await image(sources[name])]}]))));
  assets = result;
  for(const id of fighterIds) {
    const portrait=result[id].idle[0],bounds=portraitBounds(portrait);
    const canvas=document.querySelector(`[data-title-player="${id}"]`);
    if(canvas){canvas.width=bounds.width;canvas.height=bounds.height;
    canvas.getContext("2d").drawImage(portrait,bounds.x,bounds.y,bounds.width,bounds.height,0,0,canvas.width,canvas.height);}
    prepareIdlePreview(id);
  }
  // Keep startup small; only the selected pair's animations are decoded.
  await Promise.all([loadFighter("maya"), loadFighter("bruno")]);
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
    const response = await fetch("assets/stages/v8/npcs/crowd-manifest.json");
    if(response.ok) {
      const manifest = await response.json();
      for(const [id,spec] of Object.entries(manifest)) {
        const frames = await Promise.all(spec.frames.map(async entry=>{const img=await image(entry.path);img.spriteMeta={...entry};return img}));
        frames.animation={fps:spec.fps || 3,loop:true};crowdArt[id]=frames;
      }
    }
  } catch {}
  stageArt.forEach((art, index) => {
    if (!art) return;
    const preview = document.querySelector(`[data-stage="${index}"] .arena-art`);
    if (preview) {
      preview.style.background = `url("${art.src}") center / cover`;
      for (const detail of preview.children) detail.hidden = true;
    }
  });
  return result;
}
let spriteManifest = {}, fighterLoading = new Map();
const loadedFighters = new Set(), basePortraits = new Map();
async function loadFighter(name) {
  if (fighterLoading.has(name)) return fighterLoading.get(name);
  const promise = (async () => {
    if (!spriteManifest[name]?.idle) throw new Error("As animações deste lutador ainda não estão disponíveis.");
    const result = assets[name];
    if (!basePortraits.has(name)) basePortraits.set(name,result.idle[0]);
    for (const [state, paths] of Object.entries(spriteManifest[name] || {})) {
      const files = Array.isArray(paths) ? paths : paths.frames || [];
      const loaded = await Promise.all(files.map(async file => {
        const img = await image(typeof file === "string" ? file : file.path);
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
const idlePreviews = new Map();
const powerPreviewAssets = new Map();
let powerPreviews = [];
let previewAnimation, previewGeneration = 0;
function stopSelectionPreviews() {
  cancelAnimationFrame(previewAnimation);
  for(const preview of powerPreviews) preview.destroy();
  powerPreviews=[];
}
async function preparePowerPreviewAssets(id) {
  if(powerPreviewAssets.has(id))return powerPreviewAssets.get(id);
  const pending=Promise.all(["idle","special","super","hurt"].map(async state=>{
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
function animateSelectionPreviews() {
  stopSelectionPreviews();
  const generation=++previewGeneration,chosen=[selection.player,selection.opponent],previews=[null,null];
  chosen.forEach((id,index)=>prepareIdlePreview(id).then(preview=>{
    if(generation===previewGeneration)previews[index]=preview;
  }));
  const pair=Promise.all([...new Set(chosen)].map(async id=>[id,await preparePowerPreviewAssets(id)])).then(Object.fromEntries);
  for(const id of powerPreviewAssets.keys()) {
    if(powerPreviewAssets.size<=4)break;
    if(!chosen.includes(id))powerPreviewAssets.delete(id);
  }
  for(const [index,prefix] of ["player","opponent"].entries()) {
    const canvas=$("#"+prefix+"PowerDemo"),label=$("#"+prefix+"DemoLabel");
    canvas.dataset.demoReady="false";
    canvas.dataset.demoFighter=chosen[index];
    canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height);
    label.textContent="ESPECIAL / SUPER";
    pair.then(decoded=>{
      if(generation!==previewGeneration||screen!=="fighter")return;
      const demo=new PowerPreview(canvas,decoded,{player:chosen[index],opponent:chosen[1-index],facing:index?-1:1,onMove:({move,label:moveLabel})=>{
        const key=keyLabel([controlSettings.keyboard[index][move]].flat()[0]);
        label.textContent=`${key} · ${move==="super"?"SUPER":"ESPECIAL"} · ${moveLabel}`;
        canvas.setAttribute("aria-label",`${FIGHTERS[chosen[index]].name}: ${moveLabel}`);
      }});
      powerPreviews.push(demo);
    }).catch(()=>{
      if(generation===previewGeneration)label.textContent="PRÉVIA INDISPONÍVEL";
    });
  }
  const started=performance.now();
  let last=started;
  function draw(now) {
    if(generation!==previewGeneration||screen!=="fighter")return;
    const dt=Math.min(Math.max((now-last)/1000,0),.05);last=now;
    for(const demo of powerPreviews){demo.tick(dt);demo.draw();}
    for(const [index,prefix] of ["player","opponent"].entries()) {
      const canvas=$("#"+prefix+"Preview"),ctx=canvas.getContext("2d"),preview=previews[index];
      ctx.clearRect(0,0,canvas.width,canvas.height);
      if(preview){
        const sprite=preview.frames[Math.floor(Math.max(0,now-started)/1000*preview.fps)%preview.frames.length];
        const height=350/preview.referenceHeight*sprite.height*sprite.spriteMeta.scale,width=height*sprite.width/sprite.height;
        ctx.drawImage(sprite,canvas.width/2-width*sprite.spriteMeta.anchorX,canvas.height-12-height*sprite.spriteMeta.anchorY,width,height);
        canvas.dataset.previewState=preview.frames.length>1?"animated":"idle";
      }else{
        const portrait=basePortraits.get(chosen[index])||assets?.[chosen[index]]?.idle[0];
        if(portrait?.naturalWidth){const box=portraitBounds(portrait),scale=Math.min(350/box.height,(canvas.width-16)/box.width);
          ctx.drawImage(portrait,box.x,box.y,box.width,box.height,(canvas.width-box.width*scale)/2,canvas.height-12-box.height*scale,box.width*scale,box.height*scale);
        }
        canvas.dataset.previewState="portrait";
      }
      canvas.dataset.previewFighter=chosen[index];
    }
    previewAnimation=requestAnimationFrame(draw);
  }
  draw(started);
}
function renderSelection() {
  const network=selection.mode==="online"&&!!online?.room;
  if(!network){$("#playerPreview").parentElement.querySelector("small").textContent="JOGADOR 1";$("#opponentPreview").parentElement.querySelector("small").textContent="RIVAL";}
  audioDirector.warmFighter(selection.player);audioDirector.warmFighter(selection.opponent);
  const p = FIGHTERS[selection.player], rival = FIGHTERS[selection.opponent];
  for (const [prefix,f] of [["player",p],["opponent",rival]]) {
    $("#"+prefix+"Preview").setAttribute("aria-label",f.name);
    $("#"+prefix+"Name").textContent = f.name;
    $("#"+prefix+"Power").textContent = f.power.label + " / " + f.power.superLabel;
    $("#"+prefix+"Description").textContent = f.power.description;
  }
  for (const item of document.querySelectorAll("[data-player]")) {
    item.classList.toggle("selected",item.dataset.player===selection.player);
    item.classList.toggle("opponent-selected",item.dataset.player===selection.opponent);
    item.setAttribute("aria-pressed",String(item.dataset.player===selection[selectionSlot]));
    item.querySelector(".pick-badge").textContent = [item.dataset.player===selection.player?"P1":"",item.dataset.player===selection.opponent?((selection.mode==="versus"||network)?"P2":"CPU"):""].filter(Boolean).join(" · ");
  }
  $("#opponentSlot").textContent = (selection.mode==="versus"||network)?"JOGADOR 2":"RIVAL / TREINO";
  $("#fighterHeading").textContent = selectionSlot==="player"?"ESCOLHA SEU LUTADOR":"ESCOLHA O RIVAL";
  for(const button of document.querySelectorAll("[data-slot]")){button.classList.toggle("active",button.dataset.slot===selectionSlot);button.disabled=network&&button.dataset.slot!==(online.slot===0?"player":"opponent");}
  $(".roster-hint").textContent=network?"CADA JOGADOR ESCOLHE SEU LUTADOR · SELEÇÃO AO VIVO":"Q TROCA P1 / RIVAL · U ESPECIAL · I SUPER";
  if (spriteManifest.maya) animateSelectionPreviews();
}
const fighterScreen = $("#fighterScreen");
fighterScreen.innerHTML = `<header class="screen-heading"><span>02 / PLAYER SELECT</span><h2 id="fighterHeading">ESCOLHA SEU LUTADOR</h2></header>
<div class="fighter-selection"><div class="fighter-preview"><canvas id="playerPreview" width="420" height="400" role="img"></canvas><small>JOGADOR 1</small><strong id="playerName"></strong><span id="playerPower"></span><p id="playerDescription"></p><figure class="power-demo"><canvas id="playerPowerDemo" role="img" width="1280" height="720"></canvas><figcaption id="playerDemoLabel">ESPECIAL / SUPER</figcaption></figure></div>
<div class="fighter-picks"><div class="pick-tabs"><button data-slot="player" class="active">JOGADOR 1</button><button data-slot="opponent" id="opponentSlot">RIVAL</button></div><div class="fighter-list roster-grid">${fighterIds.map(id=>`<button class="roster-fighter" data-player="${id}" aria-label="Selecionar ${FIGHTERS[id].name}"><img src="${FIGHTERS[id].source}" alt="${FIGHTERS[id].name}"><span class="pick-badge"></span><strong>${FIGHTERS[id].name}</strong></button>`).join("")}</div><p class="roster-hint">Q TROCA P1 / RIVAL · U ESPECIAL · I SUPER</p></div>
<div class="fighter-preview rival-preview"><canvas id="opponentPreview" width="420" height="400" role="img"></canvas><small>RIVAL</small><strong id="opponentName"></strong><span id="opponentPower"></span><p id="opponentDescription"></p><figure class="power-demo"><canvas id="opponentPowerDemo" role="img" width="1280" height="720"></canvas><figcaption id="opponentDemoLabel">ESPECIAL / SUPER</figcaption></figure></div></div><button class="confirm-button" id="fighterNext">CONFIRMAR LUTADORES →</button>`;
function setSelectionSlot(slot) {
  if(selection.mode==="online"&&online?.room&&slot!==(online.slot===0?"player":"opponent"))return;
  selectionSlot=slot;
  renderSelection();
  document.querySelector(`[data-player="${selection[selectionSlot]}"]`)?.scrollIntoView({block:"nearest",inline:"nearest"});
}
for (const button of document.querySelectorAll("[data-slot]")) button.addEventListener("click",()=>setSelectionSlot(button.dataset.slot));
renderSelection();
let screen = "title", transitionTimer, campaign = null, campaignComplete = false;
const screenIds = {title:"titleScreen",mode:"modeScreen",fighter:"fighterScreen",stage:"stageScreen",online:"onlineScreen",versus:"versusScreen"};
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
  const id={mode:"modeNext",fighter:"fighterNext",stage:"startButton"}[next];
  if(id){const button=$("#"+id);menuActions.append(button);dockedConfirm={screen:next,button};}
}
dockMenuActions("title");
function updateStageBackdrop() {
  const path = stageArtSources[selection.stage];
  $("#stageScreen").style.setProperty("--stage-background", `url("assets/stages/${path}.png")`);
}
function showScreen(next) {
  if (next === "stage") {
    updateStageBackdrop();
    if(selection.mode!=='online') {for(const button of document.querySelectorAll('[data-stage]'))button.disabled=false;$('#startButton').disabled=!assets;$('#startButton').textContent='LUTAR →';$('#matchLoadStatus').textContent='';}
  }
  if(next==='fighter'&&selection.mode!=='online'){$('#fighterNext').disabled=false;$('#fighterNext').textContent='CONFIRMAR LUTADORES →';}
  stopSelectionPreviews();
  previewGeneration++;
  if (next !== "versus") launchToken++;
  clearTimeout(transitionTimer);
  screen = next;
  dockMenuActions(next);
  audioDirector.setScene("menu");
  for (const [name,id] of Object.entries(screenIds)) $("#"+id).hidden = name !== next;
  $("#backButton").hidden = next === "title" || next === "versus";
  $("#navigationHint").textContent = next === "title" ? "ENTER / TOQUE PARA COMEÇAR" : next === "versus" ? "PREPARE-SE PARA LUTAR" : "WASD / SETAS · J / ENTER CONFIRMAR · K / ESC VOLTAR";
  if(next === "fighter")renderSelection();
}
function setOverlay(state, winner) {
  audioDirector.setScene("pause");
  document.body.classList.add("overlay-open");
  overlayState = state;
  $("#matchOverlay").hidden = false;
  $("#resumeButton").hidden = state !== "pause";
  $("#rematchButton").hidden = state !== "end";
  const won = winner && winner !== "draw" && String(winner.id || winner.name || winner).toLowerCase() === selection.player;
  const advancing = state === "end" && campaign && won && campaign.index < 2;
  const champion = state === "end" && campaign && won && campaign.index === 2;
  campaignComplete = Boolean(champion);
  $("#nextStageButton").hidden = !advancing;
  $("#rematchButton").textContent = champion ? "JOGAR NOVAMENTE" : "REVANCHE";
  $("#overlayEyebrow").textContent = state === "pause" ? "PAUSE MENU" : champion ? "ARCADE COMPLETE" : campaign ? `STAGE ${campaign.index+1} / 3` : "MATCH RESULT";
  $("#overlayTitle").textContent = state === "pause" ? "PAUSADO" : champion ? "CAMPEÃO DAS RUAS" : winner === "draw" ? "EMPATE" : `${String(FIGHTERS[winner]?.name || winner?.name || winner || "").toUpperCase()} VENCEU`;
  $("#overlayDescription").textContent = state === "pause" ? (game?.options.online ? "A partida online continua. Seu lutador fica parado enquanto este menu está aberto." : "Volte para o próximo round.") : advancing ? "O próximo desafio espera em outra parte da cidade." : champion ? "Três arenas. Uma vitória definitiva." : campaign && !won ? "A cidade ainda não conhece seu nome. Tente de novo." : "Pronto para uma revanche?";
  (state === "pause" ? $("#resumeButton") : advancing ? $("#nextStageButton") : $("#rematchButton")).focus();
}
async function versus(config = {}, newCampaign = false) {
  if (!assets || battleLoading) return;
  Object.assign(selection, config);
  if (newCampaign) {
    const rivals = fighterIds.filter(id=>id!==selection.player);
    const first = Math.max(0,rivals.indexOf(selection.opponent));
    campaign = selection.mode === "arcade" ? {index:0,stages:[selection.stage,(selection.stage+1)%stageNames.length,(selection.stage+2)%stageNames.length],opponents:[rivals[first],rivals[(first+3)%rivals.length],rivals[(first+6)%rivals.length]]} : null;
  }
  if (campaign) selection.opponent = campaign.opponents[campaign.index];
  const token = ++launchToken;
  const match = {...selection};
  battleLoading = true;
  $("#startButton").disabled = true;
  $("#startButton").textContent = "PREPARANDO LUTADORES…";
  $("#matchLoadStatus").textContent = "";
  try {await Promise.all([loadFighter(match.player),loadFighter(match.opponent)]);} catch(error) {
    $("#matchLoadStatus").textContent = "Não foi possível preparar os lutadores. Tente novamente.";
    $("#startButton").textContent = "TENTAR NOVAMENTE →";
    battleLoading = false; $("#startButton").disabled = false;return;
  }
  battleLoading = false;$("#startButton").disabled = false;$("#startButton").textContent="LUTAR →";
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
  $("#versusRight").src = sources[opponent];
  $("#versusLeftName").textContent = FIGHTERS[selection.player].name.toUpperCase();
  $("#versusRightName").textContent = FIGHTERS[opponent].name.toUpperCase();
  $("#versusOpponent").textContent = selection.mode === "versus" ? "PLAYER 2" : selection.mode === "training" ? "TRAINING PARTNER" : "CPU";
  $("#versusStage").textContent = stageNames[selection.stage];
  showScreen("versus");
  transitionTimer = setTimeout(() => start(), 950);
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
    `${selection.mode === "training" ? "TREINO" : selection.mode === "versus" ? "VERSUS LOCAL" : "ARCADE"} / ${stageNames[selection.stage]}`;
  game = new FightGame($("#gameCanvas"), assets, {
    stageArt,
    crowdArt,
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
function backToMenu() {
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
  showScreen("mode");
  $("#modeNext").focus();
}
for (const button of document.querySelectorAll("[data-player]"))
  button.addEventListener("click", () => {
    if(selection.mode==='online'&&online?.room){if(online.lobby?.phase==='fighters')online.room.send('configure',{fighter:button.dataset.player});return;}
    selection[selectionSlot] = button.dataset.player;
    if (selection.mode !== "versus" && selection.opponent === selection.player) selection.opponent=defaultOpponent(selection.player);
    renderSelection();
  });
for (const button of document.querySelectorAll("[data-mode]"))
  button.addEventListener("click", () => {
    selection.mode = button.dataset.mode;
    for (const item of document.querySelectorAll("[data-mode]")) {
      item.classList.toggle("active", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    }
    $("#difficulty").disabled = selection.mode !== "arcade";
    selectionSlot="player";renderSelection();
  });
for (const button of document.querySelectorAll("[data-stage]"))
  button.addEventListener("click", () => {
    if(selection.mode==='online'&&online?.room){if(online.room.sessionId===online.lobby?.host)online.room.send('configure',{stage:Number(button.dataset.stage)});return;}
    selection.stage = Number(button.dataset.stage);
    updateStageBackdrop();
    for (const item of document.querySelectorAll("[data-stage]")) {
      const chosen = item === button;
      item.classList.toggle("selected", chosen);
      item.setAttribute("aria-pressed", String(chosen));
    }
  });
$("#titleStart").addEventListener("click", () => showScreen("mode"));
$("#modeNext").addEventListener("click", () => { if(selection.mode==="online"){showScreen("online");online.open();}else showScreen("fighter"); });
$("#fighterNext").addEventListener("click", () => {if(selection.mode==="online"&&online.room)online.room.send("ready");else showScreen("stage");});
$("#startButton").addEventListener("click", () => {if(selection.mode==="online"&&online.room)online.room.send("start");else versus({}, true);});
$("#backButton").addEventListener("click", async () => { if(selection.mode==="online"&&online.room&&["fighter","stage","versus"].includes(screen)){online.room.send(screen==="stage"&&online.room.sessionId===online.lobby.host?"previous":"cancelSelection");return;}if(screen==="online"){await online.leave();showScreen("mode");return;}showScreen({mode:"title",fighter:"mode",stage:"fighter"}[screen] || "title"); });
$("#nextStageButton").addEventListener("click", () => { campaign.index++; versus({stage:campaign.stages[campaign.index]}); });
$("#resumeButton").addEventListener("click", resume);
$("#rematchButton").addEventListener("click", () => { if(game?.options.online){online.returnToLobby();return;} if(campaignComplete) { campaign = null; backToMenu(); } else versus(); });
$("#menuButton").addEventListener("click", backToMenu);
$("#pauseButton").addEventListener("click", pause);
let optionsReturnFocus;
let bindingTarget = null;
function renderBindings() {
  document.querySelectorAll('.player-controls').forEach((panel,player) => {
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
  $("#muteButton").focus();
}
function closeOptions() {
  cancelBinding();
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
    if (["escape","k","2"].includes(key)) { event.preventDefault(); closeOptions(); }
    else if (["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright","tab"].includes(key)) {
      event.preventDefault();
      const buttons = [...$("#controlsDialog").querySelectorAll("button")];
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
  const footerAction=event.target.closest?.(".menu-footer button");
  if (footerAction && ["enter"," ","j","1"].includes(event.key.toLowerCase())) {
    event.preventDefault();
    if(!event.repeat)footerAction.click();
    return;
  }
  const navigationKey = ({w:"ArrowUp",s:"ArrowDown",a:"ArrowLeft",d:"ArrowRight"})[event.key.toLowerCase()] || event.key;
  if (overlayState && !$("#matchOverlay").hidden) {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(navigationKey)) {
      event.preventDefault();event.stopImmediatePropagation();
      const buttons=[...document.querySelectorAll("#matchOverlay button")].filter(b=>!b.hidden);
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
    const confirm = {title:"titleStart",mode:"modeNext",fighter:"fighterNext",stage:"startButton"};
    if (screen === "fighter" && event.key === "Enter" && event.target.closest?.("[data-slot]")) return;
    if (screen === "fighter" && event.key.toLowerCase() === "q") {
      event.preventDefault();setSelectionSlot(selectionSlot === "player" ? "opponent" : "player");return;
    }
    if (["enter"," ","j","1"].includes(event.key.toLowerCase()) && confirm[screen]) { event.preventDefault(); if(!event.repeat) $("#"+confirm[screen]).click(); return; }
    if (["escape","k","2"].includes(event.key.toLowerCase())) { event.preventDefault(); $("#backButton").click(); return; }
    const selector = {mode:"[data-mode]",fighter:"[data-player]",stage:"[data-stage]"}[screen];
    if (selector && ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(navigationKey)) {
      event.preventDefault();
      const buttons = [...document.querySelectorAll(selector)];
      const current = buttons.findIndex(b => screen === "fighter" ? b.dataset.player === selection[selectionSlot] : b.classList.contains("selected") || b.classList.contains("active"));
      const delta = screen === "fighter" && ["ArrowUp","ArrowDown"].includes(navigationKey)
        ? (navigationKey === "ArrowUp" ? -4 : 4)
        : (["ArrowLeft","ArrowUp"].includes(navigationKey) ? -1 : 1);
      const next=buttons[(current + delta + buttons.length) % buttons.length];next.click();next.focus({preventScroll:true});
      if (screen === "fighter") next.scrollIntoView({block:"nearest",inline:"nearest"});
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
      $('#fighterNext').disabled=!!self.ready;$('#fighterNext').textContent=self.ready?'AGUARDANDO O OUTRO JOGADOR…':'CONFIRMAR LUTADOR →';
      $('#playerPreview').parentElement.querySelector('small').textContent=`P1 · ${p1.name}${p1.ready?' · PRONTO':''}`;
      $('#opponentPreview').parentElement.querySelector('small').textContent=`P2 · ${p2.name}${p2.ready?' · PRONTO':''}`;
    }else{
      if(screen!=='stage')showScreen('stage');updateStageBackdrop();
      const host=online.room.sessionId===lobby.host;
      for(const button of document.querySelectorAll('[data-stage]')){button.disabled=!host;button.classList.toggle('selected',Number(button.dataset.stage)===lobby.stage);button.setAttribute('aria-pressed',String(Number(button.dataset.stage)===lobby.stage));}
      $('#startButton').disabled=!host;$('#startButton').textContent=host?'LUTAR →':'AGUARDANDO O ANFITRIÃO…';$('#matchLoadStatus').textContent=host?'Escolha a arena para os dois jogadores.':'O anfitrião está escolhendo a arena.';
    }
  },
  prepare: async ({players,stage,matchId}) => {
    const room=online.room;
    await Promise.all(players.map(p=>loadFighter(p.fighter)));
    if(online.room!==room||online.lobby?.phase!=='loading'||online.lobby.matchId!==matchId) return false;
    campaign=null;Object.assign(selection,{player:players[0].fighter,opponent:players[1].fighter,stage,mode:'online'});
    $('#versusLeft').src=sources[selection.player];$('#versusRight').src=sources[selection.opponent];
    $('#versusLeftName').textContent=players[0].name;$('#versusRightName').textContent=players[1].name;$('#versusOpponent').textContent='PLAYER 2';$('#versusStage').textContent=stageNames[stage];
    showScreen('versus');await new Promise(resolve=>setTimeout(resolve,950));
    if(online.room!==room||online.lobby?.phase!=='loading'||online.lobby.matchId!==matchId)return false;
    game?.destroy();document.body.classList.add('in-match');document.body.classList.remove('overlay-open');
    $('#menu').hidden=true;$('#gameScreen').hidden=false;$('#matchOverlay').hidden=true;overlayState=null;screen='fight';
    $('#matchLabel').textContent=`VERSUS ONLINE · VOCÊ: P${online.slot+1} / ${stageNames[stage]}`;
    game=new FightGame($('#gameCanvas'),assets,{stageArt,crowdArt,muted,online:true,onInput:held=>online.sendInput(held),onPause:()=>setOverlay('pause')});
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
    $('#overlayTitle').textContent=`${result.name.toUpperCase()} VENCEU${result.perfect?' · PERFECT!':''}`;
    $('#overlayDescription').textContent=result.reason==='disconnect'?'Vitória por desconexão. Resultado registrado no ranking.':'Resultado registrado no ranking. Volte à sala para uma nova partida.';
    $('#rematchButton').textContent='VOLTAR À SALA';
  },
  exit: () => {
    if(game?.options.online){game.destroy();game=null;$('#gameScreen').hidden=true;$('#matchOverlay').hidden=true;$('#menu').hidden=false;overlayState=null;document.body.classList.remove('in-match','overlay-open');showScreen('online');}
  },
});
let controllerSummary='';
function menuGamepads() {
  if (!game?.running || game.paused) {
    const frames=gamepads.poll();
    const summary=frames.map((p,i)=>`P${i+1}: ${p.connected?p.id:'não conectado'}`).join(' · ');
    if (summary!==controllerSummary) { $('#controllerStatus').textContent=summary;controllerSummary=summary; }
    for (const frame of frames) {
      if (!frame.connected || document.hidden) continue;
      const pressed=frame.pressed;
      if (bindingTarget) { if(pressed.has('kick'))cancelBinding();continue; }
      if (pressed.has('special') && !$('#createRoomDialog').open && !$('#controlsButton').hidden && $('#controlsDialog').hidden) { openOptions(); break; }
      if (pressed.has('super') && !$('#createRoomDialog').open && screen==='mode' && !$('#difficulty').disabled && $('#controlsDialog').hidden) {
        const difficulty=$('#difficulty');difficulty.selectedIndex=(difficulty.selectedIndex+1)%difficulty.options.length;
        difficulty.dispatchEvent(new Event('change',{bubbles:true}));break;
      }
      if (pressed.has('super') && screen==='fighter' && $('#controlsDialog').hidden) { setSelectionSlot(selectionSlot==='player'?'opponent':'player'); break; }
      if (pressed.has('pause') && overlayState==='pause' && $('#controlsDialog').hidden) { resume(); break; }
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
document.addEventListener("click",event=>{const button=event.target.closest?.("button");if(button)audioDirector.play(/Next|Start|startButton/.test(button.id)?"confirm":"select",{volume:.22});});
applyMute();
loadAssets()
  .then((loaded) => {
    assets = loaded;
    const animated = Object.values(assets).some(
      (fighter) => Object.keys(fighter).length > 1,
    );
    $("#loadStatus").textContent = "";
    $("#titleStart").textContent = "APERTE START";
    $("#titleStart").disabled = false;
    $("#startButton").disabled = false;
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
