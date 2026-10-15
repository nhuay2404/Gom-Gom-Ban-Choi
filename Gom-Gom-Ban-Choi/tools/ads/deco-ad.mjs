// Quay clip quảng cáo 30s "Deco" (9:16, 1080x1920, 60 fps). Chạy: node tools/ads/deco-ad.mjs  (game đang chạy ở :4400)
// Kết quả: <ADS_OUT>/deco-raw.mp4 (chưa nhạc) + events.json (mốc SFX). Ghép nhạc: node tools/ads/finish.mjs
// Kịch bản (màn sạch, gần như không UI):
//   0–3 hook (phòng trống, 1 mèo buồn) -> New friends (pháo giấy) -> New rooms (mở khu thật, liên tục)
//   -> Unlock EVERYTHING (đổ đầy từng phòng) -> Upgrade (đổi kiểu món, có bảng đổi kiểu) -> mèo tương tác
//   -> toàn cảnh đứng yên: Day -> Sunset -> Night chuyển dần -> cả nhà đầy đồ hiện ra cùng lúc -> logo + nút Play Now.
// Chạy một lượt khởi động (không quay) trước để biên dịch shader / dựng sẵn cảnh, rồi reset game và quay lượt thật: bớt khựng.
import { boot, prep, helpers, sleep, encode, hitches } from './lib.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = process.env.ADS_OUT || 'ads-out';
const LOGO = readFileSync(process.env.ADS_LOGO || 'ads-out/logo-cubecat.webp').toString('base64');
mkdirSync(OUT, { recursive: true });
const b = await boot(OUT + '/profile');
const h = helpers(b);

