/* recut_v103.js - regenerate the baselines v103 moved: the LAYOUT tables AND the
 * hash trails.
 *
 *   cat shim_head.js game.js recut_v103.js > rc103.js && node rc103.js > cut_v103.json
 *   python3 repin_v103.py cut_v103.json
 *
 * v103 is the map layout audit. Alone among the releases that have needed a
 * repin, this one CHANGES MAP GENERATION ON PURPOSE - so the 42-pin layout gate
 * that every previous recut ran as a refusal runs here as its own inverse.
 *
 * WHY THE GATE IS INVERTED, and why that is not a licence.
 * The gate exists to catch a release that moved the map by ACCIDENT, because
 * repinning trails on top of an accidental map change hides the real problem
 * instead of recording it. v103's whole subject is the map: the garden hose no
 * longer walks off the north edge, a blocking prop no longer stands drowned
 * inside a spill, hazards of different kinds no longer clip through each other,
 * ground cover is pruned against the finished board, and the terracotta pots
 * survive as a pair. Every one of those changes what fills M.pass and M.props,
 * which is exactly what layoutHash reads.
 * So this script demands the OPPOSITE of what recut_v101 demanded: the layout
 * must have moved, on the maps whose generation this release touched, or the cut
 * ran against a build without the fixes in it. What it still refuses is a cut
 * that walked the wrong number of pins.
 *
 * ONLY THE DESK IS ALLOWED TO HOLD, and naming that is the honest half of the
 * inversion. The Desk is not untouched - its clutter pairs now keep their art
 * clear, its two hazards retry off each other, and its mouse pad and sheet of
 * paper retry off each other too - so most of its boards move like everything
 * else. What it lacks is the PvP economy, the mines and the barricade clusters
 * (survivalSetup carves its own arena), so a Desk seed on which every retry
 * happens to clear on its first roll can legitimately generate byte-identically.
 * MEASURED: 40 of the 42 pins moved and the two that held are desk:22, the same
 * board pinned in BASE43_LAYOUTS and BASE62_LAYOUTS. V271_LAYOUTS has no desk row
 * at all, so all twelve of its pins must move. A PvP board holding still is a fix
 * that did not land, and the gate below says so.
 *
 * Each trail table is regenerated with the SAME generator its own tail uses,
 * read off that tail rather than reimplemented from memory:
 *
 *   BASE43_LAYOUTS tail_v43  layoutHash on 5 maps x 3 seeds
 *   BASE62_LAYOUTS tail_v62  the same 15, pinned a second time
 *   V271_LAYOUTS   tail_v28  12: always deathmatch, 3 opponents, no desk
 *   BASE45_TRAILS  tail_v43  cfg fac 'tan',   7 combos, 900/2400 ticks, every 90
 *   BASE48_TRAILS  tail_v49  cfg fac 'green', same combos and sampling
 *   BASE62_TRAILS  tail_v62  cfg fac 'tan'    - same inputs as BASE45_TRAILS
 *   BASE45_AI      tail_v44  aiTakeover on the human seat, 1800 ticks, every 600
 *   BASE43_DESK    tail_v45  the Gunner-at-90 fixture, desk:surv, 2400, every 90
 *
 * BASE45_TRAILS and BASE62_TRAILS are cut independently and then asserted equal,
 * because they are the same run pinned in two files: if they ever disagree the
 * tables have diverged and one of the two tails is lying about what it tests.
 * The same holds for BASE43_LAYOUTS and BASE62_LAYOUTS.
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

// verbatim from tail_v43 / tail_v62 / tail_v28, which carry byte-identical copies
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

/* ---------------- THE LAYOUT CUT, AND THE INVERTED GATE ---------------- */
const out = {};
const LAY_MAPS = ['backyard', 'kitchen', 'livingroom', 'sandbox', 'desk'];
const cutLayouts = (maps) => {
  const t = {};
  for (const m of maps) for (const sd of [11, 22, 33]) {
    G = null; newGame(cfgTan(m, m === 'desk' ? 'surv' : 'dm', sd, m === 'desk' ? 1 : 3));
    t[`${m}:${sd}`] = layoutHash();
  }
  return t;
};
out.BASE43_LAYOUTS = cutLayouts(LAY_MAPS);
out.BASE62_LAYOUTS = cutLayouts(LAY_MAPS);
// V271's config differs: always deathmatch, always three opponents, no desk. Its
// row order is the one already in tail_v28, so it is rebuilt off the pinned keys.
out.V271_LAYOUTS = (() => {
  const want = pinned('tail_v28.js', 'V271_LAYOUTS'), t = {};
  for (const key of Object.keys(want)) {
    const [m, sd] = key.split(':');
    G = null; newGame(cfgTan(m, 'dm', +sd, 3));
    t[key] = layoutHash();
  }
  return t;
})();

for (const k in out.BASE43_LAYOUTS) {
  if (out.BASE43_LAYOUTS[k] !== out.BASE62_LAYOUTS[k]) {
    console.error('BASE43_LAYOUTS and BASE62_LAYOUTS disagree on ' + k + ' - same run, two files. Nothing emitted.');
    process.exit(1);
  }
}

let checked = 0, held = [];
for (const [file, tbl] of [['tail_v43.js', 'BASE43_LAYOUTS'], ['tail_v62.js', 'BASE62_LAYOUTS'], ['tail_v28.js', 'V271_LAYOUTS']]) {
  const was = pinned(file, tbl), now = out[tbl];
  for (const key of Object.keys(was)) { checked++; if (was[key] === now[key]) held.push(`${tbl} ${key}`); }
}
if (checked !== 42) { console.error('gate expected 42 pins, walked ' + checked + '. Nothing cut.'); process.exit(1); }
// only the Desk may hold, and only for the reason given in the header
const HOLD_OK = new Set(['BASE43_LAYOUTS desk:11', 'BASE43_LAYOUTS desk:22', 'BASE43_LAYOUTS desk:33',
                         'BASE62_LAYOUTS desk:11', 'BASE62_LAYOUTS desk:22', 'BASE62_LAYOUTS desk:33']);
const surprise = held.filter(h => !HOLD_OK.has(h));
if (surprise.length) {
  console.error('INVERTED GATE FAILED - ' + surprise.length + ' PvP layout pins did not move. Nothing cut.');
  for (const l of surprise) console.error('  ' + l);
  console.error('v103 changes map generation on purpose; a PvP board that generated');
  console.error('identically means this cut ran against a build without the fixes.');
  process.exit(1);
}
console.error('layout: ' + (42 - held.length) + ' of 42 pins moved, ' + held.length + ' held' +
  (held.length ? ' (' + held.join(', ') + ')' : '') + '. Cutting trails.\n');

/* ---------------- THE TRAIL TABLES ---------------- */
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
