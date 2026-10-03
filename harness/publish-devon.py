"""Publish reviewed Devon exports; measure images without modifying their pixels."""
import hashlib,json,shutil
from pathlib import Path
import numpy as np
from PIL import Image
from sprite_gen.frames.extract import remove_chroma_background,extract_component_images,_alpha_centroid_x
run=Path('assets/sprites/_generation/devon-v1/run');asset=Path('assets/sprites/devon')
request=json.loads((run/'sprite-request.json').read_text())
metrics={};seen=[]
for state,spec in request['states'].items():
 with Image.open(run/'raw'/f'{state}.png') as im:keyed=remove_chroma_background(im,tuple(request['chroma_key']['rgb']),96,180,18)
 components=extract_component_images(keyed,spec['frames']);assert len(components)==spec['frames']
 entries=[]
 for i,source in enumerate(components):
  file=run/'curated'/f'{state}-frame-{i}.png';assert file.exists()
  seen.append(hashlib.sha256(file.read_bytes()).hexdigest())
  with Image.open(file) as im:
   bbox=im.getbbox();solid=im.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox();assert solid and solid[0]>0 and solid[1]>0 and solid[2]<im.width and solid[3]<im.height,(state,i,solid)
   sb=source.getbbox()
   entries.append({'path':str(file),'sourceHeight':sb[3]-sb[1],'outputHeight':bbox[3]-bbox[1],'anchorX':(bbox[0]+_alpha_centroid_x(im.crop(bbox),.2))/im.width,'anchorY':bbox[3]/im.height})
 metrics[state]=entries
assert len(seen)==104 and len(set(seen))==104
idle=metrics['idle'][0];reference=idle['outputHeight']/idle['sourceHeight']
# Reviewed pose heights in world units: folded poses stay shorter; limb/head
# proportions are preserved by a single uniform scale for each entire row.
calibration={'idle':365,'punch':365,'kick':365,'hurt':365,'jump':280,
 'special':365,'walk':365,'block':365,'crouch':365,'ko':345,'celebrate':365,
 'airPunch':315,'airKick':322,'crouchPunch':285,'crouchKick':285,
 'uppercut':320,'sweep':280,'dash':335,'backwalk':365,'lowBlock':285,
 'turn':365,'land':280,'jumpForward':328,'super':365,'slide':365}
for state,entries in metrics.items():
 factor=calibration[state]/(365*entries[0]['sourceHeight']/idle['sourceHeight'])
 assert .55<factor<1.8,(state,factor)
 for entry in entries:
  entry['scale']=round(reference*entry['sourceHeight']/entry['outputHeight']*factor,5)
  entry['rowScaleCorrection']=round(factor,5)
  entry['calibration']='reviewed first-pose height; uniform row camera correction'
  entry['referencePoseHeight']=calibration[state]
# Uppercut varies its camera framing between poses. Match the head directly;
# the raised fist and folded knees must never determine character body scale.
heads=json.loads((asset/'head-calibration.json').read_text())
head_reference=metrics[heads['reference']['state']][heads['reference']['frame']]
head_width=heads['reference']['box'][2]*head_reference['scale']
for entry,annotation in zip(metrics['uppercut'],heads['uppercut'],strict=True):
 entry['scale']=round(head_width/annotation['box'][2],5)
 entry['rowScaleCorrection']=round(entry['scale']/(reference*entry['sourceHeight']/entry['outputHeight']),5)
 entry['calibration']='reviewed head width matched to idle; uniform whole-frame scale'
 entry['headBox']=annotation['box']
 entry['referenceHeadWidth']=head_width
 entry['referencePoseHeight']=round(365/idle['outputHeight']*entry['outputHeight']*entry['scale'],2)
asset.mkdir(parents=True,exist_ok=True);shutil.copytree(run/'curated',asset/'curated',dirs_exist_ok=True)
for name in ['base-source.png','sprite-request.json','qa-notes.md']:shutil.copy2(run/name,asset/name)
runtime={}
for state,entries in metrics.items():
 for entry in entries:entry['path']=str(asset/'curated'/Path(entry['path']).name)
 runtime[state]={'frames':[{k:e[k] for k in ['path','scale','anchorX','anchorY']}for e in entries],'fps':request['states'][state]['fps'],'loop':request['states'][state]['loop']}
for name,data in [('runtime-metrics.json',metrics),('runtime-manifest.json',runtime),('provenance.json',{'runtimeId':'devon','playable':False,'generationRun':str(run),'suppliedReference':'assets/sprites/devon/base-source.png','referenceSHA256':hashlib.sha256((run/'base-source.png').read_bytes()).hexdigest(),'poseCalibration':calibration})]:
 (asset/name).write_text(json.dumps(data,indent=2)+'\n')
p=Path('assets/manifest.json');manifest=json.loads(p.read_text());manifest['devon']=runtime;temp=p.with_suffix('.json.tmp');temp.write_text(json.dumps(manifest,indent=2)+'\n');temp.replace(p)
print('Published Devon: 25 states, 104 unique transparent frames; reviewed uniform row scales')
