const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const { mkdirSync, writeFileSync, rmSync } = require('fs');
const FPS = 30, DUR = 60, N = FPS * DUR;
const [,, mode = 'full', out = 'ruzprompt-showcase.mp4', workers = '4'] = process.argv;
async function open() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + process.cwd() + '/showcase.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction(() => window.READY === true);
  return [b, p];
}
(async () => {
  if (mode === 'stills') {
    mkdirSync('stills', { recursive: true });
    const [b, p] = await open();
    for (const t of process.argv.slice(4).map(Number)) {
      await p.evaluate(t => setT(t), t);
      await p.screenshot({ path: `stills/s_${t}.png` });
    }
    return b.close();
  }
  const W = +workers, per = Math.ceil(N / W);
  mkdirSync('seg', { recursive: true });
  await Promise.all([...Array(W)].map(async (_, w) => {
    const a = w * per, z = Math.min(N, a + per);
    const [b, p] = await open();
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-g', '30', `seg/s${w}.mp4`], { stdio: ['pipe', 'ignore', 'inherit'] });
    for (let i = a; i < z; i++) {
      await p.evaluate(t => setT(t), i / FPS);
      const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close();
  }));
  writeFileSync('seg/list.txt', [...Array(W)].map((_, w) => `file 's${w}.mp4'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'seg/list.txt', '-c', 'copy', out]);
  rmSync('seg', { recursive: true });
})();
