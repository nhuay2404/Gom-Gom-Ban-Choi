// Chạm vào một nhiệm vụ ngày / quest chưa xong = đưa người chơi tới đúng chỗ làm được việc đó (menu/daily.js, menu/quests.js).
// Khoá = sự kiện của việc (DAILY_POOL.event / QUEST_TRACKS.event) hoặc kind của chuỗi quest ('level', 'area').
import { $ } from '../app/shared.js';
import * as ob from '../app/onboarding.js';
import { loadProgress, unlockedCount } from '../core/progression.mjs';
import { play } from './context.js';
import { showTab } from './tabs.js';
import { setShopPage } from './shop.js';

const PLAY = ['play', 'match', 'score', 'cleanWin', 'level'];
const DECO = ['build', 'place', 'surface', 'carry', 'view', 'pet', 'idle'];

// Đưa tới chỗ làm; trả về false nếu việc này không có chỗ cụ thể (giữ nguyên popup).
export function goToTask(key) {
  // Vào màn đang mở (màn cao nhất chưa qua), như nút PLAY ở Home.
  if (PLAY.includes(key)) { play.startLevel(unlockedCount(loadProgress()) - 1); return true; }
  // Mở khu: sang Deco rồi mở bảng "Next areas" (menu/areas.js).
  if (key === 'area') { showTab('deco'); setTimeout(() => $('area-next').click(), 400); return true; }
  if (DECO.includes(key)) { showTab('deco'); return true; }
  // Nhận mèo: mèo chờ nhận nằm trên bản đồ màn (Home).
  if (key === 'claimPet') { showTab('home'); return true; }
  // Sưu tầm kiểu đồ: Shop → Decoration (Shop còn khoá trong hướng dẫn tân thủ thì thôi).
  if (key === 'style' && ob.tabOpen('shop')) { showTab('shop'); setShopPage('deco'); return true; }
  return false;
}
