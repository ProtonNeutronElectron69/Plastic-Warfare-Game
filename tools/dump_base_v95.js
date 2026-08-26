/* dump_base_v95.js - render every baked sprite's painter raw, at 6x logical
   resolution, straight out of the game itself.

   This is STEP ONE of the texture pipeline (step two is material_v95.py):
   open the built game headless and call each sprite's own painter -
   trooperBody / vehBody / bldBody - into a canvas shaped exactly like its
   runtime bake box, once per faction that can field it, and save each
   result as a PNG. No enrichCell: the material pass bakes its own finish.
   Because the geometry comes from the very painter the game falls back to,
   the texture can never drift out of register with the live-drawn parts
   (weapons, turrets, rotors) that layer on top of the baked cell at runtime.

   THE ROSTER IS DERIVED, NOT LISTED. Every infantry row gets its 5 bob
   frames, every vehicle row its hull, every non-wall building its body -
   in all four army colours for a shared row, in the owner's colour alone
   for a faction exclusive (the bake creates cells for the other colours
   too, but no army can ever field them, so the painter covers those).
   The wildlife nest is skipped on the same logic one level up: it belongs
   to the bug faction, which the sprite bake itself excludes, so its cells
   are never blitted at all. Add a unit to U or a building to B and the
   next run of this tool renders it; nothing here needs editing.

   Needs: node with playwright-core resolvable, and a Chromium binary
   (CHROMIUM env var, or the playwright default install). This is a
   GENERATION tool, not a build tool - the build needs only embed_img.py
   and the committed textures.

     node tools/dump_base_v95.js          # writes tools/_base_v95/<id>.png */
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, '_base_v95');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const exe = process.env.CHROMIUM || undefined;
  const br = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
  const pg = await br.newPage();
  await pg.goto('file://' + path.join(ROOT, 'harness', 'pw.html'));
  await pg.waitForTimeout(800);

  const ids = await pg.evaluate(() => {
    const RS = 6, out = [];
    const facs = Object.keys(FAC).filter(f => f !== 'bug');
    const excl = {};
    for (const f of facs) { for (const k of FAC[f].uu) excl[k] = f; for (const k of FAC[f].ub) excl[k] = f; }
    const facsOf = k => excl[k] ? [excl[k]] : facs;
    const render = (id, box, paint) => {
      const [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0;
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(w * RS); cv.height = Math.ceil(h * RS);
      const c = cv.getContext('2d'); c.scale(RS, RS); c.translate(-x0, -y0);
      BAKING = true; try { c.save(); paint(c); c.restore(); } finally { BAKING = false; }
      out.push([id, cv.toDataURL('image/png')]);
    };
    for (const key in U) {
      if (U[key].a === 'inf') {
        for (const f of facsOf(key)) for (let i = 0; i < 5; i++) {
          const bob = i * .5 - 1;
          render('inf_' + key + '_' + f + '_' + i, [-22, -31, 22, 10], c => trooperBody(c, key, FAC[f].color, bob));
        }
      } else {
        const bx = VEH_BOX[key] || [-24, -16, 24, 16];
        for (const f of facsOf(key)) render('veh_' + key + '_' + f, bx, c => vehBody(c, key, FAC[f].color));
      }
    }
    for (const k in B) {
      if (B[k].barr || k === 'nest') continue;
      const sz = B[k].sz, S = sz * HW, HD = sz * HH;
      const box = BLD_BOX[k] || [-S - 10, -Math.max(70, S * 1.2), S + 10, HD * 1.58 + 8];
      for (const f of facsOf(k)) render('bld_' + k + '_' + f, box, c => bldBody(c, k, FAC[f].color, sz));
    }
    return out;
  });
  for (const [id, url] of ids) fs.writeFileSync(path.join(OUT, id + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', ids.length, 'base renders to', OUT);
  await br.close();
})();
