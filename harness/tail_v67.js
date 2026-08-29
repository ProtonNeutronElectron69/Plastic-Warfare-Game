/* ============================================================================
   tail_v67.js - v67: hazard declutter + landmine distribution.

   A: the ONE hazard-size lever, and that it is applied exactly once.
   B: the thinned passes - the Desk's splashes and the per-map hazard budget.
   C: no invisible blockers. The release's real bug fix, on two code paths.
   D: landmines - re-rolled per match, keep-out honoured, pair spacing honoured,
      point symmetry preserved.
   E: the levers that were explicitly NOT touched.

   Everything here drives makeMap directly. makeMap is a pure function of
   (key, seed), so every number below is reproducible rather than sampled.
   ========================================================================== */
section('T46 v67: hazard declutter, landmine distribution');

/* the pinned seed set. Twelve seeds per map, chosen once and never re-rolled:
   these are bounds tests, not hash pins, so they must be stable but they are not
   baselines and nothing here needs recutting when sim behaviour moves. */
const S67 = [101, 202, 303, 404, 505, 606, 707, 808, 909, 1010, 1111, 1212];
const PVP67 = ['backyard', 'kitchen', 'sandbox', 'livingroom'];

/* the coverage mask: which tiles a SURVIVING field object (or the kiddie pool,
   which is stamped outside field() and is deliberately unscaled) actually paints.
   renderTerrain draws from M.fields and from M.kpool and from nothing else, so a
   hazard tile outside this mask is a tile the player cannot see. */
function covMask67(M) {
  const N = M.N, cov = new Uint8Array(N * N);
  for (const fl of M.fields) {
    const ext = Math.max(fl.rx, fl.ry) * 1.4;
    for (let y = Math.max(0, Math.floor(fl.cy - ext)); y <= Math.min(N - 1, fl.cy + ext); y++)
      for (let x = Math.max(0, Math.floor(fl.cx - ext)); x <= Math.min(N - 1, fl.cx + ext); x++) {
        const ddx = x + .5 - fl.cx, ddy = y + .5 - fl.cy, rm = blobRadius(fl.blob, datan2(ddy, ddx));
        const dx = ddx / (fl.rx * rm), dy = ddy / (fl.ry * rm);
        if (dx * dx + dy * dy <= 1) cov[y * N + x] = 1;
      }
  }
  if (M.kpool) {
    const k = M.kpool;
    for (let y = Math.max(0, Math.floor(k.cy - k.r - 1)); y <= Math.min(N - 1, Math.ceil(k.cy + k.r + 1)); y++)
      for (let x = Math.max(0, Math.floor(k.cx - k.r - 1)); x <= Math.min(N - 1, Math.ceil(k.cx + k.r + 1)); x++)
        if (dhyp(x + .5 - k.cx, y + .5 - k.cy) <= k.r) cov[y * N + x] = 1;
  }
  return cov;
}
function hazStats67(M) {
  const N = M.N, cov = covMask67(M);
  let haz = 0, orphan = 0, inconsistent = 0;
  for (let i = 0; i < N * N; i++) {
    if (M.fld[i] === 3 && M.pass[i] === 1) inconsistent++;
    if (M.fld[i]) { haz++; if (!cov[i]) orphan++; }
  }
  return { haz, orphan, inconsistent, pct: haz / (N * N) * 100, tiles: N * N };
}

