/* recut_v84.js - regenerate the hash-trail baselines that v84 moved.
 *
 *   cat shim_head.js game.js recut_v84.js > rc84.js && node rc84.js
 *
 * v84 is the AI encounter ledger: a decaying record of damage taken per armour
 * class, blended into the mix aiPickUnit already scores against. It changes what
 * bots BUY, so every trail table moves and that is expected. What must NOT move
 * is the map - the ledger writes nothing but a number on a brain, and touches no
 * prop, node, nest or anything that fills M.pass.
 *
 * THE GATE RUNS FIRST AND EMITS NOTHING IF IT FAILS. All 42 layout pins
 * (12 in tail_v28, 15 in tail_v43, 15 in tail_v62) are recomputed and compared
 * before a single trail is cut - recut_v78 gated on 30, recut_v83 widened it to 42, and the third table is
 * included here because tail_v72's note counts all three when it calls the
 * layout hashes the equality proof. A layout hash that moved would mean
 * this release touched map generation, which would make every trail below it
 * meaningless to repin - so the correct answer there is to stop, not to cut.
 *
 * Each table is regenerated with the SAME generator its own tail uses, read off
 * that tail rather than reimplemented from memory:
 *
 *   BASE45_TRAILS  tail_v43  cfg fac 'tan',   7 combos, 900/2400 ticks, every 90
 *   BASE48_TRAILS  tail_v49  cfg fac 'green', same combos and sampling
 *   BASE62_TRAILS  tail_v62  cfg fac 'tan'    - same inputs as BASE45_TRAILS
 *   BASE45_AI      tail_v44  aiTakeover on the human seat, 1800 ticks, every 600
 *   BASE43_DESK    tail_v45  the Gunner-at-90 fixture, desk:surv, 2400, every 90
 *
 * BASE45_TRAILS and BASE62_TRAILS are cut independently and then asserted equal,
 * because they are the same run pinned in two files: if they ever disagree the
 * tables have diverged and one of the two tails is lying about what it tests.
 */
const DT = 1 / 30;
const fs = require('fs');

const cfgTan   = (map, mode, seed, opp) => ({ map, mode, diff: 'normal', fac: 'tan',   opp: (opp == null ? 3 : opp), seed });
const cfgGreen = (map, mode, seed, opp) => ({ map, mode, diff: 'normal', fac: 'green', opp: (opp == null ? 3 : opp), seed });
const cfgAI    = (map, mode, diff, fac, opp, seed) => ({ map, mode, diff, fac: fac || 'green', opp: opp || 3, seed });

const COMBOS = [
  ['backyard',   'dm',   777001, 3,  900],
  ['kitchen',    'dm',   777001, 3,  900],
  ['livingroom', 'dm',   777001, 3,  900],
  ['sandbox',    'dm',   777001, 3,  900],
  ['backyard',   'koth', 424243, 3,  900],
  ['kitchen',    'ctf',  424243, 3,  900],
  ['desk',       'surv', 424243, 1, 2400],
];

function trail(c, ticks, every) {
  G = null; newGame(c); const out = [];
  for (let i = 1; i <= ticks; i++) { update(DT); if (i % every === 0) out.push(hashState()); }
  return out;
}

// verbatim from tail_v43 / tail_v62, which carry byte-identical copies
function layoutHash() {
  let h = 2166136261;
  const P = G.map.pass; for (let i = 0; i < P.length; i++) h = hI(h, P[i]);
  for (const n of G.map.nodes) { h = hF(h, n.x); h = hF(h, n.y); h = hS(h, n.t); h = hF(h, n.amt); }
  for (const s of G.map.starts) { h = hF(h, s.x); h = hF(h, s.y); }
  for (const ns of (G.map.nests || [])) { h = hF(h, ns.x); h = hF(h, ns.y); }
  for (const pr of (G.map.props || [])) { h = hF(h, pr.x); h = hF(h, pr.y); h = hS(h, pr.t); }
  return h >>> 0;
}

function pinned(file, name) {
  const src = fs.readFileSync(file, 'utf8');
  const m = new RegExp('(?:const|let) ' + name + '\\s*=\\s*([\\{\\[][\\s\\S]*?[\\}\\]]);').exec(src);
  if (!m) { console.error('could not read ' + name + ' out of ' + file); process.exit(2); }
  return eval('(' + m[1] + ')');
}

/* ---------------- THE GATE ----------------
   All 42 pins, not just the 30 in tail_v43 and tail_v62: tail_v28 carries a
   third table of 12 whose config differs (always dm, always 3 opponents, no
   desk), and tail_v72's note counts all three when it calls the layout hashes
   the equality proof. A gate that skipped a table would be a gate with a hole. */
