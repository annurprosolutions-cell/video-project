import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
// node render.mjs stills  |  node render.mjs full cyber-attack.mp4
const [,, mode, out = 'cyber-attack.mp4'] = process.argv;
const DUR = 105.6, fps = 30;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('file://' + process.cwd() + '/cyber.html', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
if (mode === 'stills') {
  fs.mkdirSync('stills', { recursive: true });
  const ts = process.argv.slice(3).map(Number);
  for (const t of (ts.length ? ts : [2, 5, 9, 14, 20, 24, 29.5, 33.5, 36.5, 42.5, 49, 58, 63, 67, 72, 78, 85, 88, 93, 97, 103])) {
    await page.evaluate(t => setT(t), t);
    await page.screenshot({ path: `stills/s_${t}.png` });
  }
} else {
  const n = Math.round(DUR * fps);
  const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-i', 'audio.wav', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-t', String(DUR), '-movflags', '+faststart', out],
    { stdio: ['pipe', 'ignore', 'inherit'] });
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => setT(t), i / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log('frame', i, '/', n);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}
await browser.close();
