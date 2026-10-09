// Âm thanh Gom Gom: tổng hợp bằng Web Audio (bản HTML một file vẫn có tiếng, không tốn tải).
// Định hướng: trong trẻo + dễ thương cho người chơi casual — chuông nhỏ (sine + bội âm cao nhẹ), bong bóng "póp" (sine trượt cao độ),
// thang ngũ cung C (C D E G A) nên nốt nào chồng lên nhau cũng thuận tai; không tiếng gắt (không square / không méo), âm lượng nhỏ.
// Tiếng mèo: file thu sẵn người dùng chọn (ui/shared/sfx/cat1-8.mp3, playMeow); không tự tổng hợp tiếng mèo (đã thử, không ưng).
//
//   Giao diện / thao tác
//   pick     chạm nút, chọn            bong bóng "póp" nhỏ đi lên
//   lift     (không dùng: kéo thẻ ra khỏi khung xoay im lặng)
//   rotate   xoay thẻ                  hai tiếng "tinh" rất nhỏ, ngắn, không vang
//   fill     điểm bay vào thanh điểm   chuỗi nốt đi lên, mỗi đốm một nốt
//   place    đặt thẻ (không gom)       "bộp" mềm + chuông trầm
//   invalid  đặt sai chỗ / không được  hai tiếng "bông" trầm, nhẹ (không la mắng)
//   draw     Hold / đổi thẻ            vút lên + chuông
//   smash    búa đập ô                 cốc gỗ + lấp lánh
//   Thưởng
//   merge    gom mèo: chuỗi chuông ngũ cung dài dần theo cỡ cụm (size); cụm ≥ 5 thêm lấp lánh
//   reward   nhận xu / mua đồ          "ting-ting" đồng xu
//   complete thắng màn                 file thu sẵn ui/result/sfx/victory.mp3 (CLIPS; fanfare tổng hợp khi chưa tải xong)
//   lose     thua màn                  "uầy uầy" ba nốt trượt xuống, nốt cuối rung + chuông trầm
//   Mèo (không phải tiếng mèo)
//   pet      vuốt mèo                  hai nốt chuông ngọt đi lên
//   grumpy   mèo cáu                   "bông" trầm ngắn
//   catLift  nhấc mèo 3D ở Deco        bong bóng đi lên       mew  thả mèo ở Deco: "bộp" mềm
//   worried  vừa sắp hết lượt          hai nốt chuông đi xuống, nhỏ
//   (mèo buồn ngủ khi AFK: im lặng)
//   Nhạc nền: ui/shared/sfx/bgm.mp3, lặp bỏ đoạn im lặng cuối file (BGM / startMusic ở cuối file). Độ to mọi file: bảng LEVEL.
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
  rotate: t => { bell(PENTA[5], t, { vol: .03, decay: .07, wet: false }); bell(PENTA[7], t + .04, { vol: .025, decay: .09, wet: false }); },
  place: t => { pop(300, 150, t, { vol: .26, dur: .11 }); noise(t, .05, { vol: .05, freq: 900, q: 2 }); bell(PENTA[0], t + .01, { vol: .06, decay: .25 }); },
  invalid: t => { pop(330, 250, t, { vol: .14, dur: .12, type: 'triangle' }); pop(290, 220, t + .13, { vol: .12, dur: .14, type: 'triangle' }); },
  draw: t => { noise(t, .16, { vol: .07, freq: 700, to: 3000, q: 1.5 }); bell(PENTA[4], t + .1, { vol: .08, decay: .3 }); },
  // Thùng gỗ vỡ: dùng file ui/play/sfx/crate-break.mp3 (CLIPS); đây là tiếng dự phòng lúc chưa tải xong.
  crateBreak: t => { noise(t, .09, { vol: .2, freq: 700, to: 350, q: 2.5, attack: .002 }); pop(240, 100, t, { vol: .22, dur: .12 }); },
  smash: t => { noise(t, .07, { vol: .22, freq: 600, to: 400, q: 3, attack: .002 }); pop(260, 110, t, { vol: .28, dur: .12 });
    arpeggio([PENTA[5], PENTA[7], PENTA[8]], t + .09, .05, { vol: .06, decay: .25 }); },
  merge: (t, size) => {
    // Cụm 3 = 3 nốt, mỗi mèo thêm một nốt cao hơn (tối đa 6); cụm to được thêm lấp lánh
    const n = Math.min(6, Math.max(3, size)), start = Math.min(2, Math.max(0, size - 3));
    arpeggio(PENTA.slice(start, start + n), t, .055, { vol: .12, decay: .45 });
    if (size >= 5) arpeggio([PENTA[6], PENTA[8], PENTA[7], PENTA[8]], t + n * .055, .04, { vol: .045, decay: .3 });
  },
  // Điểm bay vào thanh: mỗi đốm chạm thanh một nốt, thấp -> cao (step = 0..10 trên thang ngũ cung, nốt đầu hạ một quãng tám)
  fill: (t, step) => bell(PENTA[Math.min(10, Math.max(0, Math.round(step)))] / 2, t, { vol: .05, decay: .16, wet: false }),
  reward: t => { bell(PENTA[7], t, { vol: .1, decay: .25 }); bell(PENTA[9], t + .08, { vol: .1, decay: .45 }); },
  complete: t => {
    arpeggio([PENTA[0], PENTA[2], PENTA[3], PENTA[5]], t, .1, { vol: .14, decay: .5 });
    arpeggio([PENTA[6], PENTA[7], PENTA[8]], t + .45, .07, { vol: .07, decay: .6 });
    bell(PENTA[5] / 2, t + .4, { vol: .1, decay: .9 });
  },
  // Thua: "uầy uầy" buồn mà vẫn dễ thương — ba nốt trượt xuống (triangle mềm), nốt cuối kéo dài rung nhẹ, chuông trầm khép lại.
  lose: t => {
    [[523.25, 493.88, 0, .26], [466.16, 440, .3, .26], [415.3, 349.23, .6, .7]].forEach(([from, to, at, dur]) => {
      const g = ctx.createGain(), osc = voice('triangle', from, t + at, t + at + dur), lfo = voice('sine', 6, t + at, t + at + dur), wob = ctx.createGain();
      osc.frequency.exponentialRampToValueAtTime(to, t + at + dur * .9);
      wob.gain.value = at > .5 ? 7 : 0; lfo.connect(wob); wob.connect(osc.frequency);
      envelope(g, t + at, .16, .02, dur);
      osc.connect(g); g.connect(out); g.connect(echo);
    });
    bell(PENTA[0] / 2, t + 1.1, { vol: .07, decay: .8 });
  },
  pet: t => { bell(PENTA[3], t, { vol: .08, decay: .3 }); bell(PENTA[5], t + .07, { vol: .08, decay: .4 }); },
  grumpy: t => pop(300, 220, t, { vol: .13, dur: .12, type: 'triangle' }),
  catLift: t => pop(420, 980, t, { vol: .16, dur: .1 }),
  mew: t => pop(300, 160, t, { vol: .2, dur: .1 }),
  worried: t => { bell(PENTA[4], t, { vol: .06, decay: .3 }); bell(PENTA[2], t + .12, { vol: .06, decay: .4 }); },
};

