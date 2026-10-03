"""Publish a browser-decodable ElevenLabs score with a tail/head crossfade."""
import json,subprocess,wave
from pathlib import Path
import numpy as np
out=Path('assets/audio/devon')
subprocess.run(['ffmpeg','-y','-v','error','-i',str(out/'elevenlabs-original.mp3'),'-ar','44100','-ac','2',str(out/'elevenlabs-decoded.wav')],check=True)
with wave.open(str(out/'elevenlabs-decoded.wav'),'rb') as f:
    rate=f.getframerate();signal=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').reshape(-1,2).astype(np.float64)/32768
original_duration=len(signal)/rate
assert original_duration>=65,original_duration
crossfade=int(rate*1.5)
# Ending blends into opening; the subsequent wrap continues the opening phrase.
phase=np.linspace(0,1,crossfade)[:,None]
blend=signal[-crossfade:]*(1-phase)+signal[:crossfade]*phase
loop=np.concatenate([signal[crossfade:-crossfade],blend])
peak=np.max(np.abs(loop))
if peak>.89:loop*=.89/peak
assert np.isfinite(loop).all() and np.mean(loop**2)>.00001
with wave.open(str(out/'theme-rock.wav'),'wb') as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate);f.writeframes((loop*32767).astype('<i2').tobytes())
metadata={'provider':'elevenlabs','model':'music_v2_5','original':'elevenlabs-original.mp3','runtime':'theme-rock.wav','originalDurationSeconds':original_duration,'runtimeDurationSeconds':len(loop)/rate,'sections':['Riff attack','Heavy escalation','Solo and turnaround'],'plannedSectionSeconds':24,'crossfadeSeconds':1.5,'peak':float(np.max(np.abs(loop)))}
(out/'theme-rock.json').write_text(json.dumps(metadata,indent=2))
(out/'elevenlabs-decoded.wav').unlink()
print(json.dumps(metadata))
