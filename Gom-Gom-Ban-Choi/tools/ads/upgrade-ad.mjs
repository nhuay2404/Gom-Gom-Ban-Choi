// Quay clip quảng cáo 30s "Upgrade progression" (9:16, 1080x1920, 60 fps): Match -> Earn (xu tự sinh) -> Upgrade (mua đồ, mở khu) -> End card.
// Chạy: node tools/ads/upgrade-ad.mjs <take|all>   (game đang chạy ở :4400). Take: match | home | end | all (+ look / lookplay để xem thử bố cục)
// Mỗi take ra <ADS_OUT>/upg/<take>.mp4 + <take>.events.json (mốc SFX). Ghép + nhạc: node tools/ads/upgrade-finish.mjs
// Cổng / hồ sơ Chrome riêng (9444) để chạy song song với deco-ad.mjs (9333) mà không đè nhau.
import { launch, sleep } from './cdp.mjs';
import { probe, helpers, encode, hitches, GAME } from './lib.mjs';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const OUT = resolve(process.env.ADS_OUT || 'ads-out', 'upg').replace(/\\/g, '/');
const PROFILE = process.env.ADS_PROFILE || tmpdir() + '/upg-run';
const PORT = 9444;
const LEVEL = Number(process.env.LV || 7);          // màn chơi trong cảnh Match
const IDLE_HOURS = Number(process.env.IDLE_HOURS || 3.5);
mkdirSync(OUT, { recursive: true });

