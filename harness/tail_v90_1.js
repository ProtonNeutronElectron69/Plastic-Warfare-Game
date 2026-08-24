/* tail_v90_1.js - T64: the v90.1 build-menu pass.

   Three interface repairs, one of which reaches the simulation. They are grouped
   here rather than spread across the tails that own each surface because they are
   one release and one claim: the Construct menu should fit on the screen, show
   the art it promises, and never be the only way back into a match.

     A  the menu ORDER: four declared shelves, alphabetical inside each
     B  the menu WIDTH: thirteen tiles on one row, at every window it claims
     C  the wall thumbnails, blank in the CONSTRUCT menu since v88
     D  one headquarters per army, at every door that can place one
     E  the rebuild button over the minimap
     F  the bot rebuilds too - and pays nothing for the feature while its HQ stands

   D and F are the only sections that touch the simulation. The pinned trails did
   NOT move for either, and the reason is worth stating so a later reader does not
   repeat the v89 mistake of trusting a clean trail too far: the trails are 900
   ticks, no HQ dies inside thirty seconds, and every line this release added to
   aiTick is behind a scan of p.blds that is false while one stands. Section F
   asserts that guard functionally rather than leaving it as prose. */
'use strict';
section('T64 v90.1: the build menu');

function cfg90(seed, fac) { return { map: 'backyard', mode: 'dm', diff: 'normal', fac: fac || 'green', opp: 3, seed }; }
function cfg90w(seed) { return { map: 'backyard', mode: 'dm', diff: 'normal', fac: 'green', opp: 3, seed, watch: true }; }
function bot90(fac) { return G.players.find(p => p.ai && (!fac || p.fac === fac)); }
const FACS90 = ['green', 'tan', 'gray', 'blue'];

/* ---------- A: the order ---------- */
{
  section('T64.A the Construct menu is sorted, not shipped in build order');

  ok('T64.A there are four shelves and they run producers, economy, defence, rest',
    Array.isArray(MENU_CATS) && MENU_CATS.join(',') === 'prod,eco,def,misc');

  /* EVERY roster row declares one. The fallback to 'misc' exists so a new row is
     legal, not so an existing one can be forgotten: this is the conscious-edit pin
     that makes an addition declare its shelf. */
  {
    const rows = new Set();
    for (const f of FACS90) for (const k of bldRoster({ fac: f })) rows.add(k);
    const undecl = [...rows].filter(k => !B[k].cat);
    const wrong = [...rows].filter(k => B[k].cat && MENU_CATS.indexOf(B[k].cat) < 0);
    ok('T64.A every structure in every army\'s menu declares a shelf' + (undecl.length ? ' [' + undecl.join(', ') + ']' : ''),
      undecl.length === 0);
    ok('T64.A ...and every declared shelf is one of the four' + (wrong.length ? ' [' + wrong.join(', ') + ']' : ''),
      wrong.length === 0);
    ok('T64.A the sort is keyed on the FLAG, never on the key (the v88 lesson)',
      /B\[k\]\.cat/.test(menuRank.toString()) && menuCmp.toString().indexOf("==='barricade'") < 0);
  }

  /* THE CLAIM ITSELF, derived per faction rather than transcribed once for Green. */
  for (const f of FACS90) {
    const r = bldRoster({ fac: f });
    ok(`T64.A ${f}: the menu is still thirteen tiles wide`, r.length === 13);
    let shelvesOK = true, alphaOK = true;
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1], b = r[i];
      const ra = MENU_CATS.indexOf(B[a].cat), rb = MENU_CATS.indexOf(B[b].cat);
      if (rb < ra) shelvesOK = false;
      if (ra === rb && B[a].cat !== 'prod' && !(B[a].n < B[b].n)) alphaOK = false;
    }
    ok(`T64.A ${f}: the four shelves come in order and never interleave`, shelvesOK);
    ok(`T64.A ${f}: inside a shelf it is alphabetical by the name on the tile`, alphaOK);
    ok(`T64.A ${f}: the producers lead, in tech order rather than alphabetically`,
      r.slice(0, 3).join(',') === 'barracks,garage,helipad' &&
      r.slice(0, 3).every(k => B[k].cat === 'prod') &&
      r.slice(3).every(k => B[k].cat !== 'prod'));
  }

  /* NON-VACUITY. The sort has to be doing work: the pre-sort list is the order the
     structures shipped in, and it is not the order the menu shows. */
  {
    const raw = ['barracks', 'supply', 'lab', 'generator', 'garage', 'guardtower', 'helipad', 'outpost', 'radiotower', ...FAC.green.ub, 'barricade', 'hq'];
    const sorted = bldRoster({ fac: 'green' });
    ok('T64.A MUTATION: the shipped order really is a different order',
      raw.join(',') !== sorted.join(','));
    ok('T64.A ...and the sort is a REORDER - the same thirteen, none gained or lost',
      raw.slice().sort().join(',') === sorted.slice().sort().join(','));
  }

  /* A fourth producer would be legal without editing MENU_PROD, which is what the
     "sorts after the three by name" clause in the comment promises. Probed on a
     real row so the claim is executed, then put back. */
  {
    const keep = B.supply.cat;
    B.supply.cat = 'prod';
    const r = bldRoster({ fac: 'green' });
    B.supply.cat = keep;
    ok('T64.A a fourth producer lands after the three named ones, not before them',
      r.slice(0, 4).join(',') === 'barracks,garage,helipad,supply');
    ok('T64.A ...and the probe put the shelf back', B.supply.cat === 'eco');
  }

  /* The Outpost's short list is NOT sorted by this and deliberately keeps its own
     order: it is three entries chosen for one job, not a catalogue. */
  ok('T64.A the Outpost\'s three-entry list is untouched by the sort',
    CONSTRUCT_OUTPOST.join(',') === 'barricade,guardtower,hq');
}

