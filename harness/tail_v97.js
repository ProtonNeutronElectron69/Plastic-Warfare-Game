/* tail_v97.js - T74: the detail & resolution pass. The owner zoomed in and
   found two things: everything soft ("units look blurry"), and the structures
   plain ("large flat surfaces, mostly square shapes"). Two mechanisms fix the
   first - device-pixel rendering (RDPR) and a supersample raise (SS 3 -> 4) -
   and a painter-wide molded-detail pass fixes the second, flowing into the
   texture set because the textures are rendered FROM the painters.

     A  RDPR: device-pixel canvases, CSS-pixel logic, headless unchanged
     B  the detail kit: deterministic, RNG-free, on every main hull
     C  the pipeline grid: SS=4 in game and tools, textures actually at it
     D  client-local, sim-silent

   THE INVARIANT THE WHOLE PASS RESTS ON: RDPR multiplies exactly one thing,
   the renderer's transform. G.zoom, G.cam, MOUSE, audAt and every camera
   clamp stay in CSS pixels (vpW/vpH - derived from the canvas, never a
   second stored copy), so two lockstep clients on different displays agree
   tick for tick, and the headless shim (devicePixelRatio pinned 1) runs the
   exact pre-v97 numbers. Measured in Chromium at deviceScaleFactor 2: the
   frame aligns with the DPR-1 frame at mean 0.77/255 - all of it resolution. */
'use strict';
section('T74 v97: device pixels, a finer bake, and molded detail everywhere');

const fs74 = require('fs');

/* ---------- A: RDPR ---------- */
{
  section('T74.A device-pixel backing, CSS-pixel logic');

  ok('T74.A headless the shim pins devicePixelRatio=1, so RDPR is 1 and nothing moved',
    RDPR === 1 && vpW() === view.width && vpH() === view.height);
  ok('T74.A calcDPR caps at 2 - beyond that the cost quadruples for nothing',
    (() => { const d0 = global.devicePixelRatio; global.devicePixelRatio = 3.5;
      const got = calcDPR(); global.devicePixelRatio = d0; return got === 2; })());

  /* driven: a resize at DPR 2 doubles the backing, pins the CSS size, and
     vpW answers CSS - then everything restores to the shim's world */
  {
    const d0 = global.devicePixelRatio, w0 = view.width, h0 = view.height;
    global.devicePixelRatio = 2; resize();
    const backing2 = view.width === innerWidth * 2 && view.height === innerHeight * 2;
    const css2 = vpW() === innerWidth && view.style.width === innerWidth + 'px';
    const mm2 = mmCv.width === Math.round(MM_S * 2);
    global.devicePixelRatio = d0; resize();
    ok('T74.A resize at DPR 2: backing doubles, style and vpW stay CSS', backing2 && css2);
    ok('T74.A ...and the minimap backing follows so it is as crisp as the field', mm2);
    ok('T74.A ...and a resize back restores the headless world exactly',
      view.width === w0 && view.height === h0 && RDPR === 1 && mmCv.width === Math.round(MM_S));
  }

  /* the one place DPR enters rendering, and the places it must NOT */
  ok('T74.A the world transform is the single scale-up: z = G.zoom*RDPR',
    renderCore.toString().indexOf('const z=G.zoom*RDPR') >= 0);
  ok('T74.A the placement ghost transforms by z*RDPR but mouse-maths by z',
    drawGhost.toString().indexOf('zr=z*RDPR') >= 0 &&
    drawGhost.toString().indexOf('MOUSE.x/z+cx') >= 0);
  ok('T74.A the screen-space overlays ride an RDPR base transform',
    renderCore.toString().indexOf('vc.setTransform(RDPR,0,0,RDPR,0,0)') >= 0 &&
    renderMinimap.toString().indexOf('mm.setTransform(RDPR,0,0,RDPR,0,0)') >= 0);
  ok('T74.A camera logic reads the CSS viewport: edge scroll, clamps, centering, audio pan',
    update.toString().indexOf('vpW()') >= 0 &&
    setZoom.toString().indexOf('vpW()') >= 0 &&
    hqCamTarget.toString().indexOf('vpW()') >= 0 &&
    audAt.toString().indexOf('vpW()') >= 0 &&
    onScreenUnit.toString().indexOf('vpW()') >= 0);
  ok('T74.A both compositors scale their pixel-valued blurs by RDPR',
    compositePost.toString().indexOf('POSTV.bloomBlur*RDPR') >= 0 &&
    compositePost.toString().indexOf('POSTV.tsBlur*RDPR') >= 0);
  /* the bug the first Chromium run caught: a canvas is a REPLACED element,
     so inset:0 positions it but never stretches it - with a device-px
     backing the GL canvas must carry an explicit CSS size or the world
     presents at double size. glSize owns that size now. */
  ok('T74.A the GL post canvas carries an explicit CSS size (replaced elements do not stretch)',
    glSize.toString().indexOf("style.width=Math.round(W/RDPR)+'px'") >= 0);
  ok('T74.A #dpr1 forces the old 1:1 rendering as the escape hatch',
    calcDPR.toString().indexOf('dpr1') >= 0);
}

