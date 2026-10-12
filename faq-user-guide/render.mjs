// node render.mjs stills            -> snapshot ke build/stills/
// node render.mjs frames [workers]  -> render semua frame ke build/frames/ + tulis build/sfx.json
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
const [,, mode = 'stills', workersArg = '4'] = process.argv;
const FPS = 30;
const TL = JSON.parse(readFileSync('build/timeline.json', 'utf8'));
const N = Math.round(TL.total * FPS);
const url = 'file://' + process.cwd() + '/faq-guide.html';
const browser = await chromium.launch();
async function open() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.error('PAGEERROR', e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return page;
}
if (mode === 'stills') {
  mkdirSync('build/stills', { recursive: true });
  const page = await open();
  const times = (process.argv[3] ? process.argv[3].split(',').map(Number) : [3, 7, 11.5, 13, 14.5, 18, 21, 23.5, 26.5, 33, 36, 38.5, 41, 43.5, 46, 48.5, 50.5, 52, 56, 59.5]);
  for (const t of times) { await page.evaluate(t => setT(t), t); await page.screenshot({ path: `build/stills/s_${String(t).padStart(5, '0')}.png` }); }
} else {
  mkdirSync('build/frames', { recursive: true });
  const W = Number(workersArg);
  const page0 = await open();
  writeFileSync('build/sfx.json', JSON.stringify(await page0.evaluate(() => window.SFX)));
  await Promise.all(Array.from({ length: W }, async (_, w) => {
    const page = w === 0 ? page0 : await open();
    for (let i = w; i < N; i += W) {
      await page.evaluate(t => setT(t), i / FPS);
      await page.screenshot({ path: `build/frames/f_${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93 });
    }
  }));
}
await browser.close();
