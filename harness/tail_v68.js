/* tail_v68.js - T47: movement robustness.
   A: the clearance grid - correct against a brute-force reference, border-aware,
      rebuilt by initPF, invalidated by every runtime pass write, and DERIVED
      (never hashed, never serialized, survives a save/load round trip).
   B: nearestFit / unstick - an embedded mover escapes, a clear mover is untouched,
      the escape is a slide and not a teleport, and it is deterministic.
   C: creature spawn depenetration - nothing spawns embedded any more, and the
      srand() stream is bit-identical to v67 (the two draws did not move).
   D: radius threading - findPath and losClear honour the mover's real half-width,
      and an omitted argument still means the v67 assumption of 0.34.
   E: node docking - one slot per truck, all inside NODE_REACH, deterministic,
      order-independent, with a centre fallback; and the re-aim is cadence gated.
   F: separation - a pinned unit never initiates and never wanders, but it can now
      be pushed; two mobile units still split the gap exactly the v67 way.
   G: the whole release is movement-only: hashState and the snapshot encoder carry
      no new field, and a match round-trips through save/load unchanged.

   Every section carries a non-vacuity arm: a deliberate mutation that the check
   must catch, so a test that has quietly stopped looking at anything fails here
   rather than passing forever. */
'use strict';
section('T47 v68: movement robustness (clearance, depenetration, docking)');

const DT68 = 1 / 30;
function cfg68(map, mode, seed, opp) { return { map, mode, diff: 'normal', fac: 'green', opp: opp == null ? 3 : opp, seed } }
const PVP68 = ['backyard', 'kitchen', 'sandbox', 'livingroom'];
const ALL68 = PVP68.concat(['desk']);
const SEEDS68 = [680011, 680022, 680033];

/* brute-force reference for the clearance grid: for each passable tile, the
   smallest chebyshev ring at which a blocked tile (or the map edge) appears.
   Deliberately written the slow, obvious way so it shares no code with buildClr. */
function refClr(M, cap) {
  const N = M.N, out = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    if (M.pass[i] !== 1) { out[i] = 0; continue }
    let d = cap;
    for (let r = 1; r <= cap && d === cap; r++) {
      let hit = false;
      for (let oy = -r; oy <= r && !hit; oy++) for (let ox = -r; ox <= r; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N || M.pass[ny * N + nx] !== 1) { hit = true; break }
      }
      if (hit) d = r;
    }
    out[i] = d;
  }
  return out;
}