/* ---------- B: the detail kit ---------- */
{
  section('T74.B molded detail: deterministic, RNG-free, everywhere');

  /* the kit must be deterministic: the offline texture pass re-renders these
     painters once for the color map and once for the normal map's luminance
     shape - detail that moved between renders would shear against its own
     relief. dth is the only randomness-shaped thing in it, and it is a hash. */
  ok('T74.B the hash is a hash - same input, same answer, spread outputs',
    dth(5) === dth(5) && dth(11.5) === dth(11.5) && Math.abs(dth(5) - dth(6)) > 1e-6 &&
    dth(3) >= 0 && dth(3) < 1);
  ok('T74.B no kit helper touches srand or Math.random',
    [wallPanels, wallBolts, wallPlinth, roofPanels, roofVent, roofPipe, drumAt, crateAt, hullSeam, boltRow]
      .every(f => f.toString().indexOf('srand') < 0 && f.toString().indexOf('Math.random') < 0));
  ok('T74.B prism carries the det option and the kit hangs off it',
    prism.toString().indexOf('opt.det') >= 0 && prism.toString().indexOf('wallPanels(') >= 0 &&
    prism.toString().indexOf('wallPlinth(') >= 0);
  /* every main hull asks for it - 16 of the 17 buildings have a prism hull
     (supply is a canopy over pallets); a new building's hull should too */
  ok('T74.B sixteen main hulls request det:1',
    (bldBody.toString().match(/det:1/g) || []).length >= 16);
  ok('T74.B both roofs draw panel structure',
    gableRoof.toString().indexOf('roofPanels(') >= 0 &&
    hipRoof.toString().indexOf('contour lines') >= 0);
  ok('T74.B the walls gained I-beam structure - web groove, flange bolts, sawn caps',
    drawBarricade.toString().indexOf('for(const bm of beams)for(const t of [.22,.5,.78])') >= 0);

  /* driven: the detailed painters bake and render headless, error-free -
     this is the permanent fallback the suite exercises forever */
  G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'tan', opp: 3, seed: 970002 });
  ok('T74.B the detailed painters baked the whole roster headless',
    SPR.done && !!SPR.bld.hq.tan && !!SPR.veh.tank.gray && !!SPR.inf.grunt.blue[4]);
  REN_ERRS.clear(); render();
  ok('T74.B a full frame renders error-free over the detailed bake', REN_ERRS.size === 0);
}

/* ---------- C: the pipeline grid ---------- */
{
  section('T74.C SS=4 in the game, RS=8 in the tools, and textures really at it');

  ok('T74.C the runtime bake supersamples at 4', SS === 4);
  ok('T74.C the material pass and the normal pass share the doubled grid',
    fs74.readFileSync('../tools/material_v95.py', 'utf8').indexOf('RS, SS = 8, 4') >= 0 &&
    fs74.readFileSync('../tools/normal_v96.py', 'utf8').indexOf('RS, SS = 8, 4') >= 0);
  const dump = fs74.readFileSync('../tools/dump_base_v95.js', 'utf8');
  ok('T74.C the base dump renders at RS=8 and clears the embedded assets first - ' +
    'drawBarricade prefers a texture cell, so a stale set would re-dump itself',
    dump.indexOf('const RS = 8') >= 0 && dump.indexOf('delete ASSETS.img[k]') >= 0);

  /* the strongest form: read a texture's dimensions out of the WebP header
     and demand the infantry box at SS=4 - the v96 set would answer SS=3 */
  function webpDims(b64) {
    const b = Buffer.from(b64, 'base64');
    for (let i = 12; i < b.length - 8;) {
      const tag = b.toString('ascii', i, i + 4), len = b.readUInt32LE(i + 4);
      if (tag === 'VP8 ') { // lossy: dims follow the 9D 01 2A start code
        for (let j = i + 8; j < i + 24; j++) if (b[j] === 0x9d && b[j + 1] === 0x01 && b[j + 2] === 0x2a)
          return { w: b.readUInt16LE(j + 3) & 0x3fff, h: b.readUInt16LE(j + 5) & 0x3fff };
        return null;
      }
      if (tag === 'VP8X') return { w: 1 + (b.readUIntLE(i + 12, 3)), h: 1 + (b.readUIntLE(i + 15, 3)) };
      i += 8 + len + (len & 1);
    }
    return null;
  }
  const d1 = webpDims(IMG_B64['inf_grunt_green_2']);
  ok(`T74.C an infantry texture measures the 44x41 box at SS=4 (${d1 && d1.w}x${d1 && d1.h})`,
    !!d1 && d1.w === 44 * 4 && d1.h === 41 * 4);
  const d2 = webpDims(NRM_B64['bld_hq_green']);
  ok(`T74.C an HQ normal map measures the 204x166 box at SS=4 (${d2 && d2.w}x${d2 && d2.h})`,
    !!d2 && d2.w === 204 * 4 && d2.h === 166 * 4);
}

/* ---------- D: client-local, sim-silent ---------- */
{
  section('T74.D resolution and detail may decide what you see, never what happens');

  G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'green', opp: 3, seed: 970003 });
  MOUSE.inside = true; MOUSE.x = 5; MOUSE.y = Math.round(vpH() / 2); // edge-scroll band reads vpW/vpH inside update
  for (let i = 0; i < 20; i++) update(1 / 30);
  const h = hashState(), snap = saveState();
  const d0 = global.devicePixelRatio;
  global.devicePixelRatio = 2; resize(); render();
  ok('T74.D a resize to DPR 2 and a render move neither hash nor snapshot',
    hashState() === h && saveState() === snap);
  global.devicePixelRatio = d0; resize();
  MOUSE.inside = false; MOUSE.x = 0; MOUSE.y = 0;
  ok('T74.D no serializer mentions the resolution layer',
    ['RDPR', 'vpW', 'calcDPR'].every(w =>
      hashState.toString().indexOf(w) < 0 && saveState.toString().indexOf(w) < 0 && loadState.toString().indexOf(w) < 0));
  ok('T74.D neither RDPR nor the kit touches the seeded stream',
    calcDPR.toString().indexOf('srand') < 0 && resize.toString().indexOf('srand') < 0 &&
    prism.toString().indexOf('srand') < 0);
}
