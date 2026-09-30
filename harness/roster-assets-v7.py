"""Validate all published new motion assets and their physical foot anchors."""
import hashlib,json,math,subprocess
from pathlib import Path
from PIL import Image
manifest=json.loads(Path('assets/manifest.json').read_text())
catalog=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {fighterIds} from './roster.js'; console.log(JSON.stringify(fighterIds))"],text=True))
roster=[fid for fid in catalog if fid not in ('maya','bruno')]
checks=[]
def check(name,value,details=None):checks.append({'name':name,'pass':bool(value),'details':details})
check('every catalog fighter published',set(manifest)==set(catalog))
total=0
for fid in roster:
 states=manifest.get(fid,{})
 first_frame=next(iter(states.values()))['frames'][0]['path']
 run_root=Path(first_frame).parent.parent
 request=json.loads((run_root/'sprite-request.json').read_text())
 check(f'{fid}: all 24 requested actions',set(states)==set(request['states']) and len(states)==24)
 count=0
 for state,spec in states.items():
  check(f'{fid}/{state}: expected frames and timing',len(spec['frames'])==request['states'][state]['frames'] and spec['fps']==request['states'][state]['fps'])
  hashes=[]
  for i,frame in enumerate(spec['frames']):
   path=Path(frame['path']);hashes.append(hashlib.sha256(path.read_bytes()).hexdigest());count+=1
   with Image.open(path) as image:
    check(f'{fid}/{state}/{i}: transparent actual sprite',image.mode=='RGBA' and image.getchannel('A').getextrema()==(0,255))
    bounds=image.getbbox()
    solid=image.getchannel('A').point(lambda alpha:255 if alpha>128 else 0).getbbox()
    check(f'{fid}/{state}/{i}: limbs clear all canvas edges',solid is not None and solid[0]>0 and solid[1]>0 and solid[2]<image.width and solid[3]<image.height,solid)
    check(f'{fid}/{state}/{i}: finite geometry',all(math.isfinite(frame[n]) for n in ['scale','anchorX','anchorY']) and frame['scale']>0 and 0<frame['anchorX']<1 and 0<frame['anchorY']<=1)
    check(f'{fid}/{state}/{i}: anchor meets opaque sole',bounds is not None and abs(frame['anchorY']*image.height-bounds[3])<1.1)
  check(f'{fid}/{state}: genuinely different frames',len(set(hashes))==len(hashes))
 check(f'{fid}: 100 motion frames',count==100,count);total+=count
check('100 motion frames per added fighter',total==len(roster)*100,total)
Path('artifacts/roster-assets-v7-report.json').write_text(json.dumps({'checks':checks},indent=2)+'\n')
failed=[c for c in checks if not c['pass']]
print(json.dumps({'passed':len(checks)-len(failed),'failed':len(failed),'failures':failed},indent=2));raise SystemExit(bool(failed))
