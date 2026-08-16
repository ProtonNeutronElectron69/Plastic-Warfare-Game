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

  console.log('== BROWSER ' + FILE.split('/').pop() + ' ==');
  ok('B1 page loads with no script errors', errs.length === 0, errs.join(' | '));

  const d = await page.evaluate(() => {
    const cs = el => el ? getComputedStyle(el) : null;
    const setup = document.getElementById('setup');
    const h1 = setup.querySelector('h1');
    const opt = setup.querySelector('.opt');
    const sel = setup.querySelector('.opt.sel');
    const start = document.getElementById('startBtn');
    const label = setup.querySelector('.slabel');
    const bg = document.getElementById('menuBg');

    // sample the live backdrop away from the centre, where the smoke is thin
    let px = null, opaque = 0, distinct = 0;
    if (bg) {
      const c = bg.getContext('2d');
      const id = c.getImageData(0, 0, bg.width, bg.height).data;
      const seen = new Set();
      for (let i = 0; i < id.length; i += 4 * 977) {
        if (id[i + 3] > 20) opaque++;
        seen.add((id[i] >> 4) + ',' + (id[i + 1] >> 4) + ',' + (id[i + 2] >> 4));
      }
      distinct = seen.size;
      px = { w: bg.width, h: bg.height, sampled: Math.floor(id.length / (4 * 977)) };
    }
    return {
      h1: { size: cs(h1).fontSize, family: cs(h1).fontFamily, shadow: cs(h1).textShadow, stroke: cs(h1).webkitTextStrokeWidth },
      opt: { shadow: cs(opt).boxShadow, radius: cs(opt).borderRadius, bg: cs(opt).backgroundImage, cursor: cs(opt).cursor },
      sel: sel ? { bg: cs(sel).backgroundImage, color: cs(sel).color } : null,
      start: { size: cs(start).fontSize, shadow: cs(start).boxShadow, rect: start.getBoundingClientRect().toJSON() },
      label: { family: cs(label).fontFamily, spacing: cs(label).letterSpacing },
      setupCursor: cs(setup).cursor,
      seam: !!getComputedStyle(opt, '::after').backgroundImage.includes('gradient'),
      canvas: px, opaque, distinct,
      docW: document.documentElement.scrollWidth, winW: window.innerWidth,
      titleTop: h1.getBoundingClientRect().top
    };
  });

  // --- A's chrome is really applied ---
  ok('B2 title uses the Trebuchet display face', /Trebuchet/i.test(d.h1.family), d.h1.family);
  ok('B3 title is the 56px moulded size', d.h1.size === '56px', d.h1.size);
  ok('B4 title carries the stacked emboss (4+ shadow layers)',
     (d.h1.shadow.match(/rgb/g) || []).length >= 4, d.h1.shadow.slice(0, 60));
  ok('B5 title is filled, not outlined (B was outlined)',
     !d.h1.stroke || d.h1.stroke === '0px', d.h1.stroke);
  ok('B6 buttons have the plastic extrusion + inset bevel',
     /inset/.test(d.opt.shadow) && (d.opt.shadow.match(/rgb/g) || []).length >= 3, d.opt.shadow.slice(0, 70));
  ok('B7 buttons are 11px-rounded moulded tabs', d.opt.radius === '11px', d.opt.radius);
  ok('B8 button face is a gradient, not flat', /gradient/.test(d.opt.bg), d.opt.bg.slice(0, 40));
  ok('B9 mould seam pseudo-element present', d.seam);
  ok('B10 selected option is the yellow plastic', d.sel && /gradient/.test(d.sel.bg) && d.sel.color === 'rgb(43, 34, 0)', d.sel && d.sel.color);
  ok('B11 section labels use the Courier stamp face', /Courier/i.test(d.label.family), d.label.family);
  ok('B12 label letter-spacing is the wide stamp setting', parseFloat(d.label.spacing) >= 3, d.label.spacing);
  ok('B13 START is the 24px loud control', d.start.size === '24px', d.start.size);
  ok('B14 custom cursor applied to the setup screen', /url\(/.test(d.setupCursor), d.setupCursor.slice(0, 40));
  ok('B15 buttons get the pointer-variant cursor', /url\(/.test(d.opt.cursor) && d.opt.cursor !== d.setupCursor);

  // --- B's backdrop is really painting ---
  ok('B16 backdrop canvas matches the viewport', d.canvas && d.canvas.w === 1440 && d.canvas.h === 900, JSON.stringify(d.canvas));
  ok('B17 backdrop covers the viewport', d.opaque > d.canvas.sampled * 0.97, d.opaque + '/' + d.canvas.sampled);
  ok('B18 backdrop has real tonal variety (floor + troops)', d.distinct >= 12, 'distinct=' + d.distinct);

  // --- controls are not squeezed by the overflowing column flex box ---
  const squeeze = await page.evaluate(() => {
    const bad = [];
    const all = [document.getElementById('startBtn'), document.getElementById('infoBtn'),
                 ...document.querySelectorAll('#setup .opt'), ...document.querySelectorAll('#setup .card')];
    for (const e of all) {
      if (!e || !e.offsetParent) continue;
      if (e.scrollHeight > e.clientHeight + 1)
        bad.push((e.id || e.className) + ' clip ' + e.clientHeight + '<' + e.scrollHeight);
    }
    const shrinkable = [...document.getElementById('setup').children]
      .filter(e => getComputedStyle(e).flexShrink !== '0')
      .map(e => e.id || e.className || e.tagName);
    return { bad, shrinkable };
  });
  ok('B27 no control is vertically clipped', squeeze.bad.length === 0, squeeze.bad.join(' | '));
  ok('B28 direct children of the setup column cannot shrink',
     squeeze.shrinkable.length === 0, squeeze.shrinkable.join(','));

  // --- layout holds ---
  ok('B19 no horizontal overflow at 1440', d.docW <= d.winW + 1, d.docW + ' vs ' + d.winW);
  ok('B20 title is not clipped off the top', d.titleTop >= 0, d.titleTop);

  for (const w of [1024, 768]) {
    await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
    await new Promise(r => setTimeout(r, 700));
    const r = await page.evaluate(() => ({
      docW: document.documentElement.scrollWidth, winW: window.innerWidth,
      cw: document.getElementById('menuBg').width,
      startVisible: document.getElementById('startBtn').getBoundingClientRect().width > 100
    }));
    ok('B21@' + w + ' no horizontal overflow', r.docW <= r.winW + 1, r.docW + ' vs ' + r.winW);
    ok('B22@' + w + ' backdrop resized with the window', r.cw === w, r.cw);
    ok('B23@' + w + ' START still laid out', r.startVisible);
  }

  if (PNG) { await page.goto('file://' + FILE, { waitUntil: 'networkidle0' }); await new Promise(r => setTimeout(r, 2600)); await page.screenshot({ path: PNG }); console.log('   shot -> ' + PNG); }
  console.log('   ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  if (fail) process.exitCode = 1;
})().catch(e => { console.log('LAUNCH FAIL: ' + e.message); process.exit(1); });
