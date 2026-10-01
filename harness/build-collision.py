"""Compile per-frame combat boxes in rendered world units; never edits sprites.
Requires Python Pillow/numpy. Run again after publishing or calibrating sprites.
Alpha strips describe the body core; offensive boxes follow the leading limb.
Review the generated contact sheets with --atlas; optional authored overrides
live in assets/collision-overrides.json and replace local hurt/hit rectangles.
"""
import argparse,json,subprocess,hashlib
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parent.parent
manifest=json.loads((ROOT/'assets/manifest.json').read_text())
fighters=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {FIGHTERS,NON_PLAYABLE_FIGHTERS} from './roster.js';process.stdout.write(JSON.stringify({...FIGHTERS,...NON_PLAYABLE_FIGHTERS}))"],cwd=ROOT))
override_path=ROOT/'assets/collision-overrides.json'
overrides=json.loads(override_path.read_text()) if override_path.exists() else {}
attacks={'punch','kick','airPunch','airKick','crouchPunch','crouchKick','uppercut','sweep'}
fingerprint=hashlib.sha256((ROOT/'assets/manifest.json').read_bytes()+(ROOT/'roster.js').read_bytes()+Path(__file__).read_bytes()+(override_path.read_bytes() if override_path.exists() else b''))
data={}
atlas=[]
for fid,states in manifest.items():
    idle=states['idle']['frames'][0];reference=Image.open(ROOT/idle['path']).convert('RGBA')
    alpha=np.asarray(reference)[:,:,3];ys=np.where(alpha>32)[0]
    reference_height=int(ys.max()-ys.min()+1)
    height=fighters[fid].get('visualHeight',320)
    data[fid]={}
    for state,spec in states.items():
        frames=[]
        for index,entry in enumerate(spec['frames']):
            fingerprint.update((ROOT/entry['path']).read_bytes())
            im=Image.open(ROOT/entry['path']).convert('RGBA');mask=np.asarray(im)[:,:,3]>160
            y,x=np.where(mask)
            if len(x)==0:raise ValueError(entry['path'])
            scale=height/reference_height*entry.get('scale',1)
            ax=entry.get('anchorX',.5)*im.width;ay=entry.get('anchorY',(ys.max()+1)/reference.height)*im.height
            px=(x-ax)*scale;py=(y-ay)*scale
            # Body core excludes extended hands, weapons and trailing accessories.
            # Follow leaning torsos instead of centering every pose on its anchor.
            ymin,ymax=float(py.min()),float(py.max())
            torso=px[(py>ymin+(ymax-ymin)*.25)&(py<ymin+(ymax-ymin)*.6)]
            center=float(np.median(torso)) if len(torso) else 0
            center=float(np.clip(center,-height*.15,height*.15))
            core=((px>=center-height*.20)&(px<=center+height*.20)) | (py>ymin+(ymax-ymin)*.6)
            hurt=[]
            for low in np.arange(ymin+4,ymax,24):
                band=core&(py>=low)&(py<min(low+24,ymax+1))
                bx=px[band];by=py[band]
                if len(bx)<4:continue
                # Split separated legs instead of filling the transparent gap.
                columns,counts=np.unique(np.floor(bx/3).astype(int),return_counts=True)
                columns=columns[counts>=max(2,3/scale)]
                if not len(columns):continue
                runs=np.split(columns,np.where(np.diff(columns)>1)[0]+1)
                for run in runs:
                    if len(run)<2:continue
                    left,right=float(run[0]*3),float((run[-1]+1)*3)
                    hurt.append([left,float(by.min()),right-left,float(by.max()-by.min()+scale)])
            hit=[]
            if state in attacks:
                if state=='uppercut':
                    candidates=(px>0)&(py<ymin+(ymax-ymin)*.45)
                    if not candidates.any():candidates=px>0
                    tip_y=float(np.quantile(py[candidates],.02))
                    near=candidates&(py<tip_y+30)
                    tip_x=float(np.median(px[near]))
                    hit=[[tip_x-24,tip_y-3,48,110]]
                else:
                    # Kicks use the leading foot, punches the leading fist.
                    low=ymin+(ymax-ymin)*(.15 if 'Kick' in state or state in {'kick','sweep'} else .08)
                    high=ymin+(ymax-ymin)*(.98 if 'Kick' in state or state in {'kick','sweep'} else .68)
                    candidates=(py>=low)&(py<=high)&(px>0)
                    if not candidates.any():candidates=px>0
                    if not candidates.any():candidates=np.ones_like(px,dtype=bool)
                    tip_x=float(np.quantile(px[candidates],.985))
                    near=candidates&(px>=tip_x-12)
                    tip_y=float(np.median(py[near]))
                    width=height*.36 if 'Kick' in state or state in {'kick','sweep'} else height*.20
                    hit=[[tip_x-width,tip_y-18,width+4,36]]
            frame={'hurt':[[round(v,1) for v in b] for b in hurt],'hit':[[round(v,1) for v in b] for b in hit]}
            frame.update(overrides.get(fid,{}).get(state,{}).get(str(index),{}))
            if not frame['hurt']:raise ValueError('No body boxes: '+entry['path'])
            frames.append(frame)
            if state in attacks and index==len(spec['frames'])//2:
                atlas.append((fid,state,im.copy(),scale,ax,ay,frame))
        data[fid][state]={'fps':spec.get('fps',6),'frames':frames}
source_hash=fingerprint.hexdigest()
encoded='// Generated by harness/build-collision.py. Coordinates: [x,y,width,height] relative to the rendered fighter anchor.\nexport const COLLISION_DATA='+json.dumps(data,separators=(',',':'))+';\nexport const COLLISION_SOURCE_HASH='+json.dumps(source_hash)+';\n'
(ROOT/'collision-data.js').write_text(encoded)
print(f'Compiled {sum(len(s["frames"]) for f in data.values() for s in f.values())} frames, {len(encoded)} bytes')
if argparse.ArgumentParser().parse_known_args()[1]==['--atlas']:
    out=ROOT/'artifacts/collisions';out.mkdir(parents=True,exist_ok=True)
    for batch in range(0,len(data),7):
        ids=list(data)[batch:batch+7];sheet=Image.new('RGB',(8*210,len(ids)*260),(15,20,32));draw=ImageDraw.Draw(sheet)
        for fid,state,im,scale,ax,ay,frame in atlas:
            if fid not in ids:continue
            row=ids.index(fid);col=list(sorted(attacks)).index(state);factor=min(190/im.width,220/im.height);scaled=im.resize((round(im.width*factor),round(im.height*factor)))
            ox=col*210+10;oy=row*260+25;sheet.paste(scaled,(ox,oy),scaled);draw.text((ox,row*260+4),fid+' '+state,fill='white')
            for kind,color in [('hurt','#48e59c'),('hit','#ff5b6a')]:
                for bx,by,bw,bh in frame[kind]:
                    rect=[ox+(bx/scale+ax)*factor,oy+(by/scale+ay)*factor,ox+((bx+bw)/scale+ax)*factor,oy+((by+bh)/scale+ay)*factor]
                    draw.rectangle(rect,outline=color,width=2)
        sheet.save(out/f'poses-{batch//7}.png')
