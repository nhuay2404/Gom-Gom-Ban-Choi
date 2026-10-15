// Phần dùng chung cho các kịch bản quay quảng cáo (tools/ads/*.mjs).
// Lưu ý: dò cảnh / ép hành vi mèo dựa vào `globalThis.__DEBUG_SCENE` (deco-room.mjs, đang đánh dấu TEMP-DEBUG).
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { launch, sleep } from './cdp.mjs';

export { sleep };
export const GAME = process.env.GAME_URL || 'http://localhost:4400/?dev';

const CSS = `
  #dev-panel, #toast, .idle-coin, .deco .wallet-hud, .deco-side > button:not(#deco-lock) { display: none !important; }
  #deco-lock { opacity: 0 !important; }
  /* Màn sạch: ẩn mọi UI của game, chỉ còn cảnh 3D (các nút vẫn bấm được bằng .click() từ kịch bản) */
  body.ad-clean .deco-side, body.ad-clean .deco-dock, body.ad-clean #tabbar, body.ad-clean #deco-pins, body.ad-clean #deco-pop,
  body.ad-clean #area-next, body.ad-clean .fg-settings, body.ad-clean .settings, body.ad-clean #deco-zone { opacity: 0 !important; pointer-events: none !important; }
  /* Cảnh nâng cấp: chỉ bảng đổi kiểu món hiện lên */
  body.ad-clean.ad-pop #deco-pop { opacity: 1 !important; pointer-events: auto !important; }
  /* Outro: logo + nút Play Now hiện dần */
  #ad-outro { position: fixed; inset: 0; z-index: 99990; pointer-events: none; opacity: 0; transition: opacity .7s ease;
    background: radial-gradient(ellipse at 50% 45%, rgba(20,12,40,.15), rgba(20,12,40,.55)); }
  #ad-outro.show { opacity: 1; }
  #ad-outro img { position: absolute; top: 9%; left: 50%; width: 90%; transform: translate(-50%, -30px) scale(.8); opacity: 0; filter: drop-shadow(0 6px 0 rgba(90,40,20,.35));
    transition: transform .8s cubic-bezier(.2,1.5,.4,1), opacity .5s ease; }
  #ad-outro.show img { transform: translate(-50%, 0) scale(1); opacity: 1; }
  #ad-outro .cta { position: absolute; left: 50%; bottom: 11%; transform: translate(-50%, 40px) scale(.7); opacity: 0; min-width: 62%; white-space: nowrap; text-align: center; padding: 12px 34px 14px;
    font-family: var(--display, sans-serif); font-weight: 800; font-size: 34px; color: #fff; letter-spacing: .02em; border-radius: 999px;
    background: linear-gradient(#7be07b, #37b34a); border: 5px solid #1f7a2e; box-shadow: 0 8px 0 #1f7a2e, 0 14px 24px rgba(0,0,0,.35);
    -webkit-text-stroke: 6px #1f7a2e; paint-order: stroke fill; text-shadow: 0 3px 0 #1f7a2e; opacity: 0; transition: transform .7s cubic-bezier(.2,1.6,.4,1) .55s, opacity .4s ease .55s; }
  #ad-outro.show .cta { transform: translate(-50%, 0) scale(1); opacity: 1; animation: ad-pulse 1.1s ease-in-out 1.4s infinite; }
  @keyframes ad-pulse { 50% { transform: translate(-50%, 0) scale(1.07); } }
  .ad-confetti { position: fixed; z-index: 99998; pointer-events: none; border-radius: 2px; }
  .ad-cap { position: fixed; left: 50%; z-index: 99999; transform: translateX(-50%) scale(1); width: 92vw; text-align: center; pointer-events: none;
    font-family: var(--display, 'Baloo 2', sans-serif); font-weight: 800; font-size: 31px; line-height: 1.12; color: #fff; letter-spacing: .01em;
    -webkit-text-stroke: 7px #6b2f1c; paint-order: stroke fill; text-shadow: 0 4px 0 #6b2f1c; animation: ad-pop .5s cubic-bezier(.2,1.6,.4,1) both; }
  .ad-cap.out { animation: ad-out .3s ease-in both; }
  @keyframes ad-pop { from { transform: translateX(-50%) scale(.2) rotate(-6deg); opacity: 0 } to { transform: translateX(-50%) scale(1) rotate(0); opacity: 1 } }
  @keyframes ad-out { to { transform: translateX(-50%) scale(.6) translateY(-12px); opacity: 0 } }`;

