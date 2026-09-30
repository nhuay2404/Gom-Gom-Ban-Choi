// Âm thanh lấy từ bản gốc Gom Gom (bản solitaire): không dùng file, tạo nốt sine ngắn bằng Web Audio.
//   pick     chạm / nhấc thẻ          390 Hz
//   draw     cất / lấy thẻ gửi tạm    360 -> 420 Hz
//   merge    gom mèo, cao dần theo cỡ cụm: 330 + cỡ × 90 Hz
//   reward   nhận xu / mua đồ          G5 -> C6
//   complete thắng màn                 C5 E5 G5 C6 (rải hợp âm)
// Trình duyệt chỉ cho phát tiếng sau lần chạm đầu tiên; bật/tắt được và lưu lại trong máy.
const KEY = 'gomgom-rotate-sound';
let context = null;
let enabled = true;
try { enabled = localStorage.getItem(KEY) !== 'off'; } catch {}

const NOTES = {
  complete: () => [523.25, 659.25, 783.99, 1046.5],
  reward: () => [783.99, 1046.5],
  merge: size => [330 + size * 90],
  draw: () => [360, 420],
  pick: () => [390],
};

export function playSound(kind, size = 2) {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') context.resume();
    (NOTES[kind] || NOTES.pick)(size).forEach((frequency, i) => {
      const osc = context.createOscillator(), gain = context.createGain(), start = context.currentTime + i * .085;
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(.065, start + .012);
      gain.gain.exponentialRampToValueAtTime(.001, start + .22);
      osc.connect(gain); gain.connect(context.destination);
      osc.start(start); osc.stop(start + .24);
    });
  } catch {}
}

export const soundOn = () => enabled;
export function setSound(on) {
  enabled = on;
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {}
  if (on) playSound('merge'); // như bản gốc: bật lên thì kêu một tiếng để biết
}
