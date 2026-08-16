'use strict';
/* 4-player deathmatch telemetry probe (v75).
   Concatenated with shim_head.js + game.js. Runs ONE spectate deathmatch per map
   (watch:true fields WATCH_ARMIES=4 bots, one per faction, each on its own team)
   and reports per army:
     AI profile, kills, units built, structures built, faction-unique units and
     structures built, plastic/electricity collected (harvested + generated +
     difficulty subsidy, tracked separately), peak army supply, and mean unspent
     plastic/electricity.

   All instrumentation is READ-ONLY with respect to sim state:
     - makeUnit / makeBuilding wrappers only count; they call through untouched.
     - meterDrop wrapper only accumulates; meterDrop is client-local telemetry.
     - aiTick wrapper replicates the known eco-trickle constants (1.5*eco/.45*eco)
       BEFORE calling through, rather than diffing p.res (which would net out the
       spending aiTick does later in the same call).
     - generator income is replicated per tick from b.t.eps, matching updateBld.
   Nothing here calls srand(), so the RNG draw order is unmoved. */

const DT = 1 / 30;
const MAPS_T = (process.env.MAPS ? process.env.MAPS.split(',') : Object.keys(MAPS).filter(k => !MAPS[k].survOnly));
const SEED = +(process.env.SEED || 4075);
const MAXT = +(process.env.TICKS || (DM_TIME > 0 ? DM_TIME * 30 + 600 : 36000));
const SAMP = +(process.env.SAMP || 30);   // unspent-resource sampling cadence, in ticks

const OUT = { seed: SEED, maxTicks: MAXT, dmTime: DM_TIME, maps: [] };

/* ---- wrappers, installed once ---- */
let REC = null;                 // per-match record map, keyed by player index
const _mkU = makeUnit, _mkB = makeBuilding, _md = meterDrop, _ai = aiTick;

makeUnit = function (key, p, x, y, ...r) {
  const u = _mkU(key, p, x, y, ...r);
  if (REC && p && REC[p.i]) {
    const a = REC[p.i];
    a.unitsMade++;
    if (a.uu.indexOf(key) >= 0) a.uqUnits++;
    a.unitMix[key] = (a.unitMix[key] || 0) + 1;
  }
  return u;
};
makeBuilding = function (key, p, tx, ty, inst, ...r) {
  const b = _mkB(key, p, tx, ty, inst, ...r);
  if (REC && p && REC[p.i]) {
    const a = REC[p.i];
    a.bldsMade++;
    if (key === a.ub) a.uqBlds++;
    a.bldMix[key] = (a.bldMix[key] || 0) + 1;
  }
  return b;
};
meterDrop = function (p, t, amt) {
  if (REC && p && REC[p.i]) {
    if (t === 'plastic') REC[p.i].harvP += amt; else REC[p.i].harvE += amt;
  }
  return _md(p, t, amt);
};
aiTick = function (p) {
  if (REC && p && REC[p.i] && p.alive) {
    const eco = ((p.diff || G.diff) || DIFFS.normal).eco;
    REC[p.i].ecoP += 1.5 * eco;
    REC[p.i].ecoE += 0.45 * eco;
  }
  return _ai(p);
};

/* ---- one match per map ---- */
for (const m of MAPS_T) {
  REC = null;
  G = null;
  newGame({ map: m, mode: 'dm', diff: 'normal', fac: 'green', seed: SEED, watch: true });

  /* install records AFTER newGame so the starting HQ, guard tower, two trucks and
     two grunts are excluded, matching the engine's own `p.stats.built = 0` reset. */
  REC = {};
  for (const p of G.players) {
    if (p.fac === 'bug') continue;
    REC[p.i] = {
      i: p.i, fac: p.fac, facName: FAC[p.fac].name, team: p.team,
      profile: p.ai ? p.ai.profile : null,
      uu: FAC[p.fac].uu.slice(), ub: FAC[p.fac].ub,
      unitsMade: 0, bldsMade: 0, uqUnits: 0, uqBlds: 0,
      unitMix: {}, bldMix: {},
      harvP: 0, harvE: 0, genE: 0, ecoP: 0, ecoE: 0,
      peakSup: 0, peakSupCap: 0,
      resPSum: 0, resESum: 0, nSamp: 0,
      aliveAt: 0, deadTick: null
    };
  }

  let endedAt = null;
  for (let i = 0; i < MAXT; i++) {
    update(DT);

    /* generator / turbine electricity, replicated from updateBld */
    for (const p of G.players) {
      const a = REC[p.i]; if (!a) continue;
      for (const b of p.blds) {
        if (b.prog < 1 || !b.t.eps) continue;
        const em = (b.upg && UPGRADES[b.key]) ? UPGRADES[b.key].eff : 1;
        a.genE += b.t.eps * em * DT;
      }
    }

    if (i % SAMP === 0) {
      for (const p of G.players) {
        const a = REC[p.i]; if (!a) continue;
        if (!p.alive) { if (a.deadTick == null) a.deadTick = G.tick; continue; }
        a.aliveAt = G.tick;
        const su = supUsed(p), sc = supCap(p);
        if (su > a.peakSup) a.peakSup = su;
        if (sc > a.peakSupCap) a.peakSupCap = sc;
        a.resPSum += p.res.p; a.resESum += p.res.e; a.nSamp++;
      }
    }

    if (G.over) { endedAt = i; break; }
  }

  const st = dmStandings();
  const rows = [];
  for (const p of G.players) {
    const a = REC[p.i]; if (!a) continue;
    a.kills = p.stats.kills;
    a.lost = p.stats.lost;
    a.builtEngine = p.stats.built;
    a.alive = !!p.alive;
    a.endBaseWorth = Math.round(dmBaseWorth(p));
    a.avgP = a.nSamp ? a.resPSum / a.nSamp : 0;
    a.avgE = a.nSamp ? a.resESum / a.nSamp : 0;
    a.collP = a.harvP + a.ecoP;
    a.collE = a.harvE + a.genE + a.ecoE;
    rows.push(a);
  }
  rows.sort((x, y) => x.i - y.i);

  OUT.maps.push({
    key: m, name: MAPS[m].n, N: MAPS[m].N,
    endTick: endedAt == null ? MAXT : endedAt,
    endSec: +(((endedAt == null ? MAXT : endedAt) / 30).toFixed(1)),
    resolved: endedAt != null,
    timeout: endedAt != null && G.tick >= DM_TIME * 30,
    winTeam: st.length ? st[0].team : null,
    armies: rows
  });
  process.stderr.write(m + ' done t=' + (endedAt == null ? MAXT : endedAt) + '\n');
}

console.log('@@JSON@@' + JSON.stringify(OUT));
