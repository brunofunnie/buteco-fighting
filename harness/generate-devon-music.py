"""Generate the boss score through ElevenLabs Music, never expose credentials."""
import json,os,subprocess,textwrap
from pathlib import Path
out=Path('assets/audio/devon');out.mkdir(parents=True,exist_ok=True)
common=['instrumental hard rock boss battle','160 BPM','E minor','distorted electric guitars through real sounding high gain amplifiers','live energetic rock drum kit','powerful electric bass','original music','balanced game soundtrack mix']
negative=['vocals','singing','speech','lyrics','MIDI sound','chiptune','ambient drone','quiet cinematic intro','fade out','ending silence']
sections=[
 ('Riff attack','{instrumental} {driving distorted guitar riff} Immediate energetic palm-muted rhythm guitars, strong snare backbeat, memorable aggressive main riff, guitar hook with musical variation.', ['driving hard rock riff','tight palm muted guitars','strong snare backbeat']),
 ('Heavy escalation','{instrumental} {new heavier riff} Clearly change to a heavier syncopated power-chord progression with open ringing chords, double kick drum bursts, cymbal accents and contrasting bass fills. Retain tempo and key.', ['heavier contrasting power chord progression','syncopated groove','double kick bursts','open ringing guitars']),
 ('Solo and turnaround','{instrumental} {electric guitar solo} New melodic lead guitar solo with expressive bends over fast rhythm guitars and rolling drum fills. Finish with a two-bar rhythmic turnaround in E minor that leads naturally directly back to the opening riff. No final resolving chord or fade.', ['expressive distorted electric guitar solo','melodic bends','fast rhythm guitars','drum fills','loop-friendly rhythmic turnaround']),
]
plan={'chunks':[{'text':f'[{name}]\n'+ '\n'.join('{'+line+'}' for line in textwrap.wrap(directions.replace('{','').replace('}',''),width=160)),'duration_ms':24000,'positive_styles':common+styles,'negative_styles':negative,'context_adherence':'high'}for name,directions,styles in sections]}
request={'composition_plan':plan,'model_id':'music_v2_5'}
(out/'elevenlabs-composition.json').write_text(json.dumps(request,indent=2))
cmd=['elevenlabs','music','compose','--json',json.dumps(request),'--output',str(out/'elevenlabs-original.mp3'),'--output-format','mp3_48000_192','--no-retry']
key=os.environ.get('ELEVENLABS_API_KEY')
if key:cmd+=['--xi-api-key',key]
result=subprocess.run(cmd,capture_output=True,text=True)
if result.returncode:
 message=result.stderr or result.stdout
 if key:message=message.replace(key,'[redacted]')
 raise SystemExit(message[:2500])
print('READY ElevenLabs Music: three 24-second sections, instrumental hard rock',flush=True)
