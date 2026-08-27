/* recut_v98.js - regenerate the hash-trail baselines that v98 moved.
 *
 *   cat shim_head.js game.js recut_v98.js > rc98.js && node rc98.js > cut_v98.json
 *   python3 repin_v98.py cut_v98.json
 *
 * v98 is four owner asks: the Heavy Barricade re-priced 60 -> 40 with its mine
 * roll raised 0.10 -> 0.15, a version stamp in the menu corner, number hotkeys
 * on the unit ability buttons (with the control groups moved to F1-F9), and a
 * hover/click sound pair for the menu and the Field Manual. Three of the four
 * are interface and cannot reach the simulation at all.
 *
 * THE ONE THAT DOES IS THE RE-PRICE, AND HOW IT REACHES THESE TRAILS IS THE
 * THING WORTH WRITING DOWN. The Heavy Barricade is GRAY-EXCLUSIVE, and the
 * trails that moved are a TAN trail, a GREEN trail and two AI-only trails -
 * none of which can lay one. The path is RESEARCH.b_hbarricade, whose price is
 * DERIVED from B.hbarricade.cp (rscale(cp*0.85 + ce*0.5), 71 -> 64) and whose
 * research TIME is derived from cp+ce (10.1s -> 9.7s). Every COMBOS trail boots
 * three real CPU opponents, one of them Gray, and in the backyard:koth match
 * that Gray bot starts b_hbarricade at TICK 627 - inside the 900-tick window.
 * Its bank and its lab therefore differ from tick 627 on, and hashState covers
 * every army in the match, not just the one the config names.
 *
 * Measured, not assumed: the four dm:777001 combos held because their Gray bot
 * never reaches that research inside thirty seconds, and desk:surv held for a
 * stronger reason still - that match is tan and blue only, so nothing in it can
 * research a Gray building at all. Two of seven trail combos and two of four
 * AI-only combos moved.
 *
 * The lesson generalises: "no army in this match can BUILD it" is not the same
 * claim as "nothing in this match reads its PRICE". A cost is an input to the
 * research table, and the research table is an input to every bot that owns a
 * lab. tail_v98 T75.A pins that derivation so the next re-price is told.
 *
 * Nothing in this release touches the mine ROLL inside a trail either, and that
 * is worth stating because HBARR_MINE_P did change: buryHBMine draws for every
 * completed heavy wall, and no heavy wall is completed in any trail window (the
 * research above never finishes). The draw is taken whether it succeeds or not,
 * so even a completed wall would not fork the stream on the outcome - only on
 * the mine's existence.
 *
 * What must NOT move is the map. Nothing in this release touches a prop, a node,
 * a nest or anything that fills M.pass.
 *
 * THE GATE RUNS FIRST AND EMITS NOTHING IF IT FAILS. All 42 layout pins
 * (12 in tail_v28, 15 in tail_v43, 15 in tail_v62) are recomputed and compared
 * before a single trail is cut. A layout hash that moved would mean this release
 * touched map generation, which would make every trail below it meaningless to
 * repin - so the correct answer there is to stop, not to cut.
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
  console.error('not what v98 claims to do. Fix that before repinning any trail.');
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
