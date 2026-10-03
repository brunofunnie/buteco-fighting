"""Generate four state-inspired rock/pop scores with ElevenLabs Music."""
import argparse,json,os,subprocess,textwrap
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import wave
STAGES=[
 {'id':'sao-paulo','state':'São Paulo','bpm':160,'key':'E minor with E Dorian color','color':['urban Brazilian pop rock','tight electric bass','crunchy rhythm guitars','electric piano','subtle saxophone hooks','Dorian raised sixth melodic color'],
  'sections':[('City riff','Driving urban guitar riff with tight drums and electric piano stabs. Distinctive bass groove and energetic opening, no intro silence.'),('Avenue chorus','Change to a wide catchy pop-rock chorus with open guitar chords and a saxophone answering melody. New chord voicings and stronger snare groove.'),('Night bridge','Clearly contrasting syncopated bass and electric piano groove, with short distorted guitar lead phrases. Use Dorian melodic color and a different rhythmic pattern.'),('Final guitar lead','Return with an evolved main riff, expressive guitar solo answered by saxophone, drum fills and harmonic turnaround. End in tempo, leading directly to the opening riff.') ]},
 {'id':'rio','state':'Rio de Janeiro','bpm':150,'key':'D major with D Mixolydian color','color':['Carioca pop rock','subtle samba funk syncopation','distorted electric guitars','bright cavaquinho accents','pandeiro and tamborim behind rock drums','Mixolydian flat seventh melodic color'],
  'sections':[('Coastal riff','Energetic electric guitar hook with a syncopated electric bass, rock kit and restrained pandeiro. Cavaquinho plays short bright rhythmic accents.'),('Carioca chorus','New catchy wide pop-rock chorus with ringing guitar chords and melodic cavaquinho responses. Keep guitar and rock drums dominant. Contrast the opening riff.'),('Syncopated bridge','Distinct samba-funk-influenced bass bridge with tamborim fills and choppy electric guitars. Explore Mixolydian notes in the new lead melody without slowing down.'),('Guitar and percussion finale','Expressive distorted electric guitar lead over a new bass variation and drum/percussion fills. Evolved opening hook and an in-tempo turnaround leading back to the start.') ]},
 {'id':'recife','state':'Pernambuco','bpm':160,'key':'A major with bright Lydian passing tones and chromatic brass runs','color':['Pernambuco inspired rock pop fusion','energetic frevo inspired brass phrases','electric guitars and electric bass','trumpet and trombone accents','maracatu inspired low drum rhythm behind rock kit','bright major melody with chromatic brass runs'],
  'sections':[('Brass guitar attack','Fast original guitar riff answered by compact trumpet and trombone phrases, powerful rock drums, subtle low-drum accents. Catchy immediate opening.'),('Recife chorus','Distinct pop-rock chorus: open guitar chords and a memorable new frevo-inspired brass melody, supported by electric bass and a driving snare backbeat.'),('Low drum bridge','Contrasting rhythmic bridge led by low drum and electric bass syncopation with choppy distorted guitar. Short chromatic trumpet runs and new harmonic voicings.'),('Electric brass finale','New overdriven guitar solo trading phrases with brass, rolling rock drum fills and an evolved main hook. Short rhythmic turnaround that loops straight into the opening.') ]},
 {'id':'manaus','state':'Amazonas','bpm':150,'key':'B minor pentatonic with B Dorian accents','color':['Amazonas inspired instrumental pop rock','driving electric guitars','wooden flute answering motifs','shaker and hand percussion textures','electric bass and energetic rock drum kit','minor pentatonic melodic hook with Dorian accents'],
  'sections':[('River guitar riff','Energetic original distorted guitar riff, electric bass and rock kit. Wooden flute gives brief airy answers, restrained shakers add rhythmic texture. No ambient intro.'),('Amazon chorus','Distinct catchy pop-rock chorus with open chords, new melodic flute hook and strong guitar rhythm. Minor pentatonic melody and brighter Dorian accents.'),('Percussive bridge','Contrasting interlocking bass and hand-percussion rhythm with muted electric guitars, new flute melody and a different chord progression. Keep the battle energy high.'),('Lead guitar current','Expressive electric guitar solo exchanging motifs with wooden flute, busier rock drum fills and evolved main riff. Finish with an in-tempo turnaround leading directly back to the start.') ]},
]
# Regional identity leads the arrangement; rock/pop provides secondary support.
REGIONAL={
 'recife':{'bpm':132,'key':'D Mixolydian and D major pentatonic, northeastern Brazilian modal melody',
 'color':['instrumental electric baiao and northeastern Brazilian sertao music','accordion is the main melodic instrument loud and upfront','zabumba low beat and dry high slap with continuous triangle subdivisions','syncopated original sertao guitar riff doubling accordion','twangy electric guitar and acoustic viola','earthy dancing baiao bass ostinato','rock energy through guitar accents, never a standard pop punk backbeat'],
 'sections':[('Sertao accordion riff','Start immediately with a memorable ORIGINAL rural northeastern modal accordion riff doubled by twangy electric guitar. Authentic prominent zabumba and triangle baiao groove, dry earthy bass ostinato. No quotation of an existing song.'),('Viola and accordion dance','Introduce a completely new major pentatonic accordion melody answered by acoustic viola, bass anticipation and zabumba slaps. Electric guitar adds rhythmic bite underneath. Keep the baiao groove foreground.'),('Modal sertao bridge','Clearly different darker Mixolydian melody with flat seventh and call-and-response between accordion and twangy guitar. Triangle subdivisions and syncopated zabumba break, no generic snare chorus.'),('Electric baiao finale','Original virtuosic accordion solo trading short phrases with gritty guitar over energetic zabumba variations. Evolve the opening rural riff and resolve through an in-tempo turnaround for looping.')]},
 'manaus':{'bpm':128,'key':'A minor with harmonic minor brega lead phrases and contrasting C major boi-bumba chorus',
 'color':['instrumental Amazonian boi bumba festival fusion with Amazonian brega dance guitar','large prominent interlocking boi bumba drum ensemble','deep surdo pulse, dry caixa rolls, repique calls and shakers','bright electric guitar plays original sentimental brega lead motifs','danceable syncopated brega bass and vintage keyboard organ','percussion ensemble and brega guitar dominate instead of generic pop rock guitars','celebratory dramatic rhythmic arena energy'],
 'sections':[('Boi drum procession','Immediate powerful interlocking boi-bumba festival drum ensemble: deep surdo pulse, caixa and repique calls, rattles. Bright electric guitar plays an original minor-key brega melody; syncopated dancing bass. Drums are the main identity.'),('Brega guitar dance','Clearly contrasting sentimental instrumental brega guitar hook with expressive slides and vintage organ response, syncopated electric bass and compact brega dance groove. Keep festival percussion audible; no punk chord strumming.'),('Boi arena call','New bright major-key festival melody and complex percussion call-and-response, surdo and repique breaks answered by guitar. Build arena tension with low drum ensemble, not a conventional rock snare chorus.'),('Brega and boi finale','Combine evolved brega guitar solo with powerful boi-bumba drum variations and organ counter melody. Strong syncopation, festive Amazonian character, original motifs and rhythmic turnaround that returns directly to the opening.')]},
 'rio':{'bpm':124,'key':'G major with Brazilian samba jazz harmony, major sevenths, ninths and secondary dominants',
 'color':['instrumental Rio de Janeiro samba and bohemian Brazilian MPB','nylon string acoustic guitar is the main instrument upfront','authentic syncopated fingerpicked Brazilian guitar with rich seventh and ninth chords','prominent pandeiro, tamborim and gentle surdo samba groove','cavaquinho rhythmic responses and warm melodic electric bass','clean electric guitar gives restrained rock pop accents only','intimate lively bohemian samba energy with sophisticated harmonic movement'],
 'sections':[('Bohemian nylon guitar','Start immediately with original nimble nylon-string guitar melody and syncopated samba fingerpicking, rich major seventh and ninth voicings. Pandeiro, tamborim and surdo carry the rhythm, cavaquinho answers, warm bass. Acoustic guitar is clearly dominant.'),('Cavaquinho samba chorus','New sunny samba melody shared by nylon guitar and cavaquinho, walking syncopated bass and stronger pandeiro. Use secondary dominants and Brazilian jazz chord movement, short clean electric guitar responses, no distorted power chords.'),('Late night MPB bridge','Contrasting lyrical minor-key nylon-string melody over sophisticated altered dominant harmony and sparse syncopated pandeiro. Bass and cavaquinho call and response. Keep a lively forward samba pulse rather than a slow ballad.'),('Samba guitar finale','Agile original fingerpicked nylon guitar solo with cavaquinho responses, tamborim variations and warm bass movement. Return to evolved bright main motif with rich harmonic turnaround ending in time for a seamless loop.')]}
}
for stage in STAGES:
 if stage['id'] in REGIONAL:
  stage.update(REGIONAL[stage['id']])
  stage['base_styles']=['original instrumental Brazilian regional fusion fighting game music','regional rhythm and lead instruments clearly dominate the mix','rock pop energy as secondary accompaniment only','organic acoustic instruments and real percussion','four clearly distinct musical sections with different melodies and arrangements','balanced mix with room for game effects']
  stage['extra_negative']=['generic Brazilian emo pop rock','pop punk','arena rock power chord chorus','four on the floor rock beat','distorted guitars dominating the mix','regional instruments buried in background','existing song melody quotation']