const KEYS = { progress: 'gomgom-rotate-progress-v1', deco: 'gomgom-rotate-deco-v1' };
const CSS = `
  #dev-panel, #toast, .deco-side, #tabbar, .fg-settings, .settings, #deco-pins, .wallet-hud .fh-gems { display: none !important; }
  * { user-select: none !important; -webkit-user-select: none !important; }
  /* Màn sạch: ẩn mọi UI trừ ví xu + cảnh (nút vẫn bấm được bằng .click() từ kịch bản) */
  body.ad-clean .deco-dock, body.ad-clean #deco-pop, body.ad-clean #area-next, body.ad-clean .fg-hud, body.ad-clean #booster-bar { opacity: 0 !important; pointer-events: none !important; }
  .ad-confetti { position: fixed; z-index: 99998; pointer-events: none; border-radius: 2px; }
  .ad-cap { position: fixed; left: 50%; z-index: 99999; transform: translateX(-50%) scale(1); width: 92vw; text-align: center; pointer-events: none;
    font-family: var(--display, 'Baloo 2', sans-serif); font-weight: 800; font-size: 31px; line-height: 1.12; color: #fff; letter-spacing: .01em;
    -webkit-text-stroke: 7px #6b2f1c; paint-order: stroke fill; text-shadow: 0 4px 0 #6b2f1c; animation: ad-pop .5s cubic-bezier(.2,1.6,.4,1) both; }
  .ad-cap.out { animation: ad-out .3s ease-in both; }
  @keyframes ad-pop { from { transform: translateX(-50%) scale(.2) rotate(-6deg); opacity: 0 } to { transform: translateX(-50%) scale(1) rotate(0); opacity: 1 } }
  @keyframes ad-out { to { transform: translateX(-50%) scale(.6) translateY(-12px); opacity: 0 } }
  /* Thanh 3 bước: Match -> Earn -> Upgrade, bước đang diễn ra sáng lên */
  #ad-steps { position: fixed; left: 50%; top: 1.2%; transform: translateX(-50%); z-index: 99997; display: flex; align-items: center; gap: 4px;
    pointer-events: none; font-family: var(--display, 'Baloo 2', sans-serif); font-weight: 800; }
  #ad-steps span { display: flex; align-items: center; gap: 5px; padding: 4px 11px 4px 5px; border-radius: 99px; font-size: 14px; line-height: 1;
    color: #a98a72; background: rgba(255,248,235,.82); border: 2px solid rgba(107,47,28,.25); transition: all .3s cubic-bezier(.2,1.6,.4,1); }
  #ad-steps span i { font-style: normal; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: #e8d5c0; color: #fff; font-size: 12px; }
  #ad-steps span.on { color: #fff; background: #ff7aa8; border-color: #6b2f1c; transform: scale(1.12); box-shadow: 0 3px 0 #6b2f1c; -webkit-text-stroke: 3px #6b2f1c; paint-order: stroke fill; }
  #ad-steps span.on i { background: #fff; color: #ff5c94; -webkit-text-stroke: 0; }
  #ad-steps u { text-decoration: none; color: #6b2f1c; font-size: 16px; opacity: .6; }
  .ad-plus { position: fixed; z-index: 99998; pointer-events: none; transform: translateX(-50%); font: 800 26px var(--display, 'Baloo 2', sans-serif); color: #ffd23f; -webkit-text-stroke: 6px #6b2f1c; paint-order: stroke fill; animation: ad-plus 1s ease-out forwards; }
  @keyframes ad-plus { from { opacity: 1; translate: 0 0; scale: .6 } 20% { scale: 1.15 } to { opacity: 0; translate: 0 -70px } }
  /* Bàn tay chạm (hand-tap.png của hướng dẫn): đầu ngón nằm ở ~(30%, 86%) của ảnh */
  #ad-hand { position: fixed; left: 0; top: 0; width: 62px; z-index: 99996; pointer-events: none; opacity: 0; filter: drop-shadow(0 3px 3px rgba(0,0,0,.3)); }
  /* Bong bóng xu của mèo chỉ hiện khi body có .idle-on (để dàn cảnh "xu vừa tích xong") */
  body.hide-area #area-next { opacity: 0 !important; pointer-events: none; }
  body.idle-off .idle-coin { opacity: 0 !important; transform-origin: 50% 100%; }
  .idle-coin.ad-pop { animation: ad-bubble .55s cubic-bezier(.2,1.7,.4,1) both; }
  @keyframes ad-bubble { from { scale: .1; opacity: 0 } to { scale: 1; opacity: 1 } }
  /* End card */
  #ad-end { position: fixed; inset: 0; z-index: 99999; display: flex; flex-direction: column; align-items: center; overflow: hidden;
    font-family: var(--display, 'Baloo 2', sans-serif); color: #6b2f1c;
    background: repeating-linear-gradient(-58deg, #ffd9e8 0 34px, #e9f7c8 34px 68px); background-size: 200% 200%; animation: ad-bg 6s linear infinite; }
  @keyframes ad-bg { to { background-position: 136px 0 } }
  #ad-end .logo-slot { width: 88%; margin-top: 15%; animation: ad-rise .6s cubic-bezier(.2,1.5,.4,1) both; } #ad-end .logo-slot img { width: 100%; display: block; filter: drop-shadow(0 6px 0 rgba(107,47,28,.18)); }
  #ad-end .flow { display: flex; align-items: center; gap: 6px; margin-top: 2%; animation: ad-rise .6s cubic-bezier(.2,1.5,.4,1) both; }
  #ad-end .step { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 92px; font-weight: 800; font-size: 18px; -webkit-text-stroke: 5px #fff; paint-order: stroke fill; }
  #ad-end .step b { display: grid; place-items: center; width: 74px; height: 74px; border-radius: 22px; background: #fff; border: 4px solid #6b2f1c; box-shadow: 0 5px 0 #6b2f1c; font-size: 38px; }
  #ad-end .step b svg { width: 62px; height: 62px; }
  #ad-end .step:nth-child(1) b { animation: ad-bob 1.4s ease-in-out infinite; }
  #ad-end .step:nth-child(3) b { animation: ad-bob 1.4s ease-in-out .25s infinite; }
  #ad-end .step:nth-child(5) b { animation: ad-bob 1.4s ease-in-out .5s infinite; }
  #ad-end .arrow { font-size: 26px; font-weight: 800; margin-top: -26px; }
  #ad-end h2 { margin: 22px 12px 0; text-align: center; font-size: 34px; line-height: 1.05; color: #ff5c94; -webkit-text-stroke: 7px #fff; paint-order: stroke fill;
    text-shadow: 0 4px 0 #fff; animation: ad-rise .6s .25s cubic-bezier(.2,1.5,.4,1) both; }
  #ad-end h2 small { display: block; margin-top: 6px; font-size: 21px; color: #6b2f1c; -webkit-text-stroke: 5px #fff; }
  #ad-end .cats { display: flex; justify-content: center; align-items: flex-end; margin-top: auto; padding-bottom: 138px; gap: 0; animation: ad-rise .6s .4s cubic-bezier(.2,1.5,.4,1) both; }
  #ad-end .cats svg { width: 78px; height: 78px; margin: 0 -4px; filter: drop-shadow(0 4px 0 #8a412840); }
  #ad-end .cats svg:nth-child(odd) { animation: ad-bob 1.2s ease-in-out infinite; }
  #ad-end .cats svg:nth-child(even) { animation: ad-bob 1.2s ease-in-out .3s infinite; }
  #ad-end .cta { position: absolute; left: 50%; bottom: 34px; translate: -50% 0; padding: 12px 46px 14px; border-radius: 99px; font-size: 30px; font-weight: 800; color: #fff;
    background: linear-gradient(#ff8ab5, #ff5c94); border: 5px solid #fff; box-shadow: 0 6px 0 #d63f78, 0 12px 24px rgba(214,63,120,.35); -webkit-text-stroke: 5px #d63f78; paint-order: stroke fill;
    animation: ad-pulse 1s ease-in-out infinite; white-space: nowrap; }
  @keyframes ad-rise { from { transform: translateY(24px) scale(.8); opacity: 0 } to { transform: none; opacity: 1 } }
  @keyframes ad-bob { 50% { transform: translateY(-7px) } }
  @keyframes ad-pulse { 50% { transform: scale(1.07) } }`;

