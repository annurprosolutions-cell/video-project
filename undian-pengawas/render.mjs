import { chromium } from 'playwright';
import { spawn } from 'child_process';
const [,, mode, out='undian-pengawas.mp4'] = process.argv;
const browser = await chromium.launch({executablePath:process.env.CHROME||undefined});
const page = await browser.newPage({ viewport: { width: 384, height: 864 }, deviceScaleFactor: 2 });
await page.goto('file://' + process.cwd() + '/undian.html', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
if (mode === 'stills') {
  for (const t of [1, 3.7, 5, 5.9, 7.5, 9.6, 11, 13, 17, 25]) {
    await page.evaluate(t => setT(t), t);
    await page.screenshot({ path: `stills/s_${t}.png` });
  }
} else {
  const fps = 30, n = Math.round(32.5 * fps);
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
