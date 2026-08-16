/* measure_v84.js - does the bot's shopping list actually bend toward counters?
 *
 *   cat shim_head.js game.js measure_v84.js > m84.js && node m84.js
 *   FOE=inf SEEDS=3 TICKS=5400 node m84.js      (all overridable)
 *
 * The v84 encounter ledger is only worth shipping if it MOVES a roster, and by a
 * measurable amount in the right direction. This runs the bot against a scripted
 * opponent whose army is forced to a single armour class, and reports what the
 * bot produced. Run it before the change and after; the delta is the evidence.
 *
 * The opponent is scripted rather than played by a second AI on purpose. A real
 * bot's composition drifts on its own, which would put the thing under test and
 * the thing generating the signal in the same loop. Here the foe is a fixed diet
 * of one class, topped up on a timer, so any movement in the bot's roster is a
 * response to that diet and nothing else.
 *
 * Production is counted by wrapping makeUnit, which is measurement only - the
 * wrapper counts and delegates, consuming no rng of its own. Waves ARE spawned
 * through makeUnit though, so the srand stream differs from an unscripted match;
 * that is fine because every arm of the comparison is scripted the same way, but
 * it does mean these numbers are not comparable to a pinned trail.
 */
const DT84 = 1 / 30;
const SEEDS84 = +(process.env.SEEDS || 3);
const TICKS84 = +(process.env.TICKS || 5400);   // 3 sim-minutes
const WAVE_EVERY = +(process.env.WAVE || 450);  // top the foe up every 15s
/* Waves are sized by PLASTIC, not by headcount, and that is the whole validity of
   the comparison. The first cut spawned six of whatever the diet was: six grunts
   is 216 plastic and six tanks is 1,596, so the tank diet applied seven times the
   pressure and the bot simply collapsed under it - 242 units built against
   infantry against 39 against tanks, and those 39 were 92% grunts. That reads
   like "tanks make the bot build grunts" and means nothing of the sort; a bot
   losing its economy builds the cheapest thing it can regardless of counters.
   Equal spend per wave isolates the diet's COMPOSITION from its force. */
const WAVE_P = +(process.env.WAVEP || 430);   // plastic-equivalent per wave

/* one representative per armour class, read off ARMOR_OF_A:
   inf->inf, jeep/apc->medium, tank->heavy, heli->air */
const FOES = { inf: 'grunt', medium: 'jeep', heavy: 'tank', air: 'heli' };

/* The BOT's faction is what matters here, and it is NOT a config field - newGame
   derives the opponent roster from the human seat AND the seed. Two earlier cuts
   of this got it wrong: the first reported GREEN over a roster full of Gray
   snipers because it labelled from the config, and the second assumed a fixed
   human->bot mapping measured by running four newGames in ONE process, where
   state carried between them and the mapping it "found" was an artefact.
   So: label from bot.fac read at runtime, and SEARCH the seed space for matches
   rather than assuming any mapping at all. Both are cheap - a newGame with no
   ticks costs almost nothing - and both are self-verifying. */
function seedsFor(botFac, want, from) {
  const out = [];
  for (let s = from; out.length < want && s < from + 4000; s++) {
    G = null; newGame(cfg84('backyard', 'green', s, 1));
    const b = G.players.find(p => p.ai);
    if (b && b.fac === botFac) out.push(s);
  }
  if (out.length < want) throw new Error('only found ' + out.length + ' seeds giving a ' + botFac + ' bot');
  return out;
}
const cfg84 = (map, fac, seed, opp) => ({ map, mode: 'dm', diff: 'normal', fac, opp: (opp == null ? 1 : opp), seed });

function runOne(foeKey, botFac, seed) {
  G = null; newGame(cfg84('backyard', 'green', seed, 1));
  const bot = G.players.find(p => p.ai);
  const foe = G.human;
  if (!bot) return null;
  if (bot.fac !== botFac) throw new Error('wanted a ' + botFac + ' bot, newGame gave ' + bot.fac);

  const built = Object.create(null);
  const realMake = makeUnit;
  makeUnit = function (key, p, x, y) {
    const u = realMake(key, p, x, y);
    if (p === bot && U[key] && U[key].dm > 0) built[key] = (built[key] || 0) + 1;
    return u;
  };

  const hq = bot.blds.find(b => b.key === 'hq') || bot.blds[0];
  try {
    for (let i = 1; i <= TICKS84; i++) {
      if (i % WAVE_EVERY === 0 && hq) {
        // drop the wave outside the bot's base so it is met rather than spawn-camped
        const each = U[foeKey].cp + U[foeKey].ce * 0.5;
        const n84 = Math.max(1, Math.round(WAVE_P / each));
        for (let n = 0; n < n84; n++) {
          const a = n * 2.39996, r = 10 + (n % 4);
          const x = clamp(hq.x + dcos(a) * r, 2, G.map.N - 3);
          const y = clamp(hq.y + dsin(a) * r, 2, G.map.N - 3);
          const u = realMake(foeKey, foe, x, y);
          if (u) { u.state = 'idle'; u.target = null; }
        }
      }
      update(DT84);
    }
  } finally { makeUnit = realMake; }

  const byClass = { inf: 0, veh: 0, aa: 0, air: 0 };
  let tot = 0;
  for (const k in built) { byClass[aiUnitClass(k)] += built[k]; tot += built[k]; }
  return { built, byClass, tot, fac: bot.fac };
}

const FOE_LIST = process.env.FOE ? [process.env.FOE] : Object.keys(FOES);
const FACS = (process.env.FACS || 'tan,gray').split(',');   // bot factions reachable at opp:1

console.log('measure_v84: bot production against a single-class diet');
console.log(`  ${SEEDS84} seeds x ${TICKS84} ticks, ~${WAVE_P} plastic of foe every ${WAVE_EVERY} ticks\n`);

for (const fac of FACS) {
  for (const foe of FOE_LIST) {
    const key = FOES[foe];
    const agg = Object.create(null); const cls = { inf: 0, veh: 0, aa: 0, air: 0 }; let tot = 0;
    const seeds = seedsFor(fac, SEEDS84, 840001);
    for (const sd of seeds) {
      const r = runOne(key, fac, sd);
      if (!r) continue;
      for (const k in r.built) agg[k] = (agg[k] || 0) + r.built[k];
      for (const c in r.byClass) cls[c] += r.byClass[c];
      tot += r.tot;
    }
    const rows = Object.entries(agg).sort((a, b) => b[1] - a[1]);
    const pct = (n) => tot ? (100 * n / tot).toFixed(1).padStart(5) + '%' : '    -';
    console.log(`BOT ${fac.toUpperCase()} vs ${foe.padEnd(7)} (${U[key].n}) - ${tot} combat units built`);
    console.log('   class: ' + Object.entries(cls).map(([c, n]) => c + ' ' + pct(n)).join('  '));
    console.log('   roster: ' + rows.map(([k, n]) => U[k].n + ' ' + pct(n)).join(' | '));
    console.log('');
  }
}