// Nạp game ở trạng thái người chơi mới + Dev Unlock (99.999 xu, 3 sao mọi màn), bỏ cờ "mở hết khu" để khu mở bằng luồng thật.
export async function prep(b, { zone = 'living', open = ['garden2', 'living'] } = {}) {
  // Xoá save ở một trang CÙNG nguồn nhưng không phải game (game đang mở sẽ ghi lại save của nó khi rời trang)
  await b.goto('about:blank');
  await b.goto(new URL('/ad-reset-blank', GAME).href);
  await b.eval(`localStorage.clear(); localStorage.setItem('gomgom-rotate-deco-tour-v1','done'); localStorage.setItem('gomgom-rotate-onboarding-v1','done')`);
  await b.goto(GAME);
  await sleep(5000);
  await b.eval(`document.getElementById('dev-unlock').click()`);
  await sleep(1200);
  await b.eval(`localStorage.removeItem('gomgom-dev-all-zones')`);
  // Mèo chỉ nhận được qua phần thưởng màn: đánh dấu đã nhận đủ (mèo trong nhà vẫn chỉ có mèo khởi đầu)
  await b.eval(`(() => { const k = 'gomgom-rotate-deco-v1', d = JSON.parse(localStorage.getItem(k)); d.claimedCats = ['orange', 'gray', 'white', 'tabby', 'siamese', 'tuxedo']; d.coins = 5000000; localStorage.setItem(k, JSON.stringify(d)); })()`);
  await b.goto(GAME);
  await sleep(5000);
  await b.eval(`document.head.insertAdjacentHTML('beforeend', ${JSON.stringify(`<style id="ad-style">${CSS}</style>`)})`);
  await b.eval(`document.querySelector('.tab[data-tab=deco]').click()`);
  await sleep(2500);
  // Dựng sẵn model + biên dịch shader mọi món ở mọi khu (game chỉ làm khi khu đó đang hiện): cho xem hết các khu một lượt bằng cờ dev
  // "mở hết khu", chờ lúc rảnh của trình duyệt, rồi tắt cờ để khu mở lại bằng luồng thật. Không làm thì lần đầu mua đồ bị khựng 100–250 ms.
  await b.eval(`localStorage.setItem('gomgom-dev-all-zones','on')`);
  for (const z of ['living', 'bedroom', 'kitchen', 'bathroom', 'backyard', 'kinder', 'garden']) {
    await b.eval(`document.querySelector('#deco-zone [data-zone=${z}]').click()`);
    await sleep(2200);
  }
  await b.eval(`localStorage.removeItem('gomgom-dev-all-zones')`);
  for (const _ of open) { await b.eval(`document.getElementById('area-next').click()`); await sleep(900); }
  if (zone) { await b.eval(`document.querySelector('#deco-zone [data-zone=${zone}]').click()`); await sleep(2500); }
  await probe(b);
}

export async function boot(profile, opts) {
  await launch({ profile, keep: false }).then(b => b.close());
  await sleep(1000);
  if (existsSync(profile)) rmSync(profile, { recursive: true, force: true });
  const b = await launch({ profile, keep: false });
  await prep(b, opts);
  return b;
}

