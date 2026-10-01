"""Extract/export generated rows through sprite-gen and stage runtime geometry.

No image edits, synthetic poses, shared-manifest writes, or QA success claims.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from PIL import Image,ImageDraw
from sprite_gen.frames.extract import remove_chroma_background,extract_component_images,_alpha_centroid_x

ROOT=Path('assets/sprites/_generation/roster-v15')
CLI='/tmp/fighting-sprite-venv/bin/sprite-gen'
profiles=json.loads((ROOT/'roster.json').read_text())
parser=argparse.ArgumentParser()
parser.add_argument('ids',nargs='+')
args=parser.parse_args()
for fid in args.ids:
    run=Path(profiles[fid]['generationRun'])
    request=json.loads((run/'sprite-request.json').read_text())
    missing=[state for state in request['states'] if not (run/'raw'/(state+'.png')).is_file()]
    if missing: raise RuntimeError(f'{fid}: missing generated states: {missing}')
    for command,extra in [('extract',[]),('compose-atlas',[]),('compose-gif',['--out-dir',str(run/'previews')]),('export-pngs',['--out-dir',str(run/'curated')]),('inspect',[])]:
        result=subprocess.run([CLI,command,'--run-dir',str(run),*extra],capture_output=True,text=True)
        (run/(command+'.log')).write_text(result.stdout+result.stderr)
        if result.returncode: raise RuntimeError(f'{fid}/{command}: failed, see {run}/{command}.log')
    result=subprocess.run(['/tmp/fighting-sprite-venv/bin/python','/home/bruno/.codex/skills/sprite-gen/scripts/preview_animation.py','--run-dir',str(run)],capture_output=True,text=True)
    (run/'motion-previews.log').write_text(result.stdout+result.stderr)
    if result.returncode: raise RuntimeError(f'{fid}: motion preview failed')
    metrics={}
    for state,spec in request['states'].items():
        with Image.open(run/'raw'/(state+'.png')) as image:
            keyed=remove_chroma_background(image,tuple(request['chroma_key']['rgb']),96,180,18)
        components=extract_component_images(keyed,spec['frames'])
        if len(components)!=spec['frames']: raise RuntimeError(f'{fid}/{state}: wrong component count')
        entries=[]
        hashes=[]
        for n,component in enumerate(components):
            path=run/'curated'/f'{state}-frame-{n}.png'
            with Image.open(path) as image:
                box=image.getbbox()
                solid=image.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox()
                if image.mode!='RGBA' or not box or not solid: raise RuntimeError(f'{path}: empty or nontransparent')
                if solid[0]<=0 or solid[1]<=0 or solid[2]>=image.width or solid[3]>=image.height: raise RuntimeError(f'{path}: solid pixels touch edge')
                source_box=component.getbbox()
                entries.append({'path':str(path),'sourceHeight':source_box[3]-source_box[1],'outputHeight':box[3]-box[1],'anchorX':(box[0]+_alpha_centroid_x(image.crop(box),.2))/image.width,'anchorY':box[3]/image.height})
            hashes.append(hashlib.sha256(path.read_bytes()).hexdigest())
        if len(set(hashes))!=len(hashes): raise RuntimeError(f'{fid}/{state}: repeated static frames')
        metrics[state]=entries
    idle=metrics['idle'][0]
    reference=idle['outputHeight']/idle['sourceHeight']
    for entries in metrics.values():
        for entry in entries: entry['scale']=round(reference*entry['sourceHeight']/entry['outputHeight'],6)
    (run/'runtime-metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
    # Eight actions per review panel, all actual frames shown in order.
    for page in range(3):
        states=list(metrics)[page*8:page*8+8]
        panel=Image.new('RGB',(6*192,8*210),'#252b36')
        draw=ImageDraw.Draw(panel)
        for row,state in enumerate(states):
            for column,entry in enumerate(metrics[state]):
                image=Image.open(entry['path']).convert('RGBA')
                image.thumbnail((184,184))
                panel.paste(image,(column*192+4,row*210+22),image)
                draw.text((column*192+4,row*210+3),f'{state} {column}',fill='white')
        panel.save(run/f'review-all-frames-{page}.png')
    (run/'processing-status.json').write_text(json.dumps({'states':len(metrics),'frames':sum(map(len,metrics.values())),'review':'pending'},indent=2)+'\n')
    print('STAGED',fid,'100 frames; visual review pending',flush=True)
