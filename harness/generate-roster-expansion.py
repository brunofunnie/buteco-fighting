"""Resume canonical sprite generation with at most eight rows in flight.

Sources and exports remain staged until publication; failures are recorded.
"""
import json
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path

ROOT=Path('assets/sprites/_generation/roster-v15')
CLI='/tmp/fighting-sprite-venv/bin/sprite-gen'
profiles=json.loads((ROOT/'roster.json').read_text())
ids=['maya-b',*[fid for fid in profiles if fid!='maya-b']]

def generate(fid):
    start=time.time()
    print('START',fid,flush=True)
    with (ROOT/'logs'/(fid+'.log')).open('a') as log:
        result=subprocess.run([CLI,'gen-set','--run-dir',profiles[fid]['generationRun'],'--provider','codex','--concurrency','4'],stdout=log,stderr=subprocess.STDOUT)
    status={'id':fid,'exit_code':result.returncode,'elapsed_seconds':round(time.time()-start,1)}
    (ROOT/'logs'/(fid+'.status.json')).write_text(json.dumps(status,indent=2)+'\n')
    print('FINISH',fid,status,flush=True)
    return status

with ThreadPoolExecutor(max_workers=2) as pool:
    results=[job.result() for job in as_completed([pool.submit(generate,fid) for fid in ids])]
(ROOT/'generation-status.json').write_text(json.dumps(results,indent=2)+'\n')
raise SystemExit(int(any(r['exit_code'] for r in results)))
