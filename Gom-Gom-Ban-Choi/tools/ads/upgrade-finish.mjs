// Ghép các take của upgrade-ad.mjs thành clip ≤30 s + nhạc/SFX: node tools/ads/upgrade-finish.mjs [thư mục ADS_OUT] [đầu ra.mp4]
// Match: MỘT đoạn liền mạch từ ~2 nước đi cuối -> clear màn -> bảng kết quả -> nhận mèo (tìm theo mốc 'move' / 'pop' của take).
// Home: bình thường tới mốc 'ff', sau đó tua nhanh (FF_SPEED) phần mua đồ cho các phòng. Cuối cùng mờ dần (xfade) sang End card có logo.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(process.argv[2] || 'ads-out', 'upg');
const out = process.argv[3] || resolve(process.argv[2] || 'ads-out', 'gomgom-upgrade-30s-9x16.mp4');
const FF_SPEED = Number(process.env.FF_SPEED || 2.5), MATCH_MAX = Number(process.env.MATCH_MAX || 8.5), FADE = 0.7;
const events = t => { try { return JSON.parse(readFileSync(`${dir}/${t}.events.json`, 'utf8')); } catch { return []; } };
const duration = t => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${dir}/${t}.mp4`]).stdout.toString());

const ME = events('match'), moves = ME.filter(e => e.kind === 'move').map(e => e.t), reward = ME.find(e => e.kind === 'pop').t;
const matchFrom = Math.max(0.5, moves.at(-2) - 1.9), matchTo = Math.min(duration('match') - 0.05, reward + 2.4);
const matchSpeed = Math.max(1, (matchTo - matchFrom) / MATCH_MAX);
const HEAD = 0.3, ff = events('home').find(e => e.kind === 'ff').t, homeEnd = duration('home') - 0.05;
const END = [0.4, 3.9];
const SEGS = [['match', matchFrom, matchTo, matchSpeed], ['home', HEAD, ff, 1], ['home', ff, homeEnd, FF_SPEED], ['end', ...END, 1]];
const len = ([, a, b, sp]) => (b - a) / sp;
console.log(SEGS.map(s => `${s[0]} ${s[1].toFixed(1)}–${s[2].toFixed(1)} x${s[3].toFixed(2)} = ${len(s).toFixed(1)}s`).join(' | '));

const takes = [...new Set(SEGS.map(s => s[0]))];
const inputs = takes.flatMap(t => ['-i', `${dir}/${t}.mp4`]);
const parts = SEGS.map(([t, a, b, sp], i) => `[${takes.indexOf(t)}:v]trim=start=${a}:end=${b},setpts=(PTS-STARTPTS)/${sp},fps=60,format=yuv420p[v${i}]`);
const body = SEGS.length - 1, bodyLen = SEGS.slice(0, body).reduce((s, x) => s + len(x), 0);
const filter = `${parts.join(';')};${SEGS.slice(0, body).map((_, i) => `[v${i}]`).join('')}concat=n=${body}:v=1:a=0,fps=60,settb=1/60[vb];`
  + `[v${body}]settb=1/60[ve];[vb][ve]xfade=transition=fade:duration=${FADE}:offset=${(bodyLen - FADE).toFixed(3)},fade=t=in:st=0:d=0.25[v]`;
const total = bodyLen + len(SEGS[body]) - FADE;

// Mốc SFX: sự kiện của take -> thời điểm trong clip ghép (End card bắt đầu chồng lên FADE giây cuối của phần thân)
const evs = []; let cursor = 0;
SEGS.forEach((seg, i) => {
  const [t, a, b, sp] = seg;
  if (i === body) cursor -= FADE;
  for (const e of events(t)) if (e.t >= a && e.t <= b && !['move', 'ff'].includes(e.kind)) evs.push({ t: +(cursor + (e.t - a) / sp).toFixed(2), kind: e.kind === 'win' ? 'buy' : e.kind });
  cursor += len(seg);
});
console.log('độ dài sau ghép:', total.toFixed(1) + 's', 'sự kiện:', evs.length);
if (total > 30) console.warn('CẢNH BÁO: dài hơn 30 s, sẽ bị cắt. Tăng FF_SPEED / giảm MATCH_MAX.');
writeFileSync(`${dir}/final.events.json`, JSON.stringify(evs));
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: 'inherit' }); if (r.status) throw new Error(cmd + ' lỗi'); };
run(process.execPath, ['tools/ads/make-music.mjs', `${dir}/final.wav`, `${dir}/final.events.json`]);
const dur = Math.min(30, total);
run('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-i', `${dir}/final.wav`, '-filter_complex', filter + `;[${takes.length}:a]atrim=0:${dur.toFixed(2)},afade=t=out:st=${(dur - 1.8).toFixed(2)}:d=1.8,loudnorm=I=-16:TP=-1.5:LRA=7[a]`,
  '-map', '[v]', '-map', '[a]', '-t', dur.toFixed(2), '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
console.log('xong:', out);

