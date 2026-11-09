import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
import { spawn } from 'child_process';
const [,, mode, out='dashboard-pbd.mp4'] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('file://' + process.cwd() + '/dashboard-pbd.html', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
if (mode === 'stills') {
  for (const t of [2, 7, 9.6, 13, 20, 23.5, 27.5, 32, 38, 39.5, 45, 49.5, 51.4, 52.2, 56, 59]) {
    await page.evaluate(t => setT(t), t);
    await page.screenshot({ path: `stills/s_${t}.png` });
  }
} else {
  const fps = 30, n = 60 * fps;
  const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'inherit'] });
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => setT(t), i / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}
await browser.close();
