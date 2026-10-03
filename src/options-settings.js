import {getInputDevice} from './input-device.js';
import {controlSettings,GAMEPAD_ACTION_LABELS,gamepadButtonLabel} from './controls.js';
import {audioDirector} from './audio.js';
const $=selector=>document.querySelector(selector);
const tabs=[...document.querySelectorAll('[data-options-tab]')];
$('#controlsDialog').addEventListener('focusin',event=>{
  if(event.target.matches('button,select,input')&&getInputDevice()==='gamepad')audioDirector.play('select',{volume:.22});
});
let padCapture=null;
export function cancelGamepadBinding(){
  padCapture?.button.classList.remove('binding-active');padCapture=null;
}
export function showOptionsTab(key){
  cancelGamepadBinding();
  for(const tab of tabs){const selected=tab.dataset.optionsTab===key;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;$('#'+tab.getAttribute('aria-controls')).hidden=!selected;}
}
for(const tab of tabs)tab.addEventListener('click',()=>showOptionsTab(tab.dataset.optionsTab));
function renderGamepadBindings(){
  $('#gamepadBindings').innerHTML=controlSettings.gamepad.map((bindings,player)=>`<section class="player-controls"><header><span class="control-badge">P${player+1}</span><h3>BOTÕES</h3></header><dl>${Object.entries(GAMEPAD_ACTION_LABELS).map(([action,label])=>`<div><dt>${label}</dt><dd><button class="key-binding" data-pad-player="${player}" data-pad-action="${action}" aria-label="P${player+1}: ${label}. Alterar botão">${bindings[action].map(gamepadButtonLabel).join(' / ')}</button></dd></div>`).join('')}</dl></section>`).join('');
}
$('#gamepadBindings').addEventListener('click',event=>{
  const button=event.target.closest('[data-pad-action]');if(!button)return;
  cancelGamepadBinding();padCapture={button,player:Number(button.dataset.padPlayer),action:button.dataset.padAction,armed:false};button.classList.add('binding-active');
  $('#gamepadBindingStatus').textContent=`P${padCapture.player+1}: ${GAMEPAD_ACTION_LABELS[padCapture.action]} — solte os botões e pressione o novo botão nesse controle. ESC cancela.`;
});
export function captureGamepadBinding(frames){
  if(!padCapture)return false;
  const frame=frames[padCapture.player];
  if(!frame?.connected){$('#gamepadBindingStatus').textContent=`Conecte o controle de P${padCapture.player+1} para continuar. ESC cancela.`;return true;}
  if(!padCapture.armed){if(!frame.heldButtons.size)padCapture.armed=true;return true;}
  const next=[...frame.pressedButtons].find(n=>n<=15);if(next===undefined)return true;
  const {player,action}=padCapture,result=controlSettings.bindGamepad(player,action,next);
  if(result.ok){cancelGamepadBinding();renderGamepadBindings();$(`[data-pad-player="${player}"][data-pad-action="${action}"]`).focus();$('#gamepadBindingStatus').textContent=result.saved?'Botão alterado e salvo.':'Botão alterado nesta sessão; o navegador não permitiu salvar.';}
  return true;
}
export function isCapturingGamepad(){return Boolean(padCapture);}
$('#resetGamepadBindings').addEventListener('click',()=>{cancelGamepadBinding();const saved=controlSettings.resetGamepad();renderGamepadBindings();$('#gamepadBindingStatus').textContent=saved?'Botões padrão restaurados e salvos.':'Botões restaurados nesta sessão.';});
renderGamepadBindings();
for(const kind of ['music','effects']){
  const field=$(`#${kind}Volume`),output=$(`#${kind}VolumeValue`);
  field.value=Math.round(audioDirector[`${kind}Volume`]*100);output.textContent=`${field.value}%`;
  field.addEventListener('input',()=>{const saved=audioDirector.setVolume(kind,Number(field.value)/100);output.textContent=`${field.value}%`;field.setAttribute('aria-valuetext',output.textContent);$('#volumeStatus').textContent=saved?'Volumes salvos neste navegador.':'Volumes ativos nesta sessão; o navegador não permitiu salvar.';});
}

const subtabs=[...document.querySelectorAll('[data-controls-tab]')];
function showControlsTab(key){
  cancelGamepadBinding();
  for(const tab of subtabs){const selected=tab.dataset.controlsTab===key;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;$('#'+tab.getAttribute('aria-controls')).hidden=!selected;}
}
for(const tab of subtabs)tab.addEventListener('click',()=>showControlsTab(tab.dataset.controlsTab));
const visibleControls=scope=>[...scope.querySelectorAll('button,select,input')].filter(el=>!el.disabled&&el.getClientRects().length);
function focusOption(element){element?.focus();element?.scrollIntoView({block:'nearest',inline:'nearest'});}
// Tabs form separate navigation levels; content follows its visual arrangement.
export function navigateOptions(event){
  const key=event.key.toLowerCase(),active=document.activeElement;
  const confirm=['enter',' ','j','1'].includes(key),back=['escape','k','2'].includes(key);
  const dx=['arrowleft','a'].includes(key)?-1:['arrowright','d'].includes(key)?1:0;
  const dy=['arrowup','w'].includes(key)?-1:['arrowdown','s'].includes(key)?1:0;
  if(!confirm&&!back&&!dx&&!dy)return false;
  const main=$('[data-options-tab][aria-selected=true]'),sub=$('[data-controls-tab][aria-selected=true]');
  const isMain=active?.matches('[data-options-tab]'),isSub=active?.matches('[data-controls-tab]');
  if(isMain||isSub){
    const list=isMain?tabs:subtabs;
    if(dx){event.preventDefault();const next=list[(list.indexOf(active)+dx+list.length)%list.length];if(isMain)showOptionsTab(next.dataset.optionsTab);else showControlsTab(next.dataset.controlsTab);focusOption(next);return true;}
    if(confirm||dy>0){event.preventDefault();const panel=$('#'+active.getAttribute('aria-controls'));focusOption(isMain&&active.dataset.optionsTab==='controls'?sub:visibleControls(panel)[0]);return true;}
    if(back||dy<0){event.preventDefault();if(isSub)focusOption(main);else if(dy<0)focusOption($('#closeControls'));else return false;return true;}
  }
  const panel=active?.closest('[role=tabpanel]');
  if(back&&panel){event.preventDefault();focusOption(panel.id.startsWith('controls-panel-')?sub:main);return true;}
  if(!dx&&!dy)return false;
  // Left/right on adjustable fields keeps the existing value adjustment path.
  if(dx&&active?.matches('select,input[type=range]'))return false;
  if(active?.id==='closeControls'){event.preventDefault();focusOption(main);return true;}
  if(!panel)return false;
  event.preventDefault();
  const rect=active.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
  const candidates=visibleControls(panel).filter(el=>el!==active).map(el=>{const r=el.getBoundingClientRect();return {el,x:r.left+r.width/2,y:r.top+r.height/2};}).filter(p=>dx?(p.x-x)*dx>8: (p.y-y)*dy>8);
  candidates.sort((a,b)=>{const score=p=>dx?Math.abs(p.x-x)+Math.abs(p.y-y)*4:Math.abs(p.y-y)+Math.abs(p.x-x)*4;return score(a)-score(b);});
  if(candidates.length)focusOption(candidates[0].el);else if(dy<0)focusOption(panel.id.startsWith('controls-panel-')?sub:main);
  return true;
}
