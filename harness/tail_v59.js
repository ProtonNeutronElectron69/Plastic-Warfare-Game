/* tail_v59.js - T39: the v59 AI army composition pass.

   v58 bots fielded 89% infantry / 11% vehicles / 0.4% air / 0.0% AA averaged over
   a match. Four independent causes, one per lettered section below:

     A  b_helipad was pushed onto the research plan only when FAC_AIR[fac] was
        non-empty, i.e. Blue alone, so 13 of 18 bots could never build a helipad.
     E  the aaOnly exclusion was a deadlock: nobody flew, so nobody bought AA.
     F  the pick scored damage-per-plastic with no durability term.
     H  production ran in p.blds order, so the barracks always had first claim.

   Everything here is FUNCTIONAL. Source-text assertions on the pick live in
   tail_v48 and tail_v51 and are deliberately not duplicated: comments in this file
   name the functions under test, which would satisfy a naive .includes() check
   whether or not the code did anything.

   The headline claim in section I carries a mutation check - the same seed is run
   twice, once with the air targets zeroed - so a green I cannot come from a match
   that would have flown anyway. */
'use strict';
section('T39 v59: AI army composition');

const DT59 = 1 / 30;
function cfg59(map, mode, diff, fac, opp, seed) { return { map, mode, diff: diff || 'normal', fac: fac || 'green', opp: (opp == null ? 3 : opp), seed }; }
function bot59() { return G.players.find(p => p.ai); }
function put59(k, p, x, y) { const u = makeUnit(k, p, x, y); u.state = 'idle'; u.path = null; u.target = null; return u; }
function foe59(p) { return G.players.find(q => q !== p && q.alive && !allied(q, p)); }
const PROF59 = ['aggressive', 'balanced', 'defensive', 'harasser', 'turtle'];

/* ---------- A: the plumbing and the unlock gate ---------- */
{
  section('T39.A plumbing: helpers, profile fields, the helipad unlock');
  ok('T39.A every new helper exists',
    typeof aiUnitClass === 'function' && typeof aiFoeWeaponMix === 'function' &&
    typeof aiFoeAirCap === 'function' && typeof aiProdClasses === 'function' &&
    typeof aiMixWant === 'function' && typeof aiMixHave === 'function');
  ok('T39.A every profile carries a target mix and an AA pair',
    PROF59.every(k => {
      const p = AI_PROFILES[k];
      return p.mixWant && typeof p.mixWant.inf === 'number' && typeof p.mixWant.veh === 'number' &&
        typeof p.mixWant.air === 'number' && Array.isArray(p.aa) && p.aa.length === 2;
    }));
  ok('T39.A the base target mixes each sum to one',
    PROF59.every(k => { const m = AI_PROFILES[k].mixWant; return Math.abs(m.inf + m.veh + m.air - 1) < 1e-9; }));
  // The v58 complaint was that profiles read the same on screen. Two of them shared
  // armyTilt 'heavy', so defensive and turtle bought the same army.
  ok('T39.A profiles still spread across shopping preferences',
    new Set(PROF59.map(k => String(AI_PROFILES[k].armyTilt))).size >= 4 &&
    PROF59.every(k => typeof AI_PROFILES[k].armyTilt === 'string' && AI_PROFILES[k].armyTilt));
  ok('T39.A infantry targets span a visible range, not a huddle',
    (function () {
      const v = PROF59.map(k => AI_PROFILES[k].mixWant.inf);
      return Math.max(...v) - Math.min(...v) >= 0.25;
    })());
  // The headline v58 bug: the pad unlock was gated on a faction-exclusive chopper.
  const missing = [];
  for (const fac of ['green', 'tan', 'gray', 'blue']) {
    G = null; newGame(cfg59('backyard', 'dm', 'normal', fac, 3, 590001));
    const p = bot59(); p.ai.researchPlan = null; aiResearch(p);
    if (!(p.ai.researchPlan || []).includes('b_helipad')) missing.push(fac);
  }
  ok('T39.A every faction can research the helipad, not just Blue (' + (missing.join(',') || 'none missing') + ')',
    missing.length === 0);
  ok('T39.A ...and each production building is unlocked ahead of a unit for it',
    (function () {
      G = null; newGame(cfg59('backyard', 'dm', 'normal', 'gray', 3, 590002));
      const p = bot59(); p.ai.researchPlan = null; aiResearch(p);
      const pl = p.ai.researchPlan;
      return pl.indexOf('b_garage') < pl.indexOf('u_jeep') && pl.indexOf('b_helipad') < pl.indexOf('u_heli') &&
        pl.indexOf('u_jeep') < pl.indexOf('u_tank');
    })());
}

