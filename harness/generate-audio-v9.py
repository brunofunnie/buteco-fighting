"""Generate the approved ElevenLabs bank; no credentials enter the repository.

Use --plan to inspect all prompts. --generate uses the locally authenticated CLI.
The runtime manifest is published only after every asset passes ffprobe decoding.
Existing successful files are retained so a retry does not regenerate them.
"""
import argparse,json,os,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'assets/audio/v9'
FIGHTERS={
 'maya':('Rina Sabre','agile sharp energy blade slash, crisp shimmering cut'),
 'bruno':('Waggy','heavy urban shockwave, dry muscular bass punch'),
 'viihuugo':('ViiHuugo','prismatic glass sparkle, bright rising rainbow synth'),
 'joke-l':('Joke L','digital block clicks, chunky bitcrushed data burst'),
 'king-luiz':('King Luiz','arcane rune chime, tumbling D20 dice and magical pulse'),
 'maya-b':('Maya B','holographic mirage sweep, airy stereo phasing shimmer'),
 'pedro-pi':('Pedro Pi','lunar mist breath, dark soft bell and deep moon pulse'),
 'alex-sebas':('Alex Sebas','magnetic hammer sweep, metal whirr and clean steel clang'),
 'math-carpenter':('Math Carpenter','kinetic body rush, compressed air and short ground tremor'),
 'dark-wong':('Dark Wong','sonic bass wave, resonant speaker thump and short oscillating tone'),
 'mr-funnie':('Mr. Funnie','digital fire crackle, glitch sparks and compact flame burst'),
 'baiano-m':('Baiano M','warm solar flare blast, dry Brazilian hand percussion and glowing ember fizz'),
 'cowboy':('Cowboy','precise compressed-air pulse, short fast sonic crack and clean cloth swish'),
 'henry-k':('Henry K','headphone bass impact, rounded sub-bass pulse with tight rhythmic transient'),
 'jamal':('Jamal','heavy gravitational compression, deep bending tone and dense impact'),
 'joe-munist':('Joe Munist','red star energy punch, layered warm metallic chimes with firm striking beat'),
 'molly-jay':('Molly Jay','red feather blade sweep, delicate sharp flutter and dark elegant shimmer'),
}
PLAN={}
for identity,(name,style) in FIGHTERS.items():
 for action,duration in [('attack',.5),('special',1.2),('super',2.0)]:
  detail='one quick physical punch or kick whoosh' if action=='attack' else 'one unleashed energy attack' if action=='special' else 'one powerful ultimate attack with a rising charge and explosive release'
  PLAN[f'{identity}-{action}']={'text':f'Original arcade fighting game sound for {name}: {detail}, signature {style}. Immediate audible onset, tight transient, clear short decay. Isolated sound, no speech, no background music, no long silence. Polished warm arcade texture, not harsh or painfully loud.','duration_seconds':duration,'prompt_influence':.7,'model_id':'eleven_text_to_sound_v2'}
for key,text in {
 'impact':'one strong clearly audible punch hitting a boxing training pad, a sharp dry THWACK followed by a compact deep bass thump, moderate full volume',
 'block':'single blocked strike, solid padded guard clack with a small metallic ping',
 'jump':'single light jumping movement, short cloth swish and soft shoe lift',
 'select':'one short warm arcade menu cursor tick',
 'confirm':'one upbeat two-note arcade menu confirmation chime',
 'ko':'one decisive fighting game knockout bass impact and bright victory accent',
}.items():PLAN[key]={'text':f'{text}. Immediate attack, isolated sound effect, no speech, no music, no leading silence.','duration_seconds':.5 if key!='ko' else 1.5,'prompt_influence':.7,'model_id':'eleven_text_to_sound_v2'}
for key,mood in [('theme-menu','confident catchy night-time title anthem, relaxed opening groove'),('theme-fight','driving energetic battle groove, strong percussion and a memorable heroic hook')]:
 PLAN[key]={'prompt':f'Original instrumental soundtrack for Buteco Fighting, Brazilian nightlife arcade fighting game. {mood}. Brazilian samba-funk percussion, warm electric bass, tasteful electric guitar and 1990s arcade synth leads, 112 BPM. No vocals or speech. Punchy balanced mix with space for gameplay effects, repeating groove and loop-friendly ending, no long cinematic intro. Entirely original composition.','music_length_ms':40000,'force_instrumental':True,'model_id':'music_v1'}
def valid(path):
 if not path.exists() or path.stat().st_size<1000:return False
 result=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(path)],capture_output=True,text=True)
 try:return result.returncode==0 and float(result.stdout)>.15
 except ValueError:return False
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--plan',action='store_true');parser.add_argument('--generate',action='store_true');args=parser.parse_args()
 OUT.mkdir(parents=True,exist_ok=True);(OUT/'generation-plan.json').write_text(json.dumps(PLAN,indent=2))
 if not args.generate:print(f'Plan ready: {len(PLAN)} assets; no API requests made.');return
 manifest={}
 for key,body in PLAN.items():
  path=OUT/f'{key}.mp3'
  if not valid(path):
   temporary=OUT/f'{key}.pending.mp3';command=['elevenlabs','music','compose'] if key.startswith('theme-') else ['elevenlabs','text-to-sound-effects','convert']
   api_key=os.environ.get('ELEVENLABS_API_KEY')
   if api_key:command+=['--xi-api-key',api_key]
   result=subprocess.run(command+['--json',json.dumps(body),'--output',str(temporary),'--no-retry'],cwd=ROOT,capture_output=True,text=True)
   if result.returncode:
    message=result.stderr or result.stdout
    if api_key:message=message.replace(api_key,'[redacted]')
    raise RuntimeError(f'ElevenLabs failed for {"configured account" if api_key else "saved login"}: {message}')
   if not valid(temporary):raise RuntimeError(f'Invalid audio: {key}')
   os.replace(temporary,path)
  manifest[key]={'path':str(path.relative_to(ROOT)),'provider':'elevenlabs'};print(f'READY {key}',flush=True)
 temporary=OUT/'manifest.pending.json';temporary.write_text(json.dumps(manifest,indent=2));os.replace(temporary,OUT/'manifest.json')
if __name__=='__main__':main()
