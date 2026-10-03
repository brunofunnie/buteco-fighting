import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RoomAdmission,createClientIpResolver} from '../src/room-admission.js';
test('pending admissions expire but active rooms retain capacity until disposed',()=>{
 let time=0;const admission=new RoomAdmission(()=>time);
 admission.reserve('ip','player');time=30001;
 const ticket=admission.reserve('ip','player');admission.consume(ticket,'player','room');time=90000;
 assert.throws(()=>admission.reserve('ip','player'),e=>e.code===409);
 admission.releaseRoom('room');assert.ok(admission.reserve('ip','player'));
});
test('creation attempts expire after one minute and cancellation does not reset the budget',()=>{
 let time=0;const admission=new RoomAdmission(()=>time);
 for(let n=0;n<3;n++)admission.cancelPending(admission.reserve('ip','player'));
 assert.throws(()=>admission.reserve('ip','player'),e=>e.code===429&&e.retryAfter===60);
 time=60000;assert.ok(admission.reserve('ip','player'));
});
test('tickets cannot be forged, reused, transferred or released by an HTTP disconnect after binding',()=>{
 const admission=new RoomAdmission();const ticket=admission.reserve('ip','player');
 assert.throws(()=>admission.consume('fake','player','room'));
 assert.throws(()=>admission.consume(ticket,'other','room'));
 admission.consume(ticket,'player','room');admission.cancelPending(ticket);
 assert.throws(()=>admission.consume(ticket,'player','other'));
 assert.throws(()=>admission.reserve('other-ip','player'),e=>e.code===409);
});
test('only explicitly trusted peers may supply a validated client IP',()=>{
 const resolve=createClientIpResolver('127.0.0.1');
 const request=(peer,ip)=>({socket:{remoteAddress:peer},headers:{'cf-connecting-ip':ip,'x-forwarded-for':'198.51.100.9'}});
 assert.equal(resolve(request('::ffff:127.0.0.1','203.0.113.1')),'203.0.113.1');
 assert.equal(resolve(request('192.0.2.1','203.0.113.1')),'192.0.2.1');
 assert.equal(resolve(request('127.0.0.1','bad,ip')),'127.0.0.1');
 assert.equal(createClientIpResolver()(request('127.0.0.1','203.0.113.1')),'127.0.0.1');
});

test('global attempt ceiling bounds state even with rotating IPs',()=>{
 const admission=new RoomAdmission();
 for(let n=0;n<120;n++)admission.checkIp('ip-'+n);
 for(let n=120;n<1000;n++)assert.throws(()=>admission.checkIp('ip-'+n),e=>e.code===429);
 assert.ok(admission.attempts.size<=121);
});