/* ---------- B: the per-match composition roll ---------- */
{
  section('T39.B the +-10% per-match roll');
  G = null; newGame(cfg59('backyard', 'dm', 'normal', 'green', 3, 590010));
  const a = makeAIBrain('balanced'), b = makeAIBrain('balanced');
  ok('T39.B the roll is private, never a handle on the shared literal',
    a.pr.mixWant !== AI_PROFILES.balanced.mixWant && b.pr.mixWant !== a.pr.mixWant);
  // v89: retuned 0.50/0.33 -> 0.42/0.32 by the air pass. This pin is transcribed
  // on purpose - it is what proves makeAIBrain's +-10% roll copies the literal
  // instead of mutating it - so a deliberate retune has to come and edit it here.
  ok('T39.B the shared literal is left exactly as authored',
    Math.abs(AI_PROFILES.balanced.mixWant.inf - 0.42) < 1e-9 &&
    Math.abs(AI_PROFILES.balanced.mixWant.veh - 0.32) < 1e-9);
  ok('T39.B two bots on one profile do not roll the same list',
    ['inf', 'veh', 'air'].some(k => Math.abs(a.pr.mixWant[k] - b.pr.mixWant[k]) > 1e-9));
  ok('T39.B a rolled mix still sums to one',
    [a, b].every(x => Math.abs(x.pr.mixWant.inf + x.pr.mixWant.veh + x.pr.mixWant.air - 1) < 1e-9));
  // +-10% per class then renormalized, so no class can land outside the widest band
  // renormalization can produce: 0.9/1.1 against 1.1/0.9 on the rest.
  let inBand = true;
  for (let i = 0; i < 200; i++) {
    const br = makeAIBrain(PROF59[i % 5]), base = AI_PROFILES[PROF59[i % 5]].mixWant;
    for (const k of ['inf', 'veh', 'air']) {
      const r = base[k] > 0 ? br.pr.mixWant[k] / base[k] : 1;
      if (r < 0.9 / 1.1 - 1e-9 || r > 1.1 / 0.9 + 1e-9) inBand = false;
    }
  }
  ok('T39.B 200 rolls all land inside the band renormalization allows', inBand);
  /* The roll is per-match state, so a resync or a reload must not re-roll it. It
     rides on ai.pr, which _encAi already copies wholesale, so no encoder changed -
     but mixWant is the first NESTED object to live there, so prove the round-trip. */
  ok('T39.B the roll survives a save/load round-trip unchanged',
    (function () {
      G = null; newGame(cfg59('backyard', 'dm', 'normal', 'green', 3, 591000));
      const pre = G.players.filter(x => x.ai).map(x => ({ i: x.i, mw: { ...x.ai.pr.mixWant }, aa: x.ai.pr.aa.slice(), tilt: x.ai.pr.armyTilt }));
      for (let i = 0; i < 600; i++) update(DT59);
      loadState(saveState());
      const post = G.players.filter(x => x.ai).map(x => ({ i: x.i, mw: { ...x.ai.pr.mixWant }, aa: x.ai.pr.aa.slice(), tilt: x.ai.pr.armyTilt }));
      if (!pre.length || pre.length !== post.length) return false;
      return pre.every((a, k) => {
        const b = post[k];
        return a.i === b.i && a.tilt === b.tilt && a.aa.join() === b.aa.join() &&
          ['inf', 'veh', 'air'].every(c => Math.abs(a.mw[c] - b.mw[c]) < 1e-12);
      });
    })());
  ok('T39.B the roll is a pure function of the rng state',
    (function () {
      const s0 = G.rngS; const x = makeAIBrain('turtle'); G.rngS = s0; const y = makeAIBrain('turtle');
      return Math.abs(x.pr.mixWant.air - y.pr.mixWant.air) < 1e-12;
    })());
}

