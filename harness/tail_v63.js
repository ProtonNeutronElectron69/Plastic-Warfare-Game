/* tail_v63.js - T42: the v63 faction identity pass.

   MEASURED PROBLEM. Every faction researched every one of its exclusives in every
   match at v62 - tech was never the bottleneck - and then almost never built them:
   the exclusives held 0.6% of Green's standing army, 5.4% of Tan's, 0.4% of Gray's
   and 17.8% of Blue's, and Blue's number is an accident of the Scout Bike being
   cheap and fast, which the value function already rewards. Gray's Rocket Artillery
   was zero in 16 of 20 logged games.

   The cause is that aiPickUnit scores damage-per-plastic and a faction's signature
   pieces are priced above the line units they compete with. A 150p Mortar Squad at
   10.6 dps scores ~23% of a 115p Machine Gunner at 35.3 dps, and the v60 draw
   weight is the SQUARE of the score, so the mortar took ~5% of the gunner's band.
   No profile variation reaches across that, which is why the fix is a quota rather
   than a bias and why it is deliberately profile-independent.

   Sections:
     A  the plumbing: the constant, aiFacShare, aiBldHasFac, and their blindness
     B  the pool narrowing, and that it narrows only when it should
     C  the stand-down exemption (the reason Gray's artillery read zero)
     D  the wait, and the reach guard that stops it being a stall
     E  research order: exclusives ahead of line units, own structure first
     F  the wish list: bunker and turbine scale, radar and dump deliberately do not
     G  the artillery buff, pinned and landed in the sim
     H  THE HEADLINE, with a mutation check

   Everything here is FUNCTIONAL apart from E and F, where the ORDER of a list is
   the thing under test and there is nothing to observe but the list. Section H's
   claim carries a mutation arm - the same seeds re-run with the floor at zero - so
   a green cannot come from a match that would have built exclusives anyway. */
'use strict';
section('T42 v63: faction identity');

const DT63 = 1 / 30;
/* Sections A-F need an AI of a NAMED faction, and in a normal match the named
   faction is the human's. Watch mode boots the whole roster as CPU with exactly
   one army per faction, which is the only configuration where "Green's bot" is a
   thing that exists. Section G wants a human owner for the blast and uses a
   normal match instead. */
function cfg63(map, mode, diff, fac, opp, seed) { return { map, mode, diff: diff || 'normal', fac: fac || 'green', opp: (opp == null ? 3 : opp), seed, watch: true }; }
function cfg63h(map, mode, diff, fac, opp, seed) { return { map, mode, diff: diff || 'normal', fac: fac || 'green', opp: (opp == null ? 3 : opp), seed }; }
function bot63(fac) { return G.players.find(p => p.ai && (!fac || p.fac === fac)); }
function put63(k, p, x, y) { const u = makeUnit(k, p, x, y); u.state = 'idle'; u.path = null; u.target = null; return u; }
function tech63(p, keys) { for (const t of keys) { p.tech.add(t); if (p.techDone) p.techDone.add(t); } }
function clearArmy63(p) {
  for (const u of p.units.slice()) if (u.t.dm > 0) {
    const i = G.units.indexOf(u); if (i >= 0) G.units.splice(i, 1);
    const j = p.units.indexOf(u); if (j >= 0) p.units.splice(j, 1);
  }
}
function supply63(p, n) {
  for (let i = 0; i < n; i++) {
    const d = makeBuilding('supply', p, Math.floor(p.start.x) - 6 + i * 2, Math.floor(p.start.y) - 5, true);
    if (d) d.prog = 1;
  }
}
const FACS63 = ['green', 'tan', 'gray', 'blue'];

