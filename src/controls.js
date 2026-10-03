import {setInputDevice} from './input-device.js';
export const DEFAULT_CONTROLS = [
  {left:'KeyA',right:'KeyD',jump:'KeyW',crouch:'KeyS',punch:['KeyJ'],kick:['KeyK'],guard:['KeyL'],special:['KeyU'],super:['KeyI']},
  {left:'ArrowLeft',right:'ArrowRight',jump:'ArrowUp',crouch:'ArrowDown',punch:['Numpad1','Digit1'],kick:['Numpad2','Digit2'],guard:['Numpad3','Digit3'],special:['Numpad4','Digit4'],super:['Numpad5','Digit5']},
];
export const ACTION_LABELS={left:'Esquerda',right:'Direita',jump:'Pular',crouch:'Agachar',punch:'Soco',kick:'Chute',guard:'Defesa',special:'Especial',super:'Super'};
export const GAMEPAD_ACTION_LABELS={...ACTION_LABELS,pause:'Pausar'};
export const DEFAULT_GAMEPAD_CONTROLS=Array.from({length:2},()=>({punch:[0],kick:[1],special:[2],super:[3],guard:[4,6],pause:[9],jump:[12],crouch:[13],left:[14],right:[15]}));
const GAMEPAD_STORAGE_KEY='buteco-gamepad-controls-v1';
export function gamepadButtonLabel(n){return ({0:'A / ×',1:'B / ○',2:'X / □',3:'Y / △',4:'LB / L1',5:'RB / R1',6:'LT / L2',7:'RT / R2',8:'Back / Share',9:'Start / Options',10:'LS / L3',11:'RS / R3',12:'↑',13:'↓',14:'←',15:'→'})[n]||`Botão ${n}`;}
const STORAGE_KEY='buteco-controls-v1';
const clone=()=>structuredClone(DEFAULT_CONTROLS);
const validCode=code=>typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Left|Right|Up|Down)|Space|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Backspace|Enter|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal|Backquote)$/.test(code);
export function keyLabel(code) {
  return ({ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Space:'ESPAÇO',ShiftLeft:'SHIFT E',ShiftRight:'SHIFT D',ControlLeft:'CTRL E',ControlRight:'CTRL D',AltLeft:'ALT E',AltRight:'ALT D',Enter:'ENTER',Backspace:'⌫',Comma:',',Period:'.',Slash:'/',Semicolon:';',Quote:"'",BracketLeft:'[',BracketRight:']',Backslash:'\\',Minus:'−',Equal:'=',Backquote:'`'})[code] || code.replace(/^Key|^Digit/,'').replace('Numpad','NUM ');
}
export class ControlSettings {
  constructor(storage) {
    this.storage=storage;this.keyboard=clone();this.gamepad=structuredClone(DEFAULT_GAMEPAD_CONTROLS);
    try{
      const data=JSON.parse(storage?.getItem(GAMEPAD_STORAGE_KEY)||'null');
      if(Array.isArray(data)&&data.length===2&&data.every(bindings=>{
        const seen=new Set();return Object.keys(GAMEPAD_ACTION_LABELS).every(action=>Array.isArray(bindings[action])&&bindings[action].length>0&&bindings[action].length<=2&&bindings[action].every(n=>Number.isInteger(n)&&n>=0&&n<=15&&!seen.has(n)&&!!seen.add(n)));
      }))this.gamepad=data;
    }catch{}
    try {
      const data=JSON.parse(storage?.getItem(STORAGE_KEY)||'null');
      if(!Array.isArray(data)||data.length!==2)return;
      const seen=new Set();
      for(let p=0;p<2;p++)for(const action of Object.keys(ACTION_LABELS)) {
        const value=data[p]?.[action],keys=Array.isArray(value)?value:[value];
        if(!keys.length||keys.length>2||!keys.every(validCode)||keys.some(k=>seen.has(k)))return;
        if(Array.isArray(DEFAULT_CONTROLS[p][action])!==Array.isArray(value))return;
        keys.forEach(k=>seen.add(k));
      }
      this.keyboard=data.map(bindings=>Object.fromEntries(Object.keys(ACTION_LABELS).map(action=>[action,bindings[action]])));
    }catch{}
  }
  save(){try{this.storage?.setItem(STORAGE_KEY,JSON.stringify(this.keyboard));return !!this.storage;}catch{return false;}}
  bind(player,action,code) {
    if(!this.keyboard[player]||!Object.hasOwn(ACTION_LABELS,action)||!validCode(code))return {ok:false,message:'Tecla indisponível. ESC cancela.'};
    for(const [p,bindings] of this.keyboard.entries())for(const [a,value] of Object.entries(bindings)) {
      if(p===player&&a===action)continue;
      if([value].flat().includes(code))return {ok:false,message:`Tecla já usada por P${p+1}: ${ACTION_LABELS[a]}. Escolha outra.`};
    }
    this.keyboard[player][action]=Array.isArray(DEFAULT_CONTROLS[player][action])?[code]:code;
    return {ok:true,saved:this.save()};
  }
  saveGamepad(){try{this.storage?.setItem(GAMEPAD_STORAGE_KEY,JSON.stringify(this.gamepad));return !!this.storage;}catch{return false;}}
  bindGamepad(player,action,button){
    if(!this.gamepad[player]||!Object.hasOwn(GAMEPAD_ACTION_LABELS,action)||!Number.isInteger(button)||button<0||button>15)return {ok:false,message:'Botão indisponível.'};
    const bindings=this.gamepad[player],previous=bindings[action][0];
    for(const [other,buttons]of Object.entries(bindings))if(other!==action&&buttons.includes(button))bindings[other]=buttons.length===1?[previous]:buttons.filter(n=>n!==button);
    bindings[action]=[button];return {ok:true,saved:this.saveGamepad()};
  }
  resetGamepad(){this.gamepad=structuredClone(DEFAULT_GAMEPAD_CONTROLS);return this.saveGamepad();}
  reset(){this.keyboard=clone();return this.save();}
}
let storage;try{if(typeof window!=="undefined")storage=window.localStorage;}catch{}
export const controlSettings=new ControlSettings(storage);
const empty=()=>({connected:false,id:'',held:new Set(),pressed:new Set(),heldButtons:new Set(),pressedButtons:new Set(),menuPressed:new Set()});
export class GamepadInput {
  constructor(read=()=>globalThis.navigator?.getGamepads?.()||[],settings=controlSettings){this.read=read;this.settings=settings;this.slots=[null,null];this.frames=[empty(),empty()];}
  poll() {
    let pads=[];try{pads=Array.from(this.read()).filter(p=>p&&p.connected!==false&&p.mapping==='standard');}catch{}
    const identities=pads.map(p=>`${p.index}:${p.id}`);
    // A disconnect frees its slot without moving the other player.
    this.slots=this.slots.map(id=>identities.includes(id)?id:null);
    for(const id of identities)if(!this.slots.includes(id)){const free=this.slots.indexOf(null);if(free>=0)this.slots[free]=id;}
    this.frames=this.slots.map((id,slot)=>{
      const pad=pads.find(p=>`${p.index}:${p.id}`===id);if(!pad)return empty();
      const held=new Set(),button=n=>pad.buttons[n]?.pressed||pad.buttons[n]?.value>.5;
      const menuHeld=new Set();
      for(const [action,numbers]of Object.entries(this.settings.gamepad[slot]))if(numbers.some(button))held.add(action);
      for(const [action,numbers]of Object.entries(DEFAULT_GAMEPAD_CONTROLS[slot]))if(numbers.some(button))menuHeld.add(action);
      if(pad.axes[0]<-.3)held.add('left');if(pad.axes[0]>.3)held.add('right');
      if(pad.axes[1]<-.3)held.add('jump');if(pad.axes[1]>.3)held.add('crouch');
      if(pad.axes[0]<-.3)menuHeld.add('left');if(pad.axes[0]>.3)menuHeld.add('right');
      if(pad.axes[1]<-.3)menuHeld.add('jump');if(pad.axes[1]>.3)menuHeld.add('crouch');
      const previous=this.frames[slot],heldButtons=new Set(pad.buttons.map((_,n)=>n).filter(button));
      return {connected:true,id:pad.id,identity:id,held,menuHeld,heldButtons,
        pressed:new Set([...held].filter(a=>previous.identity!==id||!previous.held.has(a))),
        menuPressed:new Set([...menuHeld].filter(a=>previous.identity!==id||!previous.menuHeld?.has(a))),
        pressedButtons:new Set([...heldButtons].filter(n=>previous.identity!==id||!previous.heldButtons?.has(n)))};
    });
    if(this.frames.some(frame=>frame.pressedButtons.size||frame.menuPressed.size))setInputDevice('gamepad');
    return this.frames;
  }
}
export const gamepads=new GamepadInput();