const STEPS = `<span data-s="1"><i>1</i>Match</span><u>›</u><span data-s="2"><i>2</i>Earn</span><u>›</u><span data-s="3"><i>3</i>Upgrade</span>`;
const injectCss = b => b.eval(`document.head.insertAdjacentHTML('beforeend', ${JSON.stringify(`<style id="ad-style">${CSS}</style>`)})`);

// Nạp game với save dựng sẵn. opts: { cleared (số màn đã thắng), coins, cats[], idleHours }
async function seed(b, { cleared = 10, coins = 0, cats = ['orange'], idleFor = cats, idleHours = 0, tab = 'deco' } = {}) {
  await b.goto('about:blank');
  await b.goto(new URL('/ad-reset-blank', GAME).href);
  await b.eval(`localStorage.clear(); localStorage.setItem('gomgom-rotate-deco-tour-v1','done'); localStorage.setItem('gomgom-rotate-onboarding-v1','done')`);
  await b.goto(GAME);
  await sleep(5000);
  await b.eval(`document.getElementById('dev-unlock').click()`);
  await sleep(1200);
  await b.eval(`localStorage.removeItem('gomgom-dev-all-zones')`);
  // Save cuối: chỉ thắng `cleared` màn đầu; mèo trong nhà + mốc idle lùi `idleHours` giờ (như thể đã vắng mặt từng đó giờ)
  await b.eval(`(() => {
    const p = JSON.parse(localStorage.getItem('${KEYS.progress}')); p.stars = p.stars.map((_, i) => i < ${cleared} ? 3 : 0); localStorage.setItem('${KEYS.progress}', JSON.stringify(p));
    const d = JSON.parse(localStorage.getItem('${KEYS.deco}')), cats = ${JSON.stringify(cats)}, from = Date.now() - ${idleHours} * 3600e3;
    d.coins = ${coins}; d.cats = cats; d.claimedCats = ['orange', 'gray', 'white', 'tabby', 'siamese', 'tuxedo'];
    d.idleAt = ${idleHours ? `Object.fromEntries(${JSON.stringify(idleFor)}.map(c => [c, from]))` : '{}'};
    localStorage.setItem('${KEYS.deco}', JSON.stringify(d)); })()`);
}

const steps = (b, n) => b.eval(`(() => { let e = document.getElementById('ad-steps');
  if (!e) { e = document.createElement('div'); e.id = 'ad-steps'; e.innerHTML = ${JSON.stringify(STEPS)}; document.body.append(e); }
  e.querySelectorAll('span').forEach(s => s.classList.toggle('on', Number(s.dataset.s) === ${n})); })()`);

