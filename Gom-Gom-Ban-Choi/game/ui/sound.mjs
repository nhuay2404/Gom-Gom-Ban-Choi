// Âm thanh Gom Gom: không dùng file, tổng hợp bằng Web Audio (bản HTML một file vẫn có tiếng, không tốn tải).
// Định hướng: trong trẻo + dễ thương cho người chơi casual — chuông nhỏ (sine + bội âm cao nhẹ), bong bóng "póp" (sine trượt cao độ),
// thang ngũ cung C (C D E G A) nên nốt nào chồng lên nhau cũng thuận tai; không tiếng gắt (không square / không méo), âm lượng nhỏ.
// Không có tiếng mèo (đã thử tổng hợp + ghi âm thật, người dùng không ưng): việc của mèo dùng chuông / bong bóng nhẹ.
//
//   Giao diện / thao tác
//   pick     chạm nút, chọn            bong bóng "póp" nhỏ đi lên
//   lift     nhấc thẻ ra khỏi khay     bong bóng + chuông nhỏ
//   rotate   xoay thẻ                  hai tiếng "tinh" thuỷ tinh
//   place    đặt thẻ (không gom)       "bộp" mềm + chuông trầm
//   invalid  đặt sai chỗ / không được  hai tiếng "bông" trầm, nhẹ (không la mắng)
//   draw     Hold / đổi thẻ            vút lên + chuông
//   smash    búa đập ô                 cốc gỗ + lấp lánh
//   Thưởng
//   merge    gom mèo: chuỗi chuông ngũ cung dài dần theo cỡ cụm (size); cụm ≥ 5 thêm lấp lánh
//   reward   nhận xu / mua đồ          "ting-ting" đồng xu
//   complete thắng màn                 khúc fanfare nhỏ
//   lose     thua màn                  nốt đi xuống chậm
//   Mèo (không phải tiếng mèo)
//   pet      vuốt mèo                  hai nốt chuông ngọt đi lên
//   grumpy   mèo cáu                   "bông" trầm ngắn
//   catLift  nhấc mèo 3D ở Deco        bong bóng đi lên       mew  thả mèo ở Deco: "bộp" mềm
//   worried  vừa sắp hết lượt          hai nốt chuông đi xuống, nhỏ
//   (mèo buồn ngủ khi AFK: im lặng)
// Trình duyệt chỉ cho phát tiếng sau lần chạm đầu tiên; bật/tắt được và lưu lại trong máy.
import { SAVE_KEYS, readText, writeText } from '../gameplay/save.mjs';
let ctx = null, out = null, echo = null;
let enabled = readText(SAVE_KEYS.sound) !== 'off';

// Thang ngũ cung C trưởng, từ C5 trở lên (Hz)
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    // Tổng: nén nhẹ (nhiều tiếng chồng không vỡ) -> loa. Nhánh "echo" ngắn, lọc bớt cao cho chuông có độ vang lấp lánh.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .18;
    out = ctx.createGain(); out.gain.value = .55;
    out.connect(comp); comp.connect(ctx.destination);
    echo = ctx.createGain(); echo.gain.value = .22;
    const delay = ctx.createDelay(1), feedback = ctx.createGain(), tone = ctx.createBiquadFilter();
    delay.delayTime.value = .13; feedback.gain.value = .28; tone.type = 'lowpass'; tone.frequency.value = 3200;
    echo.connect(delay); delay.connect(tone); tone.connect(feedback); feedback.connect(delay); tone.connect(out);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Đường bao âm lượng: lên nhanh, tắt dần theo hàm mũ
function envelope(gain, t, peak, attack, decay) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}
function voice(type, frequency, t, end) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t);
  osc.start(t); osc.stop(end + .02);
  return osc;
}

// Chuông nhỏ trong trẻo: sine gốc + bội 2 (nhẹ) + bội 3.98 (rất nhẹ, tắt nhanh) như glockenspiel đồ chơi
function bell(frequency, t, { vol = .16, decay = .5, wet = true } = {}) {
  [[1, 1, decay], [2, .28, decay * .6], [3.98, .1, decay * .25]].forEach(([ratio, level, d]) => {
    const g = ctx.createGain();
    envelope(g, t, vol * level, .004, d);
    voice('sine', frequency * ratio, t, t + d + .01).connect(g);
    g.connect(out);
    if (wet) g.connect(echo);
  });
}
// Bong bóng "póp": sine trượt cao độ nhanh
function pop(from, to, t, { vol = .2, dur = .09, type = 'sine' } = {}) {
  const g = ctx.createGain(), osc = voice(type, from, t, t + dur);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur * .8);
  envelope(g, t, vol, .006, dur);
  osc.connect(g); g.connect(out);
}
// Nhiễu trắng qua lọc dải (vút / cốc gỗ / rừ rừ)
let noiseBuffer = null;
function noise(t, dur, { vol = .1, freq = 1200, to = freq, q = 1.2, attack = .01 } = {}) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuffer;
  filter.type = 'bandpass'; filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, t); filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  envelope(g, t, vol, attack, dur);
  src.connect(filter); filter.connect(g); g.connect(out);
  src.start(t); src.stop(t + attack + dur + .02);
  return g;
}

