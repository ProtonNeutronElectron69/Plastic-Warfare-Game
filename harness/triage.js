/* triage.js - decide which segments a change actually needs, mechanically.
 *
 *   cat shim_head.js game.js triage.js > tri.js && node tri.js [git-ref]
 *   (./triage.sh wraps that)
 *
 * Two questions get answered, in order of how much they cost you to get wrong.
 *
 * 1. DID THE SIMULATION MOVE? This is the expensive one, because a moved
 *    simulation means every pinned trail is stale and the release needs a repin.
 *    It is also the one that cannot be answered by reading the diff: v83's
 *    placement bounds check looks like a UI guard and moves every trail, while
 *    the v82 help-panel work rewrote hundreds of lines of markup and moved
 *    nothing. So this is MEASURED, not guessed: the pinned trail combos are
 *    re-run and compared. ~25,000 ticks, about 25 seconds, against 633,000 for
 *    the full suite.
 *
 *    A trail that differs is conclusive - the sim moved, run everything.
 *    A trail that matches is strong but not absolute: it proves these combos are
 *    unchanged, not that no combo anywhere could differ. It has never been wrong
 *    in this project's history, and the layout pins below cover the other half.
 *
 * 2. WHICH TAILS NAME WHAT I TOUCHED? The tails assert against constants,
 *    function names and source text by name, so the identifiers on the changed
 *    lines are a real impact map. This over-reports rather than under-reports:
 *    a tail that merely mentions a name is listed. Over-reporting is the safe
 *    direction, and it is what would have caught T40.D in tail_v61 at v83 - a
 *    second copy of the supply invariant in a segment nobody thought to run.
 */
const { execSync } = require('child_process');
const fs = require('fs');

const REF = process.argv.slice(2).join(" ") || "HEAD";
const DT = 1 / 30;
const cfgTan = (map, mode, seed, opp) => ({ map, mode, diff: 'normal', fac: 'tan', opp: (opp == null ? 3 : opp), seed });
const cfgGreen = (map, mode, seed, opp) => ({ map, mode, diff: 'normal', fac: 'green', opp: (opp == null ? 3 : opp), seed });
const cfgAI = (map, mode, diff, fac, opp, seed) => ({ map, mode, diff, fac: fac || 'green', opp: opp || 3, seed });
const COMBOS = [
  ['backyard', 'dm', 777001, 3, 900], ['kitchen', 'dm', 777001, 3, 900],
  ['livingroom', 'dm', 777001, 3, 900], ['sandbox', 'dm', 777001, 3, 900],
  ['backyard', 'koth', 424243, 3, 900], ['kitchen', 'ctf', 424243, 3, 900],
  ['desk', 'surv', 424243, 1, 2400],
];
const trail = (c, ticks, every) => {
  G = null; newGame(c); const o = [];
  for (let i = 1; i <= ticks; i++) { update(DT); if (i % every === 0) o.push(hashState()); }
  return o;
};
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
  return m ? eval('(' + m[1] + ')') : null;
}
const same = (a, b) => !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);

/* ---- 1. did the simulation move? ---- */
const moved = [];
{
  const t45 = pinned('tail_v43.js', 'BASE45_TRAILS'), t48 = pinned('tail_v49.js', 'BASE48_TRAILS');
  for (const [m, md, sd, opp, tk] of COMBOS) {
    const k = `${m}:${md}:${sd}`;
    if (!same(trail(cfgTan(m, md, sd, opp), tk, 90), t45[k])) moved.push('trail(tan) ' + k);
    if (!same(trail(cfgGreen(m, md, sd, opp), tk, 90), t48[k])) moved.push('trail(green) ' + k);
  }
  const ai = pinned('tail_v44.js', 'BASE45_AI');
  for (const key in ai) {
    const [map, mode, diff, fac, opp, seed] = key.split(':');
    G = null; newGame(cfgAI(map, mode, diff, fac, +opp, +seed));
    execCmd({ op: 'aiTakeover', pi: G.human.i, a: { diff: 'normal' } });
    const a = []; for (let i = 1; i <= 1800; i++) { update(DT); if (i % 600 === 0) a.push(hashState()); }
    if (!same(a, ai[key])) moved.push('ai-trail ' + key);
  }
}
/* Triage walks the 30 pins in tail_v43 and tail_v62 - the fast subset of the 42
   the recut gate checks, whose third table (tail_v28's V271_LAYOUTS, 12 more) is
   the part it skips. Count them the way recut_v88_1.js counts its own, because
   the failure this guards against is the one shape of failure a triage run must
   never have: a map dropped from the list below, or a table the regex in
   pinned() stops reading, would leave the walk short and the verdict still
   reading "all pins hold" - clean for the one reason clean must never mean. The
   total is REPORTED off the walk rather than typed into the message, so the
   number cannot drift from what was actually checked the way a literal 30 can. */
