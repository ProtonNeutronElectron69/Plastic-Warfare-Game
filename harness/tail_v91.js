/* tail_v91.js - T66: roadmap 3, phase 1. The source split and the asset plumbing.

     A  the split: source/ assembles into the shipped file, byte for byte
     B  the order is declared, and the declaration is the thing the build reads
     C  the asset loader, and the promise the simulation must never wait on
     D  assets OVERRIDE - every procedural painter is still there

   Phase 1 ships NO assets and changes nothing a player can see. That is not a
   modest goal, it is the acceptance criterion: a file reorganisation that also
   changed behaviour would be indistinguishable from a file reorganisation that
   broke something. The hash trails carry that claim; this tail carries the rest.

   These checks read the repository, not just the game, so they are the first in
   the suite that fail when the WORKING TREE is out of step rather than when the
   code is wrong. That is deliberate: a stale plastic-warfare.html beside fresh
   sources is exactly the drift the v82 note warned about, one level up. */
'use strict';
section('T66 v91: the source split and the asset manifest');

const fs66 = require('fs');
const has66 = p => { try { fs66.statSync('../' + p); return true } catch (e) { return false } };
const read66 = p => { try { return fs66.readFileSync('../' + p, 'utf8') } catch (e) { return null } };

/* ---------- A: the split reassembles exactly ---------- */
{
  section('T66.A source/ rebuilds the shipped file byte for byte');

  ok('T66.A there is a source tree and a build that makes the game from it',
    has66('source/order.txt') && has66('source/head.html') && has66('source/tail.html') && has66('build.sh'));

  const order = (read66('source/order.txt') || '').split('\n')
    .map(l => l.replace(/#.*/, '').trim()).filter(Boolean);
  ok(`T66.A the order names files (${order.length})`, order.length > 10);
  ok('T66.A every file it names exists', order.every(f => has66('source/js/' + f)));

  /* every .js in the tree is NAMED. A file nobody lists is a file that silently
     does not ship - the failure mode this check exists for is adding a source
     file and forgetting the one line that makes it part of the game. */
  {
    let onDisk = [];
    try { onDisk = fs66.readdirSync('../source/js').filter(f => f.endsWith('.js')) } catch (e) { }
    const unlisted = onDisk.filter(f => order.indexOf(f) < 0);
    const missing = order.filter(f => onDisk.indexOf(f) < 0);
    ok('T66.A no source file is left out of the order' + (unlisted.length ? ' [' + unlisted.join(', ') + ']' : ''),
      unlisted.length === 0);
    ok('T66.A ...and the order names nothing that is gone' + (missing.length ? ' [' + missing.join(', ') + ']' : ''),
      missing.length === 0);
    ok('T66.A each file is named exactly once', new Set(order).size === order.length);
  }

  /* THE HEADLINE. Concatenating the sources in the declared order reproduces the
     shipped file EXACTLY - not equivalently, not modulo whitespace. That is what
     makes the split provably inert, and it is why the split was cut at line
     boundaries out of the v90.2 file rather than retyped. */
  {
    const built = [read66('source/head.html')]
      .concat(order.map(f => read66('source/js/' + f)))
      .concat([read66('source/tail.html')]).join('');
    const shipped = read66('plastic-warfare.html');
    ok('T66.A the concatenation IS the shipped file, byte for byte',
      built !== null && shipped !== null && built === shipped);
    ok(`T66.A ...including its length (${shipped ? shipped.length : '?'})`,
      built !== null && shipped !== null && built.length === shipped.length);
    /* the trailing-newline trap: the game file ends WITHOUT one, so tail.html
       must too, or every rebuild would append a byte and this check would be the
       only thing that ever noticed. */
    ok('T66.A tail.html ends without a trailing newline, as the game file does',
      shipped !== null && !/\n$/.test(shipped) && !/\n$/.test(read66('source/tail.html') || '\n'));
  }

  /* the extracted script the suite actually runs came from that same file */
  ok('T66.A game.js was extracted from the built file, so the tests run the build',
    read66('plastic-warfare.html').indexOf(fs66.readFileSync('game.js', 'utf8').slice(0, 400)) > 0);
}

/* ---------- B: the order is load-bearing and says so ---------- */
{
  section('T66.B the order is declared, not inferred');

  const raw = read66('source/order.txt') || '';
  ok('T66.B order.txt warns that the order is load-bearing, in the file itself',
    /load-bearing/i.test(raw) && /triage/i.test(raw));
  ok('T66.B build.sh reads order.txt rather than globbing the directory',
    /order\.txt/.test(read66('build.sh') || '') && !/js\/\*\.js/.test(read66('build.sh') || ''));

  /* WHY IT IS LOAD-BEARING, executed rather than asserted in prose. These are the
     two shapes that make concatenation order matter, and both are live in the
     game today: a const derived from an earlier const, and a mutation of a table
     that runs after the table's own literal. */
  ok('T66.B a derived constant really does read an earlier one',
    Math.abs(B.guardtower.dm - +(15 * DMG_SCALE).toFixed(2)) < 1e-12 && DMG_SCALE !== 1);
  ok('T66.B ...and it is applied by a statement that runs AFTER the B literal',
    /B\.guardtower\.dm=\+\(B\.guardtower\.dm\*DMG_SCALE\)/.test(fs66.readFileSync('game.js', 'utf8')));
  ok('T66.B the two live in the same source file, so no split can separate them',
    (read66('source/js/04-tables.js') || '').indexOf('B.guardtower.dm=') > 0);
}

/* ---------- C: the loader, and what it must not touch ---------- */
{
  section('T66.C the asset loader ships empty and off the simulation path');

  /* REWRITTEN AT v92 and again at v95, deliberately: phase 1 pinned the
     manifest EMPTY so the plumbing landed provably inert; phase 2 filled the
     snd half, and phase 4 began filling img - so the claim is now "both
     halves are populated". The sound keys are asserted in detail by T67
     (tail_v92), the image keys by T71 (tail_v95). */
  ok('T66.C the manifest holds phase 2 sounds and phase 4 textures',
    ASSET_MANIFEST && Object.keys(ASSET_MANIFEST.img).length > 0 && Object.keys(ASSET_MANIFEST.snd).length > 0);
  ok('T66.C nothing is loaded headless, so every lookup answers null',
    imgAsset('inf_runner_blue_2') === null && sndAsset('gun_rifle_0') === null && imgAsset('anything') === null);

  /* THE CHECK THIS SECTION EXISTS FOR. newGame() is called synchronously by
     hundreds of fixtures and by the lobby. The day it awaits an asset load is the
     day the whole suite has to become asynchronous, so the seam is pinned here
     rather than discovered later. */
  const ngSrc = newGame.toString();
  ok('T66.C newGame does not load assets, wait on them, or mention them',
    ngSrc.indexOf('assetsLoad') < 0 && ngSrc.indexOf('await') < 0 && ngSrc.indexOf('ASSET') < 0);
  ok('T66.C ...and it is still an ordinary synchronous function',
    newGame.constructor.name === 'Function' && !/^async/.test(ngSrc));
  {
    /* driven, not read: a full match boots and runs with the loader untouched */
    G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'green', opp: 3, seed: 910001 });
    for (let i = 0; i < 60; i++) update(1 / 30);
    ok('T66.C a match boots and ticks without the loader ever running',
      G && G.tick === 60 && assetsReady() === false);
  }

  /* it resolves, it does not reject, and it is idempotent */
  ok('T66.C assetsLoad returns the same promise twice', assetsLoad() === assetsLoad());
  {
    let settled = null;
    assetsLoad().then(() => { settled = 'ok' }, () => { settled = 'rejected' });
    ok('T66.C ...and it is a real promise', typeof assetsLoad().then === 'function');
  }

  /* NOT SIM STATE, and it never may be: two clients in a lockstep match can hold
     different assets - one of them may have failed a download - and must still
     agree tick for tick. */
  {
    const h = hashState(), snap = JSON.parse(saveState());
    ASSETS.img.probe = { probe: 1 }; ASSETS_STATE = 'ready';
    const h2 = hashState(), snap2 = JSON.parse(saveState());
    delete ASSETS.img.probe; ASSETS_STATE = 'idle';
    ok('T66.C loading an asset changes neither the hash nor the snapshot',
      h === h2 && JSON.stringify(snap) === JSON.stringify(snap2));
    ok('T66.C ...and neither serializer mentions assets at all',
      hashState.toString().indexOf('ASSET') < 0 && saveState.toString().indexOf('ASSET') < 0);
    ok('T66.C the probe put the loader back', imgAsset('probe') === null && assetsReady() === false);
  }
  /* REWRITTEN AT v95: the page-open call gained one .then - the late-bake
     guard - and nothing else. Still fire-and-forget: nothing awaits it, and
     the callback re-bakes sprites, which is a render concern. */
  ok('T66.C the boot kicks the load off without waiting for it',
    /^assetsLoad\(\)\.then\(rebakeIfAssetsLate\);$/m.test(fs66.readFileSync('game.js', 'utf8')));
}

