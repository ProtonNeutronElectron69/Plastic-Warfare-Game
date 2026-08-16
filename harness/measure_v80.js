'use strict';
/* v80 SCOPING PROBE - what actually shoots a Bull, and with which weapon row.

   The v80 roadmap has the Bull negating ALL damage from small-arms fire, keyed
   on weapon class 'b'. Row 'b' is fired by eight units AND by two structures
   (WC_BLD guardtower:'b', bunker:'b'), so "small arms" is a much wider set than
   the phrase suggests. This probe measures the share rather than reasoning about
   it.

   Instrumentation is READ-ONLY: applyDmg is wrapped, the wrapper buckets and
   calls through untouched. wc is resolved exactly the way applyDmg resolves it
   (wc || wcOf(attacker)), and the recorded amount is the RAW amt argument, i.e.
   the pre-matrix nominal - the post-matrix figure is recovered by multiplying
   through targetDmgMul, which is also recorded per bucket. Nothing here calls
   srand(), so the RNG draw order is unmoved. */

const DT = 1 / 30;
const MAPS_T = (process.env.MAPS ? process.env.MAPS.split(',') : ['backyard', 'kitchen', 'sandbox']);
const SEED = +(process.env.SEED || 8001);
const MAXT = +(process.env.TICKS || 27000);

const OUT = { seed: SEED, maxTicks: MAXT, maps: [] };
let REC = null;

const _apply = applyDmg;
applyDmg = function (tgt, amt, type, attacker, wc) {
  if (REC && tgt && tgt.kind === 'unit' && tgt.key === 'bulltank' && tgt.hp > 0 && amt > 0) {
    const row = wc || wcOf(attacker);
    const mul = targetDmgMul(attacker, tgt, wc);
    const eff = amt * mul;
    REC.total += eff;
    REC.byRow[row] = (REC.byRow[row] || 0) + eff;
    let src = 'environment';
    if (attacker && attacker.kind === 'unit') src = attacker.key;
    else if (attacker && attacker.kind === 'bld') src = 'BLD:' + attacker.key;
    else if (attacker && attacker.kind === 'creature') src = 'creature';
    REC.bySrc[src] = (REC.bySrc[src] || 0) + eff;
    if (row === 'b') REC.bBySrc[src] = (REC.bBySrc[src] || 0) + eff;
  }
  return _apply(tgt, amt, type, attacker, wc);
};

for (const mk of MAPS_T) {
  REC = { total: 0, byRow: {}, bySrc: {}, bBySrc: {}, bullsMade: 0, bullsLost: 0 };
  const _mk = makeUnit;
  makeUnit = function (key, p, x, y, ...r) { if (key === 'bulltank') REC.bullsMade++; return _mk(key, p, x, y, ...r); };

  G = null;
  newGame({ map: mk, mode: 'dm', diff: 'hard', fac: 'green', seed: SEED, watch: true });
  for (let i = 0; i < MAXT && !G.over; i++) update(DT);

  makeUnit = _mk;
  const rows = Object.entries(REC.byRow).sort((a, b) => b[1] - a[1]);
  const srcs = Object.entries(REC.bySrc).sort((a, b) => b[1] - a[1]);
  const bsrc = Object.entries(REC.bBySrc).sort((a, b) => b[1] - a[1]);
  OUT.maps.push({
    map: mk, bullsMade: REC.bullsMade, total: +REC.total.toFixed(1),
    bShare: REC.total > 0 ? +((REC.byRow.b || 0) / REC.total * 100).toFixed(2) : 0,
    rows: rows.map(([k, v]) => k + ':' + v.toFixed(0) + '(' + (v / REC.total * 100).toFixed(1) + '%)').join(' '),
    srcs: srcs.slice(0, 10).map(([k, v]) => k + ':' + (v / REC.total * 100).toFixed(1) + '%').join(' '),
    bSrcs: bsrc.map(([k, v]) => k + ':' + (v / (REC.byRow.b || 1) * 100).toFixed(1) + '%').join(' ')
  });
}
console.log(JSON.stringify(OUT, null, 1));