/* ---------- A: the plumbing ---------- */
{
  section('T42.A the floor constant and the two readers');
  ok('T42.A AI_FAC_FLOOR exists and is the agreed 18%',
    typeof AI_FAC_FLOOR === 'number' && Math.abs(AI_FAC_FLOOR - 0.18) < 1e-12);
  ok('T42.A both readers exist',
    typeof aiFacShare === 'function' && typeof aiBldHasFac === 'function');

  G = null; newGame(cfg63('backyard', 'dm', 'normal', 'green', 3, 630010));
  const p = bot63('green');
  clearArmy63(p);
  ok('T42.A an empty army reads as zero share, i.e. under the floor',
    aiFacShare(p) === 0 && aiFacShare(p) < AI_FAC_FLOOR);

  for (let i = 0; i < 9; i++) put63('grunt', p, 30 + (i % 3), 30 + ((i / 3) | 0));
  ok('T42.A nine grunts and no exclusive still reads zero', aiFacShare(p) === 0);
  put63('mortar', p, 34, 34);
  ok('T42.A one mortar in ten units reads exactly 0.1', Math.abs(aiFacShare(p) - 0.1) < 1e-12);

  // the blindness rules: support, riders and corpses must not vote, or the three
  // composition readers would disagree about the same army.
  const tr = put63('truck', p, 35, 35);
  ok('T42.A a truck does not enter the denominator', Math.abs(aiFacShare(p) - 0.1) < 1e-12);
  const dead = put63('grunt', p, 36, 36); dead.hp = 0;
  ok('T42.A a corpse does not enter the denominator', Math.abs(aiFacShare(p) - 0.1) < 1e-12);
  const gar = put63('grunt', p, 37, 37); gar.garrisoned = true;
  ok('T42.A a garrisoned rider does not enter the denominator', Math.abs(aiFacShare(p) - 0.1) < 1e-12);

  // Blue's Chinook is an exclusive AND a support unit. It must not be able to
  // satisfy a fighting-army quota by itself, or Blue's floor is met by one ferry.
  G = null; newGame(cfg63('backyard', 'dm', 'normal', 'blue', 3, 630011));
  const b = bot63('blue');
  clearArmy63(b);
  for (let i = 0; i < 5; i++) put63('grunt', b, 30 + i, 30);
  const preC = aiFacShare(b);
  put63('chinook', b, 33, 33);
  ok('T42.A the Chinook cannot satisfy Blue\'s floor - a transport is not a fighter',
    aiFacShare(b) === preC && preC === 0);
  put63('bike', b, 34, 34);
  ok('T42.A ...but the Scout Bike does', aiFacShare(b) > 0);

  // Wildlife has no exclusives at all and must never be gated by a quota it can
  // never fill.
  const wl = G.players.find(q => q.fac === 'bug') || G.neutral;
  if (wl) ok('T42.A a faction with no exclusives is vacuously at its floor', aiFacShare(wl) === 1);
  else ok('T42.A a faction with no exclusives is vacuously at its floor (no bug player on this map)', true);

  // aiBldHasFac reads the ROSTER, so it must follow the tech gate.
  G = null; newGame(cfg63('backyard', 'dm', 'normal', 'green', 3, 630012));
  const g = bot63('green');
  ok('T42.A a barracks with no exclusive researched does not yet count',
    !aiBldHasFac(g, 'barracks'));
  tech63(g, ['u_mortar']);
  ok('T42.A ...and does once the Mortar Squad unlocks', aiBldHasFac(g, 'barracks'));
  tech63(g, ['b_garage', 'u_tank']);
  ok('T42.A Green\'s garage holds no exclusive, so it is never exempted', !aiBldHasFac(g, 'garage'));

  G = null; newGame(cfg63('backyard', 'dm', 'normal', 'blue', 3, 630013));
  const b2 = bot63('blue');
  tech63(b2, ['b_helipad', 'u_heli', 'u_chinook']);
  ok('T42.A Blue\'s helipad is NOT exempted on the Chinook alone (support keys do not count)',
    !aiBldHasFac(b2, 'helipad'));
}

