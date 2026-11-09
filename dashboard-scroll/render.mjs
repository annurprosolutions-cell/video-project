// Usage:
//   node render.mjs stills                 -> stills/ snapshot (semak layout)
//   node render.mjs part <from> <to> <out> -> render frame [from,to) ke satu segmen mp4
// Render penuh selari: ./build.sh
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
import { spawn } from 'child_process';
const [,, mode, a, b, out] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('file://' + process.cwd() + '/scroll.html', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
if (mode === 'stills') {
  const ts = (process.argv.slice(3).length ? process.argv.slice(3).map(Number) : [2, 4.5, 5.8, 7, 8.6, 9.5, 11, 12.5, 13.5, 17, 21.5, 29, 45, 62, 80, 85.8, 88, 94, 98.5, 104]);
  for (const t of ts) { await page.evaluate(t => setT(t), t); await page.screenshot({ path: `stills/s_${t}.png` }); }
} else {
  const fps = 30, from = +a, to = +b;
  const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-g', '30', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'inherit'] });
  for (let i = from; i < to; i++) {
    await page.evaluate(t => setT(t), i / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}
await browser.close();
