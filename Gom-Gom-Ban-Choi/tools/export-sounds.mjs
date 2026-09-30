// Tổng hợp âm thanh của game ra file WAV (16-bit mono 44.1 kHz) để dùng trong Cocos (AudioSource).
// Chạy: npm run export:sounds   ->   export/audio/*.wav
// Tiếng giống hệt sound.mjs: nốt sine, cách nhau 85 ms, mỗi nốt vào 12 ms rồi tắt dần tới 220 ms.
// Web phát ở gain 0.065; file xuất ra được chuẩn hoá lên 0.9 cho sạch nhiễu, nên trong Cocos đặt
// volume ≈ 0.072 (= 0.065 / 0.9) để nghe to đúng như bản web (ghi trong export/audio/manifest.json).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'export', 'audio');
const RATE = 44100, GAIN = .065, PEAK = .9, NOTE_GAP = .085, ATTACK = .012, DECAY_END = .22, NOTE_LEN = .24;

// Cùng bảng nốt với sound.mjs. merge có 4 cao độ theo cỡ cụm gom được (3, 4, 5, 6+).
const SOUNDS = {
  pick: [390],
  draw: [360, 420],
  'merge-3': [330 + 3 * 90], 'merge-4': [330 + 4 * 90], 'merge-5': [330 + 5 * 90], 'merge-6': [330 + 6 * 90],
  'merge-toggle': [330 + 2 * 90], // tiếng khi bật lại âm thanh
  reward: [783.99, 1046.5],
  complete: [523.25, 659.25, 783.99, 1046.5],
};

function render(notes) {
  const length = Math.ceil((NOTE_GAP * (notes.length - 1) + NOTE_LEN) * RATE);
  const samples = new Float32Array(length);
  notes.forEach((frequency, i) => {
    const start = i * NOTE_GAP;
    for (let n = 0; n < NOTE_LEN * RATE; n++) {
      const t = n / RATE;
      // bao âm: 0 -> GAIN tuyến tính trong ATTACK, rồi giảm theo hàm mũ tới 0.001 lúc DECAY_END
      const env = t < ATTACK ? GAIN * t / ATTACK : GAIN * Math.pow(.001 / GAIN, Math.min(1, (t - ATTACK) / (DECAY_END - ATTACK)));
      const index = Math.round((start + t) * RATE);
      if (index < length) samples[index] += Math.sin(2 * Math.PI * frequency * t) * env;
    }
  });
  const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  return samples.map(v => v / peak * PEAK);
}
function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

mkdirSync(OUT, { recursive: true });
for (const [name, notes] of Object.entries(SOUNDS)) writeFileSync(join(OUT, `${name}.wav`), wav(render(notes)));
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({
  volume: +(GAIN / PEAK).toFixed(3),
  when: {
    pick: 'nhấc thẻ, xoay thẻ, đặt thẻ không gom, chuyển tab',
    draw: 'cất / lấy thẻ ở ô Hold; thả mèo trong phòng',
    'merge-N': 'gom mèo, N = cỡ cụm lớn nhất (6 dùng cho 6+)',
    reward: 'mua đồ Deco, nhận xu ở màn kết quả',
    complete: 'thắng màn (sau tiếng gom cuối ~380 ms)',
    'merge-toggle': 'bật lại âm thanh',
  },
  files: Object.keys(SOUNDS).map(name => `audio/${name}.wav`),
}, null, 2));
console.log(`Đã xuất ${Object.keys(SOUNDS).length} tiếng vào ${OUT}`);