/* ------------------------------------------------ A: THE ONE SIZE LEVER */
{
  ok('T46.A HAZ_SC exists and shrinks', typeof HAZ_SC === 'number' && HAZ_SC > 0 && HAZ_SC < 1);
  ok('T46.A HAZ_SC is the approved 0.80', HAZ_SC === 0.80);

  /* The Desk is the one map whose hazards are laid at FIXED half-extents rather
     than jittered ranges: hz('coffee',...,6,4) and hz('soda',...,5.5,4). That makes
     it an exact arithmetic check on the lever, not a band. */
  const M = makeMap('desk', 4242);
  const coffee = M.fields.filter(f => f.kind === 'coffee');
  const soda = M.fields.filter(f => f.kind === 'soda');
  ok('T46.A the Desk still lays both of its hazard kinds', coffee.length > 0 && soda.length > 0);
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  ok('T46.A every coffee blob is the nominal 6x4 scaled once',
     coffee.every(f => near(f.rx, 6 * HAZ_SC) && near(f.ry, 4 * HAZ_SC)));
  ok('T46.A every soda blob is the nominal 5.5x4 scaled once',
     soda.every(f => near(f.rx, 5.5 * HAZ_SC) && near(f.ry, 4 * HAZ_SC)));
  /* applied ONCE, not twice: 6*0.8 = 4.8, and 6*0.8*0.8 = 3.84 must not appear */
  ok('T46.A the scale is not applied twice',
     coffee.every(f => !near(f.rx, 6 * HAZ_SC * HAZ_SC)));
  /* non-vacuity: the comparison has to be capable of failing */
  ok('T46.A the size check is not vacuous', !near(6 * HAZ_SC, 6) && coffee.length >= 2);

  /* the lever reaches the RANDOMISED call sites too, not only the fixed ones.
     Every lane/edge/cluster blob is rolled from a known nominal band; scaled, no
     blob on any map may exceed the largest nominal half-extent times HAZ_SC.
     The widest nominal rx in the file is the Kitchen milk lobe at 6+1.5 = 7.5. */
  let widest = 0;
  for (const key of Object.keys(MAPS)) for (const sd of S67)
    for (const f of makeMap(key, sd).fields) widest = Math.max(widest, f.rx);
  ok(`T46.A no blob exceeds the scaled nominal ceiling (widest rx ${widest.toFixed(3)})`,
     widest <= 7.5 * HAZ_SC + 1e-9);
  ok('T46.A ...and the ceiling is actually being approached, not trivially clear',
     widest > 7.5 * HAZ_SC * 0.7);
}

/* ------------------------------------------------ B: THE THINNED PASSES */
{
  /* The Desk lost its two extra soda splashes: 6 hazard blobs became 4, and it is
     a curated map with no lane passes, so this is an exact count on every seed. */
  let deskCounts = new Set();
  for (const sd of S67) deskCounts.add(makeMap('desk', sd).fields.length);
  ok('T46.B the Desk lays exactly 4 hazard blobs on every seed',
     deskCounts.size === 1 && deskCounts.has(4));

  /* Per-map hazard budget. v66 covered 18.6-21.7% of the board with hazard tiles
     and the maps read as clutter. The bands below are the v67 measurement with
     headroom; the point of the assertion is the CEILING - the floor is there so a
     future change that deletes hazards wholesale cannot pass silently. */
  const BUDGET = {
    backyard:   [4.0, 13.0],
    kitchen:    [4.0, 13.0],
    sandbox:    [4.0, 14.0],
    livingroom: [4.0, 13.0],
    desk:       [2.0, 6.0]
  };
  for (const key of Object.keys(MAPS)) {
    let lo = 100, hi = 0;
    for (const sd of S67) { const p = hazStats67(makeMap(key, sd)).pct; lo = Math.min(lo, p); hi = Math.max(hi, p); }
    const [bl, bh] = BUDGET[key];
    ok(`T46.B ${key}: hazard coverage ${lo.toFixed(2)}-${hi.toFixed(2)}% inside the ${bl}-${bh}% budget`,
       lo >= bl && hi <= bh);
    /* and strictly under the v66 figure it replaced (backyard 20.5, kitchen 18.6,
       sandbox 21.7, livingroom 20.3, desk 6.1 - measured, 40 seeds each) */
    ok(`T46.B ${key}: and well under the v66 footprint`, hi < 15.0);
  }

  /* Both codes survive on every PvP map: thinning must not have deleted a whole
     hazard class. A map with no impassable hazard left would be a silent failure
     of the release rather than a success of it. */
  for (const key of PVP67) {
    let c2 = 0, c3 = 0;
    for (const sd of S67) for (const f of makeMap(key, sd).fields) { if (f.code === 2) c2++; else c3++; }
    ok(`T46.B ${key}: both hazard codes still appear (burn ${c2}, liquid ${c3})`, c2 > 0 && c3 > 0);
  }
}

