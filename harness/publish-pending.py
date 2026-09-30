"""Validate complete generated characters before merging them into the roster.

Run with the sprite-gen virtualenv. Only reviewed 24-state sprite runs are accepted.
"""
import hashlib
import json
import math
import os
import sys
from pathlib import Path
from PIL import Image

root = Path('assets/sprites')
target = Path('assets/manifest.json')
manifest = json.loads(target.read_text())
catalog_path = Path('roster.js')
catalog = catalog_path.read_text()
marker = '\n};\nexport const fighterIds'
if catalog.count(marker) != 1:
    raise RuntimeError('Cannot locate the existing roster boundary')
profiles = []
for fid in sys.argv[1:]:
    run = root / fid
    provenance_path = run / 'provenance.json'
    generation = Path(json.loads(provenance_path.read_text())['generationRun']) if provenance_path.exists() else run
    def metadata_path(name):
        canonical = run / name
        return canonical if canonical.is_file() else generation / name
    profile_path = metadata_path('character-profile.json')
    profile = json.loads(profile_path.read_text())
    request = json.loads(metadata_path('sprite-request.json').read_text())
    runtime = json.loads(metadata_path('runtime-manifest.json').read_text())
    metrics = json.loads(metadata_path('runtime-metrics.json').read_text())
    qa_path = metadata_path('qa-report.json')
    if qa_path.exists():
        qa = json.loads(qa_path.read_text())
        qa_passed = qa.get('errors') == [] and qa.get('frames') == 100
    else:
        qa = json.loads(metadata_path('publication-check.json').read_text())
        qa_passed = qa.get('frames') == 100 and all(qa.get(key) is True for key in ('solidAlphaEdgesClear', 'anatomyCalibrated', 'animatedVariationAllStates'))
    if profile['id'] != fid or fid in manifest:
        raise RuntimeError(f'{fid}: incorrect or already published ID')
    if not qa_passed or set(runtime) != set(request['states']) or len(runtime) != 24:
        raise RuntimeError(f'{fid}: QA failed or incomplete animation set')
    count = 0
    for state, spec in request['states'].items():
        entries = runtime[state]['frames']
        if len(entries) != spec['frames'] or runtime[state]['fps'] != spec['fps']:
            raise RuntimeError(f'{fid}/{state}: wrong frame count or timing')
        if any('anatomyCalibration' not in frame for frame in metrics[state]):
            raise RuntimeError(f'{fid}/{state}: anatomy not reviewed/calibrated')
        hashes = []
        for entry in entries:
            path = Path(entry['path'])
            if path.parent != run / 'curated':
                raise RuntimeError(f'{fid}: sprite outside owned run')
            if not all(math.isfinite(entry[key]) for key in ('scale', 'anchorX', 'anchorY')) or entry['scale'] <= 0:
                raise RuntimeError(f'{path}: invalid geometry')
            with Image.open(path) as image:
                if image.mode != 'RGBA' or image.getchannel('A').getextrema() != (0, 255):
                    raise RuntimeError(f'{path}: empty or nontransparent sprite')
                bounds = image.getchannel('A').point(lambda alpha: 255 if alpha > 128 else 0).getbbox()
                if not bounds or bounds[0] <= 0 or bounds[1] <= 0 or bounds[2] >= image.width or bounds[3] >= image.height:
                    raise RuntimeError(f'{path}: solid alpha touches canvas edge')
            hashes.append(hashlib.sha256(path.read_bytes()).hexdigest())
            count += 1
        if len(set(hashes)) != len(hashes):
            raise RuntimeError(f'{fid}/{state}: duplicate animation frames')
    if count != 100:
        raise RuntimeError(f'{fid}: expected 100 motion frames, got {count}')
    source = run / 'base-source.png'
    if not source.is_file():
        raise RuntimeError(f'{fid}: missing canonical base-source.png')
    profile['source'] = source.as_posix()
    if 'reference' in profile:
        profile['reference'] = source.as_posix()
    profiles.append((profile, profile_path))
    manifest[fid] = runtime

if not profiles:
    raise RuntimeError('Specify completed fighter IDs to publish')
addition = ''.join('  ' + json.dumps(profile['id']) + ': ' + json.dumps(profile, ensure_ascii=False) + ',\n' for profile, _ in profiles)
catalog = catalog.replace(marker, '\n' + addition + '};\nexport const fighterIds')
for profile, profile_path in profiles:
    profile_path.write_text(json.dumps(profile, ensure_ascii=False, indent=2) + '\n')
catalog_temp = catalog_path.with_suffix('.js.tmp')
catalog_temp.write_text(catalog)
manifest_temp = target.with_suffix('.json.tmp')
manifest_temp.write_text(json.dumps(manifest, indent=2) + '\n')
os.replace(manifest_temp, target)
os.replace(catalog_temp, catalog_path)
print(f'Published {len(profiles)} fighters, {len(profiles) * 100} reviewed frames.')
