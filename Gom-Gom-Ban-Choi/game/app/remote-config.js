// Tải config từ Firebase Remote Config TRƯỚC khi nạp game (main.js gọi rồi mới import start.js).
// Kết quả đặt vào globalThis.__GAME_CONFIG__ = { TÊN: giá trị }; economy.mjs / tuning.mjs đọc qua remote() (core/remote-config.mjs).
// - Mỗi tham số trên Firebase: tên = tên hằng số trong code, kiểu JSON / Number / Boolean (template: npm run firebase:template).
// - Lần mở trước tải được thì lưu lại trong máy: lần sau mạng chậm / mất mạng vẫn dùng bản đó; chưa có thì dùng mặc định trong code.
import { FIREBASE_CONFIG, FETCH_INTERVAL_MS, FETCH_TIMEOUT_MS } from '../config/firebase-config.js';

const CACHE_KEY = 'gomgom-remote-config';
const ID_KEY = 'gomgom-remote-config-id';
const dev = ['localhost', '127.0.0.1'].includes(location.hostname) || new URLSearchParams(location.search).has('dev');

// Cache = { at: lúc tải, values }; bản lưu kiểu cũ (chỉ có values) coi như đã hết hạn.
const readCache = () => { try { const c = JSON.parse(localStorage.getItem(CACHE_KEY)); return c?.values ? c : c ? { at: 0, values: c } : null; } catch { return null; } };
const writeCache = values => { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), values })); } catch { /* hết chỗ / chặn storage */ } };

function instanceId() {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) localStorage.setItem(ID_KEY, (id = crypto.randomUUID?.() || String(Math.random()).slice(2)));
    return id;
  } catch { return 'no-storage'; }
}

// Giá trị Remote Config (chuỗi) -> giá trị JS: JSON / số / true-false, còn lại giữ chuỗi.
function parse(text) {
  try { return JSON.parse(text); } catch { return text; }
}

// Gọi thẳng REST API của Remote Config thay cho Firebase JS SDK: SDK cần IndexedDB + origin http(s) + nạp module từ CDN,
// nên hỏng khi mở file HTML trên điện thoại (file://). fetch thường chạy được ở mọi nơi.
async function fetchRemote(signal) {
  const { apiKey, appId, messagingSenderId } = FIREBASE_CONFIG;
  const url = `https://firebaseremoteconfig.googleapis.com/v1/projects/${messagingSenderId}/namespaces/firebase:fetch?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_instance_id: instanceId() }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const { entries = {} } = await response.json();
  return Object.fromEntries(Object.entries(entries).map(([name, value]) => [name, parse(value)]));
}

export async function loadRemoteConfig() {
  globalThis.__GAME_CONFIG__ = {};
  if (!FIREBASE_CONFIG) return { source: 'code' }; // tắt Firebase: chỉ dùng số trong code (bỏ qua bản lưu cũ)
  const cached = readCache();
  globalThis.__GAME_CONFIG__ = cached?.values || {};
  if (cached && !dev && Date.now() - cached.at < FETCH_INTERVAL_MS) return { source: 'cache' }; // mới tải trong giờ qua
  try {
    const values = await fetchRemote(AbortSignal.timeout(FETCH_TIMEOUT_MS));
    globalThis.__GAME_CONFIG__ = values;
    writeCache(values);
    return { source: 'firebase', count: Object.keys(values).length };
  } catch (error) {
    console.warn('[remote-config] không tải được Firebase, dùng', cached ? 'bản đã lưu' : 'mặc định trong code', error);
    return { source: cached ? 'cache' : 'code' };
  }
}