let moved = [], checked = 0;
for (const [file, tbl] of [['tail_v43.js', 'BASE43_LAYOUTS'], ['tail_v62.js', 'BASE62_LAYOUTS']]) {
  const want = pinned(file, tbl);
  for (const m of ['backyard', 'kitchen', 'livingroom', 'sandbox', 'desk']) for (const sd of [11, 22, 33]) {
    G = null; newGame(cfgTan(m, m === 'desk' ? 'surv' : 'dm', sd, m === 'desk' ? 1 : 3));
    const got = layoutHash(), key = `${m}:${sd}`; checked++;
    if (got !== want[key]) moved.push(`${tbl} ${key}: pinned ${want[key]} got ${got}`);
  }
}
{
  const want = pinned('tail_v28.js', 'V271_LAYOUTS');
  for (const key of Object.keys(want)) {
    const [m, sd] = key.split(':');
    G = null; newGame(cfgTan(m, 'dm', +sd, 3));
    const got = layoutHash(); checked++;
    if (got !== want[key]) moved.push(`V271_LAYOUTS ${key}: pinned ${want[key]} got ${got}`);
  }
}
if (checked !== 42) { console.error('gate expected 42 pins, walked ' + checked + '. Nothing cut.'); process.exit(1); }
if (moved.length) {
  console.error('LAYOUT GATE FAILED - ' + moved.length + ' of 42 pins moved. Nothing cut.');
  for (const l of moved) console.error('  ' + l);
  console.error('A moved layout hash means this release touched map generation, which is');
  console.error('not what v83 claims to do. Fix that before repinning any trail.');
  process.exit(1);
}
console.error('layout gate: all 42 pins hold. Cutting trails.\n');

/* ---------------- THE TABLES ---------------- */
const out = {};

const cutTrails = (cfg) => {
  const t = {};
  for (const [m, md, sd, opp, tk] of COMBOS) t[`${m}:${md}:${sd}`] = trail(cfg(m, md, sd, opp), tk, 90);
  return t;
};
out.BASE45_TRAILS = cutTrails(cfgTan);
out.BASE48_TRAILS = cutTrails(cfgGreen);
out.BASE62_TRAILS = cutTrails(cfgTan);

// same inputs, so the two tan tables must agree exactly
for (const k in out.BASE45_TRAILS) {
  const a = out.BASE45_TRAILS[k], b = out.BASE62_TRAILS[k];
  if (a.length !== b.length || !a.every((v, i) => v === b[i])) {
    console.error('BASE45_TRAILS and BASE62_TRAILS disagree on ' + k + ' - they are the same run and must not. Nothing emitted.');
    process.exit(1);
  }
}

out.BASE45_AI = (() => {
  const t = {};
  for (const key of ['backyard:dm:normal:green:3:441001', 'kitchen:ctf:hard:tan:2:441002',
                     'sandbox:koth:easy:gray:3:441003', 'livingroom:dm:hard:blue:3:441004']) {
    const [map, mode, diff, fac, opp, seed] = key.split(':');
    G = null; newGame(cfgAI(map, mode, diff, fac, +opp, +seed));
    execCmd({ op: 'aiTakeover', pi: G.human.i, a: { diff: 'normal' } });
    const a = [];
    for (let i = 1; i <= 1800; i++) { update(DT); if (i % 600 === 0) a.push(hashState()); }
    t[key] = a;
  }
  return t;
})();

out.BASE43_DESK = (() => {
  // the Gunner's price feeds RESEARCH.u_gunner, so both go back for the cut
  const keepC = U.gunner.cp, R = RESEARCH.u_gunner, keepR = { cp: R.cp, ce: R.ce, time: R.time };
  U.gunner.cp = 90;
  R.cp = rscale(90 + U.gunner.ce * 0.5); R.ce = rscale(Math.max(U.gunner.ce, 90 * 0.45)); R.time = rtime(90 + U.gunner.ce);
  G = null; newGame(cfgTan('desk', 'surv', 424243, 1));
  const a = []; for (let i = 1; i <= 2400; i++) { update(DT); if (i % 90 === 0) a.push(hashState()); }
  U.gunner.cp = keepC; R.cp = keepR.cp; R.ce = keepR.ce; R.time = keepR.time;
  return a;
})();

console.log(JSON.stringify(out));
console.error('cut: ' + Object.keys(out).map(k => k + '(' + (Array.isArray(out[k]) ? out[k].length : Object.keys(out[k]).length) + ')').join(', '));