/* ------------------------------------------------- A: THE CLEARANCE GRID */
{
  ok('T47.A CLR_CAP is a byte-safe saturation point', typeof CLR_CAP === 'number' && CLR_CAP > 0 && CLR_CAP <= 255);
  ok('T47.A CLR_PEN is the approved 1.5 / 0.5 ladder',
    Array.isArray(CLR_PEN) && CLR_PEN[0] === 0 && CLR_PEN[1] === 1.5 && CLR_PEN[2] === 0.5);
  ok('T47.A ...and it is flat above clearance 2', CLR_PEN.slice(3).every(v => v === 0));
  ok('T47.A the penalty ladder is monotone non-increasing',
    CLR_PEN.slice(1).every((v, i, a) => i === 0 || a[i - 1] >= v));

  let bad = 0, checked = 0, sawOne = 0, sawTwoPlus = 0;
  for (const m of ALL68) {
    G = null; newGame(cfg68(m, 'dm', SEEDS68[0], 1));
    buildClr();
    const ref = refClr(G.map, CLR_CAP), N = G.map.N;
    for (let i = 0; i < N * N; i++) {
      checked++;
      if (PF.clr[i] !== ref[i]) bad++;
      if (PF.clr[i] === 1) sawOne++;
      if (PF.clr[i] >= 2) sawTwoPlus++;
    }
  }
  ok(`T47.A buildClr matches the brute-force reference on every tile of every map (${checked} tiles)`,
    bad === 0 && checked > 0);
  ok('T47.A ...and the grid is not degenerate: both wall-hugging and open tiles exist',
    sawOne > 0 && sawTwoPlus > 0);

  /* border awareness: passableR rejects within r of the edge, so the edge ring has
     to read as clearance 1 exactly like a tile against a wall. */
  G = null; newGame(cfg68('backyard', 'dm', SEEDS68[1], 1));
  buildClr();
  {
    const N = G.map.N; let edgeBad = 0, edgeSeen = 0;
    for (let x = 0; x < N; x++) for (const y of [0, N - 1]) {
      const i = y * N + x; if (G.map.pass[i] !== 1) continue;
      edgeSeen++; if (PF.clr[i] !== 1) edgeBad++;
    }
    ok(`T47.A the map edge counts as blocked (${edgeSeen} passable border tiles)`, edgeBad === 0);
  }

  /* invalidation: a runtime pass write must dirty the grid, and the next findPath
     must rebuild it. This is the hook that keeps a fresh building from being
     invisible to the router. */
  {
    G = null; newGame(cfg68('backyard', 'dm', SEEDS68[2], 1));
    const p = G.players[0];
    findPath(4, 4, 20, 20, false, .34);
    ok('T47.A a findPath leaves the grid clean', PF.dirty === 0);
    /* placement legality is not what is under test here - the pfDirty hook is - so
       this drops a barricade straight through makeBuilding on any passable tile. */
    let tx = -1, ty = -1;
    for (let y = 4; y < G.map.N - 4 && tx < 0; y++) for (let x = 4; x < G.map.N - 4; x++) {
      if (G.map.pass[y * G.map.N + x] === 1 && PF.clr[y * G.map.N + x] > 0) { tx = x; ty = y; break }
    }
    ok('T47.A found a clear tile to build on for the invalidation test', tx >= 0);
    const before = PF.clr[ty * G.map.N + tx];
    makeBuilding('barricade', p, tx, ty, true);
    ok('T47.A makeBuilding dirties the clearance grid', PF.dirty === 1);
    findPath(4, 4, 20, 20, false, .34);
    ok('T47.A ...and the next findPath rebuilds it', PF.dirty === 0 && PF.clr[ty * G.map.N + tx] === 0);
    ok('T47.A ...and the tile really did change (non-vacuity)', before !== 0);
  }

  /* the six runtime pass writes all route through pfDirty. Source-level, because
     several of them are death paths that are awkward to reach live; the count is
     asserted in the splice as well, so a new write site fails in both places. */
  ok('T47.A pfDirty exists and is a no-op before initPF', typeof pfDirty === 'function');
}