// Tiếng thu sẵn (file mp3, ghi đè tiếng tổng hợp cùng tên khi đã tải xong; chưa tải xong thì dùng tiếng tổng hợp).
// Bản HTML một file: build-single-html.mjs nhúng đường dẫn ui/<hub>/sfx/*.mp3 thành data URI.
const CLIPS = {
  complete: 'ui/result/sfx/victory.mp3',
  crateBreak: 'ui/play/sfx/crate-break.mp3',
  // Tiếng mèo thu sẵn (gán ở VOICE / playMeow bên dưới)
  cat1: 'ui/shared/sfx/cat1.mp3', cat2: 'ui/shared/sfx/cat2.mp3', cat3: 'ui/shared/sfx/cat3.mp3', cat4: 'ui/shared/sfx/cat4.mp3',
  cat5: 'ui/shared/sfx/cat5.mp3', cat6: 'ui/shared/sfx/cat6.mp3', cat7: 'ui/shared/sfx/cat7.mp3', cat8: 'ui/shared/sfx/cat8.mp3',
}, clipBuffers = {}, CLIP_FADE = .45;
// Cân bằng âm lượng: mỗi file tự đo độ to (RMS phần có tiếng) lúc giải mã rồi phát ở đúng LEVEL (độ to đích, cùng thang với
// chuông tổng hợp ~.04), nên file thu to / nhỏ khác nhau (thùng vỡ gốc nhỏ hơn tiếng mèo ~5 lần) vẫn ra đều tai.
// Muốn tiếng nào to / nhỏ hơn thì chỉnh LEVEL, đừng chỉnh file.
const LEVEL = { complete: .075, crateBreak: .06, call: .045, hover: .038, grumpy: .04, chorus: .032, bgm: .026 };
const clipRms = {};
function measure(buffer) {
  const data = buffer.getChannelData(0), step = Math.round(buffer.sampleRate * .05), frames = [];
  for (let s = 0; s + step <= data.length; s += step) { let e = 0; for (let k = s; k < s + step; k += 4) e += data[k] * data[k]; frames.push(e / (step / 4)); }
  const peak = Math.max(...frames), loud = frames.filter(e => e > peak * .01);
  return Math.sqrt(loud.reduce((sum, e) => sum + e, 0) / loud.length) || 1;
}
let clipsLoading = false;
function loadClips() {
  if (clipsLoading) return;
  clipsLoading = true;
  Object.entries(CLIPS).forEach(([kind, url]) => fetch(url).then(r => r.arrayBuffer()).then(data => ctx.decodeAudioData(data))
    .then(buffer => { clipRms[kind] = measure(buffer); clipBuffers[kind] = buffer; }).catch(() => {}));
}
// level: độ to đích (LEVEL) — tự quy ra hệ số khuếch đại theo độ to thật của file.
function playClip(kind, t, { fade = CLIP_FADE, level = .05, rate = 1 } = {}) {
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = clipBuffers[kind]; src.playbackRate.value = rate;
  // Fade in (không bật phụt lên).
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.min(2, level / (clipRms[kind] || .2)), t + fade);
  src.connect(g); g.connect(ctx.destination);
  src.start(t);
}