const layoutMoved = [];
let layoutChecked = 0;
const gateStop = (why) => { console.error('triage: ' + why + ' The layout gate cannot run.'); process.exit(2); };
for (const [file, tbl] of [['tail_v43.js', 'BASE43_LAYOUTS'], ['tail_v62.js', 'BASE62_LAYOUTS']]) {
  const want = pinned(file, tbl);
  if (!want) gateStop('could not read ' + tbl + ' out of ' + file + '.');
  for (const m of ['backyard', 'kitchen', 'livingroom', 'sandbox', 'desk']) for (const sd of [11, 22, 33]) {
    const key = `${m}:${sd}`;
    if (!(key in want)) gateStop(tbl + ' has no pin for ' + key + '.');
    G = null; newGame(cfgTan(m, m === 'desk' ? 'surv' : 'dm', sd, m === 'desk' ? 1 : 3));
    layoutChecked++;
    if (layoutHash() !== want[key]) layoutMoved.push(`${tbl} ${key}`);
  }
}
if (layoutChecked !== 30) gateStop('expected 30 pins, walked ' + layoutChecked + '.');

/* ---- 2. which tails name what changed? ---- */
let diff = '';
try { diff = execSync(`git -C .. diff ${REF} -- plastic-warfare.html`, { encoding: 'utf8', maxBuffer: 64e6 }); } catch (e) { diff = ''; }
const changedLines = diff.split('\n').filter(l => /^[+-]/.test(l) && !/^[+-][+-]/.test(l));
/* Comments and string bodies are stripped from BOTH sides before a single
   identifier is taken, and that is not tidiness - the first two cuts of this
   failed for exactly the want of it.
     Cut 1 took every word on a changed line: a comment reading "the ceiling is
   reached on seven depots" contributed ceiling, reached and depots, every tail
   mentions one of those in its own prose, and the map named all five segments,
   which is the same as naming none.
     Cut 2 filtered against names the build declares, but scanned game.js WITH
   its comments - so a comment of mine reading "the edges that leaked: only a
   column can wrap" registered `leaked` as a declared property, and the prose
   walked straight back in. Worse, a diff line sitting inside a multi-line block
   comment carries no comment marker of its own, so stripping line by line never
   touched it.
   Both sides now go through one stripper that tracks block comments across
   lines. What survives is code. */
function stripJs(s) {
  let out = '', i = 0;
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; out += ' '; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; }
      i++; out += ' _str_ '; continue;
    }
    out += c; i++;
  }
  return out;
}