// ===== Bảng tiếng =====
const arpeggio = (notes, t, step, opts) => notes.forEach((frequency, i) => bell(frequency, t + i * step, opts));
const SOUNDS = {
  pick: t => pop(480, 900, t, { vol: .16, dur: .08 }),
  lift: t => { pop(420, 980, t, { vol: .17, dur: .1 }); bell(PENTA[5], t + .04, { vol: .05, decay: .2 }); },
  rotate: t => { bell(PENTA[5], t, { vol: .07, decay: .14 }); bell(PENTA[7], t + .055, { vol: .06, decay: .18 }); },
  place: t => { pop(300, 150, t, { vol: .26, dur: .11 }); noise(t, .05, { vol: .05, freq: 900, q: 2 }); bell(PENTA[0], t + .01, { vol: .06, decay: .25 }); },
  invalid: t => { pop(330, 250, t, { vol: .14, dur: .12, type: 'triangle' }); pop(290, 220, t + .13, { vol: .12, dur: .14, type: 'triangle' }); },
  draw: t => { noise(t, .16, { vol: .07, freq: 700, to: 3000, q: 1.5 }); bell(PENTA[4], t + .1, { vol: .08, decay: .3 }); },
  smash: t => { noise(t, .07, { vol: .22, freq: 600, to: 400, q: 3, attack: .002 }); pop(260, 110, t, { vol: .28, dur: .12 });
    arpeggio([PENTA[5], PENTA[7], PENTA[8]], t + .09, .05, { vol: .06, decay: .25 }); },
  merge: (t, size) => {
    // Cụm 3 = 3 nốt, mỗi mèo thêm một nốt cao hơn (tối đa 6); cụm to được thêm lấp lánh
    const n = Math.min(6, Math.max(3, size)), start = Math.min(2, Math.max(0, size - 3));
    arpeggio(PENTA.slice(start, start + n), t, .055, { vol: .12, decay: .45 });
    if (size >= 5) arpeggio([PENTA[6], PENTA[8], PENTA[7], PENTA[8]], t + n * .055, .04, { vol: .045, decay: .3 });
  },
  reward: t => { bell(PENTA[7], t, { vol: .1, decay: .25 }); bell(PENTA[9], t + .08, { vol: .1, decay: .45 }); },
  complete: t => {
    arpeggio([PENTA[0], PENTA[2], PENTA[3], PENTA[5]], t, .1, { vol: .14, decay: .5 });
    arpeggio([PENTA[6], PENTA[7], PENTA[8]], t + .45, .07, { vol: .07, decay: .6 });
    bell(PENTA[5] / 2, t + .4, { vol: .1, decay: .9 });
  },
  lose: t => arpeggio([783.99, 659.25, 587.33, 523.25], t, .17, { vol: .1, decay: .55 }),
  pet: t => { bell(PENTA[3], t, { vol: .08, decay: .3 }); bell(PENTA[5], t + .07, { vol: .08, decay: .4 }); },
  grumpy: t => pop(300, 220, t, { vol: .13, dur: .12, type: 'triangle' }),
  catLift: t => pop(420, 980, t, { vol: .16, dur: .1 }),
  mew: t => pop(300, 160, t, { vol: .2, dur: .1 }),
  worried: t => { bell(PENTA[4], t, { vol: .06, decay: .3 }); bell(PENTA[2], t + .12, { vol: .06, decay: .4 }); },
};

export function playSound(kind, size = 2) {
  if (!enabled) return;
  try {
    audio();
    (SOUNDS[kind] || SOUNDS.pick)(ctx.currentTime + .005, size);
  } catch {}
}

export const soundOn = () => enabled;
export function setSound(on) {
  enabled = on;
  writeText(SAVE_KEYS.sound, on ? 'on' : 'off');
  if (on) playSound('merge', 3); // bật lên thì kêu một tiếng để biết
}