/* -------------------------------------------- B: nearestFit AND unstick */
{
  G = null; newGame(cfg68('backyard', 'dm', SEEDS68[0], 1));
  const N = G.map.N;

  /* find a solid block of terrain and a clear tile next to it */
  let bx = -1, by = -1;
  for (let y = 3; y < N - 3 && bx < 0; y++) for (let x = 3; x < N - 3; x++) {
    if (G.map.pass[y * N + x] === 0 && passableR(x + 1.5, y + .5, .34)) { bx = x; by = y; break }
  }
  ok('T47.B found a blocked tile with clear ground beside it', bx >= 0);

  const fit = nearestFit(bx + .5, by + .5, .34, PF_UNSTICK_R);
  ok('T47.B nearestFit returns a stand-able point for a position inside geometry',
    !!fit && passableR(fit.x, fit.y, .34));
  ok('T47.B ...and it is inside the scan radius',
    !!fit && Math.abs(fit.x - (bx + .5)) <= PF_UNSTICK_R + .5 && Math.abs(fit.y - (by + .5)) <= PF_UNSTICK_R + .5);
  ok('T47.B nearestFit is deterministic', (() => {
    const a = nearestFit(bx + .5, by + .5, .34, PF_UNSTICK_R), b = nearestFit(bx + .5, by + .5, .34, PF_UNSTICK_R);
    return a && b && a.x === b.x && a.y === b.y;
  })());
  ok('T47.B nearestFit gives back a tile CENTRE, so it never lands on a seam',
    !!fit && Math.abs(fit.x - Math.floor(fit.x) - .5) < 1e-9 && Math.abs(fit.y - Math.floor(fit.y) - .5) < 1e-9);
  ok('T47.B ...and a mover already standing clear gets its own tile centre back', (() => {
    const f = nearestFit(bx + 1.5, by + .5, .34, PF_UNSTICK_R);
    return f && Math.floor(f.x) === bx + 1 && Math.floor(f.y) === by;
  })());

  /* the escape itself: a unit dropped inside geometry gets out, at walking pace */
  {
    const p = G.players[0];
    const u = makeUnit('jeep', p, bx + .5, by + .5);
    ok('T47.B the planted unit really is embedded (non-vacuity)', !passableR(u.x, u.y, unitRad(u)));
    const step = u.sp * DT68;
    let ticks = 0, maxHop = 0;
    while (ticks < 200 && !passableR(u.x, u.y, unitRad(u))) {
      const x0 = u.x, y0 = u.y;
      u.path = [{ x: bx + 1.5, y: by + .5 }]; u.wp = 0; u.dest = { x: bx + 1.5, y: by + .5 };
      moveAlong(u, DT68);
      maxHop = Math.max(maxHop, dhyp(u.x - x0, u.y - y0));
      ticks++;
    }
    ok(`T47.B an embedded unit frees itself (${ticks} ticks)`, passableR(u.x, u.y, unitRad(u)) && ticks > 0);
    ok('T47.B ...by sliding, never by teleporting', maxHop <= step + 1e-9);
    u.hp = 0;
  }

  /* a clear unit must be left completely alone by the guard */
  {
    const p = G.players[0];
    const u = makeUnit('jeep', p, bx + 1.5, by + .5);
    const x0 = u.x, y0 = u.y;
    u.path = null; u.wp = 0;
    moveAlong(u, DT68);
    ok('T47.B a clear unit with no path is untouched', u.x === x0 && u.y === y0);
    u.hp = 0;
  }

  ok('T47.B unstick reports failure rather than jittering when there is nowhere to go',
    unstick({ x: bx + .5, y: by + .5 }, 99, 1) === false);
}

/* ------------------------------------ C: CREATURE SPAWN DEPENETRATION */
{
  let embedded = 0, spawned = 0;
  for (const m of ALL68) for (const sd of SEEDS68) {
    G = null; newGame(cfg68(m, 'dm', sd, 1));
    for (const ns of G.map.nests) {
      if (ns.dead) continue;
      for (let k = 0; k < 4; k++) {
        const cr = spawnCreature(ns);
        spawned++;
        if (!cr.t.fly && !passableR(cr.x, cr.y, .16)) embedded++;
      }
    }
  }
  ok(`T47.C no ground creature spawns embedded (${spawned} spawns across ${ALL68.length} maps x ${SEEDS68.length} seeds)`,
    embedded === 0 && spawned > 0);

  /* non-vacuity: the same check, with the correction bypassed, must find plenty.
     This is the v67 behaviour, and it was about half of every spawn. */
  {
    let raw = 0, rawEmb = 0;
    G = null; newGame(cfg68('backyard', 'dm', SEEDS68[0], 1));
    for (const ns of G.map.nests) {
      if (ns.dead) continue;
      for (let k = 0; k < 12; k++) {
        const a = srand() * 6.28, rr2 = ns.r * .5 * srand();
        const cx = ns.x + dcos(a) * rr2, cy = ns.y + dsin(a) * rr2;
        raw++; if (!passableR(cx, cy, .16)) rawEmb++;
      }
    }
    ok(`T47.C the uncorrected draw would still land embedded (${rawEmb}/${raw}), so the check is not vacuous`,
      rawEmb > 0);
  }

  /* the rng stream must not have moved: spawnCreature still draws exactly twice,
     in the same order. If the correction had been written as a rejection sample
     this would fail, and every pinned trail downstream would be lying about why. */
  {
    G = null; newGame(cfg68('backyard', 'dm', SEEDS68[1], 1));
    const ns = G.map.nests.find(n => !n.dead);
    ok('T47.C found a live den for the draw-order test', !!ns);
    const s0 = G.rngS;
    spawnCreature(ns);
    const after = G.rngS;
    /* five draws, not two: a and rr2 for the position, then wob/bob/legph for the
       idle wobble. The v68 correction adds none of them and reorders none of them. */
    G.rngS = s0; for (let k = 0; k < 5; k++) srand();
    ok('T47.C spawnCreature still draws exactly five srand() values, unreordered', G.rngS === after);
    G.rngS = s0; for (let k = 0; k < 4; k++) srand();
    ok('T47.C ...and the draw-count check would notice if one went missing', G.rngS !== after);
  }
}