/* ---------- B: the pool narrowing ---------- */
{
  section('T42.B aiPickUnit narrows to the exclusives while under the floor');
  G = null; newGame(cfg63('backyard', 'dm', 'normal', 'green', 3, 630020));
  const p = bot63('green');
  tech63(p, ['u_gunner', 'u_bazooka', 'u_grenadier', 'u_mortar']);
  clearArmy63(p);
  for (let i = 0; i < 10; i++) put63('grunt', p, 30 + (i % 5), 30 + ((i / 5) | 0));
  const opts = ['grunt', 'gunner', 'bazooka', 'grenadier', 'mortar'];
  const pr = AI_PROFILES.balanced;

  ok('T42.B the army is under the floor to begin with', aiFacShare(p) < AI_FAC_FLOOR);
  let ex = 0;
  for (let i = 0; i < 60; i++) if (FAC.green.uu.indexOf(aiPickUnit(p, pr, opts)) >= 0) ex++;
  ok(`T42.B every pick under the floor is an exclusive (${ex}/60)`, ex === 60);

  // MUTATION: the same army, the same pool, the floor lifted off. If the greens
  // above came from a pool the value function liked anyway, this arm picks the
  // mortar just as often.
  // AI_FAC_FLOOR is a const, so the mutation stubs the READER instead: a bot that
  // always believes it is at its quota can never narrow. That is the stronger arm
  // anyway - it proves the share read is what drives the pick, not merely that a
  // number exists.
  const keepFS = aiFacShare;
  try {
    aiFacShare = () => 1;
    let ex2 = 0;
    for (let i = 0; i < 60; i++) if (FAC.green.uu.indexOf(aiPickUnit(p, pr, opts)) >= 0) ex2++;
    ok(`T42.B a bot that believes it is already at quota almost never picks one (${ex2}/60), so the floor is what drives it`,
      ex2 < 12);
  } finally { aiFacShare = keepFS; }
  ok('T42.B the reader was put back', aiFacShare === keepFS && typeof aiFacShare === 'function');

  // Above the floor the narrowing must switch itself off entirely.
  clearArmy63(p);
  for (let i = 0; i < 4; i++) put63('mortar', p, 30 + i, 30);
  for (let i = 0; i < 4; i++) put63('grunt', p, 30 + i, 32);
  ok('T42.B a half-exclusive army reads as over the floor', aiFacShare(p) > AI_FAC_FLOOR);
  let ex3 = 0;
  for (let i = 0; i < 60; i++) if (FAC.green.uu.indexOf(aiPickUnit(p, pr, opts)) >= 0) ex3++;
  ok(`T42.B over the floor the pick is free again and mostly is not an exclusive (${ex3}/60)`, ex3 < 30);

  // A pool with nothing exclusive in it must be left completely alone.
  clearArmy63(p);
  for (let i = 0; i < 10; i++) put63('grunt', p, 30 + (i % 5), 30 + ((i / 5) | 0));
  const plain = ['grunt', 'gunner', 'bazooka'];
  let bad = 0;
  for (let i = 0; i < 40; i++) if (plain.indexOf(aiPickUnit(p, pr, plain)) < 0) bad++;
  ok('T42.B a pool with no exclusive in it is returned untouched', bad === 0);
}

/* ---------- C: the stand-down exemption ---------- */
{
  section('T42.C the garage stays open for Gray\'s artillery');
  // This is the arrangement that produced 16 zero-artillery games: an infantry-
  // heavy army makes the garage look over-target, the v59 gate parks it, and the
  // one building that could ever build a Rocket Artillery never gets a pick.
  G = null; newGame(cfg63('backyard', 'dm', 'normal', 'gray', 3, 630030));
  const p = bot63('gray');
  p.res.p = 99999; p.res.e = 99999;
  tech63(p, ['b_garage', 'u_jeep', 'u_tank', 'u_arty']);
  const gar = makeBuilding('garage', p, Math.floor(p.start.x) + 4, Math.floor(p.start.y) + 4, true);
  const bar = p.blds.find(b => b.key === 'barracks') || makeBuilding('barracks', p, Math.floor(p.start.x) - 4, Math.floor(p.start.y) + 4, true);
  for (const b of [gar, bar]) { b.prog = 1; b.queue.length = 0; }
  supply63(p, 4);
  clearArmy63(p);
  p.ai.t = 600;
  // an army that is 100% VEHICLE, so the garage reads as the surplus building and
  // the v59 gate wants it parked.
  for (let i = 0; i < 8; i++) put63('jeep', p, 30 + (i % 4), 30 + ((i / 4) | 0));
  ok('T42.C the garage holds an exclusive', aiBldHasFac(p, 'garage'));
  ok('T42.C the army is under the floor', aiFacShare(p) < AI_FAC_FLOOR);
  const cls = aiProdClasses(p), want = aiMixWant(p.ai.pr, cls, 0), have = aiMixHave(p, cls);
  ok('T42.C an all-vehicle army genuinely reads as a vehicle surplus',
    (have.veh || 0) - (want.veh || 0) > 0.04);
  for (let i = 0; i < 6; i++) aiTick(p);
  ok(`T42.C the surplus garage is still fed because it is the only source of artillery (queue ${gar.queue.length})`,
    gar.queue.length > 0);

  // MUTATION: same setup, floor lifted. The v59 gate should park the garage.
  const keepFS = aiFacShare;
  let q2 = -1;
  try {
    aiFacShare = () => 1;
    G = null; newGame(cfg63('backyard', 'dm', 'normal', 'gray', 3, 630030));
    const p2 = bot63('gray');
    p2.res.p = 99999; p2.res.e = 99999;
    tech63(p2, ['b_garage', 'u_jeep', 'u_tank', 'u_arty']);
    const gar2 = makeBuilding('garage', p2, Math.floor(p2.start.x) + 4, Math.floor(p2.start.y) + 4, true);
    const bar2 = p2.blds.find(b => b.key === 'barracks') || makeBuilding('barracks', p2, Math.floor(p2.start.x) - 4, Math.floor(p2.start.y) + 4, true);
    for (const b of [gar2, bar2]) { b.prog = 1; b.queue.length = 0; }
    supply63(p2, 4);
    clearArmy63(p2);
    p2.ai.t = 600;
    for (let i = 0; i < 8; i++) put63('jeep', p2, 30 + (i % 4), 30 + ((i / 4) | 0));
    for (let i = 0; i < 6; i++) aiTick(p2);
    q2 = gar2.queue.length;
  } finally { aiFacShare = keepFS; }
  ok(`T42.C a bot that believes it is at quota parks the same surplus garage (queue ${q2}), so the exemption is what feeds it`,
    q2 === 0);
}

