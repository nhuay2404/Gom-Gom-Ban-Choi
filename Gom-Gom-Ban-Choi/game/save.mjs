// Lưu trữ dữ liệu người chơi: MỘT chỗ duy nhất đọc/ghi, mọi module khác đi qua đây.
// Web dùng localStorage. Khi port sang Cocos chỉ cần gọi setStorageBackend(sys.localStorage) lúc khởi động
// (cùng API getItem/setItem/removeItem), key và định dạng giữ nguyên nên đọc được save của bản web.
//
// Cấu trúc save (xem docs/PORTING.md):
//   progress  { stars: number[] }            sao tốt nhất từng màn (chỉ số 0 = màn 1), 0/undefined = chưa qua
//   deco      { coins, cats[], zone, zones: { garden|living: { owned[], placed[], wall, floor } } }
//   sound     'on' | 'off'
export const SAVE_KEYS = {
  progress: 'gomgom-rotate-progress-v1',
  deco: 'gomgom-rotate-deco-v1',
  sound: 'gomgom-rotate-sound',
};

function defaultBackend() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
let backend = defaultBackend();
// Bộ nhớ tạm khi không có lưu trữ (Node, chế độ ẩn danh chặn lưu trữ): game vẫn chạy, chỉ không nhớ lâu.
const memory = new Map();

export function setStorageBackend(next) { backend = next; }

export function readText(key) {
  try { if (backend) return backend.getItem(key); } catch {}
  return memory.has(key) ? memory.get(key) : null;
}
export function writeText(key, value) {
  memory.set(key, value);
  try { backend?.setItem(key, value); } catch {}
}
export function readJSON(key, fallback = null) {
  try {
    const text = readText(key);
    return text == null ? fallback : JSON.parse(text) ?? fallback;
  } catch { return fallback; }
}
export function writeJSON(key, value) { writeText(key, JSON.stringify(value)); }
