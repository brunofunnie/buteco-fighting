import assert from 'node:assert/strict';
import {createKonamiDetector,registerSecretAction} from '../src/secret-menu.js';
const keys=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','B','A'];
const type=(detector,sequence,start=0,delay=100)=>sequence.map((key,i)=>detector.push({key},start+i*delay));
let detector=createKonamiDetector();
assert.deepEqual(type(detector,keys),[false,false,false,false,false,false,false,false,false,true]);
assert.equal(detector.push({key:'a'},1100),false,'Completion resets the recognizer');
detector=createKonamiDetector();
assert.equal(type(detector,['ArrowUp',...keys]).at(-1),true,'Overlapping starts still recognize a valid suffix');
detector=createKonamiDetector();
type(detector,keys.slice(0,5));assert.equal(type(detector,keys.slice(5),4000).at(-1),false,'A long gap resets partial input');
assert.equal(type(detector,keys,5000).at(-1),true);
detector=createKonamiDetector();
detector.push({key:'ArrowUp'},0);detector.push({key:'ArrowUp',repeat:true},50);
assert.equal(type(detector,keys.slice(2),100).at(-1),false,'Holding a key does not count as two presses');
for(const modifier of ['ctrlKey','metaKey','altKey','isComposing']){
  detector=createKonamiDetector();type(detector,keys.slice(0,9));
  assert.equal(detector.push({key:'A',[modifier]:true},1000),false);
  assert.equal(detector.push({key:'a'},1100),false);
}
assert.throws(()=>registerSecretAction({id:'invalid',label:'Invalid'}),TypeError);
const action={id:'unit-action',label:'Action',run(){}};
const remove=registerSecretAction(action);assert.throws(()=>registerSecretAction(action),/já registrada/);
remove();remove();registerSecretAction(action)();
console.log('PASS Konami sequence, overlap, timeout, autorepeat, modifiers, reset and action registration lifecycle');
