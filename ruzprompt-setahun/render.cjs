const { chromium } = require('playwright');
const { spawn } = require('child_process');
const { mkdirSync } = require('fs');
(async () => {
const [,, mode, out = 'ruzprompt-setahun.mp4'] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('file://' + process.cwd() + '/ruzprompt.html', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
if (mode === 'stills') {
  mkdirSync('stills', { recursive: true });
  for (const t of [2.5, 9, 12.5, 19, 22, 27, 31, 33.5, 38, 43, 49, 56, 59.5]) {
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
})();
