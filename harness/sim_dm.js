/* sim_dm.js - run ONE all-AI deathmatch and print a JSON record on stdout.
 *
 *   cat shim_head.js game.js sim_dm.js > sim.js
 *   MAP=backyard SEED=101 FAC0=green node sim.js
 *
 * ./sim.sh drives this; you only run it by hand to look at a single match.
 *
 * WHY WATCH MODE. v55's spectate flag already does the thing this needs: slot 0
 * becomes a CPU like the rest, so the whole roster is bots and every faction
 * fields exactly one army. Without it slot 0 is a human seat with no brain - a
 * sitting duck that would decide the match by not playing. Do NOT reach for
 * G.test instead: testing mode boots every slot HUMAN, so no slot is handed an
 * AI brain and aiTick never fires at all.
 *
 * WHY THE PROFILES ARE NOT ASSIGNED HERE. newGame draws them itself, from a
 * seeded shuffle WITHOUT replacement, so a four-army match always gets four
 * different profiles out of the five. Assigning them here would be a second
 * mechanism racing the game's own; the seed is the whole control surface, and a
 * match re-runs identically from it.
 *
 * PRODUCTION is counted by wrapping makeUnit and makeBuilding AFTER newGame
 * returns, so the starting base and starting squad land in startU/startB rather
 * than in the built counts. Both wrappers count and delegate, consuming no rng
 * of their own, so the srand stream is exactly an unplayed match's.
 *
 * The gate below is the triage lesson applied forward: a run that quietly
 * simulated three armies, or dealt the same profile twice, would produce a clean
 * looking table that meant nothing. It is asserted rather than assumed.
 */
const DT = 1 / 30;
const MAP = process.env.MAP || 'backyard';
const SEED = +(process.env.SEED || 1);
const FAC0 = process.env.FAC0 || 'green';
/* DM_TIME is 1200 sim-seconds; the extra 200 ticks let dmClock resolve the board
   on the far side of the limit rather than cutting the match off just before it. */
const MAXT = +(process.env.MAXT || 36200);

const stop = (why) => { console.error('sim_dm: ' + why); process.exit(2); };
if (!MAPS[MAP]) stop('no such map: ' + MAP + '. Have: ' + Object.keys(MAPS).join(', '));
if (MAPS[MAP].survOnly) stop(MAP + ' is wave-defense only and cannot host a deathmatch.');
if (!FAC[FAC0] || FAC0 === 'bug') stop('no such army: ' + FAC0);

/* v113: V113_OFF=expand,runner,blue,truck reverts any of the release's changes
   at run time, so one build measures each on its own against the v112 baseline
   (the tables are mutable objects; the constants are not). */
for (const k of (process.env.V113_OFF || '').split(',').map(s => s.trim()).filter(Boolean)) {
  if (k === 'expand') { AI_PROFILES.defensive.expandAt = [250, 180]; AI_PROFILES.turtle.expandAt = [250, 180]; }
  else if (k === 'runner') delete AI_SUPPORT.runner;
  else if (k === 'blue') { FAC.blue.mods.hp = .9; delete FAC.blue.aiFloor; }
  else if (k === 'truck') delete U.truck.noFacSpeed;
  else stop('V113_OFF: no such change: ' + k);
}
/* ...and V113_SET="FAC.blue.aiFloor=0.08;U.truck.noFacSpeed=1" sets any field on the
   mutable tables before the match, for a variant that has no committed knob yet */
for (const kv of (process.env.V113_SET || '').split(';').map(s => s.trim()).filter(Boolean)) {
  const m = /^([A-Za-z_][\w.]*)=(.+)$/.exec(kv); if (!m) stop('V113_SET: bad assignment: ' + kv);
  const path = m[1].split('.'), roots = { FAC, U, B, AI_PROFILES, AI_SUPPORT, RESEARCH };
  let o = roots[path[0]]; if (!o) stop('V113_SET: unknown table: ' + path[0]);
  for (let i = 1; i < path.length - 1; i++) { if (o[path[i]] == null) stop('V113_SET: no such field: ' + kv); o = o[path[i]]; }
  o[path[path.length - 1]] = JSON.parse(m[2]);
}
G = null;
newGame({ map: MAP, mode: 'dm', diff: 'normal', fac: FAC0, seed: SEED, watch: true });

const real = G.players.filter(p => p.fac !== 'bug');
if (real.length !== WATCH_ARMIES) stop('expected ' + WATCH_ARMIES + ' armies, seated ' + real.length + '.');
if (new Set(real.map(p => p.fac)).size !== real.length) stop('two armies share a faction.');
if (real.some(p => !p.ai)) stop('an army was seated without an AI brain - watch mode did not take.');
/* v113: PROFS=aggressive,balanced,turtle,defensive forces the doctrine deal, seat
   by seat, for a CONTROLLED batch - the seeded draw above deals doctrines
   unevenly across armies (measured at v113: Blue drew the dead 'defensive'
   doctrine 12 times in 32, Tan 5), so an army's win rate and its doctrines' win
   rates cannot be separated without holding one of them still. A forced deal
   may repeat a doctrine (all four seats 'balanced' is the army-only design), so
   the distinct-deal gate below is skipped for it. The brains are re-made after
   newGame, so the srand stream differs from an unforced match's; the batch is
   still deterministic from (seed, PROFS). */
