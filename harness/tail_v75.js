'use strict';
/* T52 v75: per-class veterancy rungs, an AI army ceiling read off supply, and a
   two-sided resource servo.

   ALL THREE MOVE THE SIM, so every trail table was recut. The LAYOUT tables were
   NOT: v75 touches no prop, no hazard, no node and nothing that writes M.pass,
   so map generation is bit-identical and the three layout tables passed
   unmodified. Section E states that from the other end, that nothing this
   release adds is stored on an entity, hashed, or serialized. The standing rule
   that layout baselines are never recut on a sim-only release holds here; v67
   and v74 remain its only two exceptions.

   WHAT IS DELIBERATELY NOT TESTED HERE.

   "Veterancy is now reachable" is a claim about a whole match, not about a
   function. It was measured (three ten-minute four-player matches: survivors at
   rank 2 rose from 4.1% to 8.5% and at rank 3 from 0.0% to 5.9%), and a
   measurement over four matches is not a regression gate - it is a number that
   moves with every balance change downstream. What this tail pins is the
   CONTRACT: where the rungs sit, that the ladder is chosen off the unit type,
   and that nothing else about promotion moved. T10 in tail_v29 still owns the
   credit paths and the multipliers.

   Likewise the ceiling. That the release halved armyCap's share of refused
   production decisions (33.8% to 16.0%) is measured, not asserted. Section B
   pins the arithmetic, the clamps, the live reserve, and the one thing that
   actually matters at the gate: that a bot stops at its OWN cap and that the cap
   moves when its supply capacity does.

   A: the ladder - constants, selection, both walks.
   B: aiArmyCap - derivation, live reserve, clamps, difficulty, the real gate.
   C: the servo - sign, normalisation, symmetry, the filter.
   D: the three retired v22/v61 rules are really gone.
   E: statelessness, determinism and save/load. */

section('T52 v75: veterancy rungs, supply-derived army ceiling, resource servo');

const DT75 = 1 / 30;
function cfg75(map, mode, seed, opp, fac, diff) {
  return { map, mode, diff: diff || 'normal', fac: fac || 'green', opp: (opp == null ? 1 : opp), seed };
}
function fresh75(seed, opp, map, mode, fac, diff) {
  G = null; newGame(cfg75(map || 'backyard', mode || 'dm', seed, opp, fac, diff));
  return G.human;
}
function bot75(fac) { return G.players.find(p => p.ai && (!fac || p.fac === fac)); }
function put75(k, p, x, y) { const u = makeUnit(k, p, x, y); u.state = 'idle'; u.path = null; u.target = null; return u; }
function drop75(u) {
  const i = G.units.indexOf(u); if (i >= 0) G.units.splice(i, 1);
  const j = u.p.units.indexOf(u); if (j >= 0) u.p.units.splice(j, 1);
}
function depots75(p, n) {
  const hq = p.blds[0];
  for (let i = 0; i < n; i++) {
    const b = makeBuilding('supply', p, Math.floor(hq.tx) - 7, Math.floor(hq.ty) + i * 2 - 9, true);
    if (b) b.prog = 1;
  }
}
/* a spot far from anything, so a placed unit does not immediately fight */
function spot75() {
  const s = G.map.starts[0];
  return { x: s.x, y: s.y };
}

