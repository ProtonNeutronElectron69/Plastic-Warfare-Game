/* sim_report.js - turn a directory of sim_dm.js records into the battle report.
 *
 *   cat shim_head.js game.js sim_report.js > simrep.js
 *   node simrep.js sim_out
 *
 * ./sim.sh drives this. It is concatenated after game.js like every other tool
 * here because the report needs the game's own tables to describe what it is
 * reporting - unit names and classes off U and aiUnitClass, exclusives off
 * FAC.uu / FAC.ub, the profile knobs off AI_PROFILES. Transcribing any of that
 * into the reporting layer would give it a second copy to drift from.
 *
 * The page itself is sim_page.html; this only substitutes the data and writes it.
 */
const fs = require('fs'), path = require('path');
const dir = process.argv[2] || 'sim_out';
const stop = (why) => { console.error('sim_report: ' + why); process.exit(2); };

const files = fs.readdirSync(dir).filter(f => /^game_\d+\.json$/.test(f))
  .sort((a, b) => (+/\d+/.exec(a)[0]) - (+/\d+/.exec(b)[0]));
if (!files.length) stop('no game_N.json records in ' + dir + '.');

const games = files.map((f, i) => {
  const g = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (!g.armies || !g.armies.length) stop(f + ' has no armies.');
  if (!g.winner) stop(f + ' has no single winner (survivors: ' + (g.survivors || []).join(', ') + ').');
  return Object.assign({ n: i + 1 }, g);
});
const nArmy = games[0].armies.length;
if (games.some(g => g.armies.length !== nArmy)) stop('the records disagree on army count.');

/* every army that appears anywhere, in the game's own faction order */
const F = Object.keys(FAC).filter(f => f !== 'bug'
  && games.some(g => g.armies.some(a => a.fac === f)));

const units = {}, blds = {}, fac = {};
for (const k in U) units[k] = { n: U[k].n, cls: aiUnitClass(k), cp: U[k].cp, sup: !!AI_SUPPORT[k] };
for (const k in B) blds[k] = { n: B[k].n, cp: B[k].cp, barr: !!B[k].barr };
for (const f of F) fac[f] = { name: FAC[f].name, color: FAC[f].color, uu: FAC[f].uu, ub: FAC[f].ub, desc: FAC[f].desc };

/* The game states no version constant - it lives only in comments, so parsing the
   source for one picks whichever vNN a comment happened to mention first (an early
   cut of this reported v58). The release IS marked, though: only the current
   release's recut one-shot ships, so exactly one recut_vNN.js is the version. Two
   of them means that rule has already been broken, so fall back rather than guess. */
function detectVersion() {
  if (process.env.PW_VERSION) return process.env.PW_VERSION;
  const here = fs.readdirSync('.');
  const recut = here.filter(f => /^recut_v[\d_]+\.js$/.test(f));
  if (recut.length === 1) return 'v' + /^recut_v([\d_]+)\.js$/.exec(recut[0])[1].replace(/_/g, '.');
  const tails = here.filter(f => /^tail_v[\d_]+\.js$/.test(f))
    .map(f => /^tail_v([\d_]+)\.js$/.exec(f)[1])
    .sort((a, b) => parseFloat(a.replace('_', '.')) - parseFloat(b.replace('_', '.')));
  if (tails.length) return 'v' + tails[tails.length - 1].replace(/_/g, '.');
  return 'current';
}
const version = detectVersion();

const data = {
  games, facOrder: F, units, blds, fac,
  profiles: Object.keys(AI_PROFILES), dmTime: DM_TIME,
  version, commit: process.env.PW_COMMIT || '',
  profileMeta: Object.fromEntries(Object.entries(AI_PROFILES).map(([k, v]) =>
    [k, { aggro: v.aggro, firstPush: v.firstPush, scout: v.scout, harass: v.harass,
          expand: v.expand, armyTilt: v.armyTilt, mixWant: v.mixWant }])),
};