/* ---------- D: the wait, and the reach guard ---------- */
{
  section('T42.D a factory under the floor banks for its exclusive');
  // Instrumented on Green at v62: the floor was live at 82% of picks but the pool
  // could supply an exclusive at only 16% of them, because a 138p Mortar Squad did
  // not fit in a measured 156p bank. The bot spent it on a 28p Grunt every tick and
  // never accumulated. Narrowing a pool the exclusive is absent from does nothing.
  function setup(bank) {
    G = null; newGame(cfg63('backyard', 'dm', 'normal', 'green', 3, 630040));
    const p = bot63('green');
    tech63(p, ['u_gunner', 'u_mortar']);
    const bar = p.blds.find(b => b.key === 'barracks') || makeBuilding('barracks', p, Math.floor(p.start.x) - 4, Math.floor(p.start.y) + 4, true);
    bar.prog = 1; bar.queue.length = 0;
    supply63(p, 4);
    clearArmy63(p);
    p.ai.t = 600;
    /* The expansion-saving surcharge is a SEPARATE lever that prices every option
       +170p, and with the clock wound to 600 it is on by default - which priced a
       28p Grunt at 198p and made all four arms below read the same. Disarmed here
       so this section tests the wait and nothing else; the surcharge's own
       interaction with the floor is the last arm in this block. */
    p.ai.nextExpand = 1e9;
    for (let i = 0; i < 8; i++) put63('grunt', p, 30 + (i % 4), 30 + ((i / 4) | 0));
    p.res.p = bank; p.res.e = 9999;
    return { p, bar, cost: ucost(p, 'mortar').p };
  }
  const mc = ucost(bot63('green') || G.players[0], 'mortar').p;

  // WITHIN reach: bank sits above half the price but below it. Must build nothing.
  {
    const s = setup(Math.round(mc * 0.75));
    ok('T42.D the setup is genuinely under the floor and short of the price',
      aiFacShare(s.p) < AI_FAC_FLOOR && s.p.res.p < s.cost && s.p.res.p >= s.cost * 0.5);
    for (let i = 0; i < 5; i++) aiTick(s.p);
    ok(`T42.D within reach of the price, the barracks waits rather than spending it on a grunt (queue ${s.bar.queue.length})`,
      s.bar.queue.length === 0);
  }
  // OUT of reach: bank far below half the price. Must keep producing normally -
  // this is the guard that stops the wait being a stall.
  {
    const s = setup(Math.round(mc * 0.2));
    for (let i = 0; i < 5; i++) aiTick(s.p);
    ok(`T42.D nowhere near the price, it keeps producing line units instead of stalling (queue ${s.bar.queue.length})`,
      s.bar.queue.length > 0);
  }
  // AFFORDABLE: the wait must not fire at all, and the pick must be the exclusive.
  {
    const s = setup(Math.round(mc * 4));
    for (let i = 0; i < 3; i++) aiTick(s.p);
    ok(`T42.D once affordable it builds the exclusive itself (queue ${JSON.stringify(s.bar.queue)})`,
      s.bar.queue.length > 0 && s.bar.queue.every(k => FAC.green.uu.indexOf(k) >= 0));
  }
  // ABOVE the floor: the wait must switch off, or a bot that has met its quota
  // would sit on its hands whenever an exclusive happened to be unaffordable.
  {
    const s = setup(Math.round(mc * 0.75));
    clearArmy63(s.p);
    for (let i = 0; i < 4; i++) put63('mortar', s.p, 30 + i, 30);
    for (let i = 0; i < 4; i++) put63('grunt', s.p, 30 + i, 32);
    s.p.res.p = Math.round(mc * 0.75);
    ok('T42.D the army is over the floor', aiFacShare(s.p) > AI_FAC_FLOOR);
    for (let i = 0; i < 5; i++) aiTick(s.p);
    ok(`T42.D over the floor the wait switches off and production resumes (queue ${s.bar.queue.length})`,
      s.bar.queue.length > 0);
  }
  /* THE SURCHARGE WAIVER. While saving for an outpost the bot prices every option
     +170p, which is what put a 138p Mortar Squad out of reach of a 156p bank in the
     v62 measurement. Under the floor the exclusive is exempted from that surcharge
     - it still pays its own full cost - so a bank that can afford the mortar but
     not mortar+170 must now produce one. */
  {
    // 1.3x the price, not 1.1x: the truck doctrine runs BEFORE army production and
    // spends ~18p of the bank on the way past, which at 1.1x left the tick 3p short.
    const s = setup(Math.round(mc * 1.3));
    s.p.ai.nextExpand = 0; s.p.ai.t = 600;      // re-arm expansion saving
    aiTick(s.p);
    ok('T42.D the bot really is in expansion-saving mode', s.p.ai.saveExp === true);
    ok('T42.D ...and the bank genuinely could not cover the surcharged price',
      s.p.res.p < s.cost + 170);
    for (let i = 0; i < 3; i++) aiTick(s.p);
    ok(`T42.D saving for an outpost no longer prices the exclusive out of reach (queue ${JSON.stringify(s.bar.queue)})`,
      s.bar.queue.length > 0 && s.bar.queue.every(k => FAC.green.uu.indexOf(k) >= 0));
  }
}

