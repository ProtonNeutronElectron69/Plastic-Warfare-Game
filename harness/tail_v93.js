/* tail_v93.js - T69: roadmap 3, phase 3 (first cut). The WebGL present+post
   stage, and the 2d compositor it falls back to.

     A  the fallback: headless, glComposite refuses and the 2d path runs
     B  POSTV: one tuning table, both compositors read it
     C  nothing GL touches the simulation
     D  the game is still one self-contained file - no script tags grew
     E  the stage's own discipline: under #view, context-loss safe, #nogl

   What this phase is NOT is pinned in the record rather than here: the world
   CONTENT is still drawn by the untouched 2d code into worldCv - only the
   present+post pass moved to shaders. The sprite band comes later, inside
   this stage. Measured in Chromium at v93: the GL frame and the 2d frame of
   the same tick differ by a mean 2.02/255 per channel (p95 = 4), and the sim
   hash is identical under both renderers. */
'use strict';
section('T69 v93: the WebGL present stage and its 2d fallback');

const fs69 = require('fs');

/* ---------- A: the fallback is the tested path ---------- */
{
  section('T69.A headless, GL refuses and the 2d compositor still presents');

  G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'blue', opp: 3, seed: 930002 });
  for (let i = 0; i < 30; i++) update(1 / 30);

  /* the shim's permissive fake context flunks the link-status check BY
     DESIGN - that is the capability test working, not an accident */
  ok('T69.A glComposite answers false where there is no real GL', glComposite() === false);
  ok('T69.A ...and marks the stage dead so it never re-tries per frame', !!(GLP && GLP.dead));
  ok('T69.A both present sites fall back to the 2d compositor',
    (renderCore.toString().match(/!glComposite\(\)\)compositePost\(\)/g) || []).length === 2);

  /* driven, not read: a whole frame renders headless with GL dead and the
     guard swallows nothing */
  REN_ERRS.clear();
  render();
  ok('T69.A a full frame renders through the 2d path with no suppressed errors', REN_ERRS.size === 0);
}

/* ---------- B: one tuning table, two consumers ---------- */
{
  section('T69.B POSTV is the single source of the post-pass look');

  ok('T69.B the table holds the v64-v90 numbers verbatim',
    POSTV.sat === 1.10 && POSTV.con === 1.04 && POSTV.bloomAdd === .30 &&
    POSTV.g1c === '#ffb45e' && POSTV.g2c === '#2f4d80' && POSTV.vinA === .28 &&
    POSTV.tsTopH === .24 && POSTV.tsBotH === .30);
  ok('T69.B the 2d compositor reads it and carries no orphaned literals',
    compositePost.toString().indexOf('POSTV.') >= 0 &&
    compositePost.toString().indexOf('1.10') < 0 && compositePost.toString().indexOf('#ffb45e') < 0);
  ok('T69.B the GL stage feeds its uniforms from the same table',
    ['POSTV.sat', 'POSTV.bloomBr', 'POSTV.tsTopH', 'POSTV.g1c', 'POSTV.vinA']
      .every(k => glComposite.toString().indexOf(k) >= 0));
  /* v97 REWRITE: the kernels moved into glSize and gained the RDPR factor -
     sigma is a pixel value and the buffers are device pixels now, so scaling
     by RDPR is what KEEPS the visual blur equal to the 2d path's (which
     scales its filter strings the same way). The claim is unchanged: the
     radii come from POSTV and nowhere else. */
  ok('T69.B the blur kernels derive from the same blur radii, at the device scale',
    glSize.toString().indexOf('glGauss(POSTV.bloomBlur*RDPR)') >= 0 &&
    glSize.toString().indexOf('glGauss(POSTV.tsBlur*RDPR)') >= 0 &&
    ensureGL.toString().indexOf('glGauss(') < 0);
  ok('T69.B the masks derive from the same band strengths',
    mkMask.toString().indexOf('POSTV.tsTopA') >= 0 && mkMask.toString().indexOf('POSTV.tsBotA') >= 0);
}

/* ---------- C: the renderer may decide what you see, never what happens ---------- */
{
  section('T69.C nothing GL reaches the simulation');

  const h = hashState(), snap = saveState();
  glComposite(); render();
  ok('T69.C a render pass with GL attempted moves neither hash nor snapshot',
    hashState() === h && saveState() === snap);
  ok('T69.C no GL function touches the seeded stream',
    [glComposite, ensureGL, glProg, glSize, glGauss].every(f => f.toString().indexOf('srand') < 0));
  ok('T69.C the stage is not sim state - neither serializer mentions it',
    hashState.toString().indexOf('GLP') < 0 && saveState.toString().indexOf('GLP') < 0 && loadState.toString().indexOf('GLP') < 0);
}

/* ---------- D: still one self-contained file ---------- */
{
  section('T69.D the shipped file grew a renderer, not a dependency');

  const html = fs69.readFileSync('pw.html', 'utf8');
  ok('T69.D exactly one script block, as always', (html.match(/<script/g) || []).length === 1);
  ok('T69.D and no external script, stylesheet or module import anywhere',
    html.indexOf('<script src') < 0 && html.indexOf('<link rel="stylesheet"') < 0 && html.indexOf('import(') < 0);
  const order = fs69.readFileSync('../source/order.txt', 'utf8');
  ok('T69.D the stage ships between the 2d compositor and the main loop',
    order.indexOf('25-post-processing.js\n25b-webgl.js\n26-frame.js') >= 0);
}

/* ---------- E: the stage's own discipline ---------- */
{
  section('T69.E under the view, loss-safe, and escapable');

  const src = ensureGL.toString();
  ok('T69.E the GL canvas goes UNDER #view, so input and overlays never move',
    src.indexOf('insertBefore(cv,view)') >= 0);
  ok('T69.E a lost context kills the stage instead of a frame',
    src.indexOf("'webglcontextlost'") >= 0 && src.indexOf('GLP.dead=1') >= 0);
  ok('T69.E #nogl in the URL forces the 2d path, for A/B against the old look',
    glComposite.toString().indexOf('nogl') >= 0);
  ok('T69.E the canvas only enters the DOM after the programs link',
    src.indexOf('insertBefore') > src.indexOf('glProg'));
  ok('T69.E the overlay canvas is cleared only when GL really presented',
    glComposite.toString().indexOf('clearRect') > glComposite.toString().indexOf('pComp'));
}