// Bộ dò cảnh: camera, vị trí mèo, dịch / ép hành vi mèo, pháo giấy, chiếu toạ độ 3D -> màn hình
export async function probe(b) {
  await b.eval(`(async () => {
    const T = await import('three'), L = await import('./deco/room-layout.mjs');
    window.__T = T; window.__L = L; window.__cams = new Set();
    for (const k of ['OrthographicCamera', 'PerspectiveCamera']) { const o = T[k].prototype.updateProjectionMatrix; T[k].prototype.updateProjectionMatrix = function () { window.__cams.add(this); return o.call(this); }; }
    // Camera nào được vẽ thì updateMatrixWorld được gọi mỗi khung hình
    const um = T.Camera.prototype.updateMatrixWorld; T.Camera.prototype.updateMatrixWorld = function (f) { window.__cams.add(this); return um.call(this, f); };
  })()`);
  await sleep(500);
  // camera chỉ lộ ra khi game gọi updateProjectionMatrix: ép bằng một lần đổi cỡ khung
  await b.send('Emulation.setDeviceMetricsOverride', { width: 361, height: 640, deviceScaleFactor: 0, mobile: false });
  await sleep(400);
  await b.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 0, mobile: false });
  await sleep(400);
  // Game vào chế độ AFK sau ~5 s không chạm (mèo đi ngủ, UI ngừng nhận bấm): giữ thức bằng pointerup phát ở window (không nổi bọt từ phần tử)
  await b.eval(`clearInterval(window.__keepAwake); window.__keepAwake = setInterval(() => { if (!window.__noKeep) window.dispatchEvent(new PointerEvent('pointerup')); }, 1200); window.dispatchEvent(new PointerEvent('pointerup'))`);
  // Có nhiều camera (xem trước món, QC...): camera chính là camera đổi vị trí / zoom khi cuộn chuột
  const snap = () => b.eval(`JSON.stringify([...__cams].map(c => [c.position.x, c.position.y, c.position.z, c.zoom]))`).then(JSON.parse);
  const before = await snap();
  await b.wheel(180, 330, 90, 6, 120); await sleep(500);
  const after = await snap();
  await b.wheel(180, 330, -90, 6, 120); await sleep(400);
  const idx = after.findIndex((a, i) => a.some((v, k) => Math.abs(v - before[i][k]) > 1e-4));
  console.log('camera chính:', idx, 'trong', before.length);
  await b.eval(`window.__cam = [...__cams][${Math.max(0, idx)}];
    window.__catList = () => { const out = []; __DEBUG_SCENE.traverse(n => { const c = n.userData.cat; if (c && n === c.rig?.root) out.push(c); }); return out; };
    window.__cat = breed => __catList().find(c => c.breed === breed);
    window.__scr = (x, y, z) => { const p = new __T.Vector3(x, y, z).project(__cam); return { sx: Math.round((p.x + 1) / 2 * innerWidth), sy: Math.round((1 - p.y) / 2 * innerHeight) }; };
    window.__cats = () => { const v = new __T.Vector3(); return __catList().map(c => { c.rig.root.getWorldPosition(v);
      return { breed: c.breed, x: +v.x.toFixed(1), z: +v.z.toFixed(1), ...__scr(v.x, v.y, v.z) }; }); };
    window.__catScreen = breed => __cats().find(c => c.breed === breed);
    // Đặt mèo tại (zone, dx, dz) toạ độ khu
    window.__put = (breed, zone, dx, dz) => { const c = __cat(breed); if (!c) return false; const [ox, oz] = __L.ZONE_OFFSET[zone]; c.x = ox + dx; c.z = oz + dz; c.y = __L.groundHeight(zone, dx, dz) || 0; return true; };
    // Cho mèo làm một hành vi rồi trở về cuộc sống thường: __do('gray', 'boop', 'white')
    window.__do = (breed, method, ...args) => { const c = __cat(breed); if (!c) return false;
      const others = args.map(a => typeof a === 'string' ? __cat(a) : a);
      c.interrupt((function* () { yield* c[method](...others); yield* c.life(); })()); return true; };
    window.__furn = (breed, id) => { const c = __cat(breed); if (!c) return false;
      c.interrupt((function* () { yield* c.useFurniture(id); if (c.y > .01) yield* c.getDown(); yield* c.life(); })()); return true; };
    window.__hill = breed => { const c = __cat(breed); if (!c) return false;
      c.interrupt((function* () { yield* c.climbHill(); yield* c.leaveHill(true); yield* c.life(); })()); return true; };
    window.__confetti = (x, y) => { const cols = ['#ff6b9a', '#ffd23f', '#5ad1ff', '#7be07b', '#b48cff', '#ff9a4a'];
      for (let i = 0; i < 52; i++) { const d = document.createElement('div'); d.className = 'ad-confetti';
        const w = 5 + Math.random() * 7, h = w * (.5 + Math.random()), a = (-90 + (Math.random() - .5) * 150) * Math.PI / 180, sp = 150 + Math.random() * 300;
        d.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;background:' + cols[i % cols.length] + (i % 5 === 0 ? ';border-radius:50%' : '');
        document.body.append(d);
        const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp, g = 780, dur = 1100 + Math.random() * 700, spin = (Math.random() - .5) * 900, fr = [];
        for (let k = 0; k <= 10; k++) { const t = k / 10 * dur / 1000; fr.push({ transform: 'translate(' + vx * t + 'px,' + (vy * t + .5 * g * t * t) + 'px) rotate(' + spin * t + 'deg)', opacity: k > 7 ? 1 - (k - 7) / 3 : 1 }); }
        d.animate(fr, { duration: dur, easing: 'linear' }).onfinish = () => d.remove(); } };
    // Các thao tác nhiều bước chạy TRONG trang (một lệnh CDP thay vì chục lệnh; mỗi lệnh CDP trễ ~100 ms lúc đang quay)
    const wait = ms => new Promise(r => setTimeout(r, ms));
    window.__wait = wait;
    window.__friend = async (breed, zone, dx, dz) => {
      const pop = document.getElementById('deco-pop');
      if (pop.hidden) document.querySelector('.deco-side [data-key=cats]').click();
      for (let k = 0; k < 20 && !document.querySelector('#deco-pop-items [data-id=cat-' + breed + ']'); k++) await wait(50);
      document.querySelector('#deco-pop-items [data-id=cat-' + breed + ']').click();
      for (let k = 0; k < 40 && !__put(breed, zone, dx, dz); k++) await wait(30);
      await wait(100);
      const p = __catScreen(breed); if (p) __confetti(p.sx, p.sy - 18); return p;
    };
    window.__buy = async (id, look, after) => {
      let e = null;
      for (let k = 0; k < 40 && !(e = document.querySelector('#deco-cards [data-id=' + id + ']')); k++) await wait(50);
      if (!e) return 'no-card zone=' + document.querySelector('#deco-zone .on')?.dataset.zone + ' pop=' + !document.getElementById('deco-pop').hidden + ' cards=' + [...document.querySelectorAll('#deco-cards [data-id]')].map(c => c.dataset.id).join(','); e.click(); await wait(look);
      const b = document.querySelector('#deco-cards [data-id=' + id + '] [data-act=buy]'); if (!b) return 'no-buy'; b.click(); await wait(after); return 'ok';
    };
    window.__zone = async z => {
      for (let k = 0; k < 20; k++) { document.querySelector('#deco-zone [data-zone=' + z + ']').click(); await wait(150);
        if (document.querySelector('#deco-zone .on')?.dataset.zone === z) return k; }
      return -1;
    };
    // Đồ ĐÃ đặt đầy khu zone trừ một món (trả về id món còn thiếu): sửa save ở trong trang, rồi mua nốt món cuối bằng luồng thẻ thật —
    // lần dựng phòng đó làm cả loạt món hiện ra cùng lúc ("mở khoá hàng loạt")
    window.__fill = async (zone, except = []) => {
      const S = await import('./app/shared.js'), D = await import('./deco/deco-data.mjs');
      const d = S.getDeco(), bases = D.CATALOG.filter(e => e.zone === zone && e.cat === 'furniture' && !e.slot && !except.includes(e.id));
      const left = [...bases].reverse().find(e => e.price > 0 && !(d.zones[zone].placed || []).includes(e.id));
      if (!left) return null;
      const keep = bases.filter(e => e.id !== left.id), z = d.zones[zone], uniq = a => [...new Set(a)];
      S.setDeco({ ...d, zones: { ...d.zones, [zone]: { ...z, owned: uniq([...z.owned, ...keep.map(e => e.id)]), placed: uniq([...z.placed, ...keep.map(e => e.id)]) } } });
      return left.id;
    };
    // Như __fill nhưng cho MỌI khu cùng lúc; chỉ keepZone chừa lại một món để mua nốt (kích hoạt dựng lại toàn cảnh)
    window.__fillAll = async (keepZone, except = []) => {
      const S = await import('./app/shared.js'), D = await import('./deco/deco-data.mjs'), d = S.getDeco(), zones = { ...d.zones }, uniq = a => [...new Set(a)];
      let left = null;
      for (const zone of D.ZONE_IDS) {
        const z = zones[zone]; if (!z) continue;
        let keep = D.CATALOG.filter(e => e.zone === zone && e.cat === 'furniture' && !e.slot && !except.includes(e.id));
        if (zone === keepZone && !except.length) { const l = [...keep].reverse().find(e => e.price > 0 && !z.placed.includes(e.id)); if (l) { left = l.id; keep = keep.filter(e => e.id !== l.id); } }
        zones[zone] = { ...z, owned: uniq([...z.owned, ...keep.map(e => e.id)]), placed: uniq([...z.placed, ...keep.map(e => e.id)]) };
      }
      S.setDeco({ ...d, zones }); return left;
    };
    // Đặt sẵn vài món vào save (chưa dựng lên cảnh: chỉ hiện khi lần dựng phòng kế tiếp chạy, vd. lúc mua một món khác)
    window.__addItems = async (zone, ids) => { const S = await import('./app/shared.js'), d = S.getDeco(), z = d.zones[zone], uniq = a => [...new Set(a)];
      S.setDeco({ ...d, zones: { ...d.zones, [zone]: { ...z, owned: uniq([...z.owned, ...ids]), placed: uniq([...z.placed, ...ids]) } } }); };
    window.__itemWorld = id => { let found = null; __DEBUG_SCENE.traverse(n => { if (!found && n.userData.itemId === id && n.visible) found = n; });
      if (!found) return null; const v = new __T.Vector3(); found.getWorldPosition(v); return { x: v.x, z: v.z }; };
    window.__itemAt = id => { let found = null; __DEBUG_SCENE.traverse(n => { if (!found && n.userData.itemId === id && n.visible) found = n; });
      if (!found) return null; const v = new __T.Vector3(); found.getWorldPosition(v); return __scr(v.x, v.y + .45, v.z); };
    // Trong bảng đổi kiểu món đang mở: chạm kiểu mới (xem thử) rồi chạm nút giá để mua + đặt luôn
    window.__variant = async (vid, look) => {
      let e = null;
      for (let k = 0; k < 40 && !(e = document.querySelector('#deco-pop-items [data-id=' + vid + ']')); k++) await wait(50);
      if (!e) return 'no-variant title=' + document.getElementById('deco-pop-title').textContent + ' items=' + [...document.querySelectorAll('#deco-pop-items > *')].map(x => x.dataset.id).join(',');
      e.click(); await wait(look);
      const price = document.querySelector('#deco-pop-items [data-id=' + vid + '] .deco-opt-price'); if (!price) return 'no-price';
      price.click(); return 'ok';
    };
    // Mèo cam ngồi buồn thiu nhìn camera, mặt 'half' (mắt trĩu; 'grumble' trông giận hơn buồn), cho tới khi __sad(false)
    window.__sad = (on, x, z) => { const c = __cat('orange'); if (!c) return;
      if (!on) { c.held = false; return; }
      c.x = x; c.z = z; c.held = true;
      c.interrupt((function* () { c.release(); c.occupy('tutorial'); try { if (c.y > .01) yield* c.getDown(); c.setPose('sit'); c.face('half');
        while (c.held) { const cam = c.world.cameraPos?.(); if (cam) c.turnToward(c.facing(cam.x, cam.z), 6); c.lookGoal = 0; yield; } } finally { c.release(); c.setPose('stand'); c.face('open'); } yield* c.life(); })()); };`);
}