/* ---------- C: classification ---------- */
{
  section('T39.C composition classes');
  ok('T39.C infantry, vehicles, air and AA are each their own class',
    aiUnitClass('grunt') === 'inf' && aiUnitClass('gunner') === 'inf' &&
    aiUnitClass('jeep') === 'veh' && aiUnitClass('tank') === 'veh' && aiUnitClass('bike') === 'veh' &&
    aiUnitClass('heli') === 'air' && aiUnitClass('apache') === 'air' &&
    aiUnitClass('aatruck') === 'aa');
  ok('T39.C a chopper is air whatever its own field says',
    Object.keys(U).filter(k => U[k].fly).every(k => aiUnitClass(k) === 'air'));
  ok('T39.C the AA truck is not counted as an ordinary vehicle',
    aiUnitClass('aatruck') !== 'veh');
}

/* ---------- D: the incoming half of the intel picture ---------- */
{
  section('T39.D aiFoeWeaponMix');
  G = null; newGame(cfg59('backyard', 'dm', 'normal', 'green', 3, 590020));
  const p = bot59(), q = foe59(p);
  p.ai.grudge = null;
  const blind = aiFoeWeaponMix(p);
  ok('T39.D no grudge means no intel: it assumes rifles',
    blind.length === 1 && blind[0].w === 'b' && Math.abs(blind[0].share - 1) < 1e-9);
  p.ai.grudge = q;
  q.units.length = 0;
  for (let i = 0; i < 3; i++) put59('grunt', q, 40 + i, 40);
  const tr = put59('truck', q, 44, 40);
  const rider = put59('grunt', q, 45, 40); rider.garrisoned = true;
  const dead = put59('grunt', q, 46, 40); dead.hp = 0;
  const mix = aiFoeWeaponMix(p);
  ok('T39.D the shares sum to one',
    Math.abs(mix.reduce((s, e) => s + e.share, 0) - 1) < 1e-9);
  ok('T39.D trucks, riders and corpses do not vote',
    mix.length === 1 && mix[0].key === 'grunt');
  // DPS-weighted, not head-count-weighted: one Bazooka out-votes one Grunt.
  q.units.length = 0;
  put59('grunt', q, 40, 40); put59('bazooka', q, 41, 40);
  const m2 = aiFoeWeaponMix(p);
  const rk = m2.find(e => e.w === 'r'), bk = m2.find(e => e.w === 'b');
  ok('T39.D it is weighted by damage output, not by head count',
    !!rk && !!bk && rk.share > bk.share);
  // Keyed by unit so the UVA overrides survive: the Huey's row is 'b' but it hits
  // infantry for 1.30, and that must not be flattened into the generic small-arms row.
  q.units.length = 0;
  put59('heli', q, 40, 40);
  const m3 = aiFoeWeaponMix(p);
  ok('T39.D per-unit overrides are preserved, not flattened into the row',
    m3.length === 1 && m3[0].key === 'heli' &&
    dmgMulFor(m3[0].key, m3[0].w, 'inf') > dmgMulFor(null, 'b', 'inf'));
}