const PROFS = (process.env.PROFS || '').split(',').map(s => s.trim()).filter(Boolean);
if (PROFS.length) {
  if (PROFS.length !== real.length) stop('PROFS names ' + PROFS.length + ' doctrines for ' + real.length + ' seats.');
  for (const k of PROFS) if (!AI_PROFILES[k]) stop('no such doctrine: ' + k);
  real.forEach((p, i) => { p.ai = makeAIBrain(PROFS[i]); });
} else if (new Set(real.map(p => p.ai.profile)).size !== real.length) stop('a behaviour profile was dealt twice.');

const rec = new Map();
for (const p of real) {
  const r = { startU: {}, startB: {}, builtU: {}, builtB: {} };
  for (const u of p.units) r.startU[u.key] = (r.startU[u.key] || 0) + 1;
  for (const b of p.blds) r.startB[b.key] = (r.startB[b.key] || 0) + 1;
  rec.set(p.i, r);
}

const realMakeUnit = makeUnit, realMakeBuilding = makeBuilding;
makeUnit = function (key, p, x, y, srcBld) {
  const r = p && rec.get(p.i); if (r) r.builtU[key] = (r.builtU[key] || 0) + 1;
  return realMakeUnit(key, p, x, y, srcBld);
};
makeBuilding = function (key, p, tx, ty, instant) {
  const r = p && rec.get(p.i); if (r) r.builtB[key] = (r.builtB[key] || 0) + 1;
  return realMakeBuilding(key, p, tx, ty, instant);
};

let t = 0;
const elim = {};
/* v113: a per-minute series of each army's mined total and army size, so a
   batch can say WHEN an economy falls behind rather than only that it did */
const series = new Map(real.map(p => [p.i, { mined: [], army: [], outposts: [] }]));
while (t < MAXT && !G.over) {
  update(DT); t++;
  for (const p of real) if (!p.alive && elim[p.fac] == null) elim[p.fac] = t;
  if (t % 1800 === 0) for (const p of real) { const s = series.get(p.i);
    s.mined.push(Math.round(p.stats.mined || 0)); s.army.push(p.units.filter(u => u.t.dm && !u.garrisoned).length);
    s.outposts.push(p.blds.filter(b => b.key === 'outpost' && b.prog >= 1).length); }
}
makeUnit = realMakeUnit; makeBuilding = realMakeBuilding;

/* the survivor is read the way watchEndTitle reads it, off p.alive */
const alive = G.players.filter(p => p.alive && p.fac !== 'bug');
console.log(JSON.stringify({
  map: MAP, mapName: MAPS[MAP].n, seed: SEED, fac0: FAC0,
  ticks: t, simSeconds: Math.round(t / 30), over: !!G.over,
  endReason: !G.over ? 'cutoff' : (t >= DM_TIME * 30 ? 'time' : 'elimination'),
  winner: alive.length === 1 ? alive[0].fac : null,
  survivors: alive.map(p => p.fac),
  armies: real.map(p => {
    const r = rec.get(p.i), cls = { inf: 0, veh: 0, air: 0, aa: 0 };
    let nU = 0;
    for (const k in r.builtU) { cls[aiUnitClass(k)] += r.builtU[k]; nU += r.builtU[k]; }
    const sum = (o, pick) => { let n = 0; for (const k in o) if (pick(k)) n += o[k]; return n; };
    return {
      fac: p.fac, team: p.team, profile: p.ai.profile,
      alive: p.alive, elimAt: elim[p.fac] != null ? Math.round(elim[p.fac] / 30) : null,
      kills: p.stats.kills, lost: p.stats.lost, builtTotal: p.stats.built,
      mined: Math.round(p.stats.mined || 0), baseWorth: Math.round(dmBaseWorth(p)),
      endUnits: p.units.length, endBlds: p.blds.length,
      unitsBuilt: nU, bldsBuilt: sum(r.builtB, () => true), cls,
      uuBuilt: sum(r.builtU, k => FAC[p.fac].uu.indexOf(k) >= 0),
      ubBuilt: sum(r.builtB, k => FAC[p.fac].ub.indexOf(k) >= 0),
      supportBuilt: sum(r.builtU, k => !!AI_SUPPORT[k]),
      builtU: r.builtU, builtB: r.builtB, startU: r.startU, startB: r.startB,
      minedT: series.get(p.i).mined, armyT: series.get(p.i).army, outpostsT: series.get(p.i).outposts,
    };
  }),
}));