/* ------------------------------------------------ C: NO INVISIBLE BLOCKERS */
/* The release's real bug fix. Two paths dropped a field OBJECT while leaving the
   tiles it had already stamped, and renderTerrain draws only from M.fields - so
   those tiles were impassable ground with nothing drawn on them:

     1. the lane shallow-liquid pass, deleted outright. It sat ~10 tiles from a
        corner, inside the start-overlap filter, so it was dropped on ~98% of
        seeds. Worth 65-97 tiles per PvP map at v66.
     2. the drained-pond filter, which drops a liquid blob once node clearance has
        carved it below 40% solid. Worth up to 45 tiles on a bad Kitchen seed.
        Fixed by having each liquid blob record the tiles IT blocked and hand
        exactly those back, skipping any tile a surviving lobe still covers.

   The residue below is not a leak. Instrumenting field() to mark tiles whose pass
   was ALREADY 0 when the blob stamped them shows 0 unexplained orphans over 320
   map builds: every remaining uncovered tile is one a prop, nest or node block had
   taken before any hazard touched it, so handing it back would be wrong. That
   instrumented run is the proof; the bound here is its shipping form. */
{
  const ORPHAN_MAX = { backyard: 0, kitchen: 6, sandbox: 14, livingroom: 6, desk: 0 };
  for (const key of Object.keys(MAPS)) {
    let worst = 0, total = 0, bad = 0;
    for (const sd of S67) {
      const st = hazStats67(makeMap(key, sd));
      worst = Math.max(worst, st.orphan); total += st.orphan; bad += st.inconsistent;
    }
    ok(`T46.C ${key}: uncovered hazard tiles stay at/below ${ORPHAN_MAX[key]} (worst ${worst}, total ${total})`,
       worst <= ORPHAN_MAX[key]);
    /* grid consistency: a liquid tile is impassable, always. If these ever diverge
       the drain-clear has half-applied itself. */
    ok(`T46.C ${key}: no tile is liquid-but-walkable`, bad === 0);
  }
  /* backyard is the clean case - no node-crowded ponds - and must be exactly zero */
  {
    let t = 0;
    for (const sd of S67) t += hazStats67(makeMap('backyard', sd)).orphan;
    ok('T46.C backyard carries no uncovered hazard tile at all', t === 0);
  }
  /* non-vacuity: the counter must be able to count. Strip the field objects and the
     same code has to report a large orphan count off the same grid. */
  {
    const M = makeMap('sandbox', 303);
    const before = hazStats67(M).orphan;
    const saved = M.fields; M.fields = []; const kp = M.kpool; M.kpool = null;
    const after = hazStats67(M).orphan;
    M.fields = saved; M.kpool = kp;
    ok(`T46.C the orphan counter is not vacuous (${before} -> ${after} with the fields removed)`,
       after > 200 && after > before + 100);
  }
}

/* ------------------------------------------------ D: LANDMINES */
{
  /* re-rolled per match. makeMap runs off the per-match G.seed, so two seeds must
     not produce the same field - and the same seed must reproduce exactly. */
  for (const key of PVP67) {
    const sets = new Set();
    for (const sd of S67) sets.add(makeMap(key, sd).mines.map(m => m.x + ',' + m.y).join(';'));
    ok(`T46.D ${key}: every seed lays a different minefield (${sets.size}/${S67.length})`,
       sets.size === S67.length);
  }
  {
    const a = makeMap('kitchen', 505).mines.map(m => m.x + ',' + m.y).join(';');
    const b = makeMap('kitchen', 505).mines.map(m => m.x + ',' + m.y).join(';');
    ok('T46.D ...but the same seed reproduces the same minefield exactly', a === b);
  }

  ok('T46.D MINE_KEEPOUT is the approved 14', MINE_KEEPOUT === 14);
  for (const key of PVP67) {
    let count = MINES_PER_MAP, minStart = 1e9, minPair = 1e9, asym = 0, offBoard = 0, onBlocked = 0;
    for (const sd of S67) {
      const M = makeMap(key, sd), N = M.N;
      count = Math.min(count, M.mines.length);
      for (const m of M.mines) {
        if (m.x < 0 || m.y < 0 || m.x >= N || m.y >= N) offBoard++;
        if (M.pass[Math.floor(m.y) * N + Math.floor(m.x)] !== 1) onBlocked++;
        for (const s of M.starts) minStart = Math.min(minStart, dhyp(s.x - m.x, s.y - m.y));
        /* point symmetry: every mine's mirror is also a mine */
        if (!M.mines.some(o => Math.abs(o.x - (N - m.x)) < 1e-6 && Math.abs(o.y - (N - m.y)) < 1e-6)) asym++;
        for (const o of M.mines) { if (o === m) continue; minPair = Math.min(minPair, dhyp(o.x - m.x, o.y - m.y)); }
      }
    }
    ok(`T46.D ${key}: every seed fills the full ${MINES_PER_MAP}`, count === MINES_PER_MAP);
    ok(`T46.D ${key}: keep-out honoured (closest mine to a start ${minStart.toFixed(2)})`,
       minStart >= MINE_KEEPOUT - 0.01);
    ok(`T46.D ${key}: no two mines within 3 tiles (closest pair ${minPair.toFixed(2)})`,
       minPair >= 3 - 1e-9);
    ok(`T46.D ${key}: the field is point-symmetric`, asym === 0);
    ok(`T46.D ${key}: no mine is off-board or buried under a blocker`,
       offBoard === 0 && onBlocked === 0);
  }
  /* the pair-spacing rule specifically covers a pick against its OWN mirror, which
     is the case occ cannot see. A mine in the centre band would sit ~1.4 tiles from
     its mirror; assert no mine sits close enough to the centre for that to happen. */
  for (const key of PVP67) {
    let tooCentral = 0;
    for (const sd of S67) { const M = makeMap(key, sd);
      for (const m of M.mines) if (Math.abs(m.x - M.N / 2) < 1.5 && Math.abs(m.y - M.N / 2) < 1.5) tooCentral++; }
    ok(`T46.D ${key}: no mine sits in the centre band where it would clip its own mirror`,
       tooCentral === 0);
  }
  /* spread: mirrored pairs are a fairness device, not a reason to bunch. Over the
     seed set the mines must reach every quadrant of every map. */
  for (const key of PVP67) {
    let allQuads = true;
    for (const sd of S67) {
      const M = makeMap(key, sd), c = M.N / 2, q = [0, 0, 0, 0];
      for (const m of M.mines) q[(m.x > c ? 1 : 0) + (m.y > c ? 2 : 0)]++;
      if (q.some(v => v === 0)) allQuads = false;
    }
    ok(`T46.D ${key}: every quadrant gets mines on every seed`, allQuads);
  }
  ok('T46.D the Desk still lays no mines at all (survival-only)',
     S67.every(sd => makeMap('desk', sd).mines.length === 0));
}