/* ---------- E: air capability, and the AA deadlock ---------- */
{
  section('T39.E aiFoeAirCap and the anti-air floor');
  G = null; newGame(cfg59('backyard', 'dm', 'normal', 'green', 3, 590030));
  const p = bot59(), q = foe59(p);
  for (const r of G.players) { r.units.length = 0; }
  ok('T39.E an all-ground board reads as no air threat', aiFoeAirCap(p) === false);
  const pad = makeBuilding('helipad', q, Math.floor(q.start.x) + 3, Math.floor(q.start.y) + 3, true);
  ok('T39.E a rival helipad IS the air threat, before any chopper exists', aiFoeAirCap(p) === true);
  // capability arrives with the pad, so the answer can be in the queue before the
  // first gunship is overhead rather than eleven seconds behind it
  const j = q.blds.indexOf(pad); if (j >= 0) q.blds.splice(j, 1);
  ok('T39.E ...and with a flyer on the board too',
    (function () { put59('heli', q, 40, 40); return aiFoeAirCap(p) === true; })());
  q.units.length = 0;
  ok('T39.E an ally with a pad is not a threat',
    (function () {
      const keep = q.team; q.team = p.team;
      makeBuilding('helipad', q, Math.floor(q.start.x) + 6, Math.floor(q.start.y) + 6, true);
      const r = aiFoeAirCap(p); q.team = keep; return r === false;
    })());
}

/* ---------- F: the pick values survival, not only output ---------- */
{
  section('T39.F the survivability term');
  G = null; newGame(cfg59('backyard', 'dm', 'normal', 'green', 3, 590040));
  const p = bot59(), q = foe59(p);
  p.ai.grudge = q; p.res.p = 99999; p.res.e = 99999;
  /* Level cost, output, speed, weapon row AND hull between the Tank and the Jeep, so
     the single remaining difference is the ARMOR CLASS - heavy against medium. That
     makes the test decisive rather than saturated: small arms do 0.60 to heavy and
     0.85 to medium, so heavy is the better buy against a rifle line; rockets do 1.76
     to heavy and 1.35 to medium, so the same hull is the WORSE buy against bazookas.
     The winner flips. Every value is restored below and the restore is asserted. */
  const K = {};
  for (const f of ['cp', 'ce', 'dm', 'rt', 'sp', 'w', 'hp', 'a']) K[f] = U.tank[f];
  for (const f of ['cp', 'ce', 'dm', 'rt', 'sp', 'w', 'hp']) U.tank[f] = U.jeep[f];
  function tankEdge(foeKey) {
    q.units.length = 0;
    for (let i = 0; i < 8; i++) put59(foeKey, q, 40 + i * 0.3, 40);
    let tank = 0;
    for (let i = 0; i < 1200; i++) if (aiPickUnit(p, AI_PROFILES.balanced, ['jeep', 'tank']) === 'tank') tank++;
    return tank;
  }
  const vsRifles = tankEdge('grunt'), vsRockets = tankEdge('bazooka');
  ok(`T39.F heavy armor is the preferred buy against a rifle line (${vsRifles} of 1200)`,
    vsRifles > 624);
  ok(`T39.F ...and the SAME hull is deprecated against rockets, so the pick flips (${vsRockets} of 1200)`,
    vsRockets < 576 && vsRifles - vsRockets > 80);
  /* Non-vacuity: level the armor class too and the pick must stop caring which
     weapon the foe carries. If F above were reading anything other than the
     survivability term, this arm would keep the split. */
  U.tank.a = U.jeep.a;
  const flatR = tankEdge('grunt'), flatK = tankEdge('bazooka');
  for (const f of ['cp', 'ce', 'dm', 'rt', 'sp', 'w', 'hp', 'a']) U.tank[f] = K[f];
  ok(`T39.F with the armor class levelled the foe's weapon stops mattering (${flatR} vs ${flatK})`,
    Math.abs(flatR - flatK) < 120);
  ok('T39.F every table value was put back',
    ['cp', 'ce', 'dm', 'rt', 'sp', 'w', 'hp', 'a'].every(f => U.tank[f] === K[f]) &&
    U.tank.a === 'tank' && U.tank.cp === 220);
}

