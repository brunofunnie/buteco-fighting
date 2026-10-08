export const STAGE_MUSIC = Object.freeze(['theme-sao-paulo','theme-rio','theme-recife','theme-manaus','theme-devon']);
const stageMusicAssets = Object.fromEntries(['sao-paulo','rio','recife','manaus'].map((id,index)=>[STAGE_MUSIC[index],{path:`/assets/audio/music/${id}.mp3`}]));
stageMusicAssets['theme-devon']={path:'/assets/audio/music/devon.wav'};
export function musicForStage(stage=0){return STAGE_MUSIC[stage]||'theme-fight';}
// Generated audio is optional until the complete ElevenLabs bank is published.
// The existing synth remains available when an asset fails to load.
export class AudioDirector {
  constructor(){this.buffers=new Map();this.pending=new Map();this.voices=new Set();this.scene='menu';this.muted=false;this.musicVolume=1;this.effectsVolume=1;this.synthOutputs=new Map();
    try{const saved=JSON.parse(globalThis.localStorage?.getItem('buteco-audio-volumes')||'null');for(const kind of ['music','effects'])if(Number.isFinite(saved?.[kind])&&saved[kind]>=0&&saved[kind]<=1)this[`${kind}Volume`]=saved[kind];}catch{}
  }
  async unlock(){
    if(!this.context){const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return;this.context=new Context();this.master=this.context.createGain();this.master.gain.value=this.muted?0:1;this.compressor=this.context.createDynamicsCompressor();this.compressor.threshold.value=-14;this.compressor.ratio.value=4;this.compressor.attack.value=.003;this.compressor.release.value=.12;this.output=this.context.createGain();this.output.gain.value=.85;this.effectsBus=this.context.createGain();this.musicBus=this.context.createGain();this.effectsBus.gain.value=this.effectsVolume;this.musicBus.gain.value=this.musicVolume;this.effectsBus.connect(this.master);this.musicBus.connect(this.master);this.master.connect(this.compressor).connect(this.output).connect(this.context.destination);}
    await this.context.resume();
    if(!this.manifestRequest)this.manifestRequest=fetch('/assets/audio/manifest.json').then(r=>r.ok?r.json():null).then(manifest=>{
      this.manifest=manifest;
      if(manifest)for(const key of ['theme-menu','theme-fight','theme-devon','impact','block','jump','select','confirm','ko'])this.load(key);
    }).catch(()=>{});
    await this.manifestRequest;
  }
  load(key){
    if(this.buffers.has(key))return Promise.resolve(this.buffers.get(key));
    if(this.pending.has(key))return this.pending.get(key);
    const asset=this.manifest?.[key]||stageMusicAssets[key];if(!asset||!this.context)return Promise.resolve(null);
    const promise=fetch(asset.path).then(r=>{if(!r.ok)throw new Error('Missing audio');return r.arrayBuffer();}).then(bytes=>this.context.decodeAudioData(bytes)).then(buffer=>{this.buffers.set(key,buffer);this.refreshMusic();return buffer;}).catch(()=>null);
    this.pending.set(key,promise);return promise;
  }
  warmFighter(id){for(const action of ['attack','special','super'])this.load(`${id}-${action}`);}
  setMuted(value){this.muted=value;if(this.master)this.master.gain.setValueAtTime(value?0:1,this.context.currentTime);}
  setVolume(kind,value){
    if(!['music','effects'].includes(kind)||!Number.isFinite(value))return false;
    this[`${kind}Volume`]=Math.max(0,Math.min(1,value));
    const bus=this[`${kind}Bus`];if(bus)bus.gain.setValueAtTime(this[`${kind}Volume`],this.context.currentTime);
    for(const [context,outputs]of this.synthOutputs){const output=outputs[kind];if(output)output.gain.setValueAtTime(this[`${kind}Volume`],context.currentTime);}
    try{globalThis.localStorage?.setItem('buteco-audio-volumes',JSON.stringify({music:this.musicVolume,effects:this.effectsVolume}));return !!globalThis.localStorage;}catch{return false;}
  }
  outputFor(context,kind){
    let outputs=this.synthOutputs.get(context);if(!outputs){outputs={};this.synthOutputs.set(context,outputs);}
    if(!outputs[kind]){const output=context.createGain();output.gain.value=this[`${kind}Volume`];output.connect(context.destination);outputs[kind]=output;}
    return outputs[kind];
  }
  warmStage(stage){return this.load(musicForStage(stage));}
  setScene(scene,stage=0){this.scene=scene;this.stage=stage;if(scene==='fight')this.warmStage(stage);this.refreshMusic();}
  refreshMusic(){
    const key=this.scene==='fight'?musicForStage(this.stage):this.scene==='menu'?'theme-menu':null;
    if(this.musicKey===key&&this.music)return;
    if(this.music){this.music.stop();this.music.disconnect();this.music=null;this.musicGain?.disconnect();}
    this.musicKey=null;
    const buffer=this.buffers.get(key);if(!buffer||!this.context||this.context.state!=='running')return;
    const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=.17;source.connect(gain).connect(this.musicBus);source.start();this.music=source;this.musicGain=gain;this.musicKey=key;
  }
  play(key,{position=0,volume=.45,rate=1}={}){
    if(this.muted)return false;
    if(this.effectsVolume===0)return true;
    const buffer=this.buffers.get(key);if(!buffer){this.load(key);return false;}
    if(this.context.state!=='running')return false;
    if(this.voices.size>=12){const oldest=this.voices.values().next().value;this.voices.delete(oldest);oldest.stop();}
    const source=this.context.createBufferSource(),gain=this.context.createGain(),pan=this.context.createStereoPanner();
    source.buffer=buffer;source.playbackRate.value=Math.max(.8,Math.min(1.2,rate));gain.gain.value=volume;pan.pan.value=Math.max(-.7,Math.min(.7,position));source.connect(gain).connect(pan).connect(this.effectsBus);
    this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();pan.disconnect();};source.start();return true;
  }
  combat(kind,fighter,camera=320){
    let key=kind;
    if(kind==='special'||kind==='super')key=`${fighter?.id}-${kind}`;
    else if(/punch|kick|uppercut|sweep/i.test(kind))key=`${fighter?.id}-attack`;
    else if(kind==='hit')key='impact';
    return this.play(key,{position:fighter?((fighter.x-camera)/1280-.5)*1.4:0,rate:/kick|sweep/i.test(kind)?.9:1,volume:kind==='super'?.55:.4});
  }
  fightScore(fight){
    this.setMuted(!!fight.options.muted);this.setScene(fight.paused?'pause':'fight',fight.stage);
    return this.musicKey===musicForStage(fight.stage);
  }
}
export const audioDirector=new AudioDirector();