export function playSound(kind, size = 2) {
  if (!enabled) return;
  try {
    audio();
    loadClips();
    // Tiếng thắng fade in chậm (CLIP_FADE); tiếng khác (thùng vỡ...) vào ngay.
    if (kind === 'complete' || kind === 'lose') duckMusic(kind === 'complete' ? 4.2 : 2.5);
    if (clipBuffers[kind]) return playClip(kind, ctx.currentTime + .005, { fade: kind === 'complete' ? CLIP_FADE : .005, level: LEVEL[kind] });
    (SOUNDS[kind] || SOUNDS.pick)(ctx.currentTime + .005, size);
  } catch {}
}

// ===== Tiếng mèo =====
// Phân tích 8 file (cao độ / độ dài): cat1 ~850-950 Hz ngọt, lên rồi xuống nhẹ (.76 s) · cat2 "mrrp!" ngắn, vút lên ~1100 Hz (.48 s) ·
// cat3 ngắn, trượt xuống 620 -> 450 Hz (.36 s, nghe phụng phịu) · cat4 cao ~1000 Hz, ngắn (.56 s) · cat5 trầm ~550 Hz, đều (.82 s) ·
// cat6 trung ~600 Hz, đều (.6 s) · cat7 dài "meeoow" lên rồi xuống ~700 Hz (.96 s) · cat8 cao độ đi lên như hỏi "mrrow?" (.7 s).
// Mỗi giống một giọng gọi riêng hợp tính (VOICE); cáu: cat3 cho mọi giống; ở Deco bị rê chuột qua / nhấc lên lơ lửng: cat8.
const VOICE = { orange: 'cat7', gray: 'cat6', white: 'cat1', tuxedo: 'cat5', siamese: 'cat2', tabby: 'cat4' };
const MEOW_GAP = 350; // ms: chạm dồn dập không chồng tiếng kêu lên nhau
let lastMeow = 0;
// mood: 'call' (được cưng, nhận mèo) | 'grumpy' (cáu) | 'hover' (Deco: rê chuột / nhấc lên). Chưa tải xong file thì dùng chuông cũ.
export function playMeow(breed, mood = 'call') {
  if (!enabled) return;
  try {
    audio();
    loadClips();
    const clip = mood === 'grumpy' ? 'cat3' : mood === 'hover' ? 'cat8' : VOICE[breed] || 'cat6';
    if (!clipBuffers[clip]) return playSound(mood === 'grumpy' ? 'grumpy' : mood === 'hover' ? 'catLift' : 'pet');
    const now = performance.now();
    if (now - lastMeow < MEOW_GAP) return;
    lastMeow = now;
    // Lệch cao độ chút ít mỗi lần cho đỡ lặp.
    playClip(clip, ctx.currentTime + .005, { fade: .015, level: LEVEL[mood] ?? LEVEL.call, rate: .95 + Math.random() * .1 });
  } catch {}
}

// Gom (match): cả bàn mèo vui kêu chồng lên nhau — mỗi giống trong `breeds` một tiếng (tối đa CHORUS_MAX), lệch nhịp,
// nhỏ tiếng (không át tiếng chuông gom). Không tính vào MEOW_GAP của tiếng chạm mèo.
const CHORUS_MAX = 4;
export function playMeowChorus(breeds) {
  if (!enabled || !breeds?.length) return;
  try {
    audio();
    loadClips();
    const voices = [...new Set(breeds)].sort(() => Math.random() - .5).slice(0, CHORUS_MAX);
    voices.forEach((breed, k) => {
      const clip = VOICE[breed] || 'cat6';
      if (clipBuffers[clip]) playClip(clip, ctx.currentTime + .05 + k * (.07 + Math.random() * .08), { fade: .02, level: LEVEL.chorus / Math.sqrt(voices.length), rate: .97 + Math.random() * .12 });
    });
  } catch {}
}