/* ---------- G: targets renormalize over what can actually be built ---------- */
{
  section('T39.G targets are renormalized over buildable classes');
  G = null; newGame(cfg59('backyard', 'dm', 'normal', 'green', 3, 590050));
  const p = bot59();
  // A bot at boot owns an HQ and nothing else, and the HQ is excluded as a producer,
  // so the barracks has to exist before there is any buildable class at all.
  if (!p.blds.some(b => b.key === 'barracks'))
    makeBuilding('barracks', p, Math.floor(p.start.x) - 4, Math.floor(p.start.y) + 4, true);
  for (const b of p.blds) b.prog = 1;
  const barracksOnly = aiProdClasses(p);
  ok('T39.G a barracks-only bot reads exactly one buildable class',
    Object.keys(barracksOnly).join() === 'inf');
  const w1 = aiMixWant(AI_PROFILES.balanced, barracksOnly, 0);
  ok('T39.G ...so its whole target collapses onto infantry, and it never starves',
    Math.abs(w1.inf - 1) < 1e-9);
  // This is the trap the renormalization exists for: without it, a bot with no
  // helipad carries a permanent unreachable air quota and reads its infantry as a
  // surplus forever.
  const three = { inf: 1, veh: 1, air: 1 };
  const w2 = aiMixWant(AI_PROFILES.balanced, three, 0);
  ok('T39.G with a garage and a pad the three shares sum to one and keep their order',
    Math.abs(w2.inf + w2.veh + w2.air - 1) < 1e-9 && w2.inf > w2.veh && w2.veh > w2.air);
  ok('T39.G AA is dormant while nobody flies and wakes when they do',
    aiMixWant(AI_PROFILES.balanced, { inf: 1, aa: 1 }, 0).aa === 0 &&
    aiMixWant(AI_PROFILES.balanced, { inf: 1, aa: 1 }, 0.5).aa > 0);
  ok('T39.G a defensive bot asks for more armor than an aggressive one',
    AI_PROFILES.defensive.mixWant.veh > AI_PROFILES.aggressive.mixWant.veh);
  // have() is a head count over live fighters only
  for (const u of p.units.slice()) if (u.t.dm > 0) { const i = G.units.indexOf(u); if (i >= 0) G.units.splice(i, 1); const j = p.units.indexOf(u); if (j >= 0) p.units.splice(j, 1); }
  for (let i = 0; i < 3; i++) put59('grunt', p, 30 + i, 30);
  put59('jeep', p, 34, 30);
  const tr2 = put59('truck', p, 35, 30);
  const h = aiMixHave(p, { inf: 1, veh: 1 });
  ok('T39.G current shares are a head count of live fighters, support excluded',
    Math.abs(h.inf - 0.75) < 1e-9 && Math.abs(h.veh - 0.25) < 1e-9);
}