/* ---------- B: the width ---------- */
{
  section('T64.B thirteen tiles fit on one row');

  let css = null;
  try { css = require('fs').readFileSync('pw.html', 'utf8'); } catch (e) { css = null; }
  if (!css) {
    ok('T64.B pw.html is readable next to the harness', false);
  } else {
    const num = (re, what) => { const m = re.exec(css); return m ? parseFloat(m[1]) : (ok('T64.B the stylesheet still states ' + what, false), NaN); };
    const tw = num(/:root\{--tw:(\d+)px/, 'a base tile width');
    const gap = num(/\.gitems\{[^}]*gap:(\d+)px/, 'the tile gap');
    const pad = num(/#selPanel\{[^}]*padding:(\d+)px/, 'the panel padding');
    const bord = num(/#selPanel\{[^}]*border:(\d+)px/, 'the panel border');
    const maxW = num(/#selPanel\{[^}]*max-width:(\d+)px/, 'a panel max-width');
    const N = Math.max(...FACS90.map(f => bldRoster({ fac: f }).length));
    /* DERIVED, not transcribed: the row's width is read off the same numbers the
       browser reads, so a later tile resize cannot leave this check agreeing with
       a menu that has started wrapping again. */
    const rowW = t => N * t + (N - 1) * gap + 2 * pad + 2 * bord;
    ok(`T64.B the panel is wide enough for all ${N} tiles at the base size (needs ${rowW(tw)}, has ${maxW})`,
      maxW >= rowW(tw));
    ok('T64.B MUTATION: the pre-v90.1 1240 would NOT have held them', 1240 < rowW(tw));

    /* The max-width alone only buys the row back on a large monitor: what the panel
       is GIVEN is the window minus the corner minimap's reserve, which applyMMSize
       writes as MM_S+40 against an 8px inset on the other side. So the tile has to
       narrow as the window does, and the steps have to actually clear the bar. */
    const steps = [];
    const re = /@media \(max-width:(\d+)px\)\{:root\{--tw:(\d+)px\}\}/g;
    let m; while ((m = re.exec(css))) steps.push({ w: +m[1], t: +m[2] });
    ok('T64.B the tile steps down on narrower windows (>=3 breakpoints)', steps.length >= 3);
    ok('T64.B ...monotonically: a narrower window never gets a wider tile',
      steps.slice().sort((a, b) => a.w - b.w).every((s, i, a) => i === 0 || s.t >= a[i - 1].t) &&
      steps.every(s => s.t <= tw));
    {
      const reserve = MM_SIZES.medium + 40 + 8;      // the minimap side, plus the panel's own inset
      const bands = steps.slice().sort((a, b) => a.w - b.w);
      let worst = null;
      // the narrowest window this release claims to fit, and every band above it
      const probes = [1280, 1366, 1440, 1600, 1680, 1920, 2560];
      for (const vw of probes) {
        const band = bands.find(s => vw <= s.w);
        const t = band ? band.t : tw;
        const given = Math.min(maxW, vw - reserve);
        if (given < rowW(t)) worst = worst || (vw + 'px window: ' + given + ' < ' + rowW(t));
      }
      ok('T64.B one row at every window from 1280 up, minimap at medium' + (worst ? ' [' + worst + ']' : ''),
        worst === null);
    }
    /* the panel's own minimum did not grow to hide a second row */
    ok('T64.B the panel still declares its 118px minimum', /#selPanel\{[^}]*min-height:118px/.test(css));
  }
}

/* ---------- C: the wall thumbnails ---------- */
{
  section('T64.C both walls paint in the Construct menu');

  /* THE SAME REGRESSION T63.E FIXED IN THE FIELD MANUAL, in the call site v88.1's
     own note said it did not reach. tileURL hard-coded the row as 'barricade' and
     passed no `t` at all, so the Heavy Barricade drew the wrong silhouette when it
     drew anything and the ordinary wall threw on drawBarricade's first line - into
     a catch that turned the failure into a blank tile. Three releases, four armies,
     two tiles each, and nothing said so.
     The shim has no toDataURL, so tileURL returns null here whether it painted or
     not: the observable is what it hands the painter, which is exactly the pair of
     things that were wrong. */
  G = null; newGame(cfg90(900301));
  const walls = Object.keys(B).filter(k => B[k].barr);
  ok('T64.C there are two walls to get right', walls.length === 2 && walls.indexOf('hbarricade') >= 0);

  const real = drawBarricade;
  const seen = [];
  let threw = null;
  try {
    drawBarricade = function (c, b, sx, sy) { seen.push({ key: b.key, own: b.t === B[b.key] }); return real.apply(null, arguments); };
    for (const f of FACS90) for (const k of walls) {
      for (const ck in TILEART) delete TILEART[ck];
      try { tileURL('bld', k, f) } catch (e) { threw = threw || (k + '/' + f + ': ' + e.message) }
    }
  } finally { drawBarricade = real; }

  ok('T64.C the painter runs once per wall per army, and never throws' + (threw ? ' (' + threw + ')' : ''),
    threw === null && seen.length === walls.length * FACS90.length);
  ok('T64.C ...on the row it was asked for, not on the ordinary wall every time',
    seen.filter(s => s.key === 'hbarricade').length === FACS90.length &&
    seen.filter(s => s.key === 'barricade').length === FACS90.length);
  ok('T64.C ...and carrying a real B row, which is the field the painter reads',
    seen.every(s => s.own) && /b\.t\.hbarr/.test(real.toString()));
  ok('T64.C the branch is keyed on t.barr, and the stub is built from the key it was given',
    /B\[key\]\.barr/.test(tileURL.toString()) &&
    /drawBarricade\(c,\{key,t:B\[key\]/.test(tileURL.toString()));

  /* MUTATION ARM: the stub as it stood really did throw, so this is not decorative. */
  ok('T64.C MUTATION: the old stub, with no row on it, throws',
    (function () {
      try { real(document.createElement('canvas').getContext('2d'), { key: 'barricade', p: { fac: 'green' }, prog: 1 }, 0, 0); return false }
      catch (e) { return true }
    })());
  /* and every other Construct tile still asks for art */
  {
    let bad = null;
    for (const f of FACS90) for (const k of bldRoster({ fac: f })) {
      for (const ck in TILEART) delete TILEART[ck];
      try { tileURL('bld', k, f) } catch (e) { bad = bad || (k + '/' + f) }
    }
    ok('T64.C every other structure tile still paints without throwing' + (bad ? ' (' + bad + ')' : ''), bad === null);
  }
  for (const ck in TILEART) delete TILEART[ck];
}

/* ---------- D: one headquarters at a time ---------- */
{
  section('T64.D the HQ is lim:1, at every door');

  ok('T64.D the limit is declared on the row, the way the Radio Tower\'s is',
    B.hq.lim === 1 && B.radiotower.lim === 1);

  G = null; newGame(cfg90(900401));
  const p = G.human;
  p.res.p = 99999; p.res.e = 99999;
  ok('T64.D a match opens with exactly one', bldCount(p, 'hq') === 1);

  // the UI door
  G.placing = null; startPlacing('hq');
  ok('T64.D startPlacing refuses a second while one stands', G.placing === null);
  // the tile door
  {
    const t = structTile('hq', null);
    ok('T64.D the Construct tile is greyed while one stands',
      /\bdis\b/.test(t.className) || (t.classList && t.classList.contains('dis')));
  }
  // the SIM door - the one a peer could otherwise talk past
  {
    const before = bldCount(p, 'hq');
    const hq = p.blds.find(b => b.key === 'hq');
    /* the spot has to be legal on every other rule, or the refusal below proves
       nothing. Walked out from the standing HQ rather than transcribed, because
       what is clear ground on this seed is not a fact worth pinning. */
    let tx = -1, ty = -1;
    for (let d = 6; d < 20 && tx < 0; d++) for (let a = 0; a < 16 && tx < 0; a++) {
      const cx = Math.floor(hq.x + Math.cos(a * Math.PI / 8) * d), cy = Math.floor(hq.y + Math.sin(a * Math.PI / 8) * d);
      if (canPlace(p, 'hq', cx, cy)) { tx = cx; ty = cy }
    }
    ok('T64.D the probe spot is otherwise legal, so the refusal is the limit',
      tx >= 0 && canPlace(p, 'hq', tx, ty));
    execCmd({ pi: p.i, op: 'build', a: { key: 'hq', tx, ty } });
    ok('T64.D execCmd refuses the second HQ too', bldCount(p, 'hq') === before);
    /* NON-VACUITY: the same command with the limit lifted really does build one,
       so the refusal above is the limit rather than a malformed command. */
    const keep = B.hq.lim; B.hq.lim = 0;
    execCmd({ pi: p.i, op: 'build', a: { key: 'hq', tx, ty } });
    const built = bldCount(p, 'hq');
    B.hq.lim = keep;
    ok('T64.D MUTATION: with the limit lifted the identical command places one', built === before + 1);
    const extra = p.blds.find(b => b.key === 'hq' && Math.floor(b.tx) === tx && Math.floor(b.ty) === ty);
    if (extra) kill(extra);
    ok('T64.D ...and the probe put the limit and the count back',
      B.hq.lim === 1 && bldCount(p, 'hq') === before);
  }

  // and it comes back the moment the first one falls
  {
    const hq = p.blds.find(b => b.key === 'hq');
    kill(hq);
    ok('T64.D killing it really empties the count', bldCount(p, 'hq') === 0 && p.alive);
    G.placing = null; startPlacing('hq');
    ok('T64.D ...and startPlacing arms at once', !!G.placing && G.placing.key === 'hq');
    G.placing = null;
    const t = structTile('hq', null);
    ok('T64.D ...and the Construct tile lights up again',
      !/\bdis\b/.test(t.className) && !(t.classList && t.classList.contains('dis')));
  }
  ok('T64.D the sim door reads the table field, not the key',
    /B\[a\.key\]\.lim/.test(execCmd.toString()));
}

/* ---------- E: the rebuild button ---------- */
{
  section('T64.E the button over the minimap');

  const btn = () => document.getElementById('hqPlaceBtn');

  G = null; newGame(cfg90(900501));
  const p = G.human;
  p.res.p = 99999; p.res.e = 99999;
  refreshHqPlaceBtn();
  ok('T64.E it is hidden while a headquarters stands', btn().style.display === 'none' && hqRebuildState() === null);

  kill(p.blds.find(b => b.key === 'hq'));
  refreshHqPlaceBtn();
  ok('T64.E it appears the moment there is none', btn().style.display !== 'none');
  ok('T64.E ...quoting the ordinary price, faction discount and all',
    hqRebuildState().c.p === bcost(p, 'hq').p && hqRebuildState().c.e === bcost(p, 'hq').e &&
    btn().title.indexOf(String(bcost(p, 'hq').p)) >= 0);
  ok('T64.E ...lit, because this army can afford it', btn().className.indexOf('dis') < 0);

  p.res.p = 1; p.res.e = 1;
  refreshHqPlaceBtn();
  ok('T64.E it dims when the bank cannot cover it',
    btn().className.indexOf('dis') >= 0 && hqRebuildState().afford === false);

  p.res.p = 99999; p.res.e = 99999;
  refreshHqPlaceBtn();
  G.placing = null;
  btn().onclick();
  ok('T64.E clicking it arms an HQ placement', !!G.placing && G.placing.key === 'hq');
  G.placing = null;

  /* IT GRANTS NOTHING. Every rule that refused an HQ before still refuses it: the
     button is startPlacing, and placeDeny never learned about it. */
  ok('T64.E it is the same call the Construct tile makes',
    /startPlacing\('hq'\)/.test(document.getElementById('hqPlaceBtn').onclick.toString()) &&
    placeDeny.toString().indexOf('hqPlaceBtn') < 0 &&
    placeDeny.toString().indexOf('hqRebuild') < 0);
  {
    // still refused inside an enemy HQ's ring, which is the rule a "rebuild
    // anywhere" button would have been most tempting to skip
    const foe = G.players.find(q => q !== p && q.alive);
    const fhq = foe && foe.blds.find(b => b.key === 'hq');
    ok('T64.E the enemy-HQ exclusion ring still refuses it',
      !!fhq && !canPlace(p, 'hq', Math.floor(fhq.tx), Math.floor(fhq.ty) + 2));
  }

  // chrome, and it rides the same pump the v73 HQ button does
  ok('T64.E it is refreshed from updateTopbar, not from the panel',
    /refreshHqPlaceBtn\(\)/.test(updateTopbar.toString()) &&
    refreshSelPanel.toString().indexOf('refreshHqPlaceBtn') < 0);

  // a spectator has no army to rebuild for
  {
    G = null; newGame(cfg90w(900502));
    refreshHqPlaceBtn();
    ok('T64.E a watch match never offers it', hqRebuildState() === null && btn().style.display === 'none');
  }
}

/* ---------- F: the bot rebuilds too ---------- */
{
  section('T64.F the CPU gets the same way back in');

  /* THE FEATURE. A bot that can afford a headquarters and has none puts one up,
     ahead of everything else it could buy that tick. */
  {
    G = null; newGame(cfg90w(900601));
    const p = bot90();
    kill(p.blds.find(b => b.key === 'hq'));
    p.res.p = 9999; p.res.e = 9999;
    ok('T64.F the bot starts the probe with no headquarters and is still alive',
      bldCount(p, 'hq') === 0 && p.alive);
    for (let i = 0; i < 3; i++) aiTick(p);
    ok('T64.F it rebuilds one', bldCount(p, 'hq') === 1);
    ok('T64.F ...and only one, however long it runs', (function () {
      for (let i = 0; i < 40; i++) aiTick(p);
      return bldCount(p, 'hq') === 1;
    })());
  }

  /* THE RESERVE, which is the difference between the feature working and only
     looking like it does. v89 measured the median bank at a production decision
     near 100; an HQ is 500, so a bot that spends as it earns never reaches one. */
  {
    const setup = (seed, killHQ) => {
      G = null; newGame(cfg90w(seed));
      const p = bot90();
      const bar = p.blds.find(b => b.key === 'barracks') ||
        makeBuilding('barracks', p, Math.floor(p.start.x) + 4, Math.floor(p.start.y) + 4, true);
      bar.prog = 1; bar.queue.length = 0;
      if (killHQ) kill(p.blds.find(b => b.key === 'hq'));
      p.res.p = 200; p.res.e = 9999;
      p.ai.nextExpand = 1e9;                       // the OTHER reserve, disarmed
      for (let i = 0; i < 5; i++) aiTick(p);
      return { p, bar };
    };
    const down = setup(900602, true), up = setup(900602, false);
    ok('T64.F a bot with no HQ and a short bank holds it rather than spending it' +
      ` (queue ${down.bar.queue.length})`, down.bar.queue.length === 0 && down.p.ai.saveHQ === true);
    ok('T64.F CONTROL: the same bot with its HQ standing produces normally' +
      ` (queue ${up.bar.queue.length})`, up.bar.queue.length > 0 && up.p.ai.saveHQ === false);
    ok('T64.F the trucks are deliberately NOT held back - they are how the bank grows',
      aiTick.toString().indexOf('trucks.length<wantTrucks&&p.res.p>=80&&') > 0);
  }

  /* THE GUARD, functionally. This is the claim the pinned trails rest on: while a
     bot HAS a headquarters, nothing this release added draws a single number out
     of the seeded stream, so a match that never loses an HQ plays exactly as it
     did. aiFindSpot is the only thing here that touches srand, so counting its
     calls by key is the whole test. */
  {
    G = null; newGame(cfg90w(900603));
    const p = bot90();
    p.res.p = 9999; p.res.e = 9999;
    const real = aiFindSpot;
    let hqAsks = 0, rng0 = 0, rng1 = 0;
    try {
      aiFindSpot = function (pl, key, anchor) { if (key === 'hq') hqAsks++; return real.apply(null, arguments) };
      rng0 = G.rngS; for (let i = 0; i < 10; i++) aiTick(p); rng1 = G.rngS;
      ok('T64.F with an HQ standing the bot never even asks for a spot for one', hqAsks === 0);
      ok('T64.F ...and the probe genuinely ran a bot that was spending',
        rng0 !== rng1 && bldCount(p, 'hq') === 1);
      // MUTATION: take the HQ away and the same probe fires at once
      kill(p.blds.find(b => b.key === 'hq'));
      hqAsks = 0; aiTick(p);
      ok('T64.F MUTATION: without one, it asks on the very next tick', hqAsks === 1);
    } finally { aiFindSpot = real; }
  }

  /* And the AI is gated separately from the human, because it never goes through
     execCmd - the v87 Napalm lesson, restated for a structure. */
  ok('T64.F the bot\'s own limit is a scan of its buildings, not execCmd\'s check',
    /noHQ=ai\.saveHQ=!p\.blds\.some/.test(aiTick.toString()) &&
    /if\(noHQ\)\{/.test(aiTick.toString()));
}
