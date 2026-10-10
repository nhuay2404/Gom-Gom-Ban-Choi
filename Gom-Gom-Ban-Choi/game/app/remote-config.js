// Tải config từ Firebase Remote Config TRƯỚC khi nạp game (main.js gọi rồi mới import start.js).
// Kết quả đặt vào globalThis.__GAME_CONFIG__ = { TÊN: giá trị }; economy.mjs / tuning.mjs đọc qua remote() (gameplay/remote-config.mjs).
// - Mỗi tham số trên Firebase: tên = tên hằng số trong code, kiểu JSON / Number / Boolean (template: npm run firebase:template).
// - Lần mở trước tải được thì lưu lại trong máy: lần sau mạng chậm / mất mạng vẫn dùng bản đó; chưa có thì dùng mặc định trong code.
import { FIREBASE_CONFIG, FETCH_INTERVAL_MS, FETCH_TIMEOUT_MS } from '../config/firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const CACHE_KEY = 'gomgom-remote-config';
const dev = ['localhost', '127.0.0.1'].includes(location.hostname) || new URLSearchParams(location.search).has('dev');

const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || null; } catch { return null; } };
const writeCache = values => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(values)); } catch { /* hết chỗ / chặn storage */ } };

// Giá trị Remote Config (chuỗi) -> giá trị JS: JSON / số / true-false, còn lại giữ chuỗi.
function parse(text) {
  try { return JSON.parse(text); } catch { return text; }
}

async function fetchRemote() {
  // Đường dẫn ghép chuỗi: bundler (build:html) không gộp SDK vào bản build, vẫn nạp từ CDN lúc chạy.
  const [{ initializeApp }, rc] = await Promise.all([import(/* @vite-ignore */ `${SDK}firebase-app.js`), import(/* @vite-ignore */ `${SDK}firebase-remote-config.js`)]);
  const remoteConfig = rc.getRemoteConfig(initializeApp(FIREBASE_CONFIG));
  remoteConfig.settings.minimumFetchIntervalMillis = dev ? 0 : FETCH_INTERVAL_MS;
  remoteConfig.settings.fetchTimeoutMillis = FETCH_TIMEOUT_MS;
  await rc.fetchAndActivate(remoteConfig);
  const values = {};
  for (const [name, value] of Object.entries(rc.getAll(remoteConfig))) if (value.getSource() === 'remote') values[name] = parse(value.asString());
  return values;
}

export async function loadRemoteConfig() {
  globalThis.__GAME_CONFIG__ = {};
  if (!FIREBASE_CONFIG) return { source: 'code' }; // tắt Firebase: chỉ dùng số trong code (bỏ qua bản lưu cũ)
  const cached = readCache();
  globalThis.__GAME_CONFIG__ = cached || {};
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), FETCH_TIMEOUT_MS));
    const values = await Promise.race([fetchRemote(), timeout]);
    globalThis.__GAME_CONFIG__ = values;
    writeCache(values);
    return { source: 'firebase', count: Object.keys(values).length };
  } catch (error) {
    console.warn('[remote-config] không tải được Firebase, dùng', cached ? 'bản đã lưu' : 'mặc định trong code', error);
    return { source: cached ? 'cache' : 'code' };
  }
}
