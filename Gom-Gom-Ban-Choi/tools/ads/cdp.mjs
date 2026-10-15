// Điều khiển Chrome qua CDP (không cần cài thư viện) để quay clip quảng cáo từ game local.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function launch({ width = 360, height = 640, scale = 3, profile, port = 9333, url = 'about:blank', keep = false }) {
  mkdirSync(profile, { recursive: true });
  // Chrome cũ còn sót với cùng profile sẽ nuốt lần mở mới (cổng debug không mở): dọn trước, mỗi lần chạy một Chrome sạch.
  if (!keep) {
    spawnSync('powershell', ['-NoProfile', '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*ads-profile*' -or $_.CommandLine -like '*${profile.replace(/\\/g, '/').split('/').pop()}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`]);
    await sleep(800);
  }
  let already = false;
  try { already = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).some(t => t.type === 'page'); } catch {}
  const proc = already ? { kill() {} } : spawn(CHROME, [
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--headless=new', '--use-angle=d3d11', `--force-device-scale-factor=${scale}`, `--window-size=${width},${height}`, url,
  ], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 60; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.some(t => t.type === 'page')) break; } catch {}
    await sleep(250);
  }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const waiting = new Map(), listeners = new Map();
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.error ? w.reject(new Error(m.error.message)) : w.resolve(m.result); }
    else if (m.method) listeners.get(m.method)?.forEach(fn => fn(m.params));
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id;
    const timer = setTimeout(() => { waiting.delete(i); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    waiting.set(i, { resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); } });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const on = (method, fn) => { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(fn); };
  await send('Page.enable'); await send('Runtime.enable');
  on('Runtime.consoleAPICalled', p => { if (p.type === 'error' || p.type === 'warning') console.log('[trang]', p.type, p.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200)); });
  // Lỗi JS của trang hiện ra ở console của kịch bản (để biết cú bấm bị nuốt vì lỗi hay vì lý do khác)
  on('Runtime.exceptionThrown', p => console.log('[trang] lỗi:', p.exceptionDetails.exception?.description?.split('\n').slice(0, 3).join(' | ') || p.exceptionDetails.text));
  // Cỡ khung + DPR đặt bằng cờ Chrome (không dùng Emulation.setDeviceMetricsOverride: screencast sẽ chỉ ra khung cỡ CSS px)
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 0, mobile: false });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });

  const api = {
    send, on, proc,
    goto: async u => { await send('Page.navigate', { url: u }); await sleep(800); },
    eval: async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    shot: async (file, quality = 90) => {
      const r = await send('Page.captureScreenshot', { format: 'jpeg', quality });
      writeFileSync(file, Buffer.from(r.data, 'base64'));
    },
    // Chạm / kéo bằng sự kiện chuột + cảm ứng thật (toạ độ CSS px)
    tap: async (x, y) => {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await sleep(60);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    },
    wheel: async (x, y, dy, steps = 10, ms = 500) => {
      for (let i = 0; i < steps; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy / steps }); await sleep(ms / steps); }
    },
    drag: async (x0, y0, x1, y1, ms = 600) => {
      const steps = Math.max(8, Math.round(ms / 16));
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 });
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * e, y: y0 + (y1 - y0) * e, button: 'left', buttons: 1 });
        await sleep(ms / steps);
      }
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1 });
    },
    // Quay: lưu từng khung screencast kèm mốc thời gian. Trả hàm stop() -> danh sách khung.
    record: async (dir, { quality = 92 } = {}) => {
      mkdirSync(dir, { recursive: true });
      const frames = []; let n = 0;
      on('Page.screencastFrame', p => {
        const file = join(dir, `f${String(n++).padStart(6, '0')}.jpg`);
        writeFileSync(file, Buffer.from(p.data, 'base64'));
        frames.push({ file, t: p.metadata.timestamp });
        send('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {});
      });
      await send('Page.startScreencast', { format: 'jpeg', quality, everyNthFrame: 1, maxWidth: 1080, maxHeight: 1920 });
      return async () => { await send('Page.stopScreencast'); return frames; };
    },
    close: async () => { try { await send('Browser.close'); } catch {} try { proc.kill(); } catch {} },
  };
  return api;
}
