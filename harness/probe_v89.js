/* probe_v89.js - run ONE all-AI deathmatch and print a JSON record of WHERE the
 * bot's air production is won or lost.
 *
 *   cat shim_head.js game.js probe_v89.js > probev89.js
 *   MAP=backyard SEED=101 FAC0=green node probev89.js
 *
 * ./probe_v89.sh drives this and reports a batch; you only run it by hand to look
 * at a single match. Same watch-mode setup as sim_dm.js and for the same reasons -
 * see that file's header, which is the long version of why it is not G.test.
 *
 * WHY IT EXISTS. sim.sh answers "how does this play"; it cannot answer "the bots
 * built 4% air, WHY". The class shares it prints are an outcome, and an outcome is
 * consistent with a dozen different causes: no helipad, no plastic, no supply, no
 * energy, a producer stood down by the composition gate, or a target that never
 * asked for air in the first place. This separates them, and at v88.1 it found
 * that the answer was two of them at once and neither was the one being guessed -
 * the bots were full (supFree 0 at 71.4% of helipad decisions, against a supply
 * cap already pinned at its ceiling) and broke at the moment of asking (a median
 * bank of 96 plastic against a Huey's 200), while energy - the one that looks
 * damning on the table, at 80 a Huey against a Grunt's 0 - was never the problem
 * at all, sitting at a median of 2,287.
 *
 * READ-ONLY. It wraps aiTick to SAMPLE the numbers the production loop is about to
 * compute, and wraps trainUnit to record what was actually queued. Every helper it
 * calls - aiProdClasses, aiMixWant, aiMixHave, aiFoeArmorMix, aiArmyCap, aiFacShare,
 * roster, ucost, supFree, supOf - consumes no rng, so the srand stream is exactly an
 * unplayed match's and a probed run is identical to a plain one.
 *
 * THE MIRROR IS THE MAINTENANCE COST. The per-building bucket below re-implements
 * aiTick's own filter so it can say WHICH clause refused. That copy has to be kept
 * in step with the original: if the two drift, this file reports on a bot that does
 * not exist. It is the same bargain sim_dm.js makes by asserting its own setup.
 */
const DT = 1 / 30;
const MAP = process.env.MAP || 'backyard';
const SEED = +(process.env.SEED || 1);
const FAC0 = process.env.FAC0 || 'green';
const MAXT = +(process.env.MAXT || 36200);

const stop = (why) => { console.error('probe_v89: ' + why); process.exit(2); };
if (!MAPS[MAP]) stop('no such map: ' + MAP);
if (MAPS[MAP].survOnly) stop(MAP + ' is wave-defense only and cannot host a deathmatch.');
if (!FAC[FAC0] || FAC0 === 'bug') stop('no such army: ' + FAC0);

G = null;
newGame({ map: MAP, mode: 'dm', diff: 'normal', fac: FAC0, seed: SEED, watch: true });

const real = G.players.filter(p => p.fac !== 'bug');
if (real.length !== WATCH_ARMIES) stop('expected ' + WATCH_ARMIES + ' armies, seated ' + real.length + '.');
if (real.some(p => !p.ai)) stop('an army was seated without an AI brain - watch mode did not take.');

/* the class of every trainable key, emitted with the record so the report never has
   to keep its own copy of a table the game already owns */
const CLSMAP = {};
for (const k in U) if (!U[k].noTrain) CLSMAP[k] = aiUnitClass(k);

const rec = new Map();
for (const p of real) rec.set(p.i, {
  fac: p.fac, prof: p.ai.profile,
  padPlaced: null, padDone: null,
  trained: {}, opp: {}, rsv: {},
  wantAir: 0, haveAir: 0, nAir: 0, aiTicks: 0
});

const realTrain = trainUnit;
trainUnit = function (b, k) {
  const r = b && b.p && rec.get(b.p.i);
  const ok = realTrain(b, k);
  if (r && ok) { const id = b.key + '|' + k; r.trained[id] = (r.trained[id] || 0) + 1; }
  return ok;
};

const FIELDS = ['seen', 'capped', 'queueFull', 'standdown', 'rsvBlocked', 'noPlastic', 'noEnergy', 'trained'];
const bump = (o, k, f) => {
  if (!o[k]) { o[k] = {}; for (const x of FIELDS) o[k][x] = 0; }
  o[k][f]++;
};

