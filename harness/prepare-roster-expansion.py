"""Prepare the existing sprite-gen row pipeline from the supplied references.

Nothing is published until actual animation frames have passed review.
Run with /tmp/fighting-sprite-venv/bin/python.
"""
import json
import shutil
import subprocess
from pathlib import Path

CLI='/tmp/fighting-sprite-venv/bin/sprite-gen'
ROOT=Path('assets/sprites/_generation/roster-v15')
ROOT.mkdir(parents=True,exist_ok=True)
(ROOT/'logs').mkdir(exist_ok=True)
# Name, identity, visual accent, existing gameplay power kind.
PROFILES=[
 ('Astha','astha','Young brown-skinned man, short tight dark curls, black athletic shirt with three white shoulder stripes, black tactical cargo trousers with radio and cables, black-white sneakers.','#9bbbbb','pulse'),
 ('Biskit','biskit','Slim light-skinned man with short dark hair, navy T-shirt, white athletic shorts, small hip pouch and black-white sneakers.','#87b2df','sonic'),
 ('Cody','cody','Man with large voluminous curly brown hair, lavender-blue rolled-sleeve button shirt, black trousers, hip lanyard badge and black-white sneakers.','#a7a6ea','prism'),
 ('D.Nelson','d-nelson','Broad smiling tan man, swept-back black hair and dark beard, rainbow neck ribbons, black tech graphic T-shirt, olive cargo shorts with hanging badges, red-black sneakers.','#d8ad62','solidarity'),
 ('Daddy Ianky','daddy-ianky','Stocky tan man, short brown hair, dark beard, rectangular glasses, olive T-shirt, patterned dark cargo shorts with tool pouch, charcoal sneakers.','#bdac76','boomerang'),
 ('Felurian','felurian','Tall tan man, short dark hair, sunglasses, deep purple open-collar shirt and matching trousers, hip keys, purple-white sneakers.','#b785e1','lunar'),
 ('Gabiest','gabiest','Stocky woman with long curly copper hair, black alien graphic T-shirt with shoulder pins, blue denim shorts, hip charms and black high-top sneakers.','#75b2d8','gravity'),
 ('Ghostly','ghostly','Young woman, long curly auburn hair, red long sleeveless dress with slit, light cream open jacket, necklaces, small black hip purse, white-red sneakers.','#d77e91','illusion'),
 ('Ingio','ingio','Tan man with short black hair, glasses and over-ear headphones, black sleeveless top, patterned red-gold open scarf vest, ID badge, black trousers, white-black high-top sneakers.','#e7b961','bass'),
 ('Leo','leo','Athletic tan man with short black curly hair, plain dark olive shirt, rainbow handheld folding fan (never a shirt graphic), gray-beige trousers, black-white sneakers.','#9dc885','solar'),
 ('Litte Faster','litte-faster','Light-skinned man with swept dark brown hair, rectangular glasses, black Chicago Bulls tracksuit with red piping, fingerless black gloves and red-black high-top sneakers.','#e48482','kinetic'),
 ('Maya B','maya-b','Woman with long voluminous curly auburn hair, dark sunglasses, white fitted short-sleeve blouse, brown wide-leg trousers, gold jewelry, white sneakers.','#e5b39c','illusion'),
 ('Mountain','mountain','Large bald stocky tan man with short beard, black rolled-sleeve shirt, dark green tie, black trousers, belt keys and charms, black boots.','#aeb88d','gravity'),
 ('Mr. G','mr-g','Bald bearded tan man with rectangular black glasses, white rolled-sleeve shirt and small crest, black trousers, large belt book and sun charm, black-white sneakers.','#dfc382','runes'),
 ('Musashi','musashi','Young brown-skinned man with short dense curly black hair, green leaf graphic shirt, black cargo trousers with red cloud patches, green-black backpack carrying rolled scroll and small anime charms, red-white sneakers. Preserve accessories.','#81be86','kinetic'),
 ('P.D.R','p-d-r','Stocky light-skinned martial artist with short dark hair, charcoal Brazilian jiu-jitsu gi, dark belt and gi patch, black training shoes.','#a8b4c9','kinetic'),
 ('Prefeito','prefeito','Smiling tan man, black wavy hair and short beard, black suit, white shirt, blue tie, belt keys and black dress shoes.','#8caee7','cubes'),
 ('r1sen','r1sen','Mature tan man with short gray hair and dark beard, black rectangular glasses, black rolled-sleeve shirt, dark trousers, red-gold hip scarf, bracelets, black boots.','#dca369','codefire'),
 ('Sleep','sleep','Stocky tan man with backwards black cap and short dark beard, red short-sleeve polo, black joggers, dark wristbands, red-white high-top sneakers.','#df8980','bass'),
 ('Sonee','sonee','Young tan man with curly brown hair, sunglasses, light gray rolled-sleeve open-collar shirt, necklaces, black trousers, black sneakers.','#b9c3d9','sonic'),
 ('Tony Etch','tony-etch','Athletic tan man, short dark hair and stubble, white rolled-sleeve shirt with small chest emblem, navy trousers, small hip keys, white sneakers.','#92c2d8','pulse'),
 ('Wes','wes','Muscular tan man with short brown hair and brown beard, fitted black T-shirt, black cargo trousers, belt chain, black sneakers.','#ccab83','kinetic'),
 ('Zero 6','zero-6','Slim light-skinned young man with tousled dark brown hair, navy T-shirt, short black athletic shorts and black sneakers.','#85b8cf','pulse'),
]
profiles={}
for name,fid,identity,color,kind in PROFILES:
    run=Path('assets/sprites')/fid/'generation'/'roster-v15'
    run.mkdir(parents=True,exist_ok=True)
    source=run/'base-source.png'
    shutil.copy2(Path('novos_player_para_implementar')/(name+'.png'),source)
    request=json.loads(Path('assets/sprites/naldo/sprite-request.json').read_text())
    request.pop('chroma_key',None)
    request['character']={'id':fid,'description':identity}
    request['style']='Copy the supplied full-body reference exactly: face, costume, accessories, adult head size and limb proportions. '+identity+' Fixed orthographic camera and identical body scale in every pose. Only joints articulate; crouching folds the body without shrinking it. Entire head and shoe soles visible. No extra limbs, shadows, text or engine energy effects. Face RIGHT except the deliberate turn animation.'
    # Generic grounded attacks; gameplay supplies each fighter's power effect.
    request['states']['special']['action']='FOUR distinct full-body poses facing RIGHT: fighting guard; draw rear fist back charging; forceful open-palm strike fully extended RIGHT; recover guard. Same body scale in all frames. Engine supplies energy effect, draw only body.'
    request['states']['super']['action']='FOUR distinct full-body poses facing RIGHT: deep planted guard charging with both hands; rise rotating shoulders; thrust both arms RIGHT for a powerful discharge; recover balanced guard. Clearly different from the special move. Engine supplies energy effect, draw only body.'
    for state in ('airKick',):
        request['states'][state]['action']=request['states'][state]['action'].split('Preserve backward cap')[0]
    recipe=ROOT/(fid+'-request.json')
    recipe.write_text(json.dumps(request,indent=2)+'\n')
    if not (run/'sprite-request.json').exists():
        subprocess.run([CLI,'prepare','--out-dir',str(run),'--character-id',fid,'--base-image',str(Path('novos_player_para_implementar')/(name+'.png')),'--request',str(recipe),'--chroma-key','auto','--force'],check=True,capture_output=True)
    profiles[fid]={'id':fid,'name':name,'identity':identity,'color':color,'powerKind':kind,'generationRun':str(run),'reference':str(source)}
    print('PREPARED',fid,flush=True)
(ROOT/'roster.json').write_text(json.dumps(profiles,indent=2)+'\n')