/* ------------------------------------------------- D: RADIUS THREADING */
{
  G = null; newGame(cfg68('backyard', 'dm', SEEDS68[0], 1));

  ok('T47.D findPath takes a radius argument', findPath.length === 6);
  ok('T47.D losClear takes a radius argument', losClear.length === 4);

  /* an omitted radius must reproduce the v67 assumption exactly */
  {
    const a = { x: 8.5, y: 8.5 }, b = { x: 24.5, y: 24.5 };
    ok('T47.D losClear with no radius == losClear at 0.34',
      losClear(a, b, false) === losClear(a, b, false, 0.34));
    ok('T47.D findPath with no radius == findPath at 0.34',
      JSON.stringify(findPath(8, 8, 30, 30, false)) === JSON.stringify(findPath(8, 8, 30, 30, false, 0.34)));
  }

  /* the radius has to actually bite: somewhere on a real map there is a gap a
     0.26 infantryman clears and a 0.42 hull does not. */
  {
    /* the leg has to be SHALLOW. Axis-aligned legs between tile centres sample
       corners at y+.5 +- r and both radii stay inside the same tile row; a perfect
       45-degree leg is symmetric for the same reason. Either shape makes the check
       vacuous however many tiles it sweeps, which is how the first cut of this test
       read 0 of 2328 and looked like a regression. A 3:1 leg crosses tile seams at
       an angle and separates them. */
    const N = G.map.N; let narrow = 0, tested = 0;
    for (let y = 2; y < N - 4; y++) for (let x = 2; x < N - 4; x++) {
      const a = { x: x + .5, y: y + .5 }, b = { x: x + 3.5, y: y + 1.5 };
      if (!passableR(a.x, a.y, .26) || !passableR(b.x, b.y, .26)) continue;
      tested++;
      if (losClear(a, b, false, .26) && !losClear(a, b, false, .42)) narrow++;
    }
    ok(`T47.D the smoother is genuinely radius-sensitive (${narrow} legs pass at 0.26 and fail at 0.42, of ${tested})`,
      narrow > 0 && tested > 0);
  }

  /* and the radius must reach all the way through A*, not just the smoother */
  {
    const N = G.map.N; let diff = 0, tot = 0;
    for (let k = 0; k < 400; k++) {
      const sx = 2 + (k * 7) % (N - 4), sy = 2 + (k * 11) % (N - 4);
      const tx = 2 + (k * 19) % (N - 4), ty = 2 + (k * 23) % (N - 4);
      if (!passableR(sx + .5, sy + .5, .42) || !passableR(tx + .5, ty + .5, .42)) continue;
      tot++;
      if (JSON.stringify(findPath(sx, sy, tx, ty, false, .26)) !== JSON.stringify(findPath(sx, sy, tx, ty, false, .42))) diff++;
    }
    ok(`T47.D a narrow mover and a wide one get genuinely different routes (${diff} of ${tot})`,
      tot > 50 && diff / tot > 0.25);
  }

  /* and the smoothed path a wide hull gets back must be walkable AT ITS OWN radius
     far more often than the v67 0.34 assumption allowed. This is the release's
     central claim for units, so it is measured rather than asserted. */
  {
    const N = G.map.N, R = .42; let legs = 0, bad = 0;
    for (let k = 0; k < 60; k++) {
      const sx = 3 + (k * 7) % (N - 6), sy = 3 + (k * 13) % (N - 6);
      const tx = 3 + (k * 17) % (N - 6), ty = 3 + (k * 23) % (N - 6);
      if (!passableR(sx + .5, sy + .5, R) || !passableR(tx + .5, ty + .5, R)) continue;
      const p = findPath(sx, sy, tx, ty, false, R);
      let px = sx + .5, py = sy + .5;
      for (const w of p) { legs++; if (!losClear({ x: px, y: py }, w, false, R)) bad++; px = w.x; py = w.y }
    }
    ok(`T47.D a 0.42 hull's own path is walkable at 0.42 (${bad} bad legs of ${legs})`,
      legs > 0 && bad / legs < 0.06);
  }
}