const code = stripJs(fs.readFileSync('game.js', 'utf8'));
const declared = new Set();
for (const m of code.matchAll(/(?:^|[;{}\s])(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
for (const m of code.matchAll(/(?:^|[,{\s])([A-Za-z_$][\w$]*)\s*:/g)) declared.add(m[1]);

const ids = new Set();
{
  // strip across the whole changed block, so a line inside a /* */ is caught too
  const changed = stripJs(changedLines.map(l => l.slice(1)).join('\n'));
  for (const m of changed.matchAll(/[A-Za-z_$][\w$]{2,}/g)) if (declared.has(m[0])) ids.add(m[0]);
}

const tails = fs.readdirSync('.').filter(f => /^tail_v[\d_]+\.js$/.test(f));
const body = new Map(tails.map(f => [f, fs.readFileSync(f, 'utf8')]));
const SEG = { '2a': ['53', '54', '55', '56', '57', '58'], '2b': ['59'], '2c': ['60', '61', '62', '63'] };
const segOf = (f) => {
  const n = /tail_v(\d+)/.exec(f)[1];
  for (const s in SEG) if (SEG[s].includes(n)) return s;
  return +n >= 64 ? '3' : '1';
};
const hits = new Map();
for (const id of ids) {
  const re = new RegExp('\\b' + id.replace(/\$/g, '\\$') + '\\b');
  const named = tails.filter(f => re.test(body.get(f)));
  if (!named.length || named.length > tails.length * 0.5) continue;  // skip names so common they mean nothing
  for (const f of named) {
    if (!hits.has(f)) hits.set(f, new Set());
    hits.get(f).add(id);
  }
}

/* ---- report ---- */
const simMoved = moved.length > 0;
console.log('=== 1. simulation ===');
if (layoutMoved.length) {
  console.log('  LAYOUT MOVED (' + layoutMoved.length + ' pins) - this release touched MAP GENERATION.');
  for (const l of layoutMoved.slice(0, 6)) console.log('    ' + l);
  console.log('  Do not repin trails on top of this until that is intended and understood.');
} else console.log('  layout: all ' + layoutChecked + ' pins hold - map generation untouched');
console.log(simMoved
  ? '  TRAILS MOVED (' + moved.length + ' combos) -> run ./seg.sh all, and the release needs a REPIN\n    ' + moved.slice(0, 6).join('\n    ')
  : '  trails: every pinned combo reproduces - the simulation did NOT move, so no repin is due');

let STRONG = [];
console.log('\n=== 2. tails that name what you changed ===');
if (!changedLines.length) console.log('  (no diff against ' + REF + ' for plastic-warfare.html)');
else {
  /* Rank by RARITY. A name only one or two tails mention is a real pointer; one
     that half of them mention is noise riding along. Sorting this way puts the
     tail that pins DEPOT_SUP above the fifteen that merely say `neutral`, which
     is the difference between a list you act on and a list you skim. */
  const spread = new Map([...ids].map(id => {
    const re = new RegExp('\\b' + id.replace(/\$/g, '\\$') + '\\b');
    return [id, tails.filter(f => re.test(body.get(f))).length];
  }));
  const rank = (s) => Math.min(...[...s].map(id => spread.get(id)));
  const rows = [...hits.entries()]
    .map(([f, s]) => [f, segOf(f), [...s].sort((a, b) => spread.get(a) - spread.get(b)), rank(s)])
    .sort((a, b) => a[3] - b[3] || a[1].localeCompare(b[1]));
  if (!rows.length) console.log('  none - no tail names any identifier you touched');
  for (const [f, seg, s, r] of rows) {
    const mark = r <= 3 ? '**' : '  ';
    console.log('  ' + mark + ' seg ' + seg.padEnd(3) + f.padEnd(16) + s.slice(0, 5).join(', ') + (s.length > 5 ? ' …' : ''));
  }
  STRONG = [...new Set(rows.filter(r => r[3] <= 3).map(r => r[1]))].sort();
  const segs = [...new Set(rows.map(r => r[1]))].sort();
  console.log('\n  ** = names a rare identifier, i.e. probably asserts on what you changed');
  console.log('  segments with a strong hit: ' + (STRONG.join(' ') || '(none)'));
  console.log('  segments named at all:      ' + (segs.join(' ') || '(none)'));
}
console.log('\n=== verdict ===');
console.log(simMoved
  ? '  ./seg.sh all   (the sim moved: every trail table is stale and must be recut)'
  : '  ./seg.sh ' + (STRONG.join(' ') || '1') + '   (sim unchanged; these are the segments with a strong hit)');