// ===== Nhạc nền (BGM) =====
// "Bassa Island Game Loop" (Kevin MacLeod, file 32.8 s): nhạc dứt ở ~30.47 s, sau đó chỉ còn đuôi vang tắt dần + ~1.8 s im lặng.
// Không cắt file: mỗi vòng phát từ BGM.start, vòng sau bắt đầu đúng sau BGM.loop giây (bỏ khoảng im lặng); đuôi vang của vòng trước
// vẫn ngân chồng sang đầu vòng sau nên chỗ nối liền mạch. Bật / tắt riêng bằng công tắc Music (Settings), độc lập với Sound (tiếng hiệu ứng);
// tự bật từ lần chạm đầu tiên (trình duyệt chặn tự phát).
const MUSIC_KEY = 'gomgom-rotate-pref-music'; // cùng khoá với công tắc Music (menu-controller.js prefOn)
let musicEnabled = readText(MUSIC_KEY) !== 'off';
const BGM = { url: 'ui/shared/sfx/bgm.mp3', start: .01, loop: 30.46, fadeIn: 2.5 };
let bgmBuffer = null, bgmGain = null, bgmTimer = 0, bgmNext = 0, bgmLoading = false, bgmSources = [];
const bgmLevel = () => Math.min(1, LEVEL.bgm / (clipRms.bgm || .19));
function startMusic() {
  if (!musicEnabled || bgmTimer) return;
  if (!bgmBuffer) {
    if (bgmLoading) return;
    bgmLoading = true;
    fetch(BGM.url).then(r => r.arrayBuffer()).then(data => ctx.decodeAudioData(data))
      .then(buffer => { clipRms.bgm = measure(buffer); bgmBuffer = buffer; startMusic(); }).catch(() => {});
    return;
  }
  bgmGain ||= ctx.createGain();
  bgmGain.connect(ctx.destination);
  const t = ctx.currentTime;
  bgmGain.gain.cancelScheduledValues(t);
  bgmGain.gain.setValueAtTime(0.0001, t);
  bgmGain.gain.linearRampToValueAtTime(bgmLevel(), t + BGM.fadeIn);
  bgmNext = t + .05;
  queueMusic();
}
// Lên lịch trước ~3 s các vòng sắp tới (đặt giờ chính xác theo đồng hồ âm thanh, không lệch nhịp như setInterval).
function queueMusic() {
  while (bgmNext < ctx.currentTime + 3) {
    const src = ctx.createBufferSource();
    src.buffer = bgmBuffer; src.connect(bgmGain); src.start(bgmNext, BGM.start);
    bgmSources.push(src);
    src.onended = () => { bgmSources = bgmSources.filter(other => other !== src); };
    bgmNext += BGM.loop - BGM.start;
  }
  bgmTimer = setTimeout(queueMusic, 1000);
}
function stopMusic() {
  clearTimeout(bgmTimer); bgmTimer = 0;
  if (!bgmGain) return;
  const t = ctx.currentTime;
  bgmGain.gain.cancelScheduledValues(t);
  bgmGain.gain.setValueAtTime(bgmGain.gain.value, t);
  bgmGain.gain.linearRampToValueAtTime(0.0001, t + .4);
  bgmSources.forEach(src => { try { src.stop(t + .45); } catch {} });
  bgmSources = [];
}
// Nhạc nhỏ đi khi phát tiếng thắng / thua rồi lên lại, để tiếng kết quả rõ.
function duckMusic(seconds) {
  if (!bgmGain || !bgmTimer) return;
  const t = ctx.currentTime, full = bgmLevel();
  bgmGain.gain.cancelScheduledValues(t);
  bgmGain.gain.setValueAtTime(bgmGain.gain.value, t);
  bgmGain.gain.linearRampToValueAtTime(full * .25, t + .25);
  bgmGain.gain.setValueAtTime(full * .25, t + seconds);
  bgmGain.gain.linearRampToValueAtTime(full, t + seconds + 1.5);
}
// Lần chạm đầu tiên mở khoá âm thanh + bật nhạc; ẩn tab thì tạm dừng mọi tiếng.
addEventListener('pointerdown', () => { if (enabled || musicEnabled) { try { audio(); startMusic(); } catch {} } }, { once: true, capture: true });
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend();
  else if (enabled || musicEnabled) ctx.resume();
});

export const soundOn = () => enabled;
export function setSound(on) {
  enabled = on;
  writeText(SAVE_KEYS.sound, on ? 'on' : 'off');
  if (on) playSound('merge', 3); // bật lên thì kêu một tiếng để biết
}
// Nhạc nền: bật / tắt riêng, không ảnh hưởng tiếng hiệu ứng.
export const musicOn = () => musicEnabled;
export function setMusic(on) {
  musicEnabled = on;
  writeText(MUSIC_KEY, on ? 'on' : 'off');
  try { if (on) { audio(); startMusic(); } else if (ctx) stopMusic(); } catch {}
}
