/* tail_v94.js - T70: roadmap 3, phase 3 (second cut). The sprite band on its
   own canvas, and the GL band stage it can pass through.

     A  the band: isolated, one code path, merged in one blit
     B  bandPresent: GL round-trip when real, the canvas itself when not
     C  nothing the band stage touches reaches the simulation
     D  software GL is refused - the fallback machine gets the fallback

   The claim of the cut, measured in Chromium before it landed: isolating the
   band moved the rendered frame by a mean 0.048/255 per channel (p95 = 0) -
   the only real change is that the few additive ground auras inside the band
   (heal glow, rally pulse) now add against band content instead of terrain.
   The same measurement corrected the v93 record: the 2.02/255 reported there
   included wall-clock DOM toast variance; toasts excluded, GL-vs-2d is a
   mean 0.58/255. The sim hash was identical across every variant. */
'use strict';
section('T70 v94: the sprite band and its GL stage');

/* ---------- A: the band is isolated, once, and merged once ---------- */
{
  section('T70.A the depth-sorted band draws alone and lands in one blit');

  G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'tan', opp: 3, seed: 940002 });
  for (let i = 0; i < 30; i++) update(1 / 30);
  REN_ERRS.clear();
  render();
  ok('T70.A a full frame renders headless through the band path, error-free', REN_ERRS.size === 0);
  ok('T70.A the band canvas exists at frame size beside the world canvas',
    !!sprCv && sprCv.width === view.width && sprCv.height === view.height);

  const src = renderCore.toString();
  ok('T70.A the item loops draw on the band, through one dispatch site',
    (src.match(/drawItemShadow\(bc,/g) || []).length === 1 &&
    (src.match(/drawUnit\(bc,/g) || []).length === 1 &&
    src.indexOf('drawItemShadow(c,') < 0);
  ok('T70.A the band reuses the frame camera, shake included',
    src.indexOf('spctx.setTransform(z,0,0,z,-cx*z,-cy*z)') >= 0);
  ok('T70.A one merge, through the stage seam, in screen space',
    (src.match(/drawImage\(bandPresent\(\),0,0\)/g) || []).length === 1);
  /* the degenerate no-canvases case simply draws where v93 drew */
  ok('T70.A without the band canvas the loops fall back to the scene context',
    src.indexOf('const bc=spctx||c') >= 0);
}

/* ---------- B: the stage answers honestly ---------- */
{
  section('T70.B bandPresent: the canvas itself wherever GL is not real');

  ok('T70.B headless, the band presents directly - the fake context flunks',
    bandPresent() === sprCv && !!(GLB && GLB.dead));
  /* REWRITTEN AT v96: the create-or-resize discipline moved from bandPresent
     into bandEnsure (shared with bandLit, so the first lit frame is the
     first frame), and the declared passthrough became the lighting shader -
     which is the claim v94 existed to set up, not a loosening. The identity
     property survives in a stronger form: a pixel with no normal map
     (nm.a<.5 -> flat) comes out of the lighting math exactly as it went in,
     which T72 (tail_v96) pins in detail. */
  const src = bandEnsure.toString();
  ok('T70.B #nogl forces the direct path, matching the post stage',
    src.indexOf('nogl') >= 0);
  ok('T70.B the color round-trip is premultiplied both ways, so sprite edges survive',
    bandPresent.toString().indexOf('UNPACK_PREMULTIPLY_ALPHA_WEBGL') >= 0 && src.indexOf('premultipliedAlpha:true') >= 0);
  ok('T70.B a lost context kills the stage, not the frame',
    src.indexOf("'webglcontextlost'") >= 0);
  ok('T70.B the v94 passthrough became the v96 lighting shader, flat pixels its identity case',
    GLSL_BAND.indexOf('nm.a<.5') >= 0 && GLSL_BAND.indexOf('/(uAmb+uKd*uLdir.z)') >= 0);
}

/* ---------- C: client-local, sim-silent ---------- */
{
  section('T70.C the band stage may decide what you see, never what happens');

  const h = hashState(), snap = saveState();
  bandPresent(); render();
  ok('T70.C a band frame moves neither hash nor snapshot', hashState() === h && saveState() === snap);
  ok('T70.C no band function touches the seeded stream', bandPresent.toString().indexOf('srand') < 0);
  ok('T70.C the stage is not sim state - no serializer mentions it',
    hashState.toString().indexOf('GLB') < 0 && saveState.toString().indexOf('sprCv') < 0 && loadState.toString().indexOf('GLB') < 0);
}

/* ---------- D: the fallback machine gets the fallback ---------- */
{
  section('T70.D software GL is refused, because it costs more than 2d');

  /* measured on a GPU-less box: CPU-emulated GL spends ~2x the whole 2d frame
     on texture uploads alone. A machine without real GL is exactly the machine
     compositePost exists for, so both stages ask the browser to refuse a
     major-performance-caveat context. #forcegl overrides, for testing. */
  /* v96: the band's context creation lives in bandEnsure now */
  ok('T70.D the post stage refuses a caveated context',
    ensureGL.toString().indexOf('failIfMajorPerformanceCaveat') >= 0);
  ok('T70.D the band stage refuses one too',
    bandEnsure.toString().indexOf('failIfMajorPerformanceCaveat') >= 0);
  ok('T70.D ...and #forcegl exists to override both, for measurement',
    ensureGL.toString().indexOf('forcegl') >= 0 && bandEnsure.toString().indexOf('forcegl') >= 0);
}
