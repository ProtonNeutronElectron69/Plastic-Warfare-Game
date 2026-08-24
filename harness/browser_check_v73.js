/* browser_check_v73.js — real-Chromium GEOMETRY gate for the v73 HUD relayout.

   This exists because nothing in the headless harness can answer the question
   the release turns on. The shim has no layout engine: getBoundingClientRect is
   a stub, offsetHeight does not exist, and every CSS rule is an inert string.
   tail_v73 sections A and B stay strictly inside what the game COMPUTES for
   itself and say so; this is the other half.

   What is checked, at three viewport sizes:
     - the minimap really lands in the bottom-right corner, 8px off each edge
     - the selection panel never runs under it, at any minimap size
     - the right rail stops clear of the minimap's top edge
     - the HQ button sits at the LEFT edge, directly above the selection panel
     - none of the four collide with each other

     node browser_check_v73.js <file.html> [pngPrefix]                        */
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium').default;

const FILE = process.argv[2];
const PNG = process.argv[3];
let pass = 0, fail = 0;
const ok = (n, c, extra) => {
  if (c) pass++; else { fail++; console.log('  FAIL: ' + n + (extra ? '  <' + extra + '>' : '')); }
};
const overlap = (a, b) => !(a.right <= b.left || b.right <= a.left ||
                            a.bottom <= b.top || b.bottom <= a.top);

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
  await new Promise(r => setTimeout(r, 2600));

  console.log('== BROWSER v73 HUD GEOMETRY ' + FILE.split('/').pop() + ' ==');
  ok('G0 page loads with no script errors', errs.length === 0, errs.join(' | '));

  await page.evaluate(async () => {
    document.getElementById('startBtn').click();
    await new Promise(r => setTimeout(r, 1500));
  });
  const running = await page.evaluate(() => { try { return !!eval('G') } catch (e) { return false } });
  ok('G0 a match is running', running);

  const VIEWS = (process.env.VIEWS||"1440x900").split(",").map(s=>s.split("x").map(Number));
  const SIZES = (process.env.SIZES||'medium').split(',');

  for (const [w, h] of VIEWS) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await new Promise(r => setTimeout(r, 500));

    for (const sz of SIZES) {
      const m = await page.evaluate(async (size) => {
        // drive the real size cycle rather than poking MM_S
        for (let i = 0; i < 4; i++) {
          if (eval('mmSizeKey') === size) break;
          document.getElementById('mmSizeBtn').click();
        }
        // put a building on the panel so it is at its TALLEST
        eval('(function(){var p=G.human,hq=p.blds.find(function(b){return b.key==="hq"});' +
             'p.res.p=999999;p.res.e=999999;setSel([hq]);})()');
        await new Promise(r => setTimeout(r, 350));
        const R = id => {
          const e = document.getElementById(id);
          const r = e.getBoundingClientRect();
          return { top: r.top, left: r.left, right: r.right, bottom: r.bottom,
                   w: r.width, h: r.height, vis: getComputedStyle(e).display !== 'none' };
        };
        return { mm: R('minimapWrap'), sel: R('selPanel'), rail: R('rightRail'),
                 hq: R('hqBtn'), bar: R('bottombar'),
                 vw: innerWidth, vh: innerHeight, size: eval('mmSizeKey'), mms: eval('MM_S') };
      }, sz);

      const tag = w + 'x' + h + '/' + sz;
      ok(`G1 ${tag} the size cycle really landed on ${sz}`, m.size === sz);

      // --- the minimap is in the corner ---
      ok(`G2 ${tag} minimap is 8px off the right edge`, Math.abs(m.vw - m.mm.right - 8) < 1.5,
         'right=' + m.mm.right.toFixed(1) + ' vw=' + m.vw);
      ok(`G2 ${tag} minimap is 8px off the bottom edge`, Math.abs(m.vh - m.mm.bottom - 8) < 1.5,
         'bottom=' + m.mm.bottom.toFixed(1) + ' vh=' + m.vh);

      // --- and nothing runs under it ---
      ok(`G3 ${tag} the selection panel does not run under the minimap`,
         !overlap(m.sel, m.mm),
         'sel.right=' + m.sel.right.toFixed(1) + ' mm.left=' + m.mm.left.toFixed(1));
      ok(`G3 ${tag} the right rail stops above the minimap`,
         !overlap(m.rail, m.mm),
         'rail.bottom=' + m.rail.bottom.toFixed(1) + ' mm.top=' + m.mm.top.toFixed(1));
      ok(`G3 ${tag} the HQ button does not run under the minimap`, !overlap(m.hq, m.mm));

      // --- the HQ button is at the left edge, directly above the panel ---
      ok(`G4 ${tag} the HQ button is visible`, m.hq.vis && m.hq.h > 8);
      ok(`G4 ${tag} ...at the LEFT edge, aligned with the panel`,
         Math.abs(m.hq.left - m.sel.left) < 1.5 && m.hq.left < 20,
         'hq.left=' + m.hq.left.toFixed(1) + ' sel.left=' + m.sel.left.toFixed(1));
      ok(`G4 ${tag} ...and DIRECTLY above it, not beside it`,
         m.hq.bottom <= m.sel.top + 0.5 && (m.sel.top - m.hq.bottom) < 14,
         'gap=' + (m.sel.top - m.hq.bottom).toFixed(1));
      ok(`G4 ${tag} ...and it did not get squeezed flat by the column flex (v58 trap)`,
         m.hq.h >= 20, 'h=' + m.hq.h.toFixed(1));

      // --- the panel still stretches, it just stops short of the map ---
      ok(`G5 ${tag} the selection panel still fills the width it is given`,
         // v90.1: 1240 held twelve tiles and every Construct menu is thirteen
         m.sel.w > Math.min(1340, m.vw - m.mms - 56) - 4,
         'sel.w=' + m.sel.w.toFixed(1));
      ok(`G5 ${tag} the panel is tall enough to hold a Construct row`, m.sel.h >= 118);
    }
  }

  if (PNG) {
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: PNG });
    console.log('  wrote ' + PNG);
  }

  await browser.close();
  console.log('PASS: ' + pass + '   FAIL: ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('THREW: ' + e.message); process.exit(2); });