/* ================================================== A: the ladder ========== */
{
  section('T52.A the rungs are per class, and the class comes off the unit type');

  ok('T52.A infantry promote on 1/2/4',
    Array.isArray(VET_INF) && VET_INF.join() === '1,2,4');
  ok('T52.A everything else promotes on 2/4/8',
    Array.isArray(VET_VEH) && VET_VEH.join() === '2,4,8');
  ok('T52.A the two ladders are strictly increasing, so a rank cannot be skipped backwards',
    VET_INF[0] < VET_INF[1] && VET_INF[1] < VET_INF[2] &&
    VET_VEH[0] < VET_VEH[1] && VET_VEH[1] < VET_VEH[2]);
  ok('T52.A the vehicle ladder is strictly harder at every rung',
    VET_VEH[0] > VET_INF[0] && VET_VEH[1] > VET_INF[1] && VET_VEH[2] > VET_INF[2]);

  fresh75(750001, 1);
  const sp = spot75();

  /* every trainable unit resolves to exactly one of the two frozen arrays, and
     the choice is the TYPE's armor class - not the key, not a list to maintain */
  let inf = 0, veh = 0, other = 0;
  for (const k in U) {
    if (U[k].noTrain) continue;
    const u = put75(k, G.human, sp.x, sp.y);
    const st = vetSteps(u);
    if (st === VET_INF) { inf++; if (u.t.a !== 'inf') other++; }
    else if (st === VET_VEH) { veh++; if (u.t.a === 'inf') other++; }
    else other++;
    drop75(u);
  }
  ok(`T52.A every trainable unit gets one of the two ladders and no third answer (${inf} inf, ${veh} other)`,
    inf > 0 && veh > 0 && other === 0);

  /* the infantry walk */
  const u = put75('grunt', G.human, sp.x, sp.y);
  const d0 = u.dm;
  ok('T52.A a fresh unit starts at rank 0 with no kills', u.kl === 0 && u.vr === 0);
  vetRankUp(u);
  ok('T52.A infantry rank 1 on the first kill', u.kl === 1 && u.vr === 1);
  vetRankUp(u);
  ok('T52.A infantry rank 2 on the second', u.kl === 2 && u.vr === 2);
  vetRankUp(u);
  ok('T52.A three kills is still rank 2 - the rung is 4, not 3', u.kl === 3 && u.vr === 2);
  vetRankUp(u);
  ok('T52.A infantry rank 3 on the fourth, and the damage bonus is +30%',
    u.kl === 4 && u.vr === 3 && Math.abs(u.dm - d0 * 1.3) < 1e-6);
  for (let i = 0; i < 20; i++) vetRankUp(u);
  ok('T52.A rank is capped at 3 however many kills follow',
    u.kl === 24 && u.vr === 3 && Math.abs(u.dm - d0 * 1.3) < 1e-6);

  /* the vehicle walk, one rung apart the whole way */
  const t = put75('tank', G.human, sp.x + 2, sp.y);
  const t0 = t.dm;
  vetRankUp(t);
  ok('T52.A a vehicle is still rank 0 at one kill', t.kl === 1 && t.vr === 0 && t.dm === t0);
  vetRankUp(t);
  ok('T52.A vehicle rank 1 at two', t.vr === 1 && Math.abs(t.dm - t0 * 1.1) < 1e-9);
  vetRankUp(t); vetRankUp(t);
  ok('T52.A vehicle rank 2 at four', t.kl === 4 && t.vr === 2 && Math.abs(t.dm - t0 * 1.2) < 1e-6);
  for (let i = 0; i < 3; i++) vetRankUp(t);
  ok('T52.A seven kills is still rank 2 - the rung is 8', t.kl === 7 && t.vr === 2);
  vetRankUp(t);
  ok('T52.A vehicle rank 3 at eight', t.kl === 8 && t.vr === 3 && Math.abs(t.dm - t0 * 1.3) < 1e-6);

  /* aircraft are not infantry, so they take the harder ladder too */
  const h = put75('heli', G.human, sp.x + 4, sp.y);
  vetRankUp(h);
  ok('T52.A aircraft take the vehicle ladder', vetSteps(h) === VET_VEH && h.vr === 0);
}