// Số trên ví chạy từ giá trị cũ sang mới (game đặt thẳng, không có hiệu ứng đếm)
const wallet = b => b.eval(`(() => { const el = document.getElementById('deco-coins'); if (el.dataset.tw) return;
  el.dataset.tw = 1; let shown = Number(el.textContent.replace(/,/g, '')) || 0, busy = false;
  new MutationObserver(() => { if (busy) return; const to = Number(el.textContent.replace(/,/g, '')) || 0; if (to === shown) return;
    const from = shown, t0 = performance.now(), dur = 450; busy = true; el.textContent = from.toLocaleString('en-US');
    const tick = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); shown = Math.round(from + (to - from) * e);
      el.textContent = shown.toLocaleString('en-US'); if (k < 1) requestAnimationFrame(tick); else busy = false; };
    requestAnimationFrame(tick); }).observe(el, { childList: true, characterData: true, subtree: true }); })()`);

// Bàn tay đưa tới phần tử rồi bấm thật (el.click() lúc ngón chạm xuống). Trả về sau khi đã bấm.
const tap = (b, sel, { ms = 420 } = {}) => b.eval(`(async () => {
  const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false;
  el.scrollIntoView({ inline: 'center', block: 'nearest' }); await new Promise(r => setTimeout(r, 120));
  const r = el.getBoundingClientRect(); let h = document.getElementById('ad-hand');
  if (!h) { h = document.createElement('img'); h.id = 'ad-hand'; h.src = 'ui/shared/img/tutorial/hand-tap.png'; document.body.append(h); }
  const W = 62, H = 77, tx = r.left + r.width / 2 - W * .3, ty = r.top + r.height / 2 - H * .86, sx = tx + 46, sy = ty + 90;
  const a = h.animate([
    { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(1)', opacity: 0, offset: 0 },
    { transform: 'translate(' + (tx + 16) + 'px,' + (ty + 30) + 'px) scale(1)', opacity: 1, offset: .35 },
    { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(1)', opacity: 1, offset: .7 },
    { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(.86)', opacity: 1, offset: .82 },
    { transform: 'translate(' + tx + 'px,' + (ty - 6) + 'px) scale(1)', opacity: 1, offset: .92 },
    { transform: 'translate(' + tx + 'px,' + (ty - 6) + 'px) scale(1)', opacity: 0, offset: 1 }], { duration: ${ms} * 1.6, fill: 'forwards', easing: 'ease-out' });
  await new Promise(res => setTimeout(res, ${ms} * 1.6 * .8));
  const amount = el.dataset.amount;
  el.click();
  if (amount) { const p = document.createElement('div'); p.className = 'ad-plus'; p.textContent = '+' + Number(amount).toLocaleString('en-US');
    p.style.left = (r.left + r.width / 2) + 'px'; p.style.top = (r.top - 4) + 'px'; document.body.append(p); setTimeout(() => p.remove(), 1000); }
  return true; })()`);

// MỘT cú lướt của bàn tay đi qua lần lượt các bong bóng xu (theo vị trí sống của từng bong bóng) và bấm từng cái khi lướt tới.
// Chạy hết trong trang bằng một vòng requestAnimationFrame: không có lệnh CDP chen giữa nên không giật.
const sweep = (b, breeds) => b.eval(`(async () => {
  const breeds = ${JSON.stringify(breeds)};
  let h = document.getElementById('ad-hand');
  if (!h) { h = document.createElement('img'); h.id = 'ad-hand'; h.src = 'ui/shared/img/tutorial/hand-tap.png'; document.body.append(h); }
  h.getAnimations().forEach(a => a.cancel());
  const W = 62, H = 77, find = c => document.querySelector('.idle-coin[data-breed=' + c + ']:not([hidden])');
  const at = c => { const e = find(c); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2 - W * .3, y: r.top + r.height / 2 - H * .86, e, r }; };
  const first = at(breeds[0]); if (!first) return false;
  let x = first.x + 90, y = first.y + 150, i = 0, last = performance.now(), pressAt = -1e9, clickedAt = performance.now();
  h.style.opacity = 1;
  await new Promise(done => { const tick = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const t = i < breeds.length ? at(breeds[i]) : null;
    if (t) { const k = 1 - Math.exp(-dt * 10); x += (t.x - x) * k; y += (t.y - y) * k;
      if (Math.hypot(t.x - x, t.y - y) < 10) { const amount = t.e.dataset.amount; t.e.click(); pressAt = now; clickedAt = now; i++;
        if (amount) { const p = document.createElement('div'); p.className = 'ad-plus'; p.textContent = '+' + Number(amount).toLocaleString('en-US');
          p.style.left = (t.r.left + t.r.width / 2) + 'px'; p.style.top = (t.r.top - 4) + 'px'; document.body.append(p); setTimeout(() => p.remove(), 1000); } }
    } else { x += 130 * dt; y += 260 * dt; if (now - clickedAt > 350) { done(); return; } }
    h.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + (now - pressAt < 130 ? .86 : 1) + ')';
    requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  h.style.opacity = 0; return true; })()`);