COMMON=['instrumental energetic rock pop fighting game soundtrack','original composition','real sounding distorted electric guitars','energetic live sounding rock drum kit','electric bass','clear catchy melodic hooks','balanced mix with room for game effects']
NEGATIVE=['vocals','singing','speech','lyrics','MIDI sound','chiptune','ambient drone','long intro','fade out','ending silence','same riff repeated for the entire track']
def run(stage,generate):
 out=Path('assets/audio/stages')/stage['id'];out.mkdir(parents=True,exist_ok=True)
 chunks=[]
 for name,directions in stage['sections']:
  text=f'[{name}]\n'+'\n'.join('{'+line+'}' for line in textwrap.wrap('Instrumental. '+directions,width=160))
  chunks.append({'text':text,'duration_ms':24000,'positive_styles':stage.get('base_styles',COMMON)+stage['color']+[f"{stage['bpm']} BPM",stage['key']],'negative_styles':NEGATIVE+stage.get('extra_negative',[]),'context_adherence':'high'})
 request={'model_id':'music_v2_5','composition_plan':{'chunks':chunks}}
 (out/'composition.json').write_text(json.dumps(request,ensure_ascii=False,indent=2))
 if not generate:return {'id':stage['id'],'plannedDurationSeconds':96,'sections':4}
 original=out/'elevenlabs-original.mp3'
 if not original.exists():
  command=['elevenlabs','music','compose','--json',json.dumps(request),'--output',str(out/'generation.pending.mp3'),'--output-format','mp3_48000_192','--no-retry']
  key=os.environ.get('ELEVENLABS_API_KEY')
  if key:command+=['--xi-api-key',key]
  result=subprocess.run(command,capture_output=True,text=True)
  if result.returncode:
   message=result.stderr or result.stdout
   if key:message=message.replace(key,'[redacted]')
   raise RuntimeError(stage['id']+': '+message[:2000])
  (out/'generation.pending.mp3').replace(original)
 decoded=out/'decoded.pending.wav'
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(original),'-ac','2','-ar','44100',str(decoded)],check=True)
 with wave.open(str(decoded),'rb') as f:
  rate=f.getframerate();signal=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').reshape(-1,2).astype(np.float64)/32768
 assert 90<=len(signal)/rate<=101
 crossfade_seconds=240/stage['bpm'];size=int(rate*crossfade_seconds);phase=np.linspace(0,1,size)[:,None]
 blend=signal[-size:]*(1-phase)+signal[:size]*phase
 loop=np.concatenate([signal[size:-size],blend]);peak=np.max(np.abs(loop))
 if peak>.89:loop*=.89/peak
 assert np.isfinite(loop).all() and np.mean(loop**2)>.00001
 assert 85<=len(loop)/rate<=100
 wav=out/'loop.pending.wav'
 with wave.open(str(wav),'wb') as f:
  f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate);f.writeframes((loop*32767).astype('<i2').tobytes())
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(wav),'-c:a','libmp3lame','-b:a','192k',str(out/'theme.pending.mp3')],check=True)
 (out/'theme.pending.mp3').replace(out/'theme.mp3');decoded.unlink();wav.unlink()
 metadata={'provider':'elevenlabs','model':'music_v2_5','state':stage['state'],'bpm':stage['bpm'],'key':stage['key'],'sections':[{'name':name,'seconds':24} for name,_ in stage['sections']],'originalDurationSeconds':len(signal)/rate,'runtimeDurationSeconds':len(loop)/rate,'crossfadeSeconds':crossfade_seconds,'path':str(out/'theme.mp3'),'peak':float(np.max(np.abs(loop)))}
 (out/'theme.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
 print(f"READY {stage['state']}: {len(loop)/rate:.2f}s, four sections",flush=True)
 return metadata
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--generate',action='store_true');parser.add_argument('--stages',nargs='+',choices=[stage['id'] for stage in STAGES]);args=parser.parse_args()
 selected=[stage for stage in STAGES if not args.stages or stage['id'] in args.stages]
 with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda stage:run(stage,args.generate),selected))
 manifest_path=Path('assets/audio/stages/manifest.json')
 manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
 manifest.update({stage['id']:result for stage,result in zip(selected,results)})
 manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 print('All four stage themes ready' if args.generate else 'Four composition plans ready; no API requests made',flush=True)