/* ==================================== B: the supply-derived army ceiling ==== */
{
  section('T52.B aiArmyCap reads supply, not the clock');

  ok('T52.B the three tunables exist and are ordered',
    typeof AI_SUP_PAD === 'number' && typeof AI_ARMY_FLOOR === 'number' &&
    typeof AI_ARMY_CEIL === 'number' && AI_ARMY_FLOOR < AI_ARMY_CEIL);
  ok('T52.B the floor is v69\'s opening cap, so the early game is untouched', AI_ARMY_FLOOR === 12);
  ok('T52.B the ceiling is v69\'s 52, demoted to a safety stop', AI_ARMY_CEIL === 52);

  /* AI_SUP_UNIT is DERIVED from the roster, not typed in. Recompute it here the
     way the game does and confirm the two agree, so re-pricing a unit into
     another supply quartile moves the ceiling with it. */
  {
    let n = 0, t = 0;
    for (const k in U) {
      if (U[k].noTrain || AI_SUPPORT[k] || !(U[k].dm > 0)) continue;
      n++; t += supOf(k);
    }
    ok(`T52.B AI_SUP_UNIT is the combat roster's own mean supply rank (${AI_SUP_UNIT.toFixed(4)} over ${n} units)`,
      n > 0 && Math.abs(AI_SUP_UNIT - t / n) < 1e-12);
    ok('T52.B and it sits inside the quartile range it averages',
      AI_SUP_UNIT > 1 && AI_SUP_UNIT < SUP_MAX);
  }

  /* the clock is gone: two bots with the same supply and bank but wildly
     different ai.t must answer the same number */
  {
    fresh75(750010, 3);
    const p = bot75();
    depots75(p, 4);
    p.res.p = 0;
    const keep = p.ai.t;
    p.ai.t = 0; const young = aiArmyCap(p);
    p.ai.t = 60000; const old = aiArmyCap(p);
    p.ai.t = keep;
    ok(`T52.B the match clock no longer enters the ceiling (${young} at t=0, ${old} at t=60000)`, young === old);
  }

  /* it moves with supCap, monotonically, and the difficulty stat rides it */
  {
    fresh75(750011, 3);
    const p = bot75();
    p.res.p = 0;
    const seen = [];
    for (let i = 0; i < 8; i++) { seen.push(aiArmyCap(p)); depots75(p, 1); }
    seen.push(aiArmyCap(p));
    ok(`T52.B the ceiling rises with supply capacity and never falls (${seen.join(' ')})`,
      seen.every((v, i) => i === 0 || v >= seen[i - 1]) && seen[seen.length - 1] > seen[0]);
    ok('T52.B ...and it left the floor behind on the way', seen[seen.length - 1] > AI_ARMY_FLOOR);
  }

  /* the support reserve is read LIVE off the units actually fielded, so a bot
     that adds trucks and medics loses ceiling to them rather than to a constant */
  {
    fresh75(750012, 3);
    const p = bot75();
    depots75(p, 6);
    p.res.p = 0;
    const before = aiArmyCap(p);
    const added = [];
    for (let i = 0; i < 3; i++) added.push(put75('medic', p, p.start.x + i, p.start.y));
    const after = aiArmyCap(p);
    for (const u of added) drop75(u);
    const back = aiArmyCap(p);
    ok(`T52.B support units charge against the ceiling as they are fielded (${before} -> ${after})`, after < before);
    ok('T52.B ...and give it back when they die, because the reserve is read and not stored', back === before);
    ok('T52.B a fighter does NOT charge against the reserve, only support does',
      (() => { const g = put75('grunt', p, p.start.x + 5, p.start.y); const c = aiArmyCap(p); drop75(g); return c === before; })());
  }

  /* both clamps, from both directions */
  {
    fresh75(750013, 3);
    const p = bot75();
    p.res.p = 0;
    ok('T52.B a bot with only an HQ is held at the floor rather than below it',
      aiArmyCap(p) === AI_ARMY_FLOOR);
    depots75(p, 30);
    p.res.p = 1e9;
    ok('T52.B and an unbounded supply plus an unbounded bank stops at the safety ceiling',
      aiArmyCap(p) === AI_ARMY_CEIL);
  }

  /* difficulty rides the ceiling, as it did at v69 - it is a handicap stat, not
     a supply grant, so trainUnit's supFree gate still has the last word */
  {
    fresh75(750014, 3);
    const p = bot75();
    depots75(p, 6);
    p.res.p = 0;
    const at = (d) => { p.diff = DIFFS[d]; return aiArmyCap(p); };
    const e = at('easy'), n = at('normal'), h = at('hard');
    p.diff = null;
    ok(`T52.B the difficulty stat still scales the ceiling (easy ${e}, normal ${n}, hard ${h})`, e < n && n < h);
  }

  /* and the gate itself, so the arithmetic above is not merely arithmetic */
  {
    fresh75(750015, 3);
    const p = bot75();
    const hq = p.blds[0];
    const bar = makeBuilding('barracks', p, Math.floor(hq.tx) + 4, Math.floor(hq.ty), true); bar.prog = 1;
    depots75(p, 6);
    p.res.p = 20000; p.res.e = 20000;
    for (const b of p.blds) b.queue && (b.queue.length = 0);
    const armyLen = () => p.units.filter(u => !AI_SUPPORT[u.key] && !u.garrisoned).length;
    const fightQ = () => p.blds.reduce((n, b) => n + (b.queue ? b.queue.filter(k => !AI_SUPPORT[k]).length : 0), 0);
    const cap = aiArmyCap(p);
    while (armyLen() < cap - 3) put75('grunt', p, p.start.x + (armyLen() % 6) - 3, p.start.y + ((armyLen() / 6) | 0) - 2);
    for (const b of p.blds) b.queue && (b.queue.length = 0);
    aiTick(p);
    ok('T52.B under its ceiling the bot is producing', fightQ() > 0);
    while (armyLen() < aiArmyCap(p)) put75('grunt', p, p.start.x + (armyLen() % 6) - 3, p.start.y + ((armyLen() / 6) | 0) - 2);
    for (const b of p.blds) b.queue && (b.queue.length = 0);
    aiTick(p);
    ok('T52.B ...and at its ceiling it stops', fightQ() === 0);
    ok('T52.B the stop was the ceiling and not an empty wallet', p.res.p >= 1000);
  }
}

