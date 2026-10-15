// Ghép nhạc vào video thô và xuất bản giao: node tools/ads/finish.mjs <thư mục ADS_OUT> <nhạc.wav|mp3> [đầu ra.mp4]
import { spawnSync } from 'node:child_process';
const [dir, music, outArg] = process.argv.slice(2);
const out = outArg || `${dir}/gomgom-deco-30s-9x16.mp4`;
const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${dir}/deco-raw.mp4`, '-i', music,
  '-filter_complex', '[0:v]fade=t=in:st=0:d=0.25[v];[1:a]atrim=0:30,afade=t=out:st=28.2:d=1.8,loudnorm=I=-16:TP=-1.5:LRA=7[a]',
  '-map', '[v]', '-map', '[a]', '-t', '30', '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], { stdio: 'inherit' });
process.exit(r.status || 0);
