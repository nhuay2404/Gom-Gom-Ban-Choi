// Config từ xa (Firebase Remote Config) — phần thuần dữ liệu, không đụng mạng / DOM.
// Mỗi hằng số config trong economy.mjs / tuning.mjs khai bằng remote('TÊN', giá trị mặc định):
//   - Firebase có tham số cùng TÊN (đúng kiểu) thì dùng giá trị đó, không thì dùng mặc định trong code.
//   - Object: chỉ ghi đè các khoá có trên Firebase (khoá thiếu giữ mặc định), nên trên Firebase chỉ cần để phần muốn đổi.
// Giá trị từ Firebase được app/remote-config.js tải TRƯỚC khi game nạp các module này (đặt vào globalThis.__GAME_CONFIG__).
// Chạy bằng Node (npm test, tools/) thì không có config từ xa: luôn ra mặc định.

// Mọi tham số đã khai: TÊN -> { value (mặc định trong code), description } — tools/firebase-config.mjs đọc để sinh template.
export const REMOTE_DEFAULTS = new Map();
// Tham số nào đang lấy từ Firebase (để log / dev xem).
export const REMOTE_APPLIED = [];

const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const sameKind = (a, b) => (Array.isArray(a) ? Array.isArray(b) : isObject(a) ? isObject(b) : typeof a === typeof b);
function merge(base, over) {
  if (!isObject(base)) return over;
  const out = { ...base };
  for (const [key, value] of Object.entries(over)) {
    if (!(key in base)) out[key] = value; // khoá mới (vd. thêm giá cho một món DECO)
    else if (sameKind(base[key], value)) out[key] = merge(base[key], value);
  }
  return out;
}

export function remote(name, fallback, description = '') {
  if (REMOTE_DEFAULTS.has(name)) throw new Error(`remote(): trùng tên tham số "${name}"`);
  REMOTE_DEFAULTS.set(name, { value: fallback, description });
  const over = globalThis.__GAME_CONFIG__?.[name];
  if (over === undefined) return fallback;
  if (!sameKind(fallback, over)) { console.warn(`[remote-config] bỏ qua ${name}: sai kiểu so với mặc định`); return fallback; }
  REMOTE_APPLIED.push(name);
  return merge(fallback, over);
}