/* ================================================== C: the servo =========== */
{
  section('T52.C the resource servo is signed, normalised and symmetric');

  ok('T52.C RES_REF is the ratio the price tables imply, not a typed-in number',
    (() => {
      let cp = 0, ce = 0;
      for (const k in U) { if (U[k].noTrain) continue; cp += U[k].cp; ce += U[k].ce; }
      for (const k in B) { if (k === 'nest' || k === 'barricade') continue; cp += B[k].cp; ce += B[k].ce; }
      return cp > 0 && Math.abs(RES_REF - ce / cp) < 1e-12;
    })());
  ok('T52.C the bias and the filter threshold are sane',
    RES_BIAS > 0 && RES_HARD > 0 && RES_HARD < 1);

  const sk = (p, e) => resSkew({ res: { p, e } });
  ok('T52.C an empty bank is balanced rather than undefined', sk(0, 0) === 0);
  ok('T52.C balance is exactly p * RES_REF, from either side',
    Math.abs(sk(1000, 1000 * RES_REF)) < 1e-12 && Math.abs(sk(37, 37 * RES_REF)) < 1e-12);
  ok('T52.C all plastic and no power reads +1, the battery-poor end',
    Math.abs(sk(1e6, 0) - 1) < 1e-9);
  ok('T52.C all power and no plastic reads -1, the battery-rich end',
    Math.abs(sk(0, 1e6) + 1) < 1e-9);
  ok('T52.C the range is closed: nothing can leave -1..+1',
    [[0, 0], [1, 1], [1e9, 1], [1, 1e9], [500, 200], [3, 90000]].every(([a, b]) => {
      const v = sk(a, b); return v >= -1 && v <= 1;
    }));
  ok('T52.C it is monotone in the electricity bank at fixed plastic',
    (() => { let last = 2; for (const e of [0, 50, 200, 400, 1000, 5000]) { const v = sk(1000, e); if (v >= last) return false; last = v; } return true; })());
  ok('T52.C the scale is RELATIVE, so ten times both banks is the same skew',
    Math.abs(sk(500, 2000) - sk(5000, 20000)) < 1e-12);

  /* the same claim T40.H makes, driven through findNode itself: a power-short
     fleet goes to the battery and a power-rich one is pushed onto plastic, and
     now the plastic-short case is a real case too. */
  {
    fresh75(750020, 1);
    const p = G.human;
    const u = p.units.find(x => x.t.a === 'truck' && !x.t.heal);
    if (!u) { ok('T52.C a truck to drive the servo with', false); }
    else {
      u.hold = false; u.cargo = 0; u.cargoT = null; u.node = null; u.parked = false;
      const keepP = p.res.p, keepE = p.res.e;
      let piles = 0, poorB = 0, richP = 0;
      for (const n of G.map.nodes) {
        if (n.t !== 'battery' || n.amt <= 0 || n.wreck) continue;
        u.x = n.x + 1.5; u.y = n.y + 1.5;
        piles++;
        p.res.p = 5000; p.res.e = 0;
        if ((findNode(u) || {}).t === 'battery') poorB++;
        p.res.p = 0; p.res.e = 500000;
        if ((findNode(u) || {}).t === 'plastic') richP++;
      }
      p.res.p = keepP; p.res.e = keepE;
      ok(`T52.C a power-SHORT fleet takes the battery at every pile (${poorB} of ${piles})`,
        piles > 0 && poorB === piles);
      ok(`T52.C a power-RICH fleet is pushed onto plastic instead (${richP} of ${piles})`,
        richP > 0);
      /* soft, not a ban: with no plastic left in reach a rich fleet still mines */
      const keepAmt = G.map.nodes.map(n => n.amt);
      for (const n of G.map.nodes) if (n.t === 'plastic') n.amt = 0;
      p.res.p = 0; p.res.e = 500000;
      const only = findNode(u);
      ok('T52.C with no plastic in reach a rich fleet still takes the battery',
        !!only && only.t === 'battery');
      G.map.nodes.forEach((n, i) => { n.amt = keepAmt[i]; });
      /* and a part-loaded truck still finishes its own resource, servo or no servo */
      u.cargo = 15; u.cargoT = 'battery';
      const locked = findNode(u);
      ok('T52.C a part-loaded truck still finishes its own resource', !!locked && locked.t === 'battery');
      u.cargo = 0; u.cargoT = null;
      p.res.p = keepP; p.res.e = keepE;
    }
  }
}

