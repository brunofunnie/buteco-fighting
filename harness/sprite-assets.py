"""Validate production PNG hashes, animation order and calibrated pose geometry."""
import hashlib,json
from pathlib import Path
from PIL import Image
manifest=json.loads(Path('assets/manifest.json').read_text())
motions=json.loads(Path('harness/fixtures/animation-layout.json').read_text())['movements']
poses={f['key']:f['sourceBBox'] for m in motions for f in m['frames']}
for path,expected in json.loads(Path('harness/fixtures/asset-hashes.json').read_text()).items():
 assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==expected,('Asset bytes changed',path)
for fid,states in manifest.items():
 assert 'dash' not in states
 for m in motions:assert [f['sourceKey'] for f in states[m['name']]['frames']]==[f['key'] for f in m['frames']],(fid,m['name'])
 ref=Image.open(states['idle']['frames'][0]['path']).convert('RGBA');rb=ref.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();rh=rb[3]-rb[1]
 for m in motions:
  for frame in states[m['name']]['frames']:
   with Image.open(frame['path']).convert('RGBA') as image:
    assert image.size==(384,384) and frame['pixelArt'] is False
    box=image.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();pose=poses[frame['sourceKey']];scale=frame['scale']/(.9 if m['name']=='airKick' else 1)
    assert abs((box[3]-box[1])*scale/rh-(pose[3]-pose[1])/94)<1e-8,('Pose height changed',fid,m['name'])
    assert abs((box[3]-frame['anchorY']*384)*scale/rh-(pose[3]-184)/94)<1e-8,('Floor offset changed',fid,m['name'])
    assert abs(((box[0]+box[2])/2-frame['anchorX']*384)*scale/rh-((pose[0]+pose[2])/2-96)/94)<1e-8,('Pivot drift',fid,m['name'])
print('PASS',len(manifest),'fighters: unchanged asset hashes, animation order, 10% smaller air kicks, pose-relative scale, pivots and floor offsets')