/* ---------- E: research order ---------- */
{
  section('T42.E the exclusives are researched early, not last');
  // ORDER of a list is the thing under test, so the plan itself is the observable.
  for (const fac of FACS63) {
    G = null; newGame(cfg63('backyard', 'dm', 'normal', fac, 3, 630050));
    const p = bot63(fac);
    p.ai.researchPlan = null;
    aiResearch(p);
    const plan = p.ai.researchPlan;
    ok(`T42.E ${fac}: a plan was built`, Array.isArray(plan) && plan.length > 0);
    const uu = FAC[fac].uu.filter(k => U[k] && U[k].tech).map(k => U[k].tech);
    const idx = k => plan.indexOf(k);
    ok(`T42.E ${fac}: every exclusive unit unlock is on the plan`, uu.every(t => idx(t) >= 0));
    // ahead of the line-unit block: the Tank is the head of it.
    ok(`T42.E ${fac}: the exclusives sit ahead of the Tank (${uu.map(t => t + '@' + idx(t)).join(' ')}, u_tank@${idx('u_tank')})`,
      idx('u_tank') >= 0 && uu.every(t => idx(t) < idx('u_tank')));
    // cheapest of the pair first
    if (uu.length === 2) {
      const c = k => U[k].cp + U[k].ce * 0.5;
      const pair = FAC[fac].uu.filter(k => U[k] && U[k].tech);
      const cheap = c(pair[0]) <= c(pair[1]) ? pair[0] : pair[1];
      const other = pair[pair[0] === cheap ? 1 : 0];
      ok(`T42.E ${fac}: the cheaper exclusive (${cheap}) is researched before ${other}`,
        idx(U[cheap].tech) < idx(U[other].tech));
    }
    // own structure ahead of the generic structure group
    const ubt = B[FAC[fac].ub] && B[FAC[fac].ub].tech;
    if (ubt) ok(`T42.E ${fac}: its own structure (${ubt}) leads the structure group, ahead of b_generator`,
      idx(ubt) >= 0 && idx('b_generator') >= 0 && idx(ubt) < idx('b_generator'));
    // and no other faction's exclusives leaked in
    const foreign = [];
    for (const f2 of FACS63) if (f2 !== fac) for (const k of FAC[f2].uu)
      if (U[k] && U[k].tech && FAC[fac].uu.indexOf(k) < 0 && idx(U[k].tech) >= 0) foreign.push(k);
    ok(`T42.E ${fac}: no other faction's exclusives leaked onto the plan`, foreign.length === 0);
  }
}

