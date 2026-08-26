/* dump_base_v95.js - render the phase-4 sprites' painters raw, at 6x logical
   resolution, straight out of the game itself.

   This is STEP ONE of the texture pipeline (step two is material_v95.py):
   open the built game headless, call each sprite's own painter -
   trooperBody / vehBody / bldBody - into a canvas shaped exactly like its
   runtime bake box, and save the result as a PNG. No enrichCell: the
   material pass bakes its own finish. Because the geometry comes from the
   very painter the game falls back to, the texture can never drift out of
   register with the live-drawn parts (weapons, turrets, rotors) that layer
   on top of the baked cell at runtime.

   Needs: node with playwright-core resolvable, and a Chromium binary
   (CHROMIUM env var, or the playwright default install). Run from anywhere;
   paths are repo-relative. This is a GENERATION tool, not a build tool -
   the build needs only embed_img.py and the committed PNGs.

     node tools/dump_base_v95.js          # writes tools/_base_v95/<id>.png

   Adding a sprite in a later cut: add a spec below (kind decides the
   painter and the box source), re-run both steps, then embed_img.py. */
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, '_base_v95');
fs.mkdirSync(OUT, { recursive: true });

const SPECS = [
  ...[0, 1, 2, 3, 4].map(i => ({ id: 'inf_runner_blue_' + i, kind: 'inf', key: 'runner', fac: 'blue', frame: i })),
  { id: 'veh_cmdtruck_green', kind: 'veh', key: 'cmdtruck', fac: 'green' },
  { id: 'veh_firebomb_tan', kind: 'veh', key: 'firebomb', fac: 'tan' },
  { id: 'veh_choktaw_gray', kind: 'veh', key: 'choktaw', fac: 'gray' },
  { id: 'bld_fwdpad_blue', kind: 'bld', key: 'fwdpad', fac: 'blue' },
  { id: 'bld_cmdpost_green', kind: 'bld', key: 'cmdpost', fac: 'green' },
  { id: 'bld_foundry_tan', kind: 'bld', key: 'foundry', fac: 'tan' },
  { id: 'bld_bunker_gray', kind: 'bld', key: 'bunker', fac: 'gray' },
];

(async () => {
  const exe = process.env.CHROMIUM || undefined;
  const br = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
  const pg = await br.newPage();
  await pg.goto('file://' + path.join(ROOT, 'harness', 'pw.html'));
  await pg.waitForTimeout(800);
  const res = await pg.evaluate((specs) => {
    const RS = 6, out = {};
    for (const s of specs) {
      let box, paint;
      const col = FAC[s.fac].color;
      if (s.kind === 'inf') {
        box = [-22, -31, 22, 10];
        const bob = s.frame * .5 - 1;
        paint = c => trooperBody(c, s.key, col, bob);
      } else if (s.kind === 'veh') {
        box = VEH_BOX[s.key] || [-24, -16, 24, 16];
        paint = c => vehBody(c, s.key, col);
      } else {
        const sz = B[s.key].sz, S = sz * HW, HD = sz * HH;
        box = BLD_BOX[s.key] || [-S - 10, -Math.max(70, S * 1.2), S + 10, HD * 1.58 + 8];
        paint = c => bldBody(c, s.key, col, sz);
      }
      const [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0;
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(w * RS); cv.height = Math.ceil(h * RS);
      const c = cv.getContext('2d'); c.scale(RS, RS); c.translate(-x0, -y0);
      BAKING = true; try { c.save(); paint(c); c.restore(); } finally { BAKING = false; }
      out[s.id] = cv.toDataURL('image/png');
    }
    return out;
  }, SPECS);
  for (const id in res) fs.writeFileSync(path.join(OUT, id + '.png'), Buffer.from(res[id].split(',')[1], 'base64'));
  console.log('wrote', Object.keys(res).length, 'base renders to', OUT);
  await br.close();
})();