/* ---------- H: the production gate ---------- */
{
  section('T39.H the building-level gate');
  G = null; newGame(cfg59('backyard', 'dm', 'normal', 'green', 3, 590060));
  const p = bot59();
  p.res.p = 99999; p.res.e = 99999;
  // Give it a garage with an unlocked roster and an army that is 100% infantry: the
  // barracks is over target, the garage is short, so the tick must feed the garage.
  for (const t of ['b_garage', 'u_jeep', 'u_tank']) { p.tech.add(t); if (p.techDone) p.techDone.add(t); }
  const gar = makeBuilding('garage', p, Math.floor(p.start.x) + 4, Math.floor(p.start.y) + 4, true);
  const bar = p.blds.find(b => b.key === 'barracks') || makeBuilding('barracks', p, Math.floor(p.start.x) - 4, Math.floor(p.start.y) + 4, true);
  for (const b of [gar, bar]) { b.prog = 1; b.queue.length = 0; }
  // The HQ alone grants 10 supply and the starting trucks plus eight fighters spend
  // all of it, so without headroom trainUnit refuses and the gate is untestable.
  for (let i = 0; i < 3; i++) {
    const d = makeBuilding('supply', p, Math.floor(p.start.x) - 6 + i * 2, Math.floor(p.start.y) - 5, true);
    if (d) d.prog = 1;
  }
  for (const u of p.units.slice()) if (u.t.dm > 0) { const i = G.units.indexOf(u); if (i >= 0) G.units.splice(i, 1); const j = p.units.indexOf(u); if (j >= 0) p.units.splice(j, 1); }
  // armyCap is round((12 + t/300) * diff.army), so twelve fighters at t=0 sits ON the
  // cap and skips the entire production block. Eight, with the clock wound on.
  p.ai.t = 600;
  for (let i = 0; i < 8; i++) put59('grunt', p, 30 + (i % 4), 30 + ((i / 4) | 0));
  const cls = aiProdClasses(p);
  ok('T39.H a garage with an unlocked roster registers vehicles as buildable', !!cls.veh);
  const want = aiMixWant(p.ai.pr, cls, 0), have = aiMixHave(p, cls);
  ok('T39.H an all-infantry army reads as an infantry surplus and a vehicle shortfall',
    have.inf - want.inf > 0.04 && (want.veh || 0) - (have.veh || 0) > 0.04);
  for (let i = 0; i < 6; i++) aiTick(p);
  const gq = gar.queue.length, bq = bar.queue.length;
  ok(`T39.H the tick feeds the short building and stands the surplus one down (garage ${gq}, barracks ${bq})`,
    gq > 0 && bq === 0);
}

/* ---------- I: the headline, with a mutation check ---------- */
{
  section('T39.I bots actually field aircraft and air defence');
  // trainUnit is the single choke point every bot production path goes through.
  function census(seed, ticks) {
    const seen = { inf: 0, veh: 0, air: 0, aa: 0 };
    const real = trainUnit;
    trainUnit = function (b, k) {
      const r = real(b, k);
      if (r && b.p && b.p.ai && !AI_SUPPORT[k]) seen[aiUnitClass(k)]++;
      return r;
    };
    let pads = 0;
    try {
      G = null; newGame(cfg59('backyard', 'dm', 'normal', 'green', 3, seed));
      for (let i = 1; i <= ticks; i++) update(DT59);
      pads = G.players.filter(p => p.ai && p.blds.some(b => b.key === 'helipad')).length;
    } finally { trainUnit = real; }
    return { seen, pads };
  }
  const live = census(590070, 18000);
  ok(`T39.I bots build helipads (${live.pads} of them) instead of never unlocking one`, live.pads > 0);
  ok(`T39.I ...and put aircraft in them (${live.seen.air} trained)`, live.seen.air > 0);
  ok(`T39.I air defence is bought too, not left as a deadlock (${live.seen.aa} trained)`, live.seen.aa > 0);
  ok(`T39.I vehicles are a real share of production, not a rounding error (${live.seen.veh} trained)`, live.seen.veh >= 10);
  // MUTATION: zero every air target on the same seed. If the greens above came from
  // a match that would have flown regardless, this arm flies just as much.
  const keep = {};
  for (const k of PROF59) {
    keep[k] = AI_PROFILES[k].mixWant;
    const m = AI_PROFILES[k].mixWant, s = m.inf + m.veh;
    AI_PROFILES[k].mixWant = { inf: m.inf / s, veh: m.veh / s, air: 0 };
  }
  /* v78 WIDENED THE SEED SET, 2 -> 6, and did NOT touch the 0.85 gate.
     v78's unit edits reshuffle the draw and the two-seed sample landed on the
     low tail: the arm read 24 -> 23 and inverted. Measured over six seeds on
     both builds before touching anything, air's share of everything trained is
       v77  live 4.01%  zeroed 2.58%   (per-seed live 2.28% .. 5.88%)
       v78  live 3.76%  zeroed 2.28%   (per-seed live 1.42% .. 5.39%)
     so v78 sits inside v77's own seed spread on identical total production
     (2843 vs 2845 units) and there is no v78 regression to record. What there
     is, is a test under-powered for the air share the game actually runs at -
     the standing air-production question, showing up as sampling noise. Six
     seeds is three times the evidence at an unchanged gate, and the widened
     arm passes on v77 (2.58% < 3.41%) as well as on v78 (2.28% < 3.20%), so it
     is not a fix cut to fit this release. */
  const SEEDS59 = [590070, 590071, 590072, 590073, 590074, 590075];
  const flats = SEEDS59.map(s => census(s, 18000));
  for (const k of PROF59) AI_PROFILES[k].mixWant = keep[k];
  const lives = SEEDS59.map(s => census(s, 18000));           // ...and their restored controls
  const tot59 = c => c.inf + c.veh + c.air + c.aa;
  const sum59 = (a, f) => a.reduce((n, c) => n + f(c.seen), 0);
  const liveAir = sum59(lives, c => c.air), flatAir = sum59(flats, c => c.air);
  const ls = liveAir / sum59(lives, tot59), fs = flatAir / sum59(flats, tot59);
  // v63: the cut is asserted on air's SHARE of everything trained, not on the raw
  // count. The faction floor changes how much a bot trains in total, so the two
  // arms no longer produce comparable volumes and an absolute comparison across
  // them is not apples-to-apples. The share is the axis that survives that; the
  // raw count stays as a direction check. Measured post-v63: 6.0% -> 4.4%.
  ok(`T39.I zeroing the air targets cuts air production over six seeds (${liveAir} -> ${flatAir}, ${(ls*100).toFixed(1)}% -> ${(fs*100).toFixed(1)}% of everything trained), so the target is what drives it`,
    fs < ls * 0.85 && flatAir < liveAir);
  // v89: 0.17 -> 0.26 by the air retune. The transcribed value is the point of the
  // second clause - it proves the restore put the AUTHORED table back and not just
  // some object - so it has to be re-transcribed whenever the table is retuned.
  // The mutation arm above is untouched and still passes at the new targets.
  ok('T39.I every profile was put back',
    PROF59.every(k => AI_PROFILES[k].mixWant === keep[k]) &&
    Math.abs(AI_PROFILES.balanced.mixWant.air - 0.26) < 1e-9);
}

