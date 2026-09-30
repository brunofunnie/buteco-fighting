// Generated audio is optional until the complete ElevenLabs bank is published.
// The existing synth remains available when an asset fails to load.
export class AudioDirector {
  constructor(){this.buffers=new Map();this.pending=new Map();this.voices=new Set();this.scene='menu';this.muted=false;}
  async unlock(){
    if(!this.context){const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return;this.context=new Context();this.master=this.context.createGain();this.master.gain.value=this.muted?0:1;this.compressor=this.context.createDynamicsCompressor();this.compressor.threshold.value=-14;this.compressor.ratio.value=4;this.compressor.attack.value=.003;this.compressor.release.value=.12;this.output=this.context.createGain();this.output.gain.value=.85;this.master.connect(this.compressor).connect(this.output).connect(this.context.destination);}
    await this.context.resume();
    if(!this.manifestRequest)this.manifestRequest=fetch('/assets/audio/v9/manifest.json').then(r=>r.ok?r.json():null).then(manifest=>{
      this.manifest=manifest;
      if(manifest)for(const key of ['theme-menu','theme-fight','impact','block','jump','select','confirm','ko'])this.load(key);
    }).catch(()=>{});
    await this.manifestRequest;
  }
  load(key){
    if(this.buffers.has(key))return Promise.resolve(this.buffers.get(key));
    if(this.pending.has(key))return this.pending.get(key);
    const asset=this.manifest?.[key];if(!asset||!this.context)return Promise.resolve(null);
    const promise=fetch(asset.path).then(r=>{if(!r.ok)throw new Error('Missing audio');return r.arrayBuffer();}).then(bytes=>this.context.decodeAudioData(bytes)).then(buffer=>{this.buffers.set(key,buffer);this.refreshMusic();return buffer;}).catch(()=>null);
    this.pending.set(key,promise);return promise;
  }
  warmFighter(id){for(const action of ['attack','special','super'])this.load(`${id}-${action}`);}
  setMuted(value){this.muted=value;if(this.master)this.master.gain.setValueAtTime(value?0:1,this.context.currentTime);}
  setScene(scene,stage=0){this.scene=scene;this.stage=stage;this.refreshMusic();}
  refreshMusic(){
    const key=this.scene==='fight'?'theme-fight':this.scene==='menu'?'theme-menu':null;
    if(this.musicKey===key&&this.music)return;
    if(this.music){this.music.stop();this.music.disconnect();this.music=null;this.musicGain?.disconnect();}
    this.musicKey=null;
    const buffer=this.buffers.get(key);if(!buffer||!this.context||this.context.state!=='running')return;
    const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=.17;source.connect(gain).connect(this.master);source.start();this.music=source;this.musicGain=gain;this.musicKey=key;
  }
  play(key,{position=0,volume=.45,rate=1}={}){
    if(this.muted)return false;
    const buffer=this.buffers.get(key);if(!buffer){this.load(key);return false;}
    if(this.context.state!=='running')return false;
    if(this.voices.size>=12){const oldest=this.voices.values().next().value;this.voices.delete(oldest);oldest.stop();}
    const source=this.context.createBufferSource(),gain=this.context.createGain(),pan=this.context.createStereoPanner();
    source.buffer=buffer;source.playbackRate.value=Math.max(.8,Math.min(1.2,rate));gain.gain.value=volume;pan.pan.value=Math.max(-.7,Math.min(.7,position));source.connect(gain).connect(pan).connect(this.master);
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
    return this.musicKey==='theme-fight';
  }
}
export const audioDirector=new AudioDirector();
