// Bot tự chơi trong game thật (chỉ dev; Level Editor mở game với ?level=N&bot=weak|mid|good): xem bot chơi từng nước ngay trên giao diện.
// Dùng bộ não của tools/levels/bot.mjs (nạp động: game chạy từ máy chủ không phục vụ thư mục tools/ thì bot tắt, game vẫn chạy bình thường).
import { botApi } from '../play/play-controller.js';

const PROFILES = {
  weak: { noise: 90, useHold: true }, mid: { noise: 30, useHold: true }, good: { noise: 1, useHold: true, lookahead: true },
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const STEP_MS = 650;

export async function startBot(profileId) {
  // Xem bot chơi cho gọn: ẩn cột nút dev che màn hình
  document.getElementById('dev-panel')?.style.setProperty('display', 'none', 'important');
  const profile = PROFILES[profileId] || PROFILES.mid;
  let bot;
  try { bot = await import('../../tools/levels/bot.mjs'); } catch { console.warn('[dev-bot] không nạp được tools/levels/bot.mjs: chạy game bằng máy chủ của Level Editor (npm run editor)'); return; }
  const { upcoming } = await import('../core/session.mjs');
  let last = null, attempts = 0;
  for (;;) {
    await wait(STEP_MS);
    const s = botApi.state();
    // Ván mới (đổi màn / chơi lại) thì bỏ hướng dẫn; ván xong thì chờ ván kế.
    if (s !== last) { last = s; botApi.skipTutorial(); }
    // Thua (hết lượt / kẹt) thì để bảng kết quả hiện một chút rồi chơi lại màn; thắng thì dừng ở bảng kết quả.
    if (s?.over && !s.outcome?.win) { await wait(2200); if (botApi.state() === s) { attempts++; console.info(`[dev-bot] thua, chơi lại lần ${attempts + 1}`); botApi.retry(); } continue; }
    if (!s || s.over || s.animating || document.getElementById('map')?.hidden === false) continue;
    const pick = bot.pickMove({ board: s.board, W: s.W, H: s.H, active: s.active, hold: s.hold, next: upcoming(s), useHold: profile.useHold && s.holdOn, noise: profile.noise, lookahead: profile.lookahead, grass: s.grass });
    if (!pick) continue;
    if (pick.hold) { botApi.hold(); await wait(STEP_MS); }
    for (let i = 0; i < pick.rot; i++) { botApi.rotate(); await wait(380); }
    botApi.place(pick.anchor);
  }
}
