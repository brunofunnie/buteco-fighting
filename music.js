import {audioDirector} from "./audio.js";
// Synth fallback when the generated music bank is unavailable.
const bass = [36, 36, 43, 36, 39, 39, 46, 39, 41, 41, 48, 41, 43, 43, 46, 43];
const lead = [72, null, 75, 79, null, 75, 74, null, 77, null, 80, 84, 82, 79, 77, 74];
const hz = note => 440 * 2 ** ((note - 69) / 12);
function tone(audio, note, time, duration, volume, type) {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.value = hz(note);
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(time);
  oscillator.stop(time + duration + 0.015);
}
export function scoreTick(fight) {
  if(audioDirector.fightScore(fight))return;
  const audio = fight.audio;
  if (!audio || audio.state !== 'running' || fight.options.muted || fight.paused) {
    fight.nextBeat = undefined;
    return;
  }
  if (fight.nextBeat === undefined) fight.nextBeat = audio.currentTime;
  if (fight.nextBeat > audio.currentTime + 0.07) return;
  const beat = fight.musicBeat || 0;
  const when = Math.max(fight.nextBeat, audio.currentTime);
  tone(audio, bass[Math.floor(beat / 2) % bass.length], when, 0.12, 0.022, 'triangle');
  const melody = lead[beat % lead.length];
  if (melody && beat % 32 >= 16) tone(audio, melody, when, 0.11, 0.010, 'square');
  if (beat % 4 === 0) tone(audio, 24, when, 0.07, 0.040, 'sine');
  fight.musicBeat = beat + 1;
  fight.nextBeat = when + 0.125;
}
