import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
pairs=[('Maya B','maya-b'),('King Luiz','king-luiz'),('Math Carpenter','math-carpenter'),('Pedro Pi','pedro-pi')]
def run(pair):
 name,id=pair;out=Path(f'assets/references/portraits/{id}.png')
 if out.exists():return
 prompt=f'Edit this exact supplied full-body character illustration of {name}: remove ONLY the solid black background and replace it with true transparent alpha. Keep the original character exactly unchanged: identical pose, face, hair, proportions, clothing, every accessory, original pixel outlines and colors. Do not redraw or restyle. Black hair, black clothing, shadows and outlines belonging to the character must stay opaque. Remove background in gaps between arms/legs/props. Keep entire head and shoe soles, same original composition and aspect ratio. One character only, no extra objects or scenery. Transparent PNG cutout.'
 subprocess.run(['/tmp/fighting-sprite-venv/bin/sprite-gen','gen','--provider','codex','--ref',f'novos-personagens-para-criar/{name}.png','--out',str(out),'--prompt',prompt,'--transparent','--alpha-mode','native'],stdout=(out.with_suffix('.log')).open('w'),stderr=subprocess.STDOUT,check=True)
 print('READY',id,flush=True)
with ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(run,pairs))
