// Kết nối Firebase cho Remote Config (xem docs/FIREBASE.md).
// Dán object "firebaseConfig" lấy ở Firebase console → Project settings → General → Your apps → Web app.
// Các khoá này là định danh công khai của web app (không phải mật khẩu), để trong source là bình thường.
// Để null = tắt Firebase: game chạy bằng số mặc định trong code (economy.mjs / tuning.mjs).
// Project "Cozy Cat Cube" (id cozy-cat-match), web app "Cozy Cat Cube".
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC0CsWemf_TChjnuDc2LomhZDJjY_iQ4Zk',
  authDomain: 'cozy-cat-match.firebaseapp.com',
  projectId: 'cozy-cat-match',
  storageBucket: 'cozy-cat-match.firebasestorage.app',
  messagingSenderId: '1012095487000',
  appId: '1:1012095487000:web:69c8165a435a1b4c22c76d',
  measurementId: 'G-EK50WMTWGQ',
};

// Bao lâu mới hỏi lại Firebase (ms). Bản dev (localhost / ?dev) luôn hỏi mỗi lần mở game để thấy số mới ngay.
export const FETCH_INTERVAL_MS = 60 * 60 * 1000;
// Chờ Firebase tối đa bấy lâu lúc mở game; quá giờ thì chạy bằng bản config đã lưu lần trước (hoặc mặc định).
export const FETCH_TIMEOUT_MS = 2500;
