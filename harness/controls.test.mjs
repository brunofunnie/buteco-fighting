import assert from 'node:assert/strict';
import {ControlSettings, GamepadInput} from '../src/controls.js';
const values=new Map(), storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
const settings=new ControlSettings(storage);
assert.equal(settings.bind(0,'punch','KeyF').ok,true);
assert.deepEqual(new ControlSettings(storage).keyboard[0].punch,['KeyF']);
assert.equal(settings.bind(0,'kick','KeyF').ok,false);
assert.equal(settings.bind(0,'kick','Escape').ok,false);
settings.reset(); assert.deepEqual(settings.keyboard[0].punch,['KeyJ']);
assert.equal(new ControlSettings({getItem:()=>'{bad'}).keyboard[0].left,'KeyA');
const blocked=new ControlSettings({getItem:()=>null,setItem:()=>{throw Error('blocked');}});
assert.equal(blocked.bind(0,'punch','KeyF').saved,false);
let pads=[];const input=new GamepadInput(()=>pads);
const pad=index=>({index,id:`pad${index}`,connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))});
pads=[pad(2),pad(4)];input.poll();pads[0].buttons[0].pressed=true;
assert.ok(input.poll()[0].pressed.has('punch'));
assert.ok(!input.poll()[0].pressed.has('punch'));
pads[0].axes[0]=.15;assert.ok(!input.poll()[0].held.has('right'));
pads[0].axes[0]=.8;assert.ok(input.poll()[0].pressed.has('right'));
for(const [action,n] of Object.entries({punch:0,kick:1,special:2,super:3,guard:4,pause:9,jump:12,crouch:13,left:14,right:15})) {
  pads[0]=pad(2);input.poll();pads[0].buttons[n].pressed=true;
  assert.ok(input.poll()[0].pressed.has(action),`button ${n}: ${action}`);
}
pads=[pads[1]];const disconnected=input.poll();assert.equal(disconnected[0].connected,false);assert.equal(disconnected[1].connected,true);
console.log('PASS bindings, persistence, invalid storage, gamepad edges, deadzone and stable slots');