// Kéo camera để trung bình vị trí các mèo (trên màn hình) về (180, y): cảnh mèo idle nằm giữa khung, không bị chữ che
const centerCats = async (b, y = 350, iters = 4) => {
  for (let i = 0; i < iters; i++) {
    const p = await b.eval(`JSON.stringify((() => { const c = __cats(); return { sx: c.reduce((s, k) => s + k.sx, 0) / c.length, sy: c.reduce((s, k) => s + k.sy, 0) / c.length }; })())`).then(JSON.parse);
    const dx = 180 - p.sx, dy = y - p.sy;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
    const k = Math.min(1, 200 / Math.hypot(dx, dy));
    await b.drag(180, 560, 180 + dx * k, 560 + dy * k, 420);
    await sleep(350);
  }
};

async function startRecording(b, name) {
  const frames = OUT + '/frames-' + name;
  if (existsSync(frames)) rmSync(frames, { recursive: true, force: true });
  const stop = await b.record(frames);
  const T0 = Date.now(), events = [];
  return {
    now: () => (Date.now() - T0) / 1000,
    until: async t => { const w = t * 1000 - (Date.now() - T0); if (w > 0) await sleep(w); },
    mark: kind => events.push({ t: +((Date.now() - T0) / 1000).toFixed(2), kind }),
    finish: async (len, opts = {}) => {
      const fr = await stop();
      console.log(name, 'frames', fr.length, (fr.at(-1).t - fr[0].t).toFixed(1) + 's', 'khựng:', JSON.stringify(hitches(fr).slice(0, 20)));
      writeFileSync(`${OUT}/${name}.events.json`, JSON.stringify(events, null, 1));
      encode(fr, `${OUT}/${name}.mp4`, { to: len, ...opts });
    },
  };
}

// Kéo camera để điểm 3D (x, z) về (180, y) trên màn hình
const centerOn = async (b, x, z, y = 330, iters = 3) => {
  for (let i = 0; i < iters; i++) {
    const p = await b.eval(`JSON.stringify(__scr(${x}, 0, ${z}))`).then(JSON.parse);
    const dx = 180 - p.sx, dy = y - p.sy;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    const k = Math.min(1, 200 / Math.hypot(dx, dy));
    await b.drag(180, 560, 180 + dx * k, 560 + dy * k, 420);
    await sleep(350);
  }
};

