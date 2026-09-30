"""Canonical component-row PNG publication; annotations use exported PNG pixels."""
import json,subprocess,sys,os
from pathlib import Path
from PIL import Image
from sprite_gen.frames.extract import _alpha_centroid_x
R=Path('assets/stages/v8/npcs');CLI='/tmp/fighting-sprite-venv/bin/sprite-gen'
ids=sys.argv[1:] or ['goth_woman','goth_man','pedestrian','seated_adult']
for id in ids:
 run=R/id
 for cmd,extra in [('extract',[]),('compose-atlas',[]),('compose-gif',['--out-dir',str(run/'previews')]),('export-pngs',['--out-dir',str(run/'curated')]),('inspect',[])]:
  subprocess.run([CLI,cmd,'--run-dir',str(run),*extra],check=True)
 print('EXPORTED',id,flush=True)
# No guessed head positions: publish only when all four semantic annotations reviewed.
a=R/'anatomy-annotations.json'
if not a.exists():sys.exit(0)
heads=json.loads(a.read_text());result={}
if any(id not in heads for id in ['goth_woman','goth_man','pedestrian','seated_adult']):sys.exit(0)
for id in ['goth_woman','goth_man','pedestrian','seated_adult']:
 frames=[]
 for n,head in enumerate(heads[id]):
  path=R/id/'curated'/f'frame-{n}.png'
  with Image.open(path) as im:
   im=im.convert('RGBA');box=im.getchannel('A').point(lambda p:255 if p>120 else 0).getbbox()
   if not box or box[0]<=0 or box[1]<=0 or box[2]>=im.width or box[3]>=im.height:raise RuntimeError(f'{id}/{n}: incomplete silhouette')
   sole=box[3];frames.append({'path':str(path),'scale':1/(sole-head),'anchorX':(box[0]+_alpha_centroid_x(im.crop(box),.2))/im.width,'anchorY':sole/im.height,'bodyHeadTopY':head,'soleY':sole})
   if id=='pedestrian':
    alpha=im.getchannel('A');xs=[x for y in range(sole-4,sole) for x in range(im.width) if alpha.getpixel((x,y))>120]
    frames[-1]['contactX']=(min(xs)+max(xs)+1)/2/im.width
 result[id]={'frames':frames,'fps':3,'loop':True,'posture':'seated' if id=='seated_adult' else 'standing'}
temp=R/'crowd-manifest.json.tmp';temp.write_text(json.dumps(result,indent=2)+'\n');os.replace(temp,R/'crowd-manifest.json')
print('PUBLISHED 4 distinct NPCs /16 actual poses')