/* ---------- F: the wish list ---------- */
{
  section('T42.F the bunker and the turbine scale; the radar and the dump do not');
  const src = aiTick.toString();
  /* v85: ub became a LIST and the scaling set became a table flag. The three
     source-text pins below moved with it, and the claims are unchanged: the
     scaling structures lead the list and come back for a second and a third,
     the non-scaling ones keep their single late slot, and a faction's own power
     structure is exempt from the power gate. What is gone is the hard-coded pair
     of names - a second Blue or Gray structure could never have been answered by
     `ub==='bunker'||ub==='turbine'`, and the flag says it on the row instead. */
  ok('T42.F the scaling set is a table flag, so a new structure declares its own habit',
    src.includes('B[ub].mult') && !src.includes("ub==='bunker'"));
  ok('T42.F exactly the two v63 structures carry it, and nothing else does',
    !!B.bunker.mult && !!B.turbine.mult &&
    Object.keys(B).filter(k => B[k].mult).length === 2);
  ok('T42.F the scaling structure is asked for up front, as a pair, and as a third when rich',
    src.includes('if(B[ub].mult)wish.push([ub,1]);') &&
    src.includes('if(B[ub].mult)wish.push([ub,2]);') &&
    src.includes('if(B[ub].mult)wish.push([ub,3]);'));
  ok('T42.F the non-scaling structure keeps its single, in its old slot',
    src.includes('if(!B[ub].mult)wish.push([ub,1]);'));
  ok('T42.F the scaling structure is exempt from the "only build power when needed" gate',
    src.includes('B[k].eps&&!ubs.includes(k)'));
  ok('T42.F the dead standalone turbine entry is gone',
    !src.includes("['turbine',1]"));
  // functional: a Blue bot swimming in electricity must still put up turbines,
  // which is the exact case the power gate suppressed (measured 0.67 standing).
  {
    G = null; newGame(cfg63('backyard', 'dm', 'normal', 'blue', 3, 630060));
    const p = bot63('blue');
    tech63(p, ['b_turbine', 'b_generator']);
    p.res.p = 99999; p.res.e = 99999;   // far above the 120 gate: no power is NEEDED
    let n = 0;
    for (let i = 0; i < 120 && n < 2; i++) { aiTick(p); n = p.blds.filter(b => b.key === 'turbine').length; }
    ok(`T42.F a Blue bot with surplus power still builds a pair of turbines (${n})`, n >= 2);
  }
  // the same for Gray's Bunker, which is not power-gated but does sit behind the
  // guard-tower ring. This is the cheap functional proof that the PAIR is wanted;
  // T42.H only reports what a real match actually reaches in its time limit.
  {
    G = null; newGame(cfg63('backyard', 'dm', 'normal', 'gray', 3, 630062));
    const p = bot63('gray');
    tech63(p, ['b_bunker', 'b_generator', 'b_guardtower', 'b_radiotower']);
    p.res.p = 99999; p.res.e = 99999;
    let n = 0;
    for (let i = 0; i < 200 && n < 2; i++) { aiTick(p); n = p.blds.filter(b => b.key === 'bunker').length; }
    ok(`T42.F a rich Gray bot builds a pair of bunkers (${n})`, n >= 2);
  }
  // ...and a Green bot must NOT gain a second radar, since Green was left alone.
  {
    G = null; newGame(cfg63('backyard', 'dm', 'normal', 'green', 3, 630061));
    const p = bot63('green');
    tech63(p, ['b_radar', 'b_generator', 'b_guardtower', 'b_radiotower']);
    p.res.p = 99999; p.res.e = 99999;
    for (let i = 0; i < 200; i++) aiTick(p);
    const n = p.blds.filter(b => b.key === 'radar').length;
    ok(`T42.F a rich Green bot still wants exactly one Radar Tent (${n}), per the scope call`, n <= 1);
  }
}