/* ---------- J: the wish list no longer stalls ---------- */
{
  section('T39.J the wish list falls through instead of stalling');
  // Through v58 the loop ended in an unconditional break, so the first entry it
  // could not afford blocked every entry behind it. Guard towers sat directly in
  // front of the helipad, and a turtle wanted four of them.
  G = null; newGame(cfg59('backyard', 'dm', 'normal', 'green', 3, 590080));
  const p = bot59();
  const src = aiTick.toString();
  ok('T39.J the tower entry no longer demands the full ring before the pad',
    src.includes("['guardtower',1]") && src.includes("['helipad',1]"));
  ok('T39.J the pad sits between the two towers, never behind the full ring',
    src.indexOf("['guardtower',1]") < src.indexOf("['helipad',1]") &&
    src.indexOf("['helipad',1]") < src.indexOf("['guardtower',Math.min(2,towerWant)]") &&
    src.indexOf("['helipad',1]") < src.lastIndexOf("['guardtower',towerWant]"));
  // Functional: a bot that can afford a turbine but not a guard tower must still
  // place the turbine rather than parking on the tower forever.
  for (const t of ['b_turbine', 'b_guardtower', 'b_generator']) { p.tech.add(t); if (p.techDone) p.techDone.add(t); }
  const before = p.blds.length;
  p.res.p = bcost(p, 'turbine').p + 90; p.res.e = 400;
  let placed = null;
  for (let i = 0; i < 40 && !placed; i++) {
    aiTick(p);
    if (p.blds.length > before) placed = p.blds[p.blds.length - 1].key;
    p.res.p = Math.min(p.res.p, bcost(p, 'guardtower').p - 20);
  }
  ok(`T39.J a bot too poor for a tower still reaches something cheaper behind it (placed ${placed})`,
    placed !== null && placed !== 'guardtower');
}
