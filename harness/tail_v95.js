/* tail_v95.js - T71: roadmap 3, phase 4 (first cut). Real textures for one
   unit and one structure per army, riding the manifest as data: URLs and
   entering the game through the sprite bake.

     A  the roster: each army's exclusive unit and one exclusive structure
     B  the data: real PNGs, shipped inside the page, byte-equal to assets/img
     C  the seam: bakeSprites prefers a texture, falls back to the painter
     D  the guard rails: rebake-on-late-assets, the headless warn gate
     E  client-local, sim-silent

   The textures are OFFLINE-RENDERED from the game's own painters plus a
   per-pixel material pass (plastic grain, mold seams, wear, relight), the
   same honesty as v92's sounds: each is one PNG in assets/img/, swappable
   for real art one file at a time via tools/embed_img.py. The one display
   fix riding along: the Choktaw had no VEH_BOX entry, so it baked in the
   48-wide default and its tail boom (painted to x=-31.3) was clipped off
   every sprite since v88. */
'use strict';
section('T71 v95: textures in the manifest, and the bake seam that uses them');

const fs71 = require('fs');

/* ---------- A: the roster ---------- */
{
  section('T71.A one exclusive unit and one exclusive structure per army');

  /* transcribed on purpose (rule 5): growing the set is a conscious edit
     here. 5 walk frames for the one infantryman; single cells otherwise. */
  const want = [
    'inf_runner_blue_0', 'inf_runner_blue_1', 'inf_runner_blue_2', 'inf_runner_blue_3', 'inf_runner_blue_4',
    'veh_cmdtruck_green', 'veh_firebomb_tan', 'veh_choktaw_gray',
    'bld_fwdpad_blue', 'bld_cmdpost_green', 'bld_foundry_tan', 'bld_bunker_gray'];
  const keys = Object.keys(ASSET_MANIFEST.img).sort();
  ok(`T71.A the manifest img half holds exactly the 12 first-cut textures (${keys.length})`,
    keys.length === want.length && want.slice().sort().every((k, i) => k === keys[i]));

  /* derived, both directions: every key names a real row of the right kind,
     owned by the faction in the key - so a rename in U/B fires here */
  const parse = k => k.match(/^(inf|veh|bld)_([a-z]+)_(blue|green|tan|gray)(?:_([0-4]))?$/);
  ok('T71.A every key parses as kind_row_faction and names a real exclusive',
    keys.every(k => {
      const m = parse(k); if (!m) return false;
      const [, kind, row, fac, fr] = m;
      if (kind === 'inf') return U[row] && U[row].a === 'inf' && fr !== undefined && FAC[fac].uu.includes(row);
      if (kind === 'veh') return U[row] && U[row].a !== 'inf' && fr === undefined && FAC[fac].uu.includes(row);
      return B[row] && !B[row].barr && fr === undefined && FAC[fac].ub.includes(row);
    }));
  ok('T71.A all four armies are covered, unit and structure both',
    ['blue', 'green', 'tan', 'gray'].every(f =>
      keys.some(k => k.endsWith('_' + f) && !k.startsWith('bld_') || /^inf_.*_[0-4]$/.test(k) && k.includes('_' + f + '_')) &&
      keys.some(k => k.startsWith('bld_') && k.endsWith('_' + f))));
}

/* ---------- B: the data ---------- */
{
  section('T71.B real PNGs, inside the page, byte-equal to assets/img');

  const keys = Object.keys(IMG_B64);
  ok('T71.B IMG_B64 and the manifest agree key for key',
    keys.length === Object.keys(ASSET_MANIFEST.img).length && keys.every(k => ASSET_MANIFEST.img[k]));
  ok('T71.B every texture url is a data: url, so the double-clicked file needs no folder beside it',
    keys.every(k => ASSET_MANIFEST.img[k].startsWith('data:image/png;base64,')));

  let badPng = [], total = 0;
  for (const k of keys) {
    let buf = null;
    try { buf = Buffer.from(IMG_B64[k], 'base64'); } catch (e) { }
    if (!buf || buf.length < 1024 || buf.readUInt32BE(0) !== 0x89504e47) badPng.push(k);
    else total += buf.length;
  }
  ok('T71.B every texture decodes from base64 and opens on the PNG signature' + (badPng.length ? ' [' + badPng.slice(0, 3).join(', ') + ']' : ''),
    badPng.length === 0);
  ok(`T71.B the whole set stays under three quarters of a megabyte (${Math.round(total / 1024)} kB)`,
    total > 100 * 1024 && total < 768 * 1024);

  /* committed twice on purpose, like the sounds: auditable files a human can
     view and replace one at a time, and the base64 the game actually reads.
     This is the check that the two can never quietly disagree. */
  let files = [];
  try { files = fs71.readdirSync('../assets/img').filter(f => f.endsWith('.png')).sort(); } catch (e) { }
  const sk = keys.slice().sort();
  ok(`T71.B assets/img holds exactly the embedded textures (${files.length} files)`,
    files.length === sk.length && files.every((f, i) => f.slice(0, -4) === sk[i]));
  let drifted = [];
  for (const f of files) {
    const disk = fs71.readFileSync('../assets/img/' + f).toString('base64');
    if (disk !== IMG_B64[f.slice(0, -4)]) drifted.push(f);
  }
  ok('T71.B every embedded texture is byte-identical to its file - re-run tools/embed_img.py if not' +
    (drifted.length ? ' [' + drifted.join(', ') + ']' : ''), drifted.length === 0);
  const order = fs71.readFileSync('../source/order.txt', 'utf8');
  ok('T71.B 02d-img-data.js ships right after the sound data',
    order.indexOf('02c-snd-data.js\n02d-img-data.js\n03-audio.js') >= 0);
  ok('T71.B the generated file says who generates it',
    fs71.readFileSync('../source/js/02d-img-data.js', 'utf8').indexOf('GENERATED by tools/embed_img.py') >= 0);
}