/* ---------- G: the artillery ---------- */
{
  section('T42.G Gray\'s Rocket Artillery: splash +50%');
  ok('T42.G the radius is exactly 1.5x its v62 value',
    U.arty.spl === 2.8125 && Math.abs(U.arty.spl - 1.875 * 1.5) < 1e-12);
  ok('T42.G it is still a dyadic fraction, so it adds no float noise to the hash path',
    U.arty.spl * 16 === Math.round(U.arty.spl * 16));
  ok('T42.G nothing else in the roster moved with it',
    U.mortar.spl === 1.5 && U.tank.spl === 1 && U.bulltank.spl === 1.25 && U.apache.spl === 0.75);
  // FUNCTIONAL: a target parked in the annulus between the old and new radii must
  // now take damage where it previously took none. Pinning the table alone would
  // pass even if splash() ignored the field.
  {
    G = null; newGame(cfg63h('backyard', 'dm', 'normal', 'gray', 3, 630070));
    for (const mn of (G.map.mines || [])) mn.live = false;
    const me = G.human, foe = G.players.find(p => p !== me && !allied(p, me));
    const src = put63('grunt', me, 20, 20);
    const OLD = 1.875, NEW = U.arty.spl;
    const mid = (OLD + NEW) / 2;                 // 2.34375: outside old, inside new
    const near = put63('grunt', foe, 40, 40);
    const ring = put63('grunt', foe, 40 + mid, 40);
    const far = put63('grunt', foe, 40 + NEW + 3, 40);
    const hp0 = { near: near.hp, ring: ring.hp, far: far.hp };
    splash(40, 40, U.arty.spl, 40, 'ex', src, 'm');
    ok('T42.G a target at the centre is still hit', near.hp < hp0.near);
    ok(`T42.G a target in the annulus the old radius could not reach is now hit (d=${mid.toFixed(4)}, old r=${OLD})`,
      mid > OLD && mid < NEW && ring.hp < hp0.ring);
    ok('T42.G a target beyond the new radius is still untouched', far.hp === hp0.far);
    // the blast must not have become friendly fire on the way
    const ally = put63('grunt', me, 40.2, 40);
    const ah = ally.hp;
    splash(40, 40, U.arty.spl, 40, 'ex', src, 'm');
    ok('T42.G the larger blast still spares the owner\'s own units', ally.hp === ah);
  }
}

