import sys
from pathlib import Path
from PIL import Image,ImageDraw
r=Path('assets/stages/v8/npcs')/sys.argv[1]
im=Image.new('RGB',(1680,420),'#30353c');d=ImageDraw.Draw(im)
for i in range(4):
 src=Image.open(r/'curated'/f'frame-{i}.png').convert('RGBA');im.paste(src,(i*420+30,20),src)
 for y in range(0,384,20):
  d.text((i*420,y+20),str(y),fill='white');d.line((i*420+25,y+20,i*420+413,y+20),fill='#555')
im.save(r/'measurement-contact.png')
