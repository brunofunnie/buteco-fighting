"""Read generated PNGs, semantic head/sole measurements; never edit images."""
import json
from pathlib import Path
from PIL import Image
from sprite_gen.frames.extract import _alpha_centroid_x

root = Path('assets/stages/public-v6')
identities = {'woman_clap':'lia', 'woman_shout':'nina', 'woman_toast':'rosa', 'man_cheer':'davi', 'man_drink':'seu-joao'}
# Exported PNG pixel annotations reviewed against every contact sheet.
# These are the crown/hair (hat for older man), independently of lifted arms/mugs.
heads = {'woman_clap':[16,16,16,16], 'woman_shout':[16,16,16,16], 'woman_toast':[16,17,35,16], 'man_cheer':[16,25,30,16], 'man_drink':[16,16,16,16], 'man_toast':[16,17,60,17]}
result = {}
for identity in [*identities, 'man_toast']:
    frames = []
    for n, head in enumerate(heads[identity]):
        path = root/identities[identity]/'curated'/f'frame-{n}.png' if identity in identities else Path('assets/stages/patrons/curated')/f'cheer-frame-{n}.png'
        with Image.open(path) as image:
            image = image.convert('RGBA')
            alpha = image.getchannel('A').point(lambda p:255 if p>120 else 0)
            box = alpha.getbbox()
            if not box:
                raise RuntimeError(f'{identity}: empty frame')
            sole = box[3]
            frames.append({'path':path.as_posix(), 'scale':1/(sole-head), 'anchorX':(box[0]+_alpha_centroid_x(image.crop(box), .2))/image.width, 'anchorY':sole/image.height, 'bodyHeadTopY':head, 'soleY':sole})
    result[identity] = {'frames':frames, 'fps':3, 'loop':True}
(root/'crowd-manifest.json').write_text(json.dumps(result, indent=2)+'\n')
print('Published six distinct identities / 24 frames; head-to-sole normalization.')
