// Nhạc nền TẠM (bossa / jazz-pop vui: marimba + e-piano + bass + brush, 118 BPM, swing) + SFX theo mốc sự kiện, tự tổng hợp, không file ngoài.
// node tools/ads/make-music.mjs <out.wav> [events.json]   Thay bằng nhạc thật khi có.
import { readFileSync, writeFileSync } from 'node:fs';

const SR = 44100, DUR = 30, N = SR * DUR, L = new Float32Array(N), R = new Float32Array(N);
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const BPM = 118, BEAT = 60 / BPM, SWING = .62;     // nốt móc thứ hai của mỗi cặp rơi muộn (swing)
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const put = (i, s, pan = 0) => { if (i >= 0 && i < N) { L[i] += s * (1 - Math.max(0, pan)); R[i] += s * (1 + Math.min(0, pan)); } };

function marimba(t0, midi, vel = .5, pan = 0) {
  const f = hz(midi), a = Math.floor(t0 * SR), len = Math.floor(.7 * SR);
  for (let i = 0; i < len; i++) { const t = i / SR, env = Math.exp(-t * 9) * Math.min(1, t * 700);
    put(a + i, (Math.sin(2 * Math.PI * f * t) + .5 * Math.sin(2 * Math.PI * f * 4 * t) * Math.exp(-t * 25)) * env * vel * .4, pan); }
}
function epiano(t0, midi, dur, vel = .3, pan = 0) {   // FM mềm kiểu Rhodes
  const f = hz(midi), a = Math.floor(t0 * SR), len = Math.floor((dur + .3) * SR);
  for (let i = 0; i < len; i++) { const t = i / SR, env = Math.exp(-t * 2.6) * Math.min(1, t * 200) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / .3));
    const mod = Math.sin(2 * Math.PI * f * t) * 1.4 * Math.exp(-t * 6);
    put(a + i, Math.sin(2 * Math.PI * f * t + mod) * env * vel * .35, pan); }
}
function bass(t0, midi, dur = .4, vel = .6) {
  const f = hz(midi), a = Math.floor(t0 * SR), len = Math.floor(dur * SR);
  for (let i = 0; i < len; i++) { const t = i / SR, env = Math.exp(-t * 5) * Math.min(1, t * 400);
    put(a + i, (Math.sin(2 * Math.PI * f * t) + .3 * Math.sin(2 * Math.PI * f * 2 * t)) * env * vel * .55, -.05); }
}
function brush(t0, vel = .12, pan = .25) {
  const a = Math.floor(t0 * SR), len = Math.floor(.09 * SR); let last = 0;
  for (let i = 0; i < len; i++) { const t = i / SR, n = rnd() * 2 - 1, hp = n - last; last = n; put(a + i, hp * Math.exp(-t * 40) * vel, pan); }
}
function snap(t0, vel = .2) {
  const a = Math.floor(t0 * SR), len = Math.floor(.07 * SR);
  for (let i = 0; i < len; i++) { const t = i / SR; put(a + i, (rnd() * 2 - 1) * Math.exp(-t * 90) * vel + Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 120) * vel * .4, -.15); }
}
function kick(t0, vel = .35) {
  const a = Math.floor(t0 * SR), len = Math.floor(.18 * SR); let ph = 0;
  for (let i = 0; i < len; i++) { const t = i / SR; ph += 2 * Math.PI * (52 + 70 * Math.exp(-t * 32)) / SR; put(a + i, Math.sin(ph) * Math.exp(-t * 18) * vel); }
}

// Cmaj7 – A7 – Dm7 – G7 (mỗi hợp âm 2 nhịp), giai điệu marimba nhảy trên thang C major pentatonic + nốt dẫn
const prog = [
  { root: 36, fifth: 43, chord: [60, 64, 67, 71], mel: [79, 84, 83, 79, 76, 79, 81, 79] },
  { root: 33, fifth: 40, chord: [57, 61, 64, 67], mel: [81, 79, 76, 73, 76, 81, 79, 76] },
  { root: 38, fifth: 45, chord: [62, 65, 69, 72], mel: [77, 81, 84, 81, 77, 74, 77, 81] },
  { root: 31, fifth: 38, chord: [59, 62, 65, 67], mel: [79, 77, 74, 71, 74, 77, 79, 83] },
];
const beats = Math.ceil(DUR / BEAT);
for (let beat = 0; beat < beats; beat++) {
  const t = beat * BEAT, c = prog[Math.floor(beat / 2) % 4], inBar = beat % 4, half = beat % 2;
  // nhịp nền: kick nhẹ nhịp 1, snap nhịp 2 & 4, brush swing
  if (inBar === 0) kick(t);
  if (inBar === 1 || inBar === 3) snap(t);
  brush(t, .14); brush(t + BEAT * SWING, .09);
  // bass đi nhịp bossa: gốc – quãng 5
  bass(t, half ? c.fifth : c.root, .36, .6);
  if (half === 0) bass(t + BEAT * SWING, c.root + 12, .2, .3);
  // e-piano: hợp âm gõ lệch (nhịp 1 + "và" của nhịp 2)
  if (half === 0) c.chord.forEach((m, i) => epiano(t + i * .012, m, BEAT * 1.1, .24, (i - 1.5) * .15));
  if (half === 1) c.chord.forEach((m, i) => epiano(t + BEAT * SWING + i * .01, m, BEAT * .5, .17, (i - 1.5) * .15));
  // marimba melody (từ nhịp 4, có câu đáp)
  if (beat >= 4) {
    const k = (beat % 2) * 4;
    [0, 1, 2, 3].forEach(s => { if ((beat + s) % 3 !== 2 || s === 0) marimba(t + (s % 2 ? BEAT * SWING / 2 * (s === 1 ? 1 : 1) : 0) + s * BEAT / 4 * 0, c.mel[k + s] + (beat % 8 >= 4 ? 0 : 0), .5, ((s % 3) - 1) * .3); });
  }
}

// SFX theo sự kiện của kịch bản quay
const events = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : [];
for (const { t, kind } of events) {
  if (kind === 'pop') { const base = 84 + Math.floor(rnd() * 5); marimba(t, base, .8); marimba(t + .06, base + 7, .7, .2); marimba(t + .12, base + 12, .6, -.2); }
  else if (kind === 'unlock') { [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => marimba(t + i * .07, m + 12, .6, (i % 2 - .5) * .5));
    const a = Math.floor(t * SR), len = Math.floor(.5 * SR); let last = 0;
    for (let i = 0; i < len; i++) { const x = i / SR, n = rnd() * 2 - 1; last += (n - last) * (.04 + x * .5); put(a + i, last * Math.sin(Math.PI * x / .5) * .3); } }
  else if (kind === 'buy') { marimba(t, 96, .8, .1); marimba(t + .08, 103, .7, -.1); }
  else if (kind === 'mode') { [67, 72, 76].forEach((m, i) => epiano(t + i * .1, m + 12, .5, .3)); }
}

const fade = t => Math.min(1, t / .05) * (t > DUR - 1.6 ? Math.max(0, (DUR - t) / 1.6) : 1);
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = peak > 0 ? .85 / peak : 1;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const g = fade(i / SR) * norm;
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, Math.tanh(L[i] * g * 1.2))) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, Math.tanh(R[i] * g * 1.2))) * 32767), 46 + i * 4);
}
writeFileSync(process.argv[2] || 'music.wav', buf);