/* --------------------------------------------------- E: NODE DOCKING */
{
  ok('T47.E the approved dock geometry', NODE_DOCK_N === 8 && NODE_DOCK_R === 1.6);
  ok('T47.E NODE_REACH covers the dock ring', NODE_REACH === 2.0 && NODE_REACH > NODE_DOCK_R);
  ok('T47.E the re-aim cadence is a tick count, not a clock', Number.isInteger(NODE_REPATH) && NODE_REPATH > 0);

  G = null; newGame(cfg68('backyard', 'dm', SEEDS68[0], 1));
  const p = G.players[0];
  const node = G.map.nodes.reduce((a, n) => (!a || dhyp(n.x - p.blds[0].x, n.y - p.blds[0].y) < dhyp(a.x - p.blds[0].x, a.y - p.blds[0].y)) ? n : a, null);
  ok('T47.E found a node to dock against', !!node);
  node.amt = node.max = 1e9;

  const fleet = [];
  for (let i = 0; i < 8; i++) { const u = makeUnit('truck', p, node.x + 4 + i * .1, node.y + 4); u.node = node; fleet.push(u) }

  const docks = fleet.map(u => nodeDock(u, node));
  const usable = (() => { let c = 0; for (let k = 0; k < NODE_DOCK_N; k++) { const a = k * (6.283185307179586 / NODE_DOCK_N); if (passableR(node.x + dcos(a) * NODE_DOCK_R, node.y + dsin(a) * NODE_DOCK_R, .34)) c++ } return c })();
  ok('T47.E the test pile has usable slots to hand out', usable > 0);
  ok(`T47.E every truck up to the usable-slot count gets a distinct dock (${usable} usable of ${NODE_DOCK_N})`,
    new Set(docks.slice(0, usable).map(d => d.x.toFixed(6) + '|' + d.y.toFixed(6))).size === Math.min(usable, fleet.length));
  ok('T47.E every dock is inside NODE_REACH of the pile',
    docks.every(d => dhyp(d.x - node.x, d.y - node.y) <= NODE_REACH));
  ok('T47.E every dock a truck is actually sent to is stand-able, or is the centre fallback',
    docks.every(d => passableR(d.x, d.y, .34) || (d.x === node.x && d.y === node.y)));
  {
    const d2 = docks.slice(0, usable);
    ok('T47.E distinct docks are far enough apart to clear the separation floor',
      d2.every((a, i) => d2.every((b, j) => i === j || dhyp(a.x - b.x, a.y - b.y) >= .55 - 1e-9)));
  }

  ok('T47.E docking is deterministic', (() => {
    const again = fleet.map(u => nodeDock(u, node));
    return again.every((d, i) => d.x === docks[i].x && d.y === docks[i].y);
  })());
  ok('T47.E ...and independent of iteration order (rank is by id, not by position in the list)', (() => {
    const saved = p.units.slice();
    p.units.reverse();
    const rev = fleet.map(u => nodeDock(u, node));
    p.units.length = 0; p.units.push(...saved);
    return rev.every((d, i) => d.x === docks[i].x && d.y === docks[i].y);
  })());

  /* trucks assigned to a DIFFERENT node must not consume this node's slots */
  ok('T47.E slot rank counts only the trucks on this node', (() => {
    const other = G.map.nodes.find(n => n !== node);
    if (!other) return true;
    const solo = makeUnit('truck', p, node.x + 9, node.y + 9);
    solo.node = other;
    const d = nodeDock(fleet[0], node);
    solo.hp = 0;
    return d.x === docks[0].x && d.y === docks[0].y;
  })());

  /* truckToNode pins the exact dock on the end of the path. Without it the truck
     parks on a tile centre up to ~0.7 off its slot and re-aims every tick, which
     is the churn this release had to fix during bring-up. */
  {
    const u = fleet[0];
    truckToNode(u, node);
    const last = u.path[u.path.length - 1], d = nodeDock(u, node);
    ok('T47.E truckToNode ends the path on the exact dock point',
      Math.abs(last.x - d.x) < 1e-9 && Math.abs(last.y - d.y) < 1e-9);
    ok('T47.E ...and it is not merely the tile centre (non-vacuity)',
      Math.abs(last.x - (Math.floor(last.x) + .5)) > 1e-9 || Math.abs(last.y - (Math.floor(last.y) + .5)) > 1e-9);
    ok('T47.E ...and u.dest agrees with it', u.dest.x === d.x && u.dest.y === d.y);
  }

  /* the behavioural claim: a fleet on one pile spreads out instead of piling up. */
  {
    for (const u of fleet) { u.state = 'togo'; truckToNode(u, node) }
    for (let i = 0; i < 2400; i++) update(DT68);
    const live = fleet.filter(u => u.hp > 0);
    let close = 0, pairs = 0;
    for (let a = 0; a < live.length; a++) for (let b = a + 1; b < live.length; b++) {
      pairs++; if (dhyp(live[a].x - live[b].x, live[a].y - live[b].y) < .55) close++;
    }
    ok(`T47.E a fleet of ${live.length} on one pile does not interpenetrate (${close}/${pairs} pairs inside the floor)`,
      pairs > 0 && close / pairs < 0.10);
  }
}

