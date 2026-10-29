import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { mkdirSync } from 'fs';
const [,, mode, arg='eperolehan-promo.mp4'] = process.argv;
const FPS = 30, DUR = 87;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => console.error('PAGEERROR', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
await page.goto('file://' + process.cwd() + '/eperolehan.html', { waitUntil: 'networkidle' });
await page.evaluate(() => window.ready);
if (mode === 'stills') {
  mkdirSync('stills', { recursive: true });
  const ts = arg.split(',').map(Number);
  for (const t of ts) {
    await page.evaluate(t => setT(t), t);
    await page.screenshot({ path: `stills/s_${t}.png` });
  }
} else {
  const n = Math.round(DUR * FPS);
  const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', '-movflags', '+faststart', arg], { stdio: ['pipe', 'ignore', 'inherit'] });
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => setT(t), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log('frame', i, '/', n);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}
await browser.close();