async function run(record) {
  // ---- Chuẩn bị hook: mèo cam duy nhất ngồi buồn giữa phòng khách trống, camera zoom vào mèo ----
  await h.clean(true);
  await h.sad(true);
  await sleep(1500);
  await h.zoom(-700, 1000);
  await sleep(1200);
  for (let i = 0, ok = 0; i < 8 && ok < 2; i++) {   // camera còn trôi quán tính sau khi zoom / kéo: đo lại tới khi đứng yên đúng chỗ
    const c = await h.catPos();
    const dx = 180 - c.sx, dy = 360 - c.sy;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) { ok++; await sleep(500); continue; }
    ok = 0;
    const k = Math.min(1, 220 / Math.hypot(dx, dy));
    await h.drag(50, 250, 50 + dx * k, 250 + dy * k, 500);   // bắt đầu ở vùng trống (khay thẻ phía dưới vẫn chặn chuột dù đã ẩn)
    await sleep(1000);
  }

  const stop = record ? await b.record(OUT + '/frames-deco') : null;
  const T0 = Date.now();
  const now = () => (Date.now() - T0) / 1000;
  const until = async t => { const wait = t * 1000 - (Date.now() - T0); if (wait > 0) await sleep(wait); };
  const events = [];
  const mark = kind => events.push({ t: +now().toFixed(2), kind });
  const ambient = a => b.eval(`document.querySelector('#ambient-toggle [data-ambient=${a}]')?.click()`);
  const openArea = () => { mark('unlock'); return b.eval(`document.getElementById('area-next').click()`); };

  // ================= 0–3: HOOK =================
  h.caption('This kitty has<br>NOTHING to do… 🥺', { top: 12, ms: 2700 });
  await h.zoom(-300, 2700);

  // ================= 3–6.6: NEW FRIENDS (mèo vào từng con, rồi hun / ngủ chung ngay trong cảnh) =================
  await until(3.0);
  h.sad(false);
  h.caption('New friends! 🐾', { top: 12, ms: 3300 });
  await h.zoom(650, 500);   // lùi ra khỏi cú zoom của hook TRƯỚC khi mở bảng Cats (bảng mở thì camera bị khoá)
  const spots = [[-1.2, 1.2], [.2, 1.3], [1.5, .5], [1.5, 1.6], [-.2, -1.2]];
  const breeds = ['gray', 'white', 'tabby', 'siamese', 'tuxedo'];
  await b.eval(`document.querySelector('.deco-side [data-key=cats]').click()`);   // mở bảng Cats (bị ẩn)
  for (let i = 0; i < breeds.length; i++) {
    await until(3.6 + i * 0.4);
    mark('pop');
    h.friend(breeds[i], 'living', ...spots[i]);       // chạy trong trang, không chờ
  }
  await until(5.3);
  await h.closePop();
  await h.doIt('gray', 'boop', 'white');            // cụng mũi, tim bay lên
  await h.doIt('tabby', 'cuddleNap', 'siamese');    // nằm ngủ chung
  await until(6.8);

  // ================= 6.8–9.8: NEW ROOMS (mỗi phòng giữ ~1.5 s cho kịp nhìn) =================
  h.caption('New rooms! 🏠', { top: 12, ms: 3000 });
  h.zoom(600, 400);
  await sleep(450);
  await openArea();            // phòng ngủ mọc lên, camera lướt sang
  await until(8.3);
  await openArea();            // bếp
  await until(9.8);

  // ================= 9.8–14.6: UNLOCK DECOR (mỗi phòng đầy đồ hiện ra cùng lúc, giữ ~1.6 s) =================
  h.caption('Unlock EVERYTHING ✨', { top: 12, ms: 4600 });
  mark('buy'); await h.fill('living', { except: ['lamp'] });   // đèn phòng khách để dành cho cảnh Sunset
  await until(11.4);
  mark('buy'); await h.fill('bedroom');
  await until(13.0);
  mark('buy'); await h.fill('kitchen');
  await until(14.8);        // sau lần mua cuối game bỏ qua cú chạm đổi khu ~2 s: chờ hết rồi mới về phòng khách

  // ================= 14.8–18.8: UPGRADE (đổi kiểu món, hiện bảng đổi kiểu, giữ cảnh sau khi đổi) =================
  h.caption('Upgrade your style! 🌈', { top: 3, ms: 3700 });
  await h.pop(true);
  await h.zone('living');
  await sleep(350);
  h.zoom(-300, 350, 180, 300);   // upgrade() tự kéo camera đưa món vào khung nếu còn lệch
  await sleep(380);
  mark('buy'); await h.upgrade('armchair', 'armchair-papasan', { look: 400 });
  await until(18.6);
  await b.eval(`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);   // pointerdown ngoài bảng = đóng bảng đổi kiểu (bảng mở thì camera bị khoá)
  await sleep(150);
  await h.pop(false);

  // ================= 18.8–30: MỘT CẢNH DUY NHẤT Ở VƯỜN: Day -> Sunset (đèn phòng khách) -> Night (đèn + lửa trại) -> logo =================
  await until(18.8);
  await b.eval(`__fillAll('garden', ['lamp', 'campfire', 'lantern'])`);   // cả nhà + vườn đầy đồ, chừa đèn phòng khách + đèn lồng + lửa trại
  await h.zone('garden');
  h.caption('Day ☀️', { top: 12, ms: 1100 });
  await until(20.6);
  mark('mode'); await ambient('dusk');
  h.caption('Sunset 🌇', { top: 12, ms: 3000 });
  await until(21.4);
  await h.addItems('living', ['lamp']);                                    // đèn phòng khách bật lên (hiện cùng lần dựng lại của món mua kế tiếp)
  mark('buy'); await h.buy('lantern', { look: 300, after: 300, zone: 'garden' });
  await until(23.7);
  mark('mode'); await ambient('night');
  h.caption('Night 🌙', { top: 12, ms: 2600 });
  await until(24.4);
  const camp = await b.eval(`JSON.stringify(__L.PLACES.campfire)`).then(JSON.parse);
  mark('buy'); await h.buy('campfire', { look: 300, after: 300, zone: 'garden' });
  await h.put('gray', 'garden', camp[0] - 1.2, camp[1] + .6); await h.put('white', 'garden', camp[0] + 1.2, camp[1] + .8);
  await h.doIt('gray', 'joinCampfire'); await h.doIt('white', 'joinCampfire');
  await until(26.8);          // giữ nguyên cảnh rồi mới hiện logo
  await h.outro(LOGO);
  await until(30.3);
  if (!record) return null;
  const frames = await stop();
  console.log('frames', frames.length, (frames.at(-1).t - frames[0].t).toFixed(1) + 's');
  const hs = hitches(frames);
  console.log('khung khựng (>34 ms):', hs.length, JSON.stringify(hs.slice(0, 40)));
  writeFileSync(OUT + '/events.json', JSON.stringify(events, null, 1));
  encode(frames, OUT + '/deco-raw.mp4', { to: 30 });
  return frames;
}

console.log('--- lượt khởi động (không quay) ---');
await run(false);
await prep(b);
console.log('--- lượt quay ---');
await run(true);
process.exit(0);