/* =============================== D: the retired rules are really gone ====== */
{
  section('T52.D the three v22 / v61 absolute thresholds are retired');

  const src = String(findNode);
  /* Asserted against the EXPRESSIONS, not against the words. findNode's prose
     still says "lean" while explaining what replaced it, and a /lean/ test passes
     v74 and fails v75 for the wrong reason - the same trap this project has hit
     before with prose comments carrying a token an absence assertion was hunting.
     The three retired rules were three comparisons; those are what must be gone. */
  ok('T52.D the v22 hard battery filter under 120 electricity is gone',
    !/res\.e\s*<\s*120/.test(src));
  ok('T52.D the v22 battery pull under 200 electricity is gone',
    !/res\.e\s*<\s*200/.test(src));
  ok('T52.D the v61 glut push over E_GLUT is gone',
    !/E_GLUT/.test(src) && typeof E_GLUT === 'undefined' && typeof E_GLUT_PEN === 'undefined');
  ok('T52.D and what replaced them is the servo', /resSkew/.test(src) && /RES_BIAS/.test(src));

  ok('T52.D the flat 3/6/12 ladder is gone from vetRankUp',
    !/12\s*\?\s*3/.test(String(vetRankUp)) && /vetSteps/.test(String(vetRankUp)));
  ok('T52.D the clock-driven army cap is gone from aiTick',
    !/ai\.t\s*\/\s*300/.test(String(aiTick)) && /aiArmyCap/.test(String(aiTick)));
}

/* ============================ E: statelessness and determinism ============= */
{
  section('T52.E nothing new is stored, hashed or serialized');

  /* aiArmyCap and resSkew are pure reads. Calling them a hundred times between
     two hashes must not move the sim by one bit. */
  {
    fresh75(750030, 3);
    for (let i = 0; i < 300; i++) update(DT75);
    const h0 = hashState();
    for (const p of G.players) {
      if (!p.alive || p.fac === 'bug') continue;
      for (let i = 0; i < 100; i++) { aiArmyCap(p); resSkew(p); }
    }
    ok('T52.E reading the ceiling and the servo leaves hashState where it found it', hashState() === h0);
  }

  /* vetSteps is a read too, and the ladder arrays are shared, not per-unit */
  {
    fresh75(750031, 1);
    const a = put75('grunt', G.human, G.map.starts[0].x, G.map.starts[0].y);
    const b = put75('grunt', G.human, G.map.starts[0].x + 1, G.map.starts[0].y);
    ok('T52.E two units of a class share one ladder array rather than each carrying a copy',
      vetSteps(a) === vetSteps(b) && vetSteps(a) === VET_INF);
    const before = JSON.stringify(saveState()).length;
    vetRankUp(a);
    ok('T52.E promotion adds no new serialized field, only moves kl and vr',
      Math.abs(JSON.stringify(saveState()).length - before) < 40 && a.vr === 1 && a.kl === 1);
  }

  /* same seed, same trail; and a snapshot resumes on an identical one */
  {
    const trail = (seed) => {
      fresh75(seed, 3);
      const t = []; for (let i = 1; i <= 900; i++) { update(DT75); if (i % 90 === 0) t.push(hashState()); }
      return t;
    };
    const a = trail(750040), b = trail(750040);
    ok('T52.E same seed, same trail', a.length === 10 && a.every((v, i) => v === b[i]));

    fresh75(750041, 3);
    for (let i = 0; i < 400; i++) update(DT75);
    const snap = saveState();
    const cont = []; for (let i = 0; i < 300; i++) { update(DT75); cont.push(hashState()); }
    loadState(snap);
    const res = []; for (let i = 0; i < 300; i++) { update(DT75); res.push(hashState()); }
    ok('T52.E a snapshot resumes on an identical trail', cont.every((v, i) => v === res[i]));
  }

  /* a v74 save still loads: kl and vr keep their shape, so the only thing that
     changed for a loaded unit is which rung it is standing on */
  {
    fresh75(750042, 1);
    const u = put75('grunt', G.human, G.map.starts[0].x, G.map.starts[0].y);
    u.kl = 7; u.vr = 1;
    const s = saveState();
    loadState(s);
    const v = G.units.find(x => x.kl === 7);
    ok('T52.E an integer kill count and a rank 0-3 still round-trip unchanged',
      !!v && v.kl === 7 && v.vr === 1);
  }
}