export const helpers = b => ({
  // Kéo camera (CDP); tạm ngừng pointerup giữ thức vì nó cắt ngang cú kéo giữa chừng
  drag: async (x0, y0, x1, y1, ms) => {
    await b.eval(`window.__noKeep = true`);
    await b.drag(x0, y0, x1, y1, ms);
    await b.eval(`window.__noKeep = false`);
  },
  clean: on => b.eval(`document.body.classList.toggle('ad-clean', ${!!on})`),
  addItems: (zone, ids) => b.eval(`__addItems('${zone}', ${JSON.stringify(ids)})`),
  pop: on => b.eval(`document.body.classList.toggle('ad-pop', ${!!on})`),
  // Đổ đầy một khu (trừ món cuối) rồi mua nốt món cuối: cả khu hiện ra cùng lúc
  // Đổ đầy MỌI khu trừ một món ở `keepZone`, rồi mua nốt món đó: cả ngôi nhà hiện ra cùng lúc (camera đứng yên)
  fillAll: async (keepZone, { look = 100, after = 60 } = {}) => {
    const left = await b.eval(`__fillAll('${keepZone}')`);
    if (left) await b.eval(`__buy('${left}', ${look}, ${after})`);
    return left;
  },
  fill: async (zone, { look = 120, after = 60, except = [] } = {}) => {
    await b.eval(`__zone('${zone}')`);
    const left = await b.eval(`__fill('${zone}', ${JSON.stringify(except)})`);
    if (!left) return null;
    await b.eval(`__buy('${left}', ${look}, ${after})`);
    return left;
  },
  // Nâng cấp một món: chạm vào món trong cảnh (mở bảng đổi kiểu), chạm kiểu mới, chạm giá
  upgrade: async (itemId, variantId, { look = 650 } = {}) => {
    // Camera còn lướt thì toạ độ món đổi từng khung: đợi vị trí đứng yên rồi chạm; chưa mở bảng thì chạm lại
    for (let k = 0; k < 12; k++) {
      await b.eval(`document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);   // đóng bảng nào còn mở (vd. bảng Cats) trước khi chạm món
      await sleep(150);
      let p = null, last = null;
      for (let j = 0; j < 4; j++) {
        p = await b.eval(`JSON.stringify(__itemAt('${itemId}'))`).then(JSON.parse);
        if (!p) throw new Error('không thấy món ' + itemId + ' trong cảnh');
        if (last && Math.abs(p.sx - last.sx) < 2 && Math.abs(p.sy - last.sy) < 2) break;
        last = p; await sleep(80);
      }
      if (p.sy > 360 || p.sy < 130 || p.sx < 50 || p.sx > 310) {   // món lệch khung / dưới khay thẻ: kéo camera đưa món về giữa rồi đo lại
        const dx = 180 - p.sx, dy = 270 - p.sy, kk = Math.min(1, 320 / Math.hypot(dx, dy));
        await b.eval(`window.__noKeep = true`);
        await b.drag(300, 100, 300 + dx * kk, 100 + dy * kk, 420);
        await b.eval(`window.__noKeep = false`);
        await sleep(500); continue;
      }
      await b.eval(`window.__noKeep = true`);
      await b.tap(p.sx, p.sy);
      await b.eval(`window.__noKeep = false`);
      await sleep(350);
      if (await b.eval(`!document.getElementById('deco-pop').hidden && !!document.querySelector('#deco-pop-items [data-id=${variantId}]')`)) break;
    }
    const r = await b.eval(`__variant('${variantId}', ${look})`);
    if (r !== 'ok') throw new Error('nâng cấp ' + variantId + ': ' + r);
  },
  // Logo + nút Play Now hiện dần
  outro: async logoB64 => {
    await b.eval(`(() => { if (document.getElementById('ad-outro')) return; const d = document.createElement('div'); d.id = 'ad-outro';
      d.innerHTML = '<img alt="" src="data:image/webp;base64,${logoB64}"><div class="cta">Play Now</div>'; document.body.append(d); void d.offsetWidth; d.classList.add('show'); })()`);
  },
  put: (breed, zone, dx, dz) => b.eval(`__put('${breed}', '${zone}', ${dx}, ${dz})`),
  doIt: (breed, method, ...args) => b.eval(`__do('${breed}', '${method}', ${args.map(a => JSON.stringify(a)).join(',')})`),
  furn: (breed, id) => b.eval(`__furn('${breed}', '${id}')`),
  hill: breed => b.eval(`__hill('${breed}')`),
  sad: (on, zone = 'living') => b.eval(`(() => { const [ox, oz] = __L.ZONE_OFFSET.${zone}; __sad(${!!on}, ox, oz + .6); })()`),
  catPos: (breed = 'orange') => b.eval(`JSON.stringify(__catScreen('${breed}'))`).then(JSON.parse),
  // Mèo mới vào nhà bằng bảng Cats thật (bảng bị ẩn bởi màn sạch), đặt ở khu đang quay, pháo giấy nổ ngay trên người nó
  friend: (breed, zone, dx, dz) => b.eval(`__friend('${breed}', '${zone}', ${dx}, ${dz})`),
  closePop: () => b.eval(`(() => { const p = document.getElementById('deco-pop'); if (!p.hidden) document.querySelector('.deco-side [data-key=cats]').click(); })()`),
  caption: (html, { top = 15, ms = 0 } = {}) => b.eval(`(() => {
    document.querySelectorAll('.ad-cap:not(.out)').forEach(o => { o.classList.add('out'); setTimeout(() => o.remove(), 320); });
    const e = document.createElement('div'); e.className = 'ad-cap'; e.style.top = '${top}%'; e.innerHTML = ${JSON.stringify(html)};
    document.body.append(e); ${ms ? `setTimeout(() => { e.classList.add('out'); setTimeout(() => e.remove(), 320); }, ${ms});` : ''} return true; })()`),
  // Đổi khu. Sau khi mua món, game bỏ qua cú chạm đổi khu khoảng 1–2 s (kiểm tra thực nghiệm): bấm lại tới khi đổi được.
  zone: async z => { if ((await b.eval(`__zone('${z}')`)) < 0) throw new Error('không đổi được sang khu ' + z); },
  // Mua một món bằng đúng luồng thẻ: chạm thẻ (xem thử, camera lướt tới) rồi Buy. Bấm bằng .click() nên không cần UI hiện.
  buy: async (id, { look = 600, after = 500, zone = null } = {}) => {
    // Camera zoom về phía con trỏ có thể kéo khu đang chọn sang khu bên cạnh: bảo đảm đúng khu trước khi tìm thẻ
    if (zone) await b.eval(`__zone('${zone}')`);
    const r = await b.eval(`__buy('${id}', ${look}, ${after})`);
    if (r !== 'ok') throw new Error('mua ' + id + ': ' + r);
  },
  // Zoom mượt: phát sự kiện wheel NGAY TRONG TRANG mỗi khung hình (rAF), không qua CDP (mỗi lệnh CDP trễ ~50 ms khi đang quay,
  // 170 nấc từng làm một cú zoom 2.7 s kéo dài 10 s). Dương = ra xa, âm = lại gần. Trả về khi zoom xong.
  zoom: async (dy, ms, x = 180, y = 330) => {
    await b.eval(`(() => { const c = document.querySelector('#deco-room canvas') || document.querySelector('canvas'); const t0 = performance.now(); let sent = 0;
      (function step(t) { const k = Math.min(1, (t - t0) / ${ms}), want = ${dy} * k, d = want - sent; sent = want;
        c.dispatchEvent(new WheelEvent('wheel', { deltaY: d, clientX: ${x}, clientY: ${y}, bubbles: true, cancelable: true })); if (k < 1) requestAnimationFrame(step); })(t0); })()`);
    await sleep(ms);
  },
});

// Khung screencast (mốc thời gian) -> mp4. Mỗi khung giữ tới khung kế; xuất 60 fps để không phải nội suy lệch nhịp.
export function encode(frames, out, { fps = 60, from = 0, to = Infinity, speed = 1 } = {}) {
  const t0 = frames[0].t;
  const list = frames.filter(f => f.t - t0 >= from && f.t - t0 <= to);
  const lines = ['ffconcat version 1.0'];
  list.forEach((f, i) => {
    const next = list[i + 1], dur = ((next ? next.t : f.t + 1 / fps) - f.t) / speed;
    lines.push(`file '${f.file.replace(/\\/g, '/')}'`, `duration ${Math.max(dur, 0.001).toFixed(5)}`);
  });
  lines.push(`file '${list.at(-1).file.replace(/\\/g, '/')}'`);
  const listFile = out + '.txt';
  writeFileSync(listFile, lines.join('\n'));
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-vf', `fps=${fps},format=yuv420p`, '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status) throw new Error('ffmpeg lỗi');
}

// Báo các khung khựng (gap giữa hai khung screencast > ngưỡng ms) để biết giật ở đâu
export function hitches(frames, thresholdMs = 34) {
  const t0 = frames[0].t, out = [];
  for (let i = 1; i < frames.length; i++) { const g = (frames[i].t - frames[i - 1].t) * 1000; if (g > thresholdMs) out.push([+(frames[i - 1].t - t0).toFixed(2), Math.round(g)]); }
  return out;
}