/* ------------------------------------------------ E: EXPLICITLY UNCHANGED */
/* Austin declined these; a post-condition on the splice covers the source text and
   this covers the behaviour. */
{
  ok('T46.E the mine count is untouched at 20', MINES_PER_MAP === 20);

  /* the kiddie pool is NOT scaled by HAZ_SC: it is stamped outside field(). Its
     radius is rolled as 3.8 + rnd()*0.5, so it must stay inside [3.8, 4.3]. */
  let pmin = 99, pmax = 0, pools = 0;
  for (const sd of S67) { const M = makeMap('backyard', sd); if (M.kpool) { pools++; pmin = Math.min(pmin, M.kpool.r); pmax = Math.max(pmax, M.kpool.r); } }
  ok('T46.E the backyard still has its kiddie pool on every seed', pools === S67.length);
  ok(`T46.E the kiddie pool is unscaled (r ${pmin.toFixed(2)}-${pmax.toFixed(2)}, nominal 3.80-4.30)`,
     pmin >= 3.8 - 1e-9 && pmax <= 4.3 + 1e-9);
  ok('T46.E ...and it would have been caught if it had been scaled',
     pmin > 4.3 * HAZ_SC);

  /* barricades: the placer itself is still untouched, but v74 unblocked a lot of
     prop ground and barrTile only takes tiles that are currently passable, so the
     totals rose about 7-21% by map (65-110 to 88-125 over these seeds). The band
     below is widened to match, with headroom this time: the v66 ceiling of 110
     was being hit exactly, and a wider seed sample puts even v73 at 118, so that
     bound was a twelve-seed snapshot rather than an invariant. Message names the
     band being TESTED; the observed range is reported alongside it. */
  /* v103 owner pass: the BACKYARD is deliberately below the v74 band now and has
     its own. The owner asked for fewer, more spread-out hedgehog arcs on that map
     - it is the one where dark barricades sit on bright grass - so it lays three
     random clusters instead of seven and two lane roadblocks per lane instead of
     three. The other three maps keep the v74 band untouched, which is what makes
     this an intended cut on one map rather than a drift on all of them. The lower
     bound still bites: it is not far below what was measured (44-66 over these
     seeds), so a pass that started eating the lawn's cover fails here. */
  const BARR_BAND = { backyard: [36, 90], _: [50, 140] };   // v74 band for everything else
  for (const key of PVP67) {
    const [BARR_LO, BARR_HI] = BARR_BAND[key] || BARR_BAND._;
    let lo = 1e9, hi = 0;
    for (const sd of S67) { const n = makeMap(key, sd).barricades.length; lo = Math.min(lo, n); hi = Math.max(hi, n); }
    ok(`T46.E ${key}: barricade totals inside its band ${BARR_LO}-${BARR_HI} (saw ${lo}-${hi})`,
       lo >= BARR_LO && hi <= BARR_HI);
  }

  /* roach dens: v66 put a mirrored pair on every map and the hazard thinning moved
     the rnd() stream, so this is worth re-confirming rather than assuming. */
  for (const key of Object.keys(MAPS)) {
    let missing = 0;
    for (const sd of S67) if (!makeMap(key, sd).nests.some(n => n.species === 'roach')) missing++;
    ok(`T46.E ${key}: still has its roach den on every seed`, missing === 0);
  }
}
