// Cài đặt: popup (Home / Restart khi đang trong màn), âm thanh, nhạc, ngày / đêm, các tuỳ chọn khác.
// Sang Unity: SettingsPanel (MonoBehaviour).
import * as ob from '../app/onboarding.js';
import { playSound, soundOn, setSound, setMusic } from '../ui/sound.mjs';
import { SAVE_KEYS, readText, writeText } from '../core/save.mjs';
import { $ } from '../app/shared.js';
import { refreshClaimDot } from './map-view.js';
import { refreshDecoDot } from './deco-panel.js';
import { room3d } from './room.js';

// Thanh tab chung hiện ở Home (bản đồ) / Deco / Shop, đánh dấu mục đang mở.
// Home và Deco có nút cài đặt chung (cùng hàng ví); Shop không có (banner gói khởi đầu nằm đúng chỗ đó).
const SETTINGS_TABS = ['home', 'deco', 'shop'];

export function markTab(tab) {
  // Onboarding: tab chưa mở thì ẩn — riêng Shop luôn hiện từ đầu nhưng khoá (mờ, không nhấn được) tới hướng dẫn Decoration.
  $('tabbar').querySelectorAll('.tab').forEach(button => {
    const open = ob.tabOpen(button.dataset.tab), shop = button.dataset.tab === 'shop';
    button.hidden = !open && !shop;
    button.disabled = !open;
    button.classList.toggle('locked', !open);
  });
  $('tabbar').hidden = false;
  $('hub-settings').hidden = !SETTINGS_TABS.includes(tab);
  refreshClaimDot();
  refreshDecoDot();
  $('tabbar').querySelectorAll('.tab').forEach(button => {
    if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

// Nút cài đặt (Home: ngày/đêm, âm thanh, hướng dẫn; màn chơi: âm thanh, hướng dẫn): bánh răng xổ menu.
// Chạm ra ngoài hoặc Esc thì đóng.
function setSettingsOpen(box, open) {
  menuOf(box).hidden = !open;
  box.querySelector('.settings-toggle').setAttribute('aria-expanded', open);
}

// Menu của một nút bánh răng: theo aria-controls (popup Settings ở Home nằm ngoài khối .settings, menu màn chơi nằm trong).
const menuOf = box => document.getElementById(box.querySelector('.settings-toggle').getAttribute('aria-controls'));

const settingsBoxes = [...document.querySelectorAll('.settings')];

export const closeAllSettings = (except = null) => settingsBoxes.forEach(box => { if (box !== except) setSettingsOpen(box, false); });

settingsBoxes.forEach(box => {
  box.querySelector('.settings-toggle').onclick = () => {
    playSound('pick');
    // Mở từ màn chơi: popup hiện thêm hàng Home / Restart
    menuOf(box).classList.toggle('in-game', box.classList.contains('fg-settings'));
    setSettingsOpen(box, menuOf(box).hidden);
  };
});

// Chạm ra ngoài thì đóng; với popup, chạm nền tối (ngoài khung) cũng đóng.
// Bánh răng Home và màn chơi dùng chung một popup: giữ mọi hộp có popup chứa chỗ chạm (không chỉ hộp tìm thấy đầu tiên),
// không thì chạm nút trong popup đang mở từ màn chơi lại đóng nó trước khi nút kịp chạy.
document.addEventListener('pointerdown', event => {
  const inside = box => box.contains(event.target)
    || (menuOf(box).contains(event.target) && !(event.target === menuOf(box) && menuOf(box).classList.contains('settings-modal')));
  const keptMenus = new Set(settingsBoxes.filter(inside).map(menuOf));
  settingsBoxes.forEach(box => { if (!keptMenus.has(menuOf(box))) setSettingsOpen(box, false); });
});

document.querySelectorAll('.settings-close').forEach(button => { button.onclick = () => { playSound('pick'); closeAllSettings(); }; });

document.addEventListener('keydown', event => { if (event.key === 'Escape') closeAllSettings(); });

// Home / Restart trong popup: đóng popup trước, play/result.js hỏi lại rồi rời / chơi lại màn
['open-map', 'restart'].forEach(id => $(id).addEventListener('click', () => closeAllSettings()));

function renderSoundButtons() {
  document.querySelectorAll('.sound-toggle').forEach(button => {
    button.setAttribute('aria-pressed', soundOn());
    button.setAttribute('aria-label', soundOn() ? 'Sound on, tap to mute' : 'Sound off, tap to unmute');
    // Công tắc ON / OFF (popup Settings) hoặc nút icon loa (menu màn chơi).
    if (button.classList.contains('switch')) button.querySelector('b').textContent = soundOn() ? 'ON' : 'OFF';
    else button.innerHTML = `<svg viewBox="0 0 24 24"><use href="#i-${soundOn() ? 'sound' : 'mute'}"/></svg>`;
  });
}

document.querySelectorAll('.sound-toggle').forEach(button => { button.onclick = () => { setSound(!soundOn()); renderSoundButtons(); }; });


// Ánh sáng môi trường cho khu mèo (cảnh 3D ở Deco): Day / Afternoon (dusk) / Night. Lưu lại cho lần sau ('off' = ngày, 'dusk', 'on' = đêm).
const AMBIENTS = { dawn: 'dawn', off: 'day', dusk: 'dusk', on: 'night' };

const AMBIENT_CYCLE = ['dawn', 'day', 'dusk', 'night'];
export let ambient = AMBIENTS[readText(SAVE_KEYS.night)] || 'day';

// Một nút ở Deco (dưới nút Settings): chạm để sang buổi kế (bình minh -> ngày -> chiều -> đêm); biểu tượng đổi theo (#i-sun / #i-sunset / #i-moon).
function applyAmbient() {
  const label = ambient === 'dawn' ? 'Dawn' : ambient === 'dusk' ? 'Afternoon' : ambient === 'night' ? 'Night' : 'Day';
  $('ambient-toggle').dataset.ambient = ambient;
  $('ambient-toggle').title = label;
  $('ambient-toggle').setAttribute('aria-label', `Ambient: ${label}`);
  $('ambient-toggle').querySelector('use')?.setAttribute('href', ambient === 'dusk' || ambient === 'dawn' ? '#i-sunset' : ambient === 'night' ? '#i-moon' : '#i-sun');
  $('deco-room').classList.toggle('night', ambient === 'night');
  $('deco-room').classList.toggle('dusk', ambient === 'dusk');
  $('deco').classList.toggle('night', ambient === 'night'); // nền trời đêm của màn Deco (ui-portrait.css)
  $('deco').classList.toggle('dusk', ambient === 'dusk'); // nền trời chiều
  $('deco-room').classList.toggle('dawn', ambient === 'dawn');
  $('deco').classList.toggle('dawn', ambient === 'dawn');
  room3d?.setAmbient(ambient);
}

$('ambient-toggle').addEventListener('click', () => {
  ambient = AMBIENT_CYCLE[(AMBIENT_CYCLE.indexOf(ambient) + 1) % AMBIENT_CYCLE.length];
  writeText(SAVE_KEYS.night, ambient === 'night' ? 'on' : ambient === 'dusk' || ambient === 'dawn' ? ambient : 'off');
  playSound('pick');
  applyAmbient();
});

// Tự chuyển bình minh -> ngày -> chiều -> đêm, mỗi buổi 1 phút (trời chuyển dần 8 giây); bấm nút thì vòng chạy tiếp từ buổi đã chọn. Không lưu lại.
setInterval(() => {
  ambient = AMBIENT_CYCLE[(AMBIENT_CYCLE.indexOf(ambient) + 1) % AMBIENT_CYCLE.length];
  applyAmbient();
}, 60000);


// Music / Haptic / Notifications: lựa chọn của người chơi (mặc định bật), nhớ qua localStorage. Music bật / tắt nhạc nền (sound.mjs setMusic,
// riêng với Sound = tiếng hiệu ứng); Notifications hiện chỉ lưu lại; Haptic rung nhẹ khi bật (máy có hỗ trợ). Đọc ở nơi khác qua prefOn(name).
const PREF_KEY = name => `gomgom-rotate-pref-${name}`;

export const prefOn = name => readText(PREF_KEY(name)) !== 'off';

function renderPrefs() {
  document.querySelectorAll('.pref-toggle').forEach(button => {
    const on = prefOn(button.dataset.pref);
    button.setAttribute('aria-pressed', on);
    button.setAttribute('aria-label', `${button.dataset.pref}: ${on ? 'on' : 'off'}`);
    button.querySelector('b').textContent = on ? 'ON' : 'OFF';
  });
}

document.querySelectorAll('.pref-toggle').forEach(button => {
  button.onclick = () => {
    const name = button.dataset.pref, on = !prefOn(name);
    writeText(PREF_KEY(name), on ? 'on' : 'off');
    playSound('pick');
    if (name === 'haptic' && on) navigator.vibrate?.(30);
    if (name === 'music') setMusic(on);
    renderPrefs();
  };
});

// Khởi động (menu-controller.js gọi sau khi mọi module menu đã nạp): vẽ công tắc âm thanh, áp ngày / đêm, công tắc tuỳ chọn.
export function startSettings() {
  renderSoundButtons();
  applyAmbient();
  renderPrefs();
}