const tplPath = 'sim_page.html';
if (!fs.existsSync(tplPath)) stop('cannot find ' + tplPath + ' beside this script.');
const tpl = fs.readFileSync(tplPath, 'utf8');
if (tpl.indexOf('/*__DATA__*/null') < 0) stop(tplPath + ' has lost its /*__DATA__*/null placeholder.');
/* A syntax error in the page's own script yields a page that loads, paints its
   empty shell and fills in NOTHING - no title, no tables, no error a reader would
   notice as anything but an odd blank report. That has happened once already, from
   a quoted string wrapped across a line inside a template literal. Parse the block
   here, where it is cheap, and refuse to write a page that cannot run. new Function
   compiles without executing, so nothing in the page's script actually runs. */
const script = /<script>(?![\s\S]{0,40}__DATA__)([\s\S]*?)<\/script>/g;
let m, blocks = 0;
while ((m = script.exec(tpl)) !== null) {
  blocks++;
  try { new Function(m[1]); }
  catch (e) { stop(tplPath + ' script block ' + blocks + ' does not parse: ' + e.message); }
}
if (!blocks) stop(tplPath + ' has no runnable script block.');

const html = tpl.replace('/*__DATA__*/null', JSON.stringify(data).replace(/</g, '\\u003c'));
const out = path.join(dir, 'battle-report.html');
fs.writeFileSync(out, html);

/* ---- the same summary as a table, so a run reports without opening the page ---- */
const A = {};
F.forEach(f => A[f] = { wins: 0, kills: 0, lost: 0, units: 0, blds: 0, cls: { inf: 0, veh: 0, air: 0, aa: 0 } });
const P = {};
Object.keys(AI_PROFILES).forEach(p => P[p] = { n: 0, wins: 0, kills: 0 });
for (const g of games) {
  A[g.winner].wins++;
  for (const a of g.armies) {
    const x = A[a.fac];
    x.kills += a.kills; x.lost += a.lost; x.units += a.unitsBuilt; x.blds += a.bldsBuilt;
    for (const c in a.cls) x.cls[c] += a.cls[c];
    const y = P[a.profile]; y.n++; y.kills += a.kills; if (a.fac === g.winner) y.wins++;
  }
}
const pad = (s, n) => String(s).padEnd(n), rp = (s, n) => String(s).padStart(n);
const wMap = Math.max(4, ...games.map(g => g.mapName.length)) + 2;
const wFac = Math.max(6, ...F.map(f => FAC[f].name.length)) + 2;
const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
console.log('\n' + games.length + ' matches, ' + games.length * nArmy + ' armies, at ' + version + '\n');
console.log(pad('match', 6) + pad('map', wMap) + pad('winner', wFac) + pad('doctrine', 12) + rp('length', 7) + rp('kills', 7));
for (const g of games) {
  const w = g.armies.find(a => a.fac === g.winner);
  console.log(pad(g.n, 6) + pad(g.mapName, wMap) + pad(FAC[g.winner].name, wFac) + pad(w.profile, 12)
    + rp(mmss(g.simSeconds), 7) + rp(g.armies.reduce((s, a) => s + a.kills, 0), 7));
}
console.log('\n' + pad('army', wFac) + rp('wins', 5) + rp('kills', 7) + rp('lost', 7) + rp('K/L', 7)
  + rp('units', 7) + rp('blds', 6) + rp('inf%', 7) + rp('veh%', 7) + rp('air%', 7));
for (const f of F) {
  const x = A[f], n = x.units || 1;
  console.log(pad(FAC[f].name, wFac) + rp(x.wins, 5) + rp(x.kills, 7) + rp(x.lost, 7)
    + rp((x.kills / (x.lost || 1)).toFixed(2), 7) + rp(x.units, 7) + rp(x.blds, 6)
    + rp((100 * x.cls.inf / n).toFixed(1), 7) + rp((100 * x.cls.veh / n).toFixed(1), 7)
    + rp((100 * x.cls.air / n).toFixed(1), 7));
}
console.log('\n' + pad('doctrine', 12) + rp('drawn', 6) + rp('wins', 6) + rp('win%', 6) + rp('kills/match', 13));
for (const p of Object.keys(P).sort((a, b) => P[b].wins - P[a].wins || P[b].n - P[a].n)) {
  const x = P[p];
  console.log(pad(p, 12) + rp(x.n, 6) + rp(x.wins, 6) + rp(x.n ? (100 * x.wins / x.n).toFixed(0) : '0', 6)
    + rp(x.n ? (x.kills / x.n).toFixed(0) : '0', 13));
}
console.log('\nreport: ' + out + '\n');