/* ---------- C: the seam ---------- */
{
  section('T71.C bakeSprites prefers a texture and keeps every painter');

  const src = bakeSprites.toString();
  ok('T71.C all three bake sites ask imgAsset first',
    src.indexOf("imgAsset('inf_'+key+'_'+f+'_'+i)") >= 0 &&
    src.indexOf("imgAsset('veh_'+key+'_'+f)") >= 0 &&
    src.indexOf("imgAsset('bld_'+k+'_'+f)") >= 0);
  ok('T71.C ...and every procedural painter survives behind them as the fallback',
    src.indexOf('trooperBody(') >= 0 && src.indexOf('vehBody(') >= 0 && src.indexOf('bldBody(') >= 0);

  /* the cell a texture becomes must be indistinguishable in shape from the
     cell a painter bakes - driven, not read, with a stub image (headless
     drawImage is a no-op, which is exactly the point: geometry only) */
  const a = cellFromImg({ width: 10, height: 10 }, -22, -31, 22, 10);
  const b = bakeCell(-22, -31, 22, 10, () => { });
  ok('T71.C cellFromImg returns the exact cell shape bakeCell does',
    a.w === b.w && a.h === b.h && a.ax === b.ax && a.ay === b.ay &&
    a.cv.width === b.cv.width && a.cv.height === b.cv.height && !!a.sil);

  ok('T71.C headless, imgAsset is null for every real key, so the whole suite tests the painters',
    imgAsset('inf_runner_blue_2') === null && imgAsset('bld_bunker_gray') === null);

  /* the display fix riding along: the Choktaw finally owns a bake box wide
     enough for its tail (painted to x=-31.3 at its 1.08 scale) */
  ok('T71.C the Choktaw owns a VEH_BOX entry that no longer clips its tail boom',
    VEH_BOX.choktaw && VEH_BOX.choktaw[0] === -33 && VEH_BOX.choktaw[2] === 18);
}

/* ---------- D: the guard rails ---------- */
{
  section('T71.D late assets re-bake once; headless never warns about them');

  /* driven: pretend the bake ran before the load resolved, then let the
     guard notice. Headless the manifest never loads, so a fake entry stands
     in for "a texture arrived". */
  G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'blue', opp: 3, seed: 950002 });
  const before = SPR.veh.truck && SPR.veh.truck.blue;
  SPR.assets = false; ASSETS.img._t71 = { width: 1, height: 1 };
  rebakeIfAssetsLate();
  ok('T71.D a bake that ran before the assets is re-run once they land',
    SPR.done === true && SPR.veh.truck.blue !== before);
  delete ASSETS.img._t71;
  ok('T71.D ...and a bake that already saw the assets is left alone',
    (() => { const c = SPR.veh.truck.blue; rebakeIfAssetsLate(); return SPR.veh.truck.blue === c; })());
  ok('T71.D the page-open load is the hook that fires the guard',
    fs71.readFileSync('../source/js/28-menu-backdrop.js', 'utf8').indexOf('assetsLoad().then(rebakeIfAssetsLate)') >= 0);

  /* the v95 lesson about Node: global fetch EXISTS under the shim, so the
     "files went missing" warn must gate on Image, which does not */
  ok('T71.D the missing-asset warn gates on Image, not just fetch',
    assetsLoad.toString().indexOf("typeof Image==='function'") >= 0);
}

/* ---------- E: client-local, sim-silent ---------- */
{
  section('T71.E textures may decide what you see, never what happens');

  const h = hashState(), snap = saveState();
  rebakeIfAssetsLate(); render();
  ok('T71.E a re-bake and a full frame move neither hash nor snapshot',
    hashState() === h && saveState() === snap);
  ok('T71.E no serializer mentions the texture layer',
    ['IMG_B64', 'cellFromImg', 'ASSETS'].every(w =>
      hashState.toString().indexOf(w) < 0 && saveState.toString().indexOf(w) < 0 && loadState.toString().indexOf(w) < 0));
  ok('T71.E the bake seam never touches the seeded stream',
    cellFromImg.toString().indexOf('srand') < 0 && rebakeIfAssetsLate.toString().indexOf('srand') < 0);
  REN_ERRS.clear(); render();
  ok('T71.E a full frame renders headless through the fallback painters, error-free', REN_ERRS.size === 0);
}
