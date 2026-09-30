import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
const hash=token=>createHash('sha256').update(token).digest('hex');
export class Rankings {
  constructor(file) {
    if(file!==':memory:')mkdirSync(path.dirname(file),{recursive:true});
    this.db=new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY,token TEXT UNIQUE NOT NULL,name TEXT NOT NULL,wins INTEGER NOT NULL DEFAULT 0,perfects INTEGER NOT NULL DEFAULT 0,losses INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS results(match_id TEXT PRIMARY KEY,winner TEXT,loser TEXT,perfect INTEGER,reason TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
  }
  register(name) {
    if(typeof name!=='string'||!name.trim()||name.trim().length>24||/[\x00-\x1f]/.test(name))throw Error('Use um apelido de 1 a 24 caracteres.');
    const id=randomUUID(),token=randomBytes(32).toString('hex');
    this.db.prepare('INSERT INTO players(id,token,name) VALUES(?,?,?)').run(id,hash(token),name.trim());
    return {id,token,name:name.trim()};
  }
  identify(token) {
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
    return this.db.prepare('SELECT id,name FROM players WHERE token=?').get(hash(token))||null;
  }
  record(matchId,winner,loser,perfect=false,reason='ko') {
    if(winner===loser)throw Error('Players must differ');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result=this.db.prepare('INSERT OR IGNORE INTO results(match_id,winner,loser,perfect,reason) VALUES(?,?,?,?,?)').run(matchId,winner,loser,Number(perfect),reason);
      if(result.changes){this.db.prepare('UPDATE players SET wins=wins+1,perfects=perfects+? WHERE id=?').run(Number(perfect),winner);this.db.prepare('UPDATE players SET losses=losses+1 WHERE id=?').run(loser);}
      this.db.exec('COMMIT');return !!result.changes;
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  list(){return this.db.prepare('SELECT id,name,wins,perfects,losses FROM players WHERE wins+losses>0 ORDER BY wins DESC,perfects DESC,losses ASC,name COLLATE NOCASE,id LIMIT 100').all();}
  close(){this.db.close();}
}
