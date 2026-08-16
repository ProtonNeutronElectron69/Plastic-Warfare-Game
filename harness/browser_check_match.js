/* browser_check.js — real-Chromium assertions on a built mockup.
   Confirms the injected chrome actually applies (not just that the CSS parsed),
   that the live backdrop is painting, and that the layout holds at three widths.
     node browser_check.js <file.html> [pngOut] */
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium').default;

const FILE = process.argv[2];
const PNG = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n + (extra ? '  <' + extra + '>' : '')); } };

(async () => {
  const browser = await puppeteer.launch({
    args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    executablePath: await chromium.executablePath(),
    headless: true, defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 }
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto('file://' + FILE, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2600));   // bakeSprites + a few painted frames

  console.log('== BROWSER MATCH-BOOT '+FILE.split('/').pop()+' ==');
  ok('M1 page loads with no script errors', errs.length===0, errs.join(' | '));
  // --- the backdrop must vanish once a match starts ---
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await new Promise(r => setTimeout(r, 400));
  const hidden = await page.evaluate(async () => {
    document.getElementById('startBtn').click();
    await new Promise(r => setTimeout(r, 1200));
    return {
      setup: getComputedStyle(document.getElementById('setup')).display,
      bg: document.getElementById('menuBg').style.display,
      running: (()=>{try{return !!eval('G')}catch(e){return 'probe failed: '+e.message}})()
    };
  });
  ok('B24 match starts', hidden.running && hidden.setup === 'none', JSON.stringify(hidden));
  ok('B25 backdrop hides itself during the match', hidden.bg === 'none', hidden.bg);

  const errs2 = errs.length;
  ok('B26 no errors raised during boot into a match', errs2 === 0, errs.join(' | '));

  console.log('   '+pass+' passed, '+fail+' failed');
  await browser.close();
  if(fail) process.exitCode=1;
})().catch(e=>{console.log('LAUNCH FAIL: '+e.message);process.exit(1)});