/* ---------- D: assets override, they never replace ---------- */
{
  section('T66.D every procedural painter is still there');

  /* This is the rule that keeps the ~124 drawing assertions alive through phases
     3-5, and keeps a missing file degrading to the v90.2 game rather than to a
     hole. Phase 1 adds the lookups and deliberately wires none of them up; what
     it must guarantee is that there is still something to fall back TO. */
  for (const fn of ['trooperBody', 'vehBody', 'bldBody', 'drawBarricade', 'bakeSprites', 'bakeCell'])
    ok('T66.D ' + fn + ' survives the split', typeof eval(fn) === 'function');

  /* REWRITTEN AT v95, deliberately: phase 4 exists to wire the texture in,
     so the phase-1 claim "no imgAsset in the bake" flips to "imgAsset is
     asked, and the painter stands behind it". T71.C pins the three sites. */
  ok('T66.D the bake asks for a texture now, with every painter still behind it',
    bakeSprites.toString().indexOf('imgAsset') >= 0 &&
    bakeSprites.toString().indexOf('trooperBody') >= 0);
  {
    /* and it still produces cells for the whole roster, in every army's colours */
    bakeSprites();
    const facs = Object.keys(FAC).filter(f => f !== 'bug');
    const missing = [];
    for (const k in U) for (const f of facs) {
      const cell = U[k].a === 'inf' ? (SPR.inf[k] && SPR.inf[k][f] && SPR.inf[k][f][2]) : (SPR.veh[k] && SPR.veh[k][f]);
      if (!cell) missing.push(k + '/' + f);
    }
    ok('T66.D SPR still holds a cell for every unit in every army' + (missing.length ? ' [' + missing.slice(0, 4).join(', ') + ']' : ''),
      SPR.done === true && missing.length === 0);
  }
  ok('T66.D the two lookups exist for phases 2 and 4 to reach for',
    typeof imgAsset === 'function' && typeof sndAsset === 'function' && typeof assetsReady === 'function');
}