const realAiTick = aiTick;
aiTick = function (p) {
  const r = rec.get(p.i);
  if (r && p.alive) {
    r.aiTicks++;
    const pr = p.ai.pr || AI_PROFILES.balanced;
    const army = p.units.filter(u => !AI_SUPPORT[u.key] && !u.garrisoned);
    const prodBlds = p.blds.filter(b => b.prog >= 1 && b.t.prod && b.key !== 'hq' && b.key !== 'outpost');
    const gCls = aiProdClasses(p);
    const gWant = aiMixWant(pr, gCls, aiFoeArmorMix(p).air);
    const gHave = aiMixHave(p, gCls);
    if (gCls.air) { r.wantAir += gWant.air || 0; r.haveAir += gHave.air || 0; r.nAir++; }

    const bShort = b => {
      let d = -9;
      for (const k of roster(p, b.key)) {
        if (AI_SUPPORT[k] || U[k].noTrain) continue;
        const c = aiUnitClass(k); if (!gCls[c]) continue;
        const v = (gWant[c] || 0) - (gHave[c] || 0); if (v > d) d = v;
      }
      return d;
    };
    const gShort = {};
    for (const b of prodBlds) gShort[b.id] = bShort(b);
    const gAnyShort = prodBlds.some(b => gShort[b.id] > 0);
    const gFacShort = aiFacShare(p) < AI_FAC_FLOOR;
    const capped = army.length >= aiArmyCap(p);
    const saveExp = p.ai.saveExp;

    // --- mirror of aiTick's gRsv (see the header note about keeping it in step) ---
    const gRsv = (function () {
      const cheap = {}, csup = {};
      for (const b of prodBlds) {
        if (b.queue.length >= 2) continue;
        for (const k of roster(p, b.key)) {
          if (AI_SUPPORT[k] || U[k].noTrain) continue;
          const c = aiUnitClass(k); if (!gCls[c]) continue;
          if (U[k].lim && p.units.filter(u => u.key === k).length >= U[k].lim) continue;
          const cp = ucost(p, k).p;
          if (cheap[c] == null || cp < cheap[c]) { cheap[c] = cp; csup[c] = supOf(k); }
        }
      }
      let bc = null, bd = 0;
      for (const c of AI_CLASSES) {
        if (cheap[c] == null) continue;
        const w = gWant[c] || 0, d = w - (gHave[c] || 0);
        if (d <= AI_RSV_SHORT || w <= 0) continue;
        const rel = d / w; if (rel > bd) { bd = rel; bc = c; }
      }
      return bc === null ? null : { cls: bc, p: cheap[bc], s: csup[bc] };
    })();
    const rk = gRsv ? gRsv.cls : 'none';
    r.rsv[rk] = (r.rsv[rk] || 0) + 1;

    for (const b of prodBlds) {
      bump(r.opp, b.key, 'seen');
      if (capped) { bump(r.opp, b.key, 'capped'); continue; }
      if (b.queue.length >= 2) { bump(r.opp, b.key, 'queueFull'); continue; }
      if (gAnyShort && gShort[b.id] < -0.04 && !(gFacShort && aiBldHasFac(p, b.key))) { bump(r.opp, b.key, 'standdown'); continue; }
      const bSup = supFree(p);
      let byRsv = 0, byE = 0, ok = 0;
      for (const k of roster(p, b.key)) {
        if (AI_SUPPORT[k] || U[k].noTrain) continue;
        if (U[k].lim && p.units.filter(u => u.key === k).length >= U[k].lim) continue;
        const c = ucost(p, k), fx = gFacShort && FAC[p.fac].uu.indexOf(k) >= 0;
        let rsv = fx ? 0 : (saveExp ? 170 : 0), sup = 0;
        if (!fx && gRsv && aiUnitClass(k) !== gRsv.cls) { rsv += gRsv.p; sup = gRsv.s; }
        if (bSup - supOf(k) < sup) { byRsv++; continue; }
        if (!(p.res.e >= c.e)) { byE++; continue; }
        if (!(p.res.p >= c.p + rsv)) continue;
        ok++;
      }
      // ranked so the bucket names the FIRST thing that would have to change
      if (ok) bump(r.opp, b.key, 'trained');
      else if (byE) bump(r.opp, b.key, 'noEnergy');
      else if (byRsv) bump(r.opp, b.key, 'rsvBlocked');
      else bump(r.opp, b.key, 'noPlastic');
    }
  }
  return realAiTick(p);
};

let t = 0;
while (t < MAXT && !G.over) {
  update(DT); t++;
  for (const p of real) {
    const r = rec.get(p.i);
    if (r.padPlaced == null && p.blds.some(b => b.key === 'helipad')) r.padPlaced = t;
    if (r.padDone == null && p.blds.some(b => b.key === 'helipad' && b.prog >= 1)) r.padDone = t;
  }
}

const out = { map: MAP, seed: SEED, ticks: t, armies: [] };
for (const p of real) {
  const r = rec.get(p.i);
  out.armies.push({
    fac: r.fac, prof: r.prof, padPlaced: r.padPlaced, padDone: r.padDone,
    aiTicks: r.aiTicks, airTicks: r.nAir,
    wantAir: r.nAir ? +(r.wantAir / r.nAir).toFixed(4) : null,
    haveAir: r.nAir ? +(r.haveAir / r.nAir).toFixed(4) : null,
    trained: r.trained, opp: r.opp, rsv: r.rsv, cls: CLSMAP
  });
}
console.log(JSON.stringify(out));
