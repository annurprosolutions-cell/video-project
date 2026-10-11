// Render driver (Playwright + headless Chromium/SwiftShader + ffmpeg).
//   node render.mjs stills 3,12.5,40            -> stills/s_<t>.png
//   node render.mjs part <i> <n> [fps]          -> parts/part_<i>.mp4 (frames i-th slice of n)
//   node render.mjs full [out.mp4] [fps]        -> whole video in one process
//   node render.mjs mux <out.mp4> [fps]         -> concat parts + song audio
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const AUDIO = process.env.SONG || path.join(HERE, 'audio', 'song.mp3');
const DUR = 163.68;
const [, , mode = 'stills', a1, a2, a3] = process.argv;

async function open() {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text().slice(0, 4000)); });
  page.on('pageerror', e => console.error('[pageerror]', e.message.slice(0, 6000)));
  await page.goto('file://' + path.join(HERE, 'index.html'), { waitUntil: 'load' });
  const lyrics = JSON.parse(fs.readFileSync(path.join(HERE, 'lyrics.json'), 'utf8'));
  const spans = await page.evaluate(d => window.boot(d), lyrics);
  return { browser, page, spans };
}

function ffmpegOut(file, fps, extra = []) {
  return spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    ...extra, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'medium', '-tune', 'film', '-r', String(fps), file],
    { stdio: ['pipe', 'inherit', 'inherit'] });
}

async function renderRange(page, f0, f1, fps, file) {
  const ff = ffmpegOut(file, fps);
  const t0 = Date.now();
  for (let i = f0; i < f1; i++) {
    const b64 = await page.evaluate(t => { window.setT(t); return document.getElementById('gl').toDataURL('image/jpeg', .95).slice(23); }, i / fps);
    const buf = Buffer.from(b64, 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((i - f0) % 60 === 0) {
      const el = (Date.now() - t0) / 1000, done = i - f0 + 1;
      console.log(`${path.basename(file)} frame ${i} (${done}/${f1 - f0}) ${(el / done).toFixed(2)}s/f eta ${((f1 - f0 - done) * el / done / 60).toFixed(1)}min`);
    }
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}

if (mode === 'stills') {
  const { browser, page, spans } = await open();
  console.log(JSON.stringify(spans));
  fs.mkdirSync(path.join(HERE, 'stills'), { recursive: true });
  for (const t of (a1 || '3').split(',').map(Number)) {
    const t0 = Date.now();
    const b64 = await page.evaluate(t => { window.setT(t); return document.getElementById('gl').toDataURL('image/png').slice(22); }, t);
    fs.writeFileSync(path.join(HERE, 'stills', `s_${t}.png`), Buffer.from(b64, 'base64'));
    const st = { ms: Date.now() - t0 };
    console.log('t', t, JSON.stringify(st));
  }
  await browser.close();
} else if (mode === 'part') {
  const i = +a1, n = +a2, fps = +(a3 || 30);
  const total = Math.round(DUR * fps);
  const per = Math.ceil(total / n);
  const f0 = i * per, f1 = Math.min(total, f0 + per);
  fs.mkdirSync(path.join(HERE, 'parts'), { recursive: true });
  const { browser, page } = await open();
  await renderRange(page, f0, f1, fps, path.join(HERE, 'parts', `part_${String(i).padStart(2, '0')}.mp4`));
  await browser.close();
} else if (mode === 'seg') {
  // segment i = [end of transition into scene i, end of transition out of scene i)
  const i = +a1, fps = +(a2 || 30);
  const { browser, page, spans } = await open();
  const b = [0, ...spans.map(s => Math.min(DUR, s[2]))];
  b[b.length - 1] = DUR;
  const f0 = Math.round(b[i] * fps), f1 = Math.round(b[i + 1] * fps);
  fs.mkdirSync(path.join(HERE, 'parts'), { recursive: true });
  console.log(`seg ${i} ${spans[i][0]} frames ${f0}-${f1}`);
  await renderRange(page, f0, f1, fps, path.join(HERE, 'parts', `seg_${String(i).padStart(2, '0')}${process.env.SEG_SUFFIX || ''}.mp4`));
  await browser.close();
} else if (mode === 'full') {
  const out = a1 || 'sekadar-kehilangan-silent.mp4', fps = +(a2 || 30);
  const { browser, page } = await open();
  await renderRange(page, 0, Math.round(DUR * fps), fps, path.join(HERE, out));
  await browser.close();
} else if (mode === 'mux') {
  // concat segments, then 2-pass H.264 at a TikTok-friendly bitrate with the song as AAC
  const out = a1 || 'sekadar-kehilangan.mp4', kbps = +(a2 || 4300);
  const P = f => path.join(HERE, 'parts', f);
  const parts = fs.readdirSync(path.join(HERE, 'parts')).filter(f => /^seg_\d+\.mp4$/.test(f)).sort();
  fs.writeFileSync(P('list.txt'), parts.map(p => `file '${p}'`).join('\n'));
  const run = args => new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
    ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c)));
  });
  await run(['-f', 'concat', '-safe', '0', '-i', P('list.txt'), '-c', 'copy', P('concat.mp4')]);
  const v = ['-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
    '-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * 1.7)}k`, '-bufsize', `${kbps * 2}k`, '-r', '30',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-passlogfile', P('x264')];
  await run(['-i', P('concat.mp4'), ...v, '-pass', '1', '-an', '-f', 'mp4', '/dev/null']);
  await run(['-i', P('concat.mp4'), '-i', AUDIO, '-map', '0:v', '-map', '1:a', ...v, '-pass', '2',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', path.join(HERE, out)]);
  console.log('wrote', out);
}