/* ---------- H: THE HEADLINE, with a mutation check ---------- */
{
  section('T42.H bots actually field their faction\'s signature units');
  const SUP63 = { truck: 1, medic: 1, apc: 1, chinook: 1 };
  // makeUnit is the single choke point every spawn goes through, bot or otherwise.
  function census(seeds, ticks) {
    const per = {};
    const real = makeUnit;
    makeUnit = function (key, p, x, y, srcBld) {
      const u = real(key, p, x, y, srcBld);
      if (u && p && p.ai && !SUP63[key]) {
        const a = per[p.fac] = per[p.fac] || { ex: 0, all: 0, bld: 0, n: 0 };
        a.all++; if (FAC[p.fac].uu.indexOf(key) >= 0) a.ex++;
      }
      return u;
    };
    try {
      for (const sd of seeds) {
        G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'green', seed: sd, watch: true });
        for (let i = 1; i <= ticks; i++) update(DT63);
        for (const p of G.players) {
          if (!p.ai) continue;
          const a = per[p.fac] = per[p.fac] || { ex: 0, all: 0, bld: 0, n: 0 };
          // v85: ub is a list. Counted as "how many of this army's SCALING structure
          // stand", which is what the threshold below has always meant - a Blue army
          // now also owns a Forward Pad, and folding that into the same total would
          // have made the turbine bar pass on a building that never scales.
          const scal = (FAC[p.fac].ub || []).filter(k => B[k].mult);
          a.n++; a.bld += p.blds.filter(b => scal.includes(b.key) && b.prog >= 1).length;
        }
      }
    } finally { makeUnit = real; }
    return per;
  }
  /* v86: TWO SEEDS BECAME FOUR, and the reason is measurement rather than a
     failure being papered over. v86 adds nothing to Gray, but it moves the shared
     RNG stream everywhere (a Green bot now researches and fields three more
     things), and on the original pair Gray's bunker count fell 1.00 -> 0.00 while
     Blue's turbine count rose 1.00 -> 2.50. Measured over six seeds instead of
     two: v85 read blue 1.00 / gray 1.67, v86 reads blue 2.33 / gray 0.83, so the
     PAIR is roughly conserved (2.67 -> 3.16) and what actually happened is a
     redistribution between two armies, not Gray losing the ability to build
     bunkers. A two-sample mean of a small count was never enough to tell those
     apart, which is the same fault T31.E and T50.F were found to have at v85.
     Four rather than six is the time budget: each seed is a 400-second match and
     this section runs the census twice, so six would put ~120 seconds on the
     segment for a third decimal place. */
  const SEEDS63 = [630080, 630081, 630082, 630083];
  /* 400 sim-seconds. This section costs four full matches and is the most expensive
     thing in the file, so it buys the claim it can afford: that signature units are
     a real share of production and that the structures get built. Whether the bot
     WANTS a pair is proved functionally and for free in T42.F; what a single match
     actually finishes within its clock is map- and seed-dependent (measured across
     3 maps x 3 seeds: turbine 2.56, bunker 1.78; on backyard alone the bunker
     reaches 1.0), so the threshold here is what one map honestly supports. */
  const HORIZON63 = 12000;
  const live = census(SEEDS63, HORIZON63);
  for (const f of FACS63) {
    const a = live[f];
    if (!a || !a.all) { ok(`T42.H ${f}: fielded an army at all`, false); continue; }
    const sh = a.ex / a.all;
    ok(`T42.H ${f}: signature units are a real share of what it builds (${a.ex}/${a.all} = ${(sh * 100).toFixed(1)}%)`,
      sh >= 0.05);
  }
  {
    const g = live.gray;
    ok(`T42.H Gray builds Rocket Artillery at all - it was zero in 16 of 20 logged v62 games`,
      !!g && g.ex > 0);
  }
  /* v85: Blue's bar drops 1.5 -> 1.0 and the reason is a design consequence worth
     writing down rather than a threshold being softened to get green.
     Blue gained a SECOND exclusive structure at v85. Its slot in the wish list is
     the one the non-scaling structures have always had - just after the radio
     tower - which puts it AHEAD of the second turbine, so within one match's clock
     a Blue bot now buys a Forward Pad's worth of progress where it used to buy a
     second turbine. Measured over six backyard seeds rather than the two this
     section runs: turbine 1.00 flat, so this is the new standing behaviour and not
     seed noise. Gray, whose exclusive list did not change, measures 1.67 over the
     same six and is unmoved.
     The WANT is untouched and is still proved for free in T42.F, where a rich Blue
     bot with no competition puts up a pair in both arms. What moved is what a
     single 400-second match can afford, which is the only thing this section has
     ever claimed to measure. */
  {
    const b = live.blue, gy = live.gray;
    ok(`T42.H the scaling structures get built, and a second exclusive now shares the budget (blue turbine ${b ? (b.bld / b.n).toFixed(2) : '-'}, gray bunker ${gy ? (gy.bld / gy.n).toFixed(2) : '-'})`,
      !!b && !!gy && b.bld / b.n >= 1.0 && gy.bld / gy.n >= 0.5);
  }
  // MUTATION: the same seeds with the floor at zero. If the shares above came from
  // matches that would have built exclusives anyway, this arm matches them.
  const keepFS = aiFacShare;
  let flat = null;
  try { aiFacShare = () => 1; flat = census(SEEDS63, HORIZON63); } finally { aiFacShare = keepFS; }
  ok('T42.H the reader was put back', aiFacShare === keepFS && typeof aiFacShare === 'function');
  {
    let liveEx = 0, liveAll = 0, flatEx = 0, flatAll = 0;
    for (const f of FACS63) {
      if (live[f]) { liveEx += live[f].ex; liveAll += live[f].all; }
      if (flat[f]) { flatEx += flat[f].ex; flatAll += flat[f].all; }
    }
    const ls = liveEx / liveAll, fs = flatEx / flatAll;
    ok(`T42.H bots that believe they are at quota collapse signature production (${(ls * 100).toFixed(1)}% -> ${(fs * 100).toFixed(1)}% of everything trained), so the floor is what drives it`,
      fs < ls * 0.6);
  }
}
