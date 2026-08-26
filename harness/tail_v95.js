/* tail_v95.js - T71: roadmap 3, phase 4. Real textures for the WHOLE baked
   roster - every unit's five walk frames or hull and every non-wall
   building, in all four colours for shared rows and the owner's colour for
   exclusives - riding the manifest as data: URLs and entering the game
   through the sprite bake.

     A  the roster: derived from U/B/FAC, so a new row fires until textured
     B  the data: real images (webp), shipped inside the page, byte-equal
        to assets/img
     C  the seam: bakeSprites prefers a texture, falls back to the painter
     D  the guard rails: rebake-on-late-assets, the headless warn gate
     E  client-local, sim-silent

   The textures are OFFLINE-RENDERED from the game's own painters plus a
   per-pixel material pass (plastic grain, mold seams, wear - see
   tools/material_v95.py for the recipe and the relight dead end), the same
   honesty as v92's sounds: each is one file in assets/img/, swappable for
   real art one file at a time via tools/embed_img.py. The one display fix
   riding along: the Choktaw had no VEH_BOX entry, so it baked in the
   48-wide default and its tail boom (painted to x=-31.3) was clipped off
   every sprite since v88. */
'use strict';
section('T71 v95: textures in the manifest, and the bake seam that uses them');

const fs71 = require('fs');

/* ---------- A: the roster ---------- */
{
  section('T71.A the whole roster is textured, derived from the tables');

  /* DERIVED, both directions, from the same rule the generator uses: every
     infantry row gets 5 frames, every vehicle its hull, every non-wall
     building its body - in all four colours for a shared row, in the
     owner's colour alone for a faction exclusive. The wildlife nest is out
     because it belongs to the bug faction, which the bake excludes. A row
     added to U or B fires here until the texture pipeline is re-run
     (dump_base_v95.js + material_v95.py + embed_img.py) - which is the
     conscious step a textured game demands of a new unit. */
  const facs = Object.keys(FAC).filter(f => f !== 'bug');
  const excl = {};
  for (const f of facs) { for (const k of FAC[f].uu) excl[k] = f; for (const k of FAC[f].ub) excl[k] = f; }
  const facsOf = k => excl[k] ? [excl[k]] : facs;
  const want = [];
  for (const k in U) {
    if (U[k].a === 'inf') { for (const f of facsOf(k)) for (let i = 0; i < 5; i++) want.push('inf_' + k + '_' + f + '_' + i); }
    else for (const f of facsOf(k)) want.push('veh_' + k + '_' + f);
  }
  for (const k in B) { if (B[k].barr || k === 'nest') continue; for (const f of facsOf(k)) want.push('bld_' + k + '_' + f); }
  /* v96: the manifest's img half now also carries the normal maps under
     nrm_ keys - T72 (tail_v96) owns that half; this roster pin scopes to
     the textures */
  const keys = Object.keys(ASSET_MANIFEST.img).filter(k => !k.startsWith('nrm_')).sort();
  const ws = want.sort();
  const miss = ws.filter(k => !ASSET_MANIFEST.img[k]), extra = keys.filter(k => ws.indexOf(k) < 0);
  ok(`T71.A the manifest holds a texture for every baked sprite the tables define (${keys.length})` +
    (miss.length ? ' missing [' + miss.slice(0, 3).join(', ') + ']' : '') +
    (extra.length ? ' extra [' + extra.slice(0, 3).join(', ') + ']' : ''),
    miss.length === 0 && extra.length === 0);
}

/* ---------- B: the data ---------- */
{
  section('T71.B real PNGs, inside the page, byte-equal to assets/img');

  const keys = Object.keys(IMG_B64);
  ok('T71.B IMG_B64 and the manifest agree key for key', // v96: the nrm_ half is T72's
    keys.length === Object.keys(ASSET_MANIFEST.img).filter(k => !k.startsWith('nrm_')).length &&
    keys.every(k => ASSET_MANIFEST.img[k]));
  /* webp because the full roster as png is ~5.8 MB and as q95 webp is 4-6x
     smaller at a mean error under 0.7/255 - and a browser that could not
     decode one would fall back to the painter like any missing file */
  ok('T71.B every texture url is a data: url in its own declared format',
    keys.every(k => ASSET_MANIFEST.img[k].startsWith('data:' + IMG_MIME[k] + ';base64,')));

  const SIG = {
    'image/webp': b => b.length > 16 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
    'image/png': b => b.length > 16 && b.readUInt32BE(0) === 0x89504e47,
  };
  let badSig = [], total = 0;
  for (const k of keys) {
    let buf = null;
    try { buf = Buffer.from(IMG_B64[k], 'base64'); } catch (e) { }
    if (!buf || buf.length < 512 || !SIG[IMG_MIME[k]] || !SIG[IMG_MIME[k]](buf)) badSig.push(k);
    else total += buf.length;
  }
  ok('T71.B every texture decodes from base64 and opens on its format signature' + (badSig.length ? ' [' + badSig.slice(0, 3).join(', ') + ']' : ''),
    badSig.length === 0);
  ok(`T71.B the whole set stays under two and a half megabytes (${Math.round(total / 1024)} kB)`,
    total > 500 * 1024 && total < 2560 * 1024);

  /* committed twice on purpose, like the sounds: auditable files a human can
     view and replace one at a time, and the base64 the game actually reads.
     This is the check that the two can never quietly disagree. */
  let files = [];
  try { files = fs71.readdirSync('../assets/img').filter(f => /\.(webp|png)$/.test(f)).sort(); } catch (e) { }
  const sk = keys.slice().sort();
  ok(`T71.B assets/img holds exactly the embedded textures (${files.length} files)`,
    files.length === sk.length && files.every((f, i) => f.replace(/\.(webp|png)$/, '') === sk[i]));
  let drifted = [];
  for (const f of files) {
    const disk = fs71.readFileSync('../assets/img/' + f).toString('base64');
    if (disk !== IMG_B64[f.replace(/\.(webp|png)$/, '')]) drifted.push(f);
  }
  ok('T71.B every embedded texture is byte-identical to its file - re-run tools/embed_img.py if not' +
    (drifted.length ? ' [' + drifted.join(', ') + ']' : ''), drifted.length === 0);
  const order = fs71.readFileSync('../source/order.txt', 'utf8');
  /* v96: the normal-map data (02e) slid in behind the textures, so the
     pinned run grew a line - the same conscious growth T67.E took at v95 */
  ok('T71.B 02d-img-data.js ships right after the sound data',
    order.indexOf('02c-snd-data.js\n02d-img-data.js\n02e-nrm-data.js\n03-audio.js') >= 0);
  ok('T71.B the generated file says who generates it',
    fs71.readFileSync('../source/js/02d-img-data.js', 'utf8').indexOf('GENERATED by tools/embed_img.py') >= 0);
}

/* ---------- C: the seam ---------- */
{
  section('T71.C bakeSprites prefers a texture and keeps every painter');

  const src = bakeSprites.toString();
  /* v96: each site now builds the id once (the normal map reuses it), so
     the pinned shape moved from imgAsset('inf_...') to id='inf_...' */
  ok('T71.C all three bake sites ask imgAsset first',
    src.indexOf("id='inf_'+key+'_'+f+'_'+i,im=imgAsset(id)") >= 0 &&
    src.indexOf("id='veh_'+key+'_'+f,im=imgAsset(id)") >= 0 &&
    src.indexOf("id='bld_'+k+'_'+f,im=imgAsset(id)") >= 0);
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
