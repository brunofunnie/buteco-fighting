"""Publish the complete, reviewed dummy exports without adding a playable fighter."""
import json
import shutil
from pathlib import Path

run = Path('assets/sprites/_generation/dummy-v1/run')
asset = Path('assets/sprites/dummy')
request = json.loads((run / 'sprite-request.json').read_text())
metrics = json.loads((run / 'runtime-metrics.json').read_text())
assert len(metrics) == 24
assert sum(len(entries) for entries in metrics.values()) == 100
asset.mkdir(parents=True, exist_ok=True)
shutil.copytree(run / 'curated', asset / 'curated', dirs_exist_ok=True)
for name in ['base-source.png', 'sprite-request.json']:
    shutil.copy2(run / name, asset / name)
runtime = {}
for state, entries in metrics.items():
    for entry in entries:
        entry['path'] = str(asset / 'curated' / Path(entry['path']).name)
    runtime[state] = {
        'frames': [{key: entry[key] for key in ['path', 'scale', 'anchorX', 'anchorY']} for entry in entries],
        'fps': request['states'][state]['fps'],
        'loop': request['states'][state]['loop'],
    }
for name, contents in [('runtime-metrics.json',metrics),('runtime-manifest.json',runtime),
                       ('provenance.json',{'runtimeId':'dummy','playable':False,'generationRun':str(run),
                                           'suppliedReference':'novos_player_para_implementar/dummy.png'})]:
    (asset / name).write_text(json.dumps(contents,indent=2)+'\n')
manifest_path = Path('assets/manifest.json')
manifest = json.loads(manifest_path.read_text())
manifest['dummy'] = runtime
temporary = manifest_path.with_suffix('.json.tmp')
temporary.write_text(json.dumps(manifest,indent=2)+'\n')
temporary.replace(manifest_path)
print('Published non-playable dummy: 24 states, 100 frames')
