'use strict';

/**
 * Generates gentle, original ambient seed tracks as 16-bit mono WAV files.
 * Pure synthesis — sine pads + filtered noise, no samples, no licensing worries.
 * Usage: node scripts/generate-seed-audio.js
 */

const fs = require('fs');
const path = require('path');

const SR = 22050;
const OUT = path.join(__dirname, '..', 'seed', 'music');

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

function writeWav(file, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
  console.log(`  wrote ${path.basename(file)} (${(n / SR).toFixed(0)}s, ${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** attack over `a` seconds, release over `r` seconds after `len` seconds */
function envAt(tt, len, a, r) {
  const attack = smooth(Math.min(1, Math.max(0, tt / a)));
  const rel = smooth(Math.min(1, Math.max(0, (len - tt) / r + 1)));
  return Math.min(attack, rel);
}

/** One-pole lowpass filter state */
function makeLP() {
  let y = 0;
  return (x, cutoff) => {
    const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
    y += a * (x - y);
    return y;
  };
}

function makeTrack(name, durationSec, chords, opts = {}) {
  const total = Math.round(durationSec * SR);
  const out = new Float32Array(total);

  const padLevel = opts.padLevel ?? 0.30;
  const noiseLevel = opts.noiseLevel ?? 0.06;
  const subLevel = opts.subLevel ?? 0.10;
  const sparkleLevel = opts.sparkleLevel ?? 0;

  // ---- pads with crossfading chords ----
  let t = 0;
  const chordSpecs = chords.map((c) => ({ notes: c.notes, len: Math.round(c.seconds * SR) }));
  for (const { notes, len } of chordSpecs) {
    const end = Math.min(total, t + len + Math.round(5 * SR)); // overlap for crossfade
    for (let i = t; i < end; i++) {
      const tt = (i - t) / SR;
      const env = envAt(tt, len / SR, 5, 5);
      if (env <= 0.001) continue;
      const secs = i / SR;
      const wob = 0.09 * Math.sin(2 * Math.PI * 0.05 * secs);
      let s = 0;
      for (const midi of notes) {
        const f = midiToFreq(midi);
        const ph = 2 * Math.PI * f * secs;
        s += Math.sin(ph) * (1 + wob);
        s += Math.sin(ph * 1.003 + 1.7) * 0.55; // detuned layer for thickness
        s += Math.sin(ph * 2 + 0.9) * 0.14; // octave shimmer
      }
      out[i] += (s / (notes.length * 1.55)) * env * padLevel;
    }
    t += len;
  }

  // ---- slow sub drone ----
  if (opts.subNotes) {
    for (let i = 0; i < total; i++) {
      const secs = i / SR;
      const env = envAt(secs, durationSec, 8, 10);
      let s = 0;
      for (const midi of opts.subNotes) {
        s += Math.sin(2 * Math.PI * midiToFreq(midi) * secs);
      }
      out[i] += (s / opts.subNotes.length) * env * subLevel;
    }
  }

  // ---- filtered noise bed (waves / air) ----
  if (noiseLevel > 0) {
    const lp = makeLP();
    const lp2 = makeLP();
    const lp3 = makeLP();
    for (let i = 0; i < total; i++) {
      const secs = i / SR;
      const n = Math.random() * 2 - 1;
      const swellA = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.07 * secs + 1.2);
      const swellB = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.043 * secs + 3.8);
      const cutoffA = 420 + 260 * Math.sin(2 * Math.PI * 0.05 * secs);
      const cutoffB = 1100 + 500 * Math.sin(2 * Math.PI * 0.031 * secs + 2);
      const y = lp(n, cutoffA) * swellA + lp2(n, cutoffB * 0.5, cutoffB) * 0.5 * swellB + lp3(n, 180) * 0.35;
      out[i] += y * noiseLevel * 0.55;
    }
  }

  // ---- sparkle (for night sky tracks) ----
  if (sparkleLevel > 0) {
    const rng = mulberry32(42);
    for (let s = 2; s < durationSec - 6; s += 0.4) {
      if (rng() < 0.16) {
        const midi = 84 + Math.floor(rng() * 12);
        const f = midiToFreq(midi);
        const start = Math.round(s * SR);
        const len = Math.round(2.5 * SR);
        for (let i = 0; i < len && start + i < total; i++) {
          const secs = i / SR;
          const env = Math.exp(-secs * 1.6) * smooth(Math.min(1, secs / 0.02));
          out[start + i] += Math.sin(2 * Math.PI * f * secs) * env * sparkleLevel;
        }
      }
    }
  }

  // ---- master fades + normalize ----
  const fadeIn = Math.round(5 * SR);
  const fadeOut = Math.round(9 * SR);
  let peak = 0;
  for (let i = 0; i < total; i++) {
    const fIn = Math.min(1, i / fadeIn);
    const fOut = Math.min(1, (total - i) / fadeOut);
    out[i] *= Math.min(fIn, fOut);
    const a = Math.abs(out[i]);
    if (a > peak) peak = a;
  }
  const gain = peak > 0 ? 0.85 / peak : 1;
  for (let i = 0; i < total; i++) out[i] *= gain;

  writeWav(path.join(OUT, `${name}.wav`), out);
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

fs.mkdirSync(OUT, { recursive: true });
console.log('Generating seed audio…');

makeTrack('moonlit-waves', 120, [
  { notes: [60, 64, 67, 71, 74], seconds: 120 }, // Cmaj9
], { subNotes: [36, 43], subLevel: 0.12, noiseLevel: 0.16, padLevel: 0.24 });

makeTrack('forest-breeze', 132, [
  { notes: [55, 59, 62, 67, 71, 74], seconds: 30 }, // G(add9)
  { notes: [52, 55, 59, 64, 67, 71], seconds: 30 }, // Em7
  { notes: [48, 55, 60, 64, 67, 72], seconds: 30 }, // Cmaj
  { notes: [50, 57, 62, 66, 69, 74], seconds: 30 }, // D(add9)
], { subNotes: [43], noiseLevel: 0.08, padLevel: 0.30 });

makeTrack('starlight-drift', 100, [
  { notes: [57, 60, 64, 67, 71, 76], seconds: 100 }, // Am9-ish
], { subNotes: [45, 52], noiseLevel: 0.03, padLevel: 0.22, sparkleLevel: 0.055 });

console.log('Done.');
