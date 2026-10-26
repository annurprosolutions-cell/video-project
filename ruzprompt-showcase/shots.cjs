const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const H = '/home/user/';
const OUT = H + 'video-project/ruzprompt-showcase/assets/shots/';
const T = [
 ['erph','erph/dist'],['jadual','ruztimetable'],['kembara','ragnarokmath/dist'],['celik','celik-minda-quest'],
 ['eaduan','eaduan'],['karadi','repotemplatekaradi/site'],['mcm','mcmbaruOktober'],['zakat','zakatbahrululum'],
 ['azn','azndraft'],['ams','AMS'],['homestay','demobookinghomestay'],['edudash','eduAnalisis'],
 ['prosaff','prosaff'],['p2d','prompt2dashboard'],['jalanpulang','jalanpulang'],['mengaji','draftngajihafsah'],
 ['ammar','ammartraveldraft/dist'],['profil','newruzprofile'],
];
const mime = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json','.ico':'image/x-icon'};
(async()=>{
  const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  const only = process.argv.slice(2);
  for (const [k, root] of T) {
    if (only.length && !only.includes(k)) continue;
    const ctx = await b.newContext({ viewport:{width:1440,height:900}, serviceWorkers:'block' });
    const page = await ctx.newPage();
    await page.route('http://app.local/**', async r => {
      let p = decodeURIComponent(new URL(r.request().url()).pathname);
      let f = path.join(H+root, p);
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f,'index.html');
      if (!fs.existsSync(f)) { if (!path.extname(p)) f = path.join(H+root,'index.html'); else return r.fulfill({status:404,body:''}); }
      r.fulfill({ status:200, body: fs.readFileSync(f), contentType: mime[path.extname(f)]||'application/octet-stream' });
    });
    await page.route(/google\.com\/macros|script\.google\.com|firebaseio|identitytoolkit|supabase\.co|googleapis\.com\/(?!css)/, r=>r.abort());
    try { await page.goto('http://app.local/', {waitUntil:'domcontentloaded', timeout:15000}); } catch(e){ console.log(k,'goto',e.message.slice(0,60)); }
    await page.waitForTimeout(3500);
    const ACT={erph:'Masuk sebagai Cikgu Aina',jadual:'Pentadbir jadual',edudash:'Guna Data Contoh'};
    if (ACT[k]) { try { await page.getByText(ACT[k]).first().click({timeout:4000}); await page.waitForTimeout(2500); } catch(e){ console.log(k,'act',e.message.slice(0,50)); } }
    await page.screenshot({ path: OUT+k+'.jpg', type:'jpeg', quality:88 });
    console.log('ok',k);
    await ctx.close();
  }
  await b.close();
})();
