import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Rankings} from '../ranking.js';
const db=new Rankings(':memory:');const a=db.register('Host'),b=db.register('Guest');
assert.equal(db.identify(a.token).id,a.id);assert.equal(db.identify('invalid'),null);
assert.throws(()=>db.register(' '.repeat(4)));
assert.equal(db.record('match1',a.id,b.id,true),true);assert.equal(db.record('match1',a.id,b.id,true),false);
assert.deepEqual({...db.list()[0]},{id:a.id,name:'Host',wins:1,perfects:1,losses:0});
db.record('match2',b.id,a.id,false,'disconnect');assert.equal(db.list().find(p=>p.id===b.id).perfects,0);
db.close();console.log('PASS identity validation, match deduplication, wins, perfects and forfeits');

const dir=mkdtempSync(path.join(tmpdir(),'ranking-persist-')),file=path.join(dir,'ranking.sqlite');const first=new Rankings(file);const one=first.register('Persist'),two=first.register('Opponent');first.record('persist',one.id,two.id,true);first.close();const reopened=new Rankings(file);assert.equal(reopened.list()[0].wins,1);assert.equal(reopened.identify(one.token).id,one.id);reopened.close();rmSync(dir,{recursive:true});console.log('PASS database persistence after restart');
