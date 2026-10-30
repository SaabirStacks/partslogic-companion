// Renders the app's sounds into assets/sounds as short WAV files: the same notes, lengths and wave shapes
// as the approved part look-up prototype, which played them with Web Audio. Every sound the app makes comes
// from here, so they can be remade or retuned. No dependencies. Run:
//   node scripts/render-sounds.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RATE = 44100;
// The loudest sound peaks here (about -3 dB); the others keep their level relative to it, as in the prototype.
const PEAK = 0.7;
// Silence after the last note, so a phone's audio output never cuts the decay short.
const TAIL = 0.03;

// One note: frequency (Hz), start and length (seconds), wave shape, volume, and an optional low-pass cutoff.
const note = (freq, at, dur, wave = 'sine', vol = 0.16, cutoff = null) => ({ freq, at, dur, wave, vol, cutoff });

// The app's whole vocabulary of sound, one entry per kind of moment (src/feel/moments.ts says when each plays).
export const SOUNDS = {
  scan: [note(1900, 0, 0.07, 'square', 0.05, 5000)],
  unknown: [note(980, 0, 0.08, 'triangle', 0.16), note(980, 0.13, 0.08, 'triangle', 0.16)],
  refused: [note(170, 0, 0.3, 'sawtooth', 0.12, 900)],
  done: [note(784, 0, 0.12, 'sine', 0.17), note(1175, 0.1, 0.18, 'sine', 0.17)],
  found: [note(1047, 0, 0.09, 'sine', 0.15), note(1319, 0.08, 0.09, 'sine', 0.15), note(1568, 0.16, 0.18, 'sine', 0.15)],
  nothing: [note(587, 0, 0.12, 'sine', 0.13), note(440, 0.11, 0.18, 'sine', 0.13)],
  tick: [note(2600, 0, 0.014, 'sine', 0.05)],
};

// Band-limited waves built from their harmonics up to the Nyquist limit, as Web Audio's oscillators are, so
// square and sawtooth notes don't alias into a buzz.
function wave(shape, freq, t) {
  const phase = 2 * Math.PI * freq * t;
  if (shape === 'sine') return Math.sin(phase);
  const top = Math.floor(RATE / 2 / freq);
  let sum = 0;
  for (let k = 1; k <= top; k += 1) {
    if (shape === 'square' && k % 2 === 1) sum += Math.sin(k * phase) / k;
    if (shape === 'sawtooth') sum += ((k % 2 === 1 ? 1 : -1) * Math.sin(k * phase)) / k;
    if (shape === 'triangle' && k % 2 === 1) sum += ((((k - 1) / 2) % 2 === 0 ? 1 : -1) * Math.sin(k * phase)) / (k * k);
  }
  if (shape === 'square') return (4 / Math.PI) * sum;
  if (shape === 'sawtooth') return (2 / Math.PI) * sum;
  if (shape === 'triangle') return (8 / (Math.PI * Math.PI)) * sum;
  throw new Error(`Unknown wave shape: ${shape}`);
}

// Web Audio's envelope: from near silence up to the volume in 6 ms, then an exponential fall to near silence.
function envelope(vol, t, dur) {
  const floor = 0.0001;
  const attack = 0.006;
  if (t < 0 || t > dur) return 0;
  if (t < attack) return floor * (vol / floor) ** (t / attack);
  return vol * (floor / vol) ** ((t - attack) / (dur - attack));
}

// A low-pass biquad (the Audio EQ Cookbook form Web Audio uses), with Web Audio's default Q of 1 dB.
function lowPass(samples, cutoff) {
  const q = 10 ** (1 / 20);
  const w = (2 * Math.PI * cutoff) / RATE;
  const alpha = Math.sin(w) / (2 * q);
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  const b0 = (1 - cos) / 2 / a0;
  const b1 = (1 - cos) / a0;
  const b2 = b0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  const out = new Float64Array(samples.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const x = samples[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}

// The notes mixed into one buffer of samples between -1 and 1, before the overall level is set.
export function mix(notes) {
  const length = Math.ceil((Math.max(...notes.map((n) => n.at + n.dur)) + TAIL) * RATE);
  const buffer = new Float64Array(length);
  for (const n of notes) {
    let voice = new Float64Array(length);
    for (let i = 0; i < length; i += 1) {
      const t = i / RATE - n.at;
      if (t >= 0 && t <= n.dur) voice[i] = wave(n.wave, n.freq, t) * envelope(n.vol, t, n.dur);
    }
    if (n.cutoff) voice = lowPass(voice, n.cutoff);
    for (let i = 0; i < length; i += 1) buffer[i] += voice[i];
  }
  return buffer;
}

export const peakOf = (samples) => samples.reduce((top, value) => Math.max(top, Math.abs(value)), 0);

// 16-bit mono PCM in a WAV container, which both iOS and Android play without decoding cost.
export function wavFile(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((value, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // bytes per second
  header.writeUInt16LE(2, 32); // bytes per frame
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// Every sound mixed and levelled together, so the loudest reaches PEAK and the rest keep their balance.
export function renderAll() {
  const mixed = Object.entries(SOUNDS).map(([name, notes]) => [name, mix(notes)]);
  const gain = PEAK / Math.max(...mixed.map(([, samples]) => peakOf(samples)));
  return mixed.map(([name, samples]) => [name, samples.map((value) => value * gain)]);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');
  mkdirSync(folder, { recursive: true });
  for (const [name, samples] of renderAll()) {
    const file = path.join(folder, `${name}.wav`);
    writeFileSync(file, wavFile(samples));
    console.log(`${name}.wav  ${(samples.length / RATE).toFixed(3)} s  peak ${peakOf(samples).toFixed(2)}`);
  }
}
