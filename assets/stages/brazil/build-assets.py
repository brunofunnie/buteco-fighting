"""GPT subscription generation; one invocation per asset, no implicit retry."""
import sys,json,subprocess
from pathlib import Path
R=Path('assets/stages/brazil');CLI='/tmp/fighting-sprite-venv/bin/sprite-gen'
def run(*args):subprocess.run([CLI,*map(str,args)],check=True)
if sys.argv[1]=='stages':
 for id in ['sao-paulo','rio','manaus']:
  if (R/f'{id}.png').exists():continue
  run('gen','--provider','codex','--prompt-file',R/'prompts'/f'{id}.txt','--out',R/f'{id}.png')
elif sys.argv[1]=='npcs':
 for id in ['goth_woman','goth_man','pedestrian','seated_adult']:
  base=R/'npcs'/f'{id}-base.png';out=R/'npcs'/id
  if not base.exists():run('gen','--provider','codex','--prompt-file',R/'prompts'/f'{id}.txt','--out',base,'--transparent')
  if not (out/'sprite-request.json').exists():run('prepare','--out-dir',out,'--character-id',id,'--base-image',base,'--request',R/'npcs'/f'{id}-request.json','--cell-size','384','--safe-margin','16','--fit-align-x','bbox-center')
  run('gen-set','--run-dir',out,'--provider','codex','--concurrency','1')