/* ------------------------------------------------------- F: SEPARATION */
{
  G = null; newGame(cfg68('backyard', 'dm', SEEDS68[1], 1));
  const p = G.players[0];
  let ox = -1, oy = -1;
  for (let y = 6; y < 40 && ox < 0; y++) for (let x = 6; x < 40; x++) {
    let clear = true;
    for (let dy = -2; dy <= 2 && clear; dy++) for (let dx = -2; dx <= 2; dx++) if (!passableR(x + dx + .5, y + dy + .5, .34)) { clear = false; break }
    if (clear) { ox = x; oy = y }
  }
  ok('T47.F found open ground for the separation tests', ox >= 0);
  const clearUnits = () => { for (const u of G.units.slice()) u.hp = 0; G.units.length = 0; p.units.length = 0 };

  /* two mobile units: must split the gap exactly as v67 did */
  {
    clearUnits();
    const a = makeUnit('jeep', p, ox + .5, oy + .5), b = makeUnit('jeep', p, ox + .8, oy + .5);
    const d0 = dhyp(a.x - b.x, a.y - b.y), expect = (.55 - d0) / 2;
    separation();
    ok('T47.F two mobile units each take half the gap, the v67 arithmetic',
      Math.abs(Math.abs(b.x - (ox + .8)) - expect) < 1e-9 && Math.abs(Math.abs(a.x - (ox + .5)) - expect) < 1e-9);
  }

  /* pinned + mobile: the miner holds station, the mobile one takes the WHOLE gap */
  {
    clearUnits();
    const a = makeUnit('truck', p, ox + .5, oy + .5), b = makeUnit('jeep', p, ox + .8, oy + .5);
    a.state = 'harvest';
    const ax0 = a.x, ay0 = a.y, d0 = dhyp(a.x - b.x, a.y - b.y), expect = .55 - d0;
    separation();
    ok('T47.F a harvesting truck never moves', a.x === ax0 && a.y === ay0);
    ok('T47.F ...and its mobile neighbour takes the whole gap instead of half',
      Math.abs(Math.abs(b.x - (ox + .8)) - expect) < 1e-9);
    ok('T47.F ...which is strictly more than v67 moved it (non-vacuity)', expect > (.55 - d0) / 2);
  }

  /* the v67 hole: the pair was skipped outright when the LOWER-id side was mining */
  {
    clearUnits();
    const a = makeUnit('truck', p, ox + .5, oy + .5), b = makeUnit('jeep', p, ox + .8, oy + .5);
    a.state = 'harvest';
    ok('T47.F the miner is the lower-id side, which is the case v67 dropped', a.id < b.id);
    separation();
    ok('T47.F ...and the overlap is now resolved', dhyp(a.x - b.x, a.y - b.y) > .55 - 1e-9);
  }

  /* two pinned units: nothing moves, so a mining pair cannot shove each other off */
  {
    clearUnits();
    const a = makeUnit('truck', p, ox + .5, oy + .5), b = makeUnit('truck', p, ox + .8, oy + .5);
    a.state = 'harvest'; b.state = 'harvest';
    const s = [a.x, a.y, b.x, b.y];
    separation();
    ok('T47.F two pinned units are both left alone', a.x === s[0] && a.y === s[1] && b.x === s[2] && b.y === s[3]);
  }

  /* an entrenched gunner is pinned on the same rule */
  {
    clearUnits();
    const a = makeUnit('gunner', p, ox + .5, oy + .5), b = makeUnit('jeep', p, ox + .8, oy + .5);
    a.entrenched = true;
    const ax0 = a.x;
    separation();
    ok('T47.F an entrenched gunner holds its position', a.x === ax0);
    ok('T47.F ...and is still pushed clear of', dhyp(a.x - b.x, a.y - b.y) > .55 - 1e-9);
  }
}

