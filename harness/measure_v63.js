'use strict';
/* Faction-exclusive audit probe. Not a test tail; never shipped.
   Boots all-CPU watch matches and reports, per faction:
     - sim-second at which each exclusive UNIT unlock and the exclusive BUILDING
       unlock completed (-1 = never)
     - late-window army share held by the exclusives
     - count of the exclusive building standing at the end
*/
const DT = 1 / 30;
const SUP = { truck: 1, medic: 1, apc: 1, chinook: 1 };
const TICKS = +(process.env.TICKS || 18000);
const SEEDS = (process.env.SEEDS || '901,902').split(',').map(Number);
const MAPS_T = (process.env.MAPS ? process.env.MAPS.split(',') : Object.keys(MAPS).filter(k => !MAPS[k].survOnly).slice(0, 3));
const DIFF = process.env.DIFF || 'normal';

const facAcc = {}; // fac -> {techU:{k:[s]}, techB:[s], share:[x], bldN:[n], prof:{}}
const A = f => facAcc[f] = facAcc[f] || { techU: {}, techB: [], share: [], bldN: [], profs: {}, bShare: [] };

/* cumulative BUILT counts per player, which is the axis the CSV reports (u_* are
   spawn totals, not live counts). Wraps makeUnit rather than reading p.stats,
   which only carries a grand total. */
const BUILT = new Map();
const _makeUnit = makeUnit;
makeUnit = function (key, p, x, y, srcBld) {
  const u = _makeUnit(key, p, x, y, srcBld);
  if (u && p) { let m = BUILT.get(p); if (!m) BUILT.set(p, m = {}); m[key] = (m[key] || 0) + 1; }
  return u;
};

for (const m of MAPS_T) for (const sd of SEEDS) {
  G = null;
  newGame({ map: m, mode: 'dm', diff: DIFF, fac: 'green', seed: sd, watch: true });
  const meta = G.players.filter(p => p.ai).map(p => ({ p, fac: p.fac, prof: p.ai.profile, tU: {}, tB: -1, ex: 0, all: 0 }));
  for (let i = 0; i < TICKS; i++) {
    update(DT);
    if (i % 30 === 0) for (const mm of meta) {
      const sec = Math.round(G.tick / 30);
      for (const uk of FAC[mm.fac].uu) { const tk = U[uk] && U[uk].tech; if (tk && mm.tU[uk] == null && hasTech(mm.p, tk)) mm.tU[uk] = sec; }
      const bt = B[FAC[mm.fac].ub] && B[FAC[mm.fac].ub].tech;
      if (mm.tB < 0 && bt && hasTech(mm.p, bt)) mm.tB = sec;
    }
    if (i >= TICKS - 9000 && i % 900 === 0) for (const mm of meta) {
      for (const u of mm.p.units) {
        if (SUP[u.key] || u.garrisoned || u.hp <= 0 || !u.t || !(u.t.dm > 0)) continue;
        mm.all++; if (FAC[mm.fac].uu.indexOf(u.key) >= 0) mm.ex++;
      }
    }
  }
  for (const mm of meta) {
    const a = A(mm.fac);
    for (const uk of FAC[mm.fac].uu) (a.techU[uk] = a.techU[uk] || []).push(mm.tU[uk] == null ? -1 : mm.tU[uk]);
    a.techB.push(mm.tB);
    a.share.push(mm.all ? mm.ex / mm.all : 0);
    a.bldN.push(mm.p.blds.filter(b => b.key === FAC[mm.fac].ub && b.prog >= 1).length);
    const bm = BUILT.get(mm.p) || {};
    let bt = 0, bx = 0;
    for (const k in bm) { if (SUP[k]) continue; bt += bm[k]; if (FAC[mm.fac].uu.indexOf(k) >= 0) bx += bm[k]; }
    a.bShare.push(bt ? bx / bt : 0);
    a.profs[mm.prof] = (a.profs[mm.prof] || 0) + 1;
  }
  process.stderr.write('.');
}
process.stderr.write('\n');
const avg = L => L.length ? (L.reduce((x, y) => x + y, 0) / L.length) : 0;
const nev = L => L.filter(x => x < 0).length;
console.log('TICKS=' + TICKS + ' maps=' + MAPS_T.join(',') + ' seeds=' + SEEDS.join(','));
for (const f in facAcc) {
  const a = facAcc[f];
  console.log('\n== ' + f + '  (n=' + a.techB.length + ' bots)');
  for (const uk in a.techU) {
    const L = a.techU[uk], got = L.filter(x => x >= 0);
    console.log('   unit ' + uk.padEnd(10) + ' unlocked ' + got.length + '/' + L.length + '  avg@' + Math.round(avg(got)) + 's  never=' + nev(L));
  }
  const gb = a.techB.filter(x => x >= 0);
  console.log('   bld  ' + FAC[f].ub.padEnd(10) + ' unlocked ' + gb.length + '/' + a.techB.length + '  avg@' + Math.round(avg(gb)) + 's  never=' + nev(a.techB));
  console.log('   exclusive share: LIVE army ' + (avg(a.share) * 100).toFixed(1) + '%   of all BUILT ' + (avg(a.bShare) * 100).toFixed(1) + '%');
  console.log('   exclusive bldgs standing avg ' + avg(a.bldN).toFixed(2));
}
