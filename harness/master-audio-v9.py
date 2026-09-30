"""Preserve ElevenLabs originals and balance the runtime MP3 bank."""
import json,re,shutil,subprocess
from pathlib import Path
root=Path(__file__).resolve().parent.parent
bank=root/'assets/audio/v9';masters=bank/'masters';masters.mkdir(exist_ok=True)
manifest=json.loads((bank/'manifest.json').read_text());report=[]
def stats(path):
 result=subprocess.run(['ffmpeg','-hide_banner','-i',str(path),'-af','volumedetect','-f','null','-'],capture_output=True,text=True,check=True)
 return {key:float(re.search(key+r': ([-\d.]+)',result.stderr)[1]) for key in ['mean_volume','max_volume']}
for key,asset in manifest.items():
 path=root/asset['path'];original=masters/path.name
 if not original.exists():shutil.copyfile(path,original)
 before=stats(original)
 if key.startswith('theme-'):filters='loudnorm=I=-18:TP=-3:LRA=7,afade=t=in:d=0.03,afade=t=out:st=39.8:d=0.2'
 else:filters=f'volume={-3-before["max_volume"]}dB,afade=t=in:d=0.002'
 temporary=bank/f'{key}.mastered.mp3'
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(original),'-af',filters,'-ar','44100','-codec:a','libmp3lame','-b:a','128k',str(temporary)],check=True)
 temporary.replace(path);after=stats(path)
 assert after['mean_volume']>-45,f'{key} unexpectedly silent'
 assert after['max_volume']<=-.5,f'{key} lacks headroom'
 report.append({'id':key,'original':before,'runtime':after})
(root/'artifacts/audio-levels-v9.json').write_text(json.dumps(report,indent=2))
print(f'PASS {len(report)} mastered files: audible signal and peak headroom; originals preserved')