const takes = {
  // Xem thử bố cục Deco
  async look(b) {
    await seed(b, { cleared: 10, coins: 337, cats: ['orange', 'gray', 'white'], idleHours: IDLE_HOURS });
    await b.goto(GAME); await sleep(5000); await injectCss(b);
    await b.eval(`document.querySelector('.tab[data-tab=deco]').click()`); await sleep(2500);
    await probe(b); await steps(b, 2); await wallet(b);
    await helpers(b).caption('Cats earn coins<br>while you nap 💤', { top: 15 });
    await sleep(2500);
    await b.shot(OUT + '/look-earn.jpg');
    console.log(await b.eval(`JSON.stringify([...document.querySelectorAll('.idle-coin[data-breed]')].map(e => [e.dataset.breed, e.dataset.amount, e.hidden]))`));
  },

  // Dò căn giữa camera cho cảnh idle: in vị trí mèo trước / sau centerCats + chụp ảnh
  async dbg(b) {
    await seed(b, { cleared: 70, coins: 337, cats: ['orange', 'gray'], idleHours: IDLE_HOURS });
    await b.goto(GAME); await sleep(5000); await injectCss(b);
    await b.eval(`document.body.classList.add('ad-clean'); document.querySelector('.tab[data-tab=deco]').click()`);
    await sleep(2500);
    await probe(b);
    const h = helpers(b);
    await h.zone('garden'); await sleep(600);
    const show = async tag => { console.log(tag, await b.eval(`JSON.stringify(__cats().map(c => [c.breed, c.sx, c.sy]))`)); await b.shot(`${OUT}/dbg-${tag}.jpg`, 60); };
    await show('a-start');
    await h.zoom(-220, 500); await sleep(500); await show('b-zoom');
    await centerCats(b, 350); await sleep(600); await show('c-centered');
  },

  // Xem thử màn chơi: bot chơi màn LV, chụp mỗi giây
  async lookplay(b) {
    await seed(b, { cleared: 0, tab: null });
    await b.goto(GAME + '&level=' + LEVEL + '&bot=good');
    await sleep(2500);
    await injectCss(b);
    for (let i = 0; i < 24; i++) {
      await b.shot(`${OUT}/lp-${String(i).padStart(2, '0')}.jpg`, 60);
      if (await b.eval(`document.getElementById('result-dialog').open`)) console.log('kết quả ở giây', i);
      await sleep(1000);
    }
  },

  // ===== Cảnh 1 — MATCH & CLEAR: bot chơi một màn thật (màn 7: thưởng xu + mèo xám). Ghi mốc từng nước đi để bước ghép lấy 2 nước cuối liền mạch
  // -> bảng kết quả (+xu) -> màn nhận mèo mới =====
  async match(b) {
    const run = async record => {
      await seed(b, { cleared: LEVEL - 1, coins: 0, tab: null });
      await b.goto(GAME + '&level=' + LEVEL);
      await sleep(4500);
      await injectCss(b);
      await b.eval(`document.body.classList.add('ad-clean')`);
      const h = helpers(b), rec = record ? await startRecording(b, 'match') : null;
      // Caption đứng yên suốt ván (đoạn ghép chỉ lấy 2 nước cuối nên không được phụ thuộc lúc caption xuất hiện)
      h.caption('Match & clear cats 🐱', { top: 8 });
      await sleep(600);
      await b.eval(`import('./app/dev-bot.js').then(m => { m.startBot('good'); })`);
      let won = false, moves = null;
      for (let i = 0; i < 450 && !won; i++) {
        await sleep(100);
        const s = JSON.parse(await b.eval(`JSON.stringify([document.getElementById('moves').textContent, document.getElementById('result-dialog').open && /complete/i.test(document.getElementById('result-title').textContent)])`));
        if (s[0] !== moves) { if (moves !== null) rec?.mark('move'); moves = s[0]; }
        won = s[1];
      }
      if (!won) throw new Error('bot không thắng trong 45 s');
      rec?.mark('win');
      h.caption('Earn coins! 🪙', { top: 8 });
      await sleep(1900);
      // Màn nhận mèo mới: dựng lại đúng DOM / CSS / mèo 3D của showCatReward (menu-controller.js), vì nút Claim trên bản đồ là sprite WebGL
      rec?.mark('pop');
      h.caption('Unlock new cats! 😻', { top: 8 });
      await b.eval(`(async () => {
        document.getElementById('result-dialog').close();
        const { catShowcase } = await import('./deco/map-world.mjs');
        const s = document.createElement('div'); s.className = 'cat-reward';
        s.innerHTML = '<div class="cr-rays"></div><div class="cr-glow"></div><p class="cr-title">You got</p><div class="cr-cat cr-3d"><i class="cr-spark s1"></i><i class="cr-spark s2"></i><i class="cr-spark s3"></i><i class="cr-spark s4"></i></div><p class="cr-rarity r-common">Common</p><p class="cr-name">Gray cat</p><p class="cr-tap">Tap to claim</p>';
        document.body.append(s); catShowcase(s.querySelector('.cr-cat'), 'gray', {}); setTimeout(() => s.classList.add('ready'), 900); })()`);
      await sleep(3000);
      if (rec) await rec.finish(60);
    };
    console.log('--- match: lượt khởi động ---'); await run(false);
    console.log('--- match: lượt quay ---'); await run(true);
  },

  // ===== Cảnh 2 — mèo idle tích xu: 2 mèo gom xu bằng MỘT cú lướt -> thêm 2 mèo mới, gom tiếp -> mua đồ + đổi kiểu khác -> mở lần lượt mọi khu
  // (tới trường mẫu giáo) -> tua nhanh mua đồ cho các phòng. Một lượt quay liền (ví xu liên tục). Mốc 'ff' = chỗ bắt đầu tua nhanh. =====
  async home(b) {
    const cats = ['orange', 'gray'], newCats = [['tabby', -1.6, 1.0], ['siamese', 1.5, 1.2]];
    const ROOMS = 7;                                  // garden2, living, bedroom, kitchen, bathroom, backyard, kinder
    const run = async record => {
      // Mèo mới cũng có mốc idle lùi sẵn (xem dưới: game đặt lại mốc khi mèo vào nhà nên phải lùi lại sau khi vào)
      await seed(b, { cleared: 70, coins: 337, cats, idleFor: [...cats, ...newCats.map(n => n[0])], idleHours: IDLE_HOURS });
      await b.goto(GAME); await sleep(5000); await injectCss(b);
      await b.eval(`document.body.classList.add('idle-off', 'ad-clean'); document.querySelector('.tab[data-tab=deco]').click()`);
      await sleep(2500);
      await probe(b); await wallet(b);
      // Làm nóng cảnh: dựng sẵn model + shader mọi khu (mở hết khu một lượt rồi tắt cờ)
      await b.eval(`localStorage.setItem('gomgom-dev-all-zones','on')`);
      for (const z of ['living', 'bedroom', 'kitchen', 'bathroom', 'backyard', 'kinder', 'garden']) {
        await b.eval(`document.querySelector('#deco-zone [data-zone=${z}]')?.click()`); await sleep(2200);
      }
      await b.eval(`localStorage.removeItem('gomgom-dev-all-zones')`);
      const h = helpers(b);
      await h.zone('garden');
      await sleep(600);
      await h.zoom(-220, 500);
      await sleep(300);
      await centerCats(b, 350);

      const rec = record ? await startRecording(b, 'home') : null;
      const mark = k => rec?.mark(k);
      const topUp = n => b.eval(`(async () => { const { getDeco, setDeco, refreshWallet } = await import('./app/shared.js'); const d = getDeco();
        if (d.coins < ${n}) { setDeco({ ...d, coins: ${n} }); refreshWallet(); } })()`);
      const reveal = breeds => b.eval(`document.body.classList.remove('idle-off'); ${JSON.stringify(breeds)}.forEach((c, i) => document.querySelectorAll('.idle-coin[data-breed=' + c + ']').forEach(e => { e.classList.remove('ad-pop'); void e.offsetWidth; setTimeout(() => e.classList.add('ad-pop'), i * 120); }))`);

      // ---- 1. Hai mèo idle tích xu: bong bóng bật lên, một cú lướt thu cả hai ----
      h.caption('Idle cats earn coins! 💰', { top: 9 });
      await sleep(300);
      mark('pop'); await reveal(cats);
      await sleep(700);
      mark('buy'); await sweep(b, cats);
      await sleep(350);
      // ---- 2. Thêm mèo mới = thêm xu ----
      h.caption('More cats, more coins! 😻', { top: 9 });
      for (const [breed, dx, dz] of newCats) {
        mark('pop'); await h.friend(breed, 'garden', dx, dz);
        // Game đặt mốc idle của mèo mới = lúc vào nhà (0 xu): lùi lại như các mèo kia đã tích sẵn
        await b.eval(`(async () => { const { getDeco, setDeco } = await import('./app/shared.js'); const d = getDeco();
          setDeco({ ...d, idleAt: { ...(d.idleAt || {}), ['${breed}']: Date.now() - ${IDLE_HOURS} * 3600e3 } }); })()`);
        await sleep(150); await h.closePop();
      }
      await sleep(250);
      await reveal(newCats.map(n => n[0]));
      for (let k = 0; k < 30 && !(await b.eval(`!!document.querySelector('.idle-coin[data-breed=siamese]:not([hidden])')`)); k++) await sleep(100);
      mark('buy'); await sweep(b, newCats.map(n => n[0]));
      await sleep(300);
      // ---- 3. Mở khoá đồ mới, rồi nâng cấp sang kiểu khác (chạm đồ trong vườn -> chọn kiểu -> mua) ----
      h.caption('Unlock new furniture! 🛋️', { top: 9 });
      for (const id of ['cathouse', 'pond', 'hammock']) { mark('buy'); await h.buy(id, { look: 300, after: 120 }); }
      h.caption('Upgrade to new styles! ✨', { top: 9 });
      for (const [slot, variant] of [['cathouse', 'cathouse-barrel'], ['hammock', 'hammock-tire']]) {
        const at = await b.eval(`JSON.stringify((() => { const [ox, oz] = __L.ZONE_OFFSET.garden, [px, pz] = __L.PLACES['${slot}']; return __scr(ox + px, .35, oz + pz); })())`).then(JSON.parse);
        await b.tap(at.sx, at.sy);
        let ok = false;
        for (let k = 0; k < 20 && !ok; k++) { ok = await b.eval(`!!document.querySelector('#deco-pop-items [data-id=${variant}]')`); if (!ok) await sleep(100); }
        if (!ok) { console.log('không thấy kiểu', variant); continue; }
        await b.eval(`document.querySelector('#deco-pop-items [data-id=${variant}]').click()`);
        await sleep(250);
        mark('buy'); await b.eval(`document.querySelector('#deco-pop-items [data-id=${variant}] .deco-opt-price')?.click()`);
        await sleep(450);
      }
      // ---- 4. Mở lần lượt mọi khu, tới trường mẫu giáo ----
      h.caption('Unlock every room! 🏠', { top: 9 });
      await topUp(40000);
      for (let i = 0; i < ROOMS; i++) {
        mark('unlock'); await b.eval(`document.getElementById('area-next').click()`);
        await sleep(i === ROOMS - 1 ? 1100 : 750);
      }
      // ---- 5. Tua nhanh: mua đồ cho các phòng ----
      mark('ff');
      h.caption('Furnish them all! 🏡', { top: 9 });
      for (const z of ['living', 'bedroom', 'kitchen', 'backyard']) {
        await h.zone(z);
        await sleep(350);
        const ids = await b.eval(`JSON.stringify([...document.querySelectorAll('#deco-cards [data-id]')].slice(0, 4).map(e => e.dataset.id))`).then(JSON.parse);
        for (const id of ids) { await topUp(40000); mark('buy'); await h.buy(id, { look: 130, after: 70 }); }
      }
      await sleep(500);
      if (rec) await rec.finish(60);
    };
    console.log('--- home: lượt khởi động ---'); await run(false);
    console.log('--- home: lượt quay ---'); await run(true);
  },

  // ===== Outro: logo + tagline + mèo + PLAY NOW =====
  async end(b) {
    const logo = readFileSync(OUT + '/logo-s.png').toString('base64');
    await seed(b, { cleared: 10, coins: 0, tab: null });
    await b.goto(GAME); await sleep(5000); await injectCss(b);
    const rec = await startRecording(b, 'end');
    await b.eval(`(async () => {
      const { catMarkup, catGroups } = await import('./ui/cat-art.mjs');
      const e = document.createElement('div'); e.id = 'ad-end';
      const cats = catGroups.slice(0, 5).map(g => catMarkup[g]).join('');
      e.innerHTML = '<div class="logo-slot"><img src="data:image/png;base64,${logo}"></div>'
        + '<h2>Match · Upgrade · Earn<small>Build your dream cat home!</small></h2>'
        + '<div class="cats">' + cats + '</div><div class="cta">PLAY NOW</div>';
      document.body.append(e); })()`);
    await sleep(4200);
    await rec.finish(60);
  },
};


const which = process.argv[2] || 'look';
rmSync(PROFILE, { recursive: true, force: true });
const b = await launch({ profile: PROFILE, port: PORT, keep: true });
try {
  for (const name of which === 'all' ? ['match', 'home', 'end'] : [which]) await takes[name](b);
} finally { await b.close(); }
process.exit(0);












