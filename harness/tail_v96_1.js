/* tail_v96_1.js - T73: the graphics feedback pass. The owner played v96 and
   sent back three findings; each is a change and a check here.

     A  the walls take textures - all four colours AND the map's neutral gray
     B  flame casts real light - stronger fire, a new flame-weapon source
     C  infantry relief softened - the data changed, the recipe is pinned

   Same shape as v92.1 (the audio feedback pass): the owner's eye is the
   acceptance test, and what it found becomes a pinned claim so it cannot
   quietly regress. */
'use strict';
section('T73 v96.1: walls textured, flame alight, infantry unwashed');

const fs73 = require('fs');

/* ---------- A: the walls ---------- */
{
  section('T73.A the walls joined the texture pass, painter still the fallback');

  /* the roster half lives in T71.A, which now derives the wall keys; here
     the RUNTIME half: the bake fills SPR.barr from assets alone (no
     procedural cell behind it - drawBarricade itself is the fallback, as it
     has been since v88), and the painter survives untouched below the blit */
  const bs = bakeSprites.toString();
  ok('T73.A the bake fills SPR.barr for both walls, neutral included',
    bs.indexOf('SPR.barr[k]={}') >= 0 && bs.indexOf("facs.concat('neutral')") >= 0 &&
    bs.indexOf('BARR_BOX[k]') >= 0);
  const db = drawBarricade.toString();
  ok('T73.A drawBarricade blits the cell when one loaded - build-progress fade included',
    db.indexOf("SPR.barr[b.t.hbarr?'hbarricade':'barricade']") >= 0 &&
    db.indexOf("cell=wcell&&wcell[neutral?'neutral':b.p.fac]") >= 0 &&
    db.indexOf('.5+.5*wpr') >= 0);
  ok('T73.A ...mirrors its normal map into the band like every other sprite',
    db.indexOf('NCTX&&cell.nrm') >= 0);
  ok('T73.A ...and the hedgehog painter survives in full behind it',
    db.indexOf('beams') >= 0 && db.indexOf('hedgehog') + 1 !== 0 || db.indexOf('lineCap') >= 0);
  ok('T73.A the boxes are the painter\'s measured extents plus margin',
    BARR_BOX.barricade[0] === -14 && BARR_BOX.hbarricade[1] === -23);

  /* driven headless: no Image, so SPR.barr stays empty and the wall paints
     procedurally through a whole frame - the suite keeps testing the v88 path */
  G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'gray', opp: 3, seed: 961002 });
  ok('T73.A headless the walls hold no cells and the painter carries every one',
    Object.keys(SPR.barr.barricade || {}).length === 0 && Object.keys(SPR.barr.hbarricade || {}).length === 0);
  REN_ERRS.clear(); render();
  ok('T73.A a full frame with neutral map walls renders error-free', REN_ERRS.size === 0);
}

/* ---------- B: flame light ---------- */
{
  section('T73.B fire reads as fire now');

  /* the owner heard it right: at r 64 / i .34 the burn-cell light was
     invisible in play. And a flame WEAPON mid-stream cast nothing at all -
     the muzzle-flash source deliberately skips w 'f' for the star sprite,
     and no burn cell exists under a flamethrower. Both fixed in LIGHTV and
     pinned as an ORDER, not just numbers: a flame stream outshines a muzzle
     pop, ground fire is no longer the faintest thing in the table. */
  ok('T73.B ground fire got real strength', LIGHTV.fire.i >= .6 && LIGHTV.fire.r >= 80);
  ok('T73.B a flame stream is a fire, not a muzzle pop',
    !!LIGHTV.flame && LIGHTV.flame.i > LIGHTV.flash.i && LIGHTV.flame.r > LIGHTV.flash.r);
  const src = bandLightsCollect.toString();
  ok('T73.B the collector branches on the flame weapon class, at the stream midpoint',
    src.indexOf("u.t.w==='f'") >= 0 && src.indexOf('(u.x+t.x)/2') >= 0);
  ok('T73.B ...behind the same vision gate as every other source',
    src.indexOf("u.t.w==='f'") > src.indexOf('visibleToHuman(u)'));

  /* driven: a firing flamethrower becomes a flame light, a rifleman a flash */
  GLB = { lights: [] };
  G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'tan', opp: 3, seed: 961003, test: true });
  const hq = G.human.blds.find(b => b.key === 'hq');
  const fl = makeUnit('flamer', G.human, hq.tx + 2, hq.ty + 2);
  const gr = makeUnit('grunt', G.human, hq.tx + 4, hq.ty + 2);
  fl.flash = .1; fl.target = gr; gr.flash = .1;
  bandLightsCollect(isoX(hq.tx + 3, hq.ty + 2) - view.width / 2, isoY(hq.tx + 3, hq.ty + 2) - view.height / 2, 1);
  const rs = GLB.lights.map(l => Math.round(l.r));
  ok(`T73.B one flame light and one flash light, sized apart (${rs.join(',')})`,
    GLB.lights.length === 2 && Math.max(...rs) === LIGHTV.flame.r && Math.min(...rs) === LIGHTV.flash.r);
  fl.flash = 0; gr.flash = 0; GLB = null;
}

/* ---------- C: infantry relief ---------- */
{
  section('T73.C the little men keep their faces');

  /* the wash-out was DATA, not shader: an infantryman's tiny silhouette
     makes the molding dome steep everywhere, so half the figure sat at the
     lamp's maximum. The fix is regenerated maps from a gentler per-kind
     recipe; headless cannot decode webp to verify the pixels, so the pin
     is on the recipe itself - the generator carries an inf override that
     flattens (higher nz, lower dome), and the maps in the manifest are the
     regenerated bytes (T72.A's byte-equality holds them to assets/nrm). */
  const gen = fs73.readFileSync('../tools/normal_v96.py', 'utf8');
  ok('T73.C the normal generator carries the inf softening override',
    /KIND_NRM\s*=\s*\{'inf':/.test(gen) && gen.indexOf('nz=3.6') >= 0);
  ok('T73.C ...and the override flattens rather than sharpens',
    gen.indexOf('w_dome=0.55') >= 0 && gen.indexOf('w_lum=0.65') >= 0);
}

/* ---------- sim silence, same as every render release ---------- */
{
  section('T73.D nothing here reaches the simulation');
  G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'blue', opp: 3, seed: 961004 });
  for (let i = 0; i < 15; i++) update(1 / 30);
  const h = hashState(), snap = saveState();
  render();
  ok('T73.D a frame with textured walls moves neither hash nor snapshot',
    hashState() === h && saveState() === snap);
  ok('T73.D no new code touches the seeded stream',
    drawBarricade.toString().indexOf('srand') < 0 && bandLightsCollect.toString().indexOf('srand') < 0);
}