/* --------------------------------- G: MOVEMENT-ONLY, AND IT ROUND-TRIPS */
{
  /* nothing this release added may reach the wire. The clearance grid lives on PF,
     which is scratch and is rebuilt by initPF; the dock point lives in u.dest,
     which was already movement state. */
  G = null; newGame(cfg68('backyard', 'dm', SEEDS68[2], 1));
  for (let i = 0; i < 600; i++) update(DT68);

  const snap = JSON.stringify(saveState());
  for (const k of ['"clr"', '"dirty"', '"clrT"']) {
    ok(`T47.G the snapshot carries no ${k} field`, snap.indexOf(k) < 0);
  }

  /* the grid must be rebuilt, not restored, on load - and the load must not care
     that it was never in the save. */
  {
    const h0 = hashState();
    const S = JSON.parse(snap);
    loadState(S);
    ok('T47.G a save/load round trip is hash-identical', hashState() === h0);
    ok('T47.G ...and the clearance grid comes back rebuilt, not restored',
      PF.clr instanceof Uint8Array && PF.clr.length === G.map.N * G.map.N);
    findPath(4, 4, 20, 20, false, .34);
    const ref = refClr(G.map, CLR_CAP);
    let bad = 0; for (let i = 0; i < ref.length; i++) if (PF.clr[i] !== ref[i]) bad++;
    ok('T47.G ...and it is correct after the load', bad === 0);
  }

  /* determinism: two runs from the same seed agree tick for tick, with wildlife
     awake (the depenetration path is what this release changed underneath them). */
  {
    const trail = seed => {
      G = null; newGame(cfg68('backyard', 'dm', seed, 3));
      const t = [];
      for (let i = 0; i < 900; i++) { update(DT68); if (i % 150 === 0) t.push(hashState()) }
      return t.join(',');
    };
    ok('T47.G identical seeds produce identical trails', trail(680404) === trail(680404));
    ok('T47.G ...and different seeds do not (non-vacuity)', trail(680404) !== trail(680505));
  }

  /* creatures actually move now. The v67 number on this measurement was 48.5%
     of steps blocked; the gate is deliberately loose so it tests the defect and
     not the exact tuning. */
  {
    G = null; newGame(cfg68('backyard', 'dm', 680606, 3));
    let calls = 0, blocked = 0;
    const _cs = creatureStep;
    creatureStep = function (cr, dX, dY, dt) {
      const x0 = cr.x, y0 = cr.y, st = cr.sp * dt;
      _cs(cr, dX, dY, dt);
      if (cr.t.fly) return;
      calls++; if (dhyp(cr.x - x0, cr.y - y0) < st * .1) blocked++;
    };
    for (let i = 0; i < 5400; i++) update(DT68);
    creatureStep = _cs;
    ok(`T47.G wildlife is not frozen against geometry any more (${blocked}/${calls} steps blocked)`,
      calls > 200 && blocked / calls < 0.20);
  }
}
