"""Stage the next supplied batch with the established 24-action sprite pipeline."""
import argparse,json,shutil,subprocess
from pathlib import Path

CLI='/tmp/fighting-sprite-venv/bin/sprite-gen'
ROOT=Path('assets/sprites/_generation/roster-v16')
parser=argparse.ArgumentParser()
parser.add_argument('--replace-cowboy',action='store_true')
args=parser.parse_args()
rows=[
 ('Gus','gus','Stocky tan adult man with short brown hair, cream short-sleeve T-shirt, light gray trousers, cream sneakers, dark wristwatch, cigarette and small lighter. Preserve adult face and stocky proportions; accessories are physical objects, never shirt prints.','#d4bf96','gravity',('Pressão densa','Nuvem de impacto','PESO DO BALCÃO'),{'speed':270,'tempo':1.07,'damage':{'punch':10,'kick':15}}),
 ('Kalango','kalango','Tan adult man with buzz-cut dark hair, black rectangular glasses, dark navy T-shirt with orange code emblem, fingerless black-orange gloves, black cargo trousers with orange straps, hip badge and utility pouches, black-white-orange sneakers. Preserve actual attached pouches and badges.','#eea24b','codefire',('Faísca laranja','Compilação explosiva','CÓDIGO EM CHAMAS'),{'speed':330,'tempo':.9,'damage':{'punch':7,'kick':12}}),
 ('Miss Laura','miss-laura','Adult woman with long wavy blonde hair and dark roots, red lipstick, black top with lace sleeves and silver heart emblem, black fingerless gloves with blue cloud wrist display, black cargo trousers with AWS pocket logo, physically attached miniature game-console keychain and orange straps, black-white sneakers with blue cloud motifs. Preserve feminine adult face, lace, wrist display and physical keychain; never turn the keychain into a fabric graphic.','#87bddb','cubes',('Pacote da nuvem','Escala máxima','PODER DA NUVEM'),{'speed':310,'tempo':.95,'damage':{'punch':8,'kick':13}}),
 ('s3rious','s3rious','Athletic tan adult man with black beard and mustache, dark sunglasses, gray bucket hat with long neck flap, bare torso, cigarette between lips, multicolor neck lanyard with keys, physical black hip bag with green code emblem and colorful hanging scarf, black cargo shorts with small Brazil patch, black socks with green leaf motifs, black-gray-white sneakers. Preserve hat flap, beard, bag and attached keys, all actual objects.','#9fbf72','lunar',('Bruma tropical','Neblina total','BRISA DO BOTECO'),{'speed':300,'tempo':.98,'damage':{'punch':8,'kick':13}}),
]
if args.replace_cowboy:
 rows.append(('cowboy','cowboy','Slim athletic tan adult man with swept short brown hair, clean-shaven face, plain black T-shirt with small white code emblem and multicolor infinity sleeve emblem, black wristband, dark cargo trousers with attached hip badge and black-white sneakers. Preserve youthful adult face and exact costume.','#8dbae0','pulse',None,{}))
ROOT.mkdir(parents=True,exist_ok=True)
(ROOT/'logs').mkdir(exist_ok=True)
profiles={}
for name,fid,identity,color,kind,labels,stats in rows:
 source=Path('novos_player_para_implementar')/(name+'.png')
 run=Path('assets/sprites')/fid/'generation'/'roster-v16'
 run.mkdir(parents=True,exist_ok=True)
 shutil.copy2(source,run/'base-source.png')
 request=json.loads(Path('assets/sprites/naldo/sprite-request.json').read_text())
 request.pop('chroma_key',None)
 request['character']={'id':fid,'description':identity}
 request['style']='Faithfully copy the supplied pixel-art full-body reference: face, costume, physical accessories, crisp stepped contours and clustered pixel shading. '+identity+' Fixed orthographic camera, consistent head/body scale and adult anatomy in every pose. Articulate joints without shrinking crouched bodies. Entire head, hands, accessories and shoe soles visible with clear margins. No backdrop, shadows, halo, additional people or engine energy effects. Face RIGHT except the deliberate turn sequence.'
 request['states']['special']['action']='FOUR chronological poses: normal RIGHT-facing guard; draw rear fist back; extend an open-palm strike RIGHT; recover guard. Preserve accessories with plausible hand support. Draw only body, engine supplies energy effects.'
 request['states']['super']['action']='FOUR chronological poses: planted RIGHT-facing guard; rotate shoulders and chamber arms; discharge with both arms RIGHT; retract into balanced guard. Preserve physical accessories with hand support; engine supplies energy effects.'
 request['states']['airKick']['action']=request['states']['airKick']['action'].split('Preserve backward cap')[0]
 request['states']['kick']['action']='FOUR chronological RIGHT-facing poses: grounded ordinary guard with both feet down; chamber knee with supporting knee slightly bent; extend raised kicking foot RIGHT; retract knee into recovery. No full kick before frame 2. Same head/body scale.'
 request['states']['lowBlock']['action']='FOUR chronological RIGHT-facing LOW BLOCK poses: enter a deep squat with pelvis near knee height; brace both forearms together across abdomen and knees; hold that closed low shield in deep squat; slightly relax knees while maintaining the low shield. Hands remain below chest, never at forehead. Both feet support the crouch. No forward punch or reaching arm.'
 request['states']['turn']['action']='FOUR chronological full-body poses with monotonic rotation: frame 0 RIGHT profile guard with nose pointing RIGHT; frame 1 FRONT-on guard with centered nose; frame 2 unmistakable LEFT PROFILE with nose protruding LEFT of cheek, eyes looking LEFT, shoe toes toward LEFT; frame 3 final LEFT-facing front-three-quarter guard, nose and toes LEFT, front chest still visible as in frame 2. Stop rotation before showing the back. Never return nose RIGHT in frames 2 or 3. Preserve anatomical accessory sides and body/head scale, no mirroring substitute.'
 request['states']['backwalk']['action']='SIX distinct chronological RIGHT-facing rearward boxing-shuffle poses: wide guard; lift rear shoe and retreat it LEFT while front shoe supports; plant rear shoe further LEFT in wide stance; lift front shoe and draw it LEFT toward rear shoe with rear leg supporting; land front shoe in narrower stance; reopen wide guard for loop seam. Show visible alternate shoe travel and support transfers, keep natural bent knees, no leg crossing, no static heel-only wiggle. Head/body size consistent.'
 request['states']['walk']['action']='SIX distinct chronological RIGHT-facing forward boxing-shuffle poses: wide guard; lift front shoe and move it RIGHT with rear leg supporting; plant front shoe ahead in wide stance; lift rear shoe and draw it RIGHT with front leg supporting; plant rear shoe in narrower stance; reopen wide guard for loop seam. Actual alternating shoe travel and weight transfers, no crossed legs or static breathing substitute. Same adult head/body scale.'
 recipe=ROOT/(fid+'-request.json')
 recipe.write_text(json.dumps(request,indent=2)+'\n')
 if not (run/'sprite-request.json').exists():
  subprocess.run([CLI,'prepare','--out-dir',str(run),'--character-id',fid,'--base-image',str(source),'--request',str(recipe),'--description',identity,'--chroma-key','auto','--force'],check=True,capture_output=True)
 profiles[fid]={'id':fid,'name':'Cowboy' if fid=='cowboy' else name,'identity':identity,'color':color,'powerKind':kind,'powerLabels':labels,'stats':stats,'generationRun':str(run),'suppliedReference':str(source),'replaceExisting':fid=='cowboy'}
 print('PREPARED',fid,flush=True)
(ROOT/'roster.json').write_text(json.dumps(profiles,indent=2)+'\n')
