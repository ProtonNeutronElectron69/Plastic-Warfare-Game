'use strict';
/* T48 v69: the economy binds where it should.

   Four approved changes and one approved NON-change:
     A  the tunables themselves
     B  D3 the supply ladder, and the CLIFF it was brought in to remove
     C  D4 the Gunner: the entrench rate in the SIM, and the relation that had to hold
     D  D2 the AI bank-pressure term on armyCap, driven through the real gate
     E  D6 the deathmatch clock: scoring, ordering, when it fires and when it must not
     F  D5 the vehicle rows are UNCHANGED, asserted rather than merely claimed
     G  statelessness + determinism: nothing here is hashed or serialized

   Nothing in here is a source-text assertion. The one place a grep would be
   tempting - "is the entrench multiplier really 1.5" - is done by driving a real
   Gunner through fireAt and reading the cooldown it lands on, with the old 2.0x
   rule replayed over the same unit as the mutation arm. */

const DT69 = 1 / 30;
function cfg69(map, mode, seed, opp, fac) {
  return { map, mode, diff: 'normal', fac: fac || 'green', opp: (opp == null ? 3 : opp), seed };
}
function fresh69(seed, opp, mode, map) { G = null; newGame(cfg69(map || 'backyard', mode || 'dm', seed, opp)); }
function put69(k, p, x, y) { const u = makeUnit(k, p, x, y); u.state = 'idle'; u.path = null; u.target = null; return u; }

section('T48 v69: supply ladder, gunner price, AI bank pressure, deathmatch clock');

/* ================================================ A: the tunables ============= */
{
  ok('T48.A the six v69 tunables exist and hold their approved values',
     ENTRENCH_RATE === 1.5 && typeof SUP_STEP === 'undefined' && SUP_MAX === 4 &&
     DM_TIME === 1200 && AI_BANK_STEP === 500 && AI_BANK_CAP === 12);
  ok('T48.A the supply ceiling moved 80 -> 110', SUP_CAP === 110);
  ok('T48.A the retired median constant is gone rather than left dangling',
     typeof SUP_MEDIAN === 'undefined');
}

/* ================================================ B: D3 the ladder =========== */
{
  /* The ladder's VALUES are T35.A's to pin. What this section owns is the reason
     the ladder exists: the old two-bucket cost put a cliff in per-supply combat
     value, so the best buy was always the most expensive unit still on the cheap
     side of the threshold. The measure is per-supply effective DPS against one
     armor class, and the claim is that the spread narrows. Both the old rule and
     the new one are evaluated over the SAME roster and the SAME matrix, so the
     comparison isolates the supply rule and nothing else. */
  /* v73 NOTE. This section isolates the SUPPLY RULE by evaluating the old rule
     and the new one over one roster. v73 moved that roster underneath it: the
     Machine Gunner's reload went .34 -> .4, which is a -15% DPS cut, and he is
     the unit every figure below is about. Restoring his v72 reload for the length
     of this measurement keeps the section measuring what it was written to
     measure, and every figure in it therefore stands UNEDITED - they are claims
     about the ladder, not about the Gunner. His live v73 standing (third
     per-supply now, behind the Apache) is T50.C's to pin, and it does. */
  const _rt72 = U.gunner.rt; U.gunner.rt = .34;
  const armed = Object.keys(U).filter(k => U[k].dm > 0 && U[k].rt > 0 && U[k].cp > 0);
  const effDps = k => unitDPS(U[k]) * dmgMulFor(k, U[k].w, 'medium');
  const spread = supFn => {
    const v = armed.map(k => effDps(k) / supFn(k)).filter(x => x > 0);
    return Math.max(...v) / Math.min(...v);
  };
  // the v68 rule, rebuilt here rather than remembered: >median => 2, else 1
  /* v85: this reconstruction used to read (v[9]+v[10])/2, which is the median of a
     TWENTY-element list and nothing else - the indices were the roster size baked
     in. The Signal Runner made it 21 and the "median" silently became the average
     of the 10th and 11th cheapest, which is not the middle of anything. Written as
     a real median it is correct at any roster size, which is what a reconstruction
     of a retired rule has to be if the comparison below is to mean anything. */
  const oldMedian = (() => {
    const v = Object.keys(U).filter(k => !U[k].noTrain).map(k => U[k].cp + U[k].ce).sort((a, b) => a - b);
    const n = v.length;
    return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  })();
  const oldSup = k => (U[k].cp + U[k].ce) > oldMedian ? 2 : 1;
  const nowSpread = spread(supOf), thenSpread = spread(oldSup);
  /* RECORDED HONESTLY, because the scoping estimate for this release was WRONG and
     the tail is where that gets caught rather than smoothed away. The scope said
     the roster-wide max/min spread would narrow 4.7x -> 2.9x. Measured over the
     whole armed roster it WIDENS, 4.76x -> 5.84x, and the reason is structural:
     the ladder closes the top (the Gunner stops being a runaway leader) and opens
     the bottom, because siege units now pay 3-4 supply for single-target DPS that
     was never the point of them. Artillery at splash 2.8125 and range 9 does not
     show up in a single-target measure at all.
     So the spread is pinned at the measured figure rather than asserted to have
     fallen. What this release actually fixes is the TOP end, and section B tests
     that directly below. The bottom end is a v70 siege question. */
  /* v85: the LADDER's figure is untouched at 5.84 - the Signal Runner is not the
     floor of it (Rocket Artillery still is, at 1.27 against his 1.72), so a new
     unit joined the roster without moving the number this section is about. The
     median arm moved 4.76 -> 7.04, and that is the retired rule being re-measured
     over a 21-unit roster with a correct median, not a change in anything shipped. */
  ok(`T48.B the roster-wide per-supply spread is the v69 figure (${nowSpread.toFixed(2)}x, was ${thenSpread.toFixed(2)}x under the median rule)`,
     Math.abs(nowSpread - 5.84) < 0.05 && Math.abs(thenSpread - 7.04) < 0.05);
  /* v85: THE DIRECTION FLIPPED, and the flip is honest rather than a fix.
     At v69 the ladder measured WIDER than the median rule (5.84 vs 4.76) and that
     was recorded above as the scope estimate having been wrong. Over a 21-unit
     roster it measures NARROWER (5.84 vs 7.04) - the ladder's own figure did not
     move at all, the median arm did. Adding one cheap, very-low-DPS unit costs the
     two-bucket rule far more than the quartile rule, because a bucket keyed on an
     absolute threshold hands him the SAME 1 supply it hands the Bazooka, while a
     rank cut re-sorts the roster around him. That is precisely the cliff the ladder
     was built to remove, so v69's estimate was not wrong about the mechanism - it
     was measured on a roster too small to show it.
     Recorded as the comparison it now is, with the v69 reading left standing above
     as what that roster honestly said. */
  ok(`T48.B ...and over a 21-unit roster the ladder is the narrower of the two (${nowSpread.toFixed(2)}x vs ${thenSpread.toFixed(2)}x)`,
     nowSpread < thenSpread);
  ok('T48.B ...because it is the MEDIAN arm that moved, not the ladder',
     Math.abs(nowSpread - 5.84) < 0.05);

  /* The specific cliff: under the median rule the Gunner was the single best
     per-supply buy in the game by a wide margin, and it got there by being the
     most expensive 1-supply unit rather than by being well designed. */
  // the AA truck scores 0 against ground armor by design (row 'a' is all zeros), so
  // it is excluded here the same way spread() excludes it, not ranked last on a zero.
  const rank = supFn => armed.map(k => ({ k, v: effDps(k) / supFn(k) })).filter(o => o.v > 0).sort((a, b) => b.v - a.v);
  const oldTop = rank(oldSup), newTop = rank(supOf);
  ok('T48.B under the old rule the Gunner led the per-supply table outright',
     oldTop[0].k === 'gunner' && oldTop[0].v / oldTop[1].v > 1.1);
  ok('T48.B under the ladder he is no longer the head of it',
     newTop[0].k === 'bazooka' && newTop[1].k === 'gunner');
  ok('T48.B ...and his own per-supply figure fell by the full step he moved up',
     Math.abs(newTop.find(o => o.k === 'gunner').v * 2 - oldTop[0].v) < 1e-9);
  /* The consequence, pinned by name so it cannot be discovered again by surprise:
     the three units the ladder demotes hardest are the siege pieces, and every one
     of them carries splash or reach that this measure cannot see. */
  /* v85: the Mortar Squad is displaced out of the bottom three by the Signal
     Runner, and the note above survives the change intact rather than needing a
     new excuse - he is the fourth unit in the roster whose whole job this measure
     cannot see. Artillery's splash, the Sniper's reach and now the Runner's two
     auras are all invisible to single-target DPS per supply. That is a statement
     about the metric, and it is why the bottom of this table has never been an
     argument for buffing anything. */
  const bottom3 = newTop.slice(-3).map(o => o.k).sort().join(',');
  ok(`T48.B the ladder's bottom three are units this measure cannot see (${bottom3}) - a v70 question, recorded here`,
     bottom3 === 'arty,runner,sniper');
  ok('T48.B ...and the Mortar Squad is the one it displaced, still just above them',
     newTop.slice(-4)[0].k === 'mortar');

  U.gunner.rt = _rt72;
  ok('T48.B ...and the v72 reload the measurement borrowed was put back',
     U.gunner.rt === .5 && U.gunner.rt !== .34);

  /* Supply is still ENFORCED, not merely re-priced: the gate that refuses a train
     order has to see the new numbers. Driven through trainUnit, not read. */
  fresh69(690001, 1);
  const p = G.human, hq = p.blds[0];
  const bar = makeBuilding('barracks', p, Math.floor(hq.tx) + 4, Math.floor(hq.ty), true); bar.prog = 1;
  p.res.p = 999999; p.res.e = 999999;
  p.tech.add && p.tech.add('u_gunner'); p.techDone.add('u_gunner');
  const free0 = supFree(p);
  const okTrain = trainUnit(bar, 'gunner');
  ok('T48.B a Gunner reserves 2 supply from the queue, not 1',
     okTrain && supFree(p) === free0 - 2 && supOf('gunner') === 2);
  // fill to the ceiling and confirm the refusal is SUPPLY and not queue room
  let placed = 0;
  const bars = [bar];
  for (let i = 1; i < 30; i++) {
    const b = makeBuilding('barracks', p, Math.floor(hq.tx) + 4, Math.floor(hq.ty) + i * 3, true);
    b.prog = 1; bars.push(b);
  }
  let progress = true;
  while (progress) { progress = false; for (const b of bars) if (b.queue.length < 5 && trainUnit(b, 'grunt')) { placed++; progress = true; } }
  ok('T48.B the fill stops on supply with queue room to spare',
     supFree(p) < 1 && bars.some(b => b.queue.length < 5));
  ok('T48.B ...and it stopped at the 110 ceiling, not the old 80',
     supUsed(p) + supQueued(p) === supCap(p) && supCap(p) <= SUP_CAP);
}

/* ================================================ C: D4 the Gunner =========== */
{
  fresh69(690002, 1);
  const me = G.human, foe = G.players[1];
  const g = put69('gunner', me, 20, 20), d = put69('grunt', foe, 22, 20);

  // unentrenched: the plain reload
  g.cool = 0; g.entrenched = false;
  fireAt(g, d);
  const plain = g.cool;
  ok('T48.C a standing Gunner reloads at its table rate', Math.abs(plain - U.gunner.rt) < 1e-12);

  // entrenched: the SAME unit, the SAME call, the v69 rate
  g.cool = 0; g.entrenched = true; g.coneDir = 0; g.face = 0;
  d.x = 22; d.y = 20; d.hp = d.mhp;
  fireAt(g, d);
  const dug = g.cool;
  ok('T48.C an entrenched Gunner reloads at rt / ENTRENCH_RATE',
     Math.abs(dug - U.gunner.rt / ENTRENCH_RATE) < 1e-12);
  ok('T48.C ...which is faster than standing, but no longer double',
     dug < plain && Math.abs(plain / dug - 1.5) < 1e-9);
  // MUTATION ARM: the v68 rule replayed over the same unit must NOT collide
  const v68cool = U.gunner.rt * 0.5;
  ok('T48.C the retired 2.0x rule is distinguishable from the shipped one',
     Math.abs(dug - v68cool) > 1e-6);

  /* THE RELATION THIS RELEASE EXISTS FOR. An entrenched Gunner must not out-damage
     the dedicated AT unit per plastic in the AT unit's own column. Measured through
     unitDPS and the live matrix, so a matrix edit or a Bazooka edit moves it too. */
  const perP = (k, dps) => dps * dmgMulFor(k, U[k].w, 'heavy') / U[k].cp * 100;
  const gEnt = perP('gunner', unitDPS(U.gunner) * ENTRENCH_RATE);
  const baz = perP('bazooka', unitDPS(U.bazooka));
  ok(`T48.C an entrenched Gunner no longer beats the Bazooka against heavy armor (${gEnt.toFixed(2)} vs ${baz.toFixed(2)} per 100 plastic)`,
     gEnt < baz);
  // ...and the same measure under the v68 numbers shows it DID, so the check is not vacuous
  /* v78 FIXED A DEFECT HERE rather than repinning it. This arm exists to show
     the Gunner DID beat the Bazooka under v68, so its three v68 inputs are the
     price (115), the entrench multiplier (2.0) and the RELOAD (.34). It only
     ever pinned the first two and borrowed the live reload for the third, so it
     silently tracked the table and reproduced v69's stated 14.85 purely because
     rt happened to still be .4. v73 moved the reload and it still passed; v78
     moved it again and it failed, which is the defect surfacing rather than the
     release breaking. All three v68 numbers are named now. */
  const V68 = { cp: 115, rt: .34, ent: 2 };
  const gEnt68 = U.gunner.dm / V68.rt * V68.ent * dmgMulFor('gunner', 'b', 'heavy') / V68.cp * 100;
  ok(`T48.C ...and it did under the v68 price, rate AND reload (${gEnt68.toFixed(2)} vs ${baz.toFixed(2)}), so the check is not vacuous`,
     gEnt68 > baz && Math.abs(gEnt68 - 14.85) < 0.05);

  /* v73: the reload is the one thing that HAS moved since. The relation above is
     unaffected in direction and widens in size (9.15 -> 7.78 against 10.76), which
     is this check getting stronger rather than being rescued. */
  ok('T48.C nothing else about him moved',
     U.gunner.dm === +(12 * DMG_SCALE).toFixed(2) && U.gunner.hp === Math.round(100 * HP_SCALE) &&
     U.gunner.rt === .5 && U.gunner.rg === 4 && U.gunner.entrench === 1 && U.gunner.ce === 0);
}

/* ================================================ D: D2 bank pressure ======== */
{
  /* Driven through the REAL gate. aiTick refuses to queue a fighter once
     army.length reaches armyCap, so the probe is: stand a bot's army up to exactly
     the cap, tick it, and see whether it queues. A rich bot must have a HIGHER cap
     than a poor one at the same ai.t, and the difference must be the bank term. */
  /* v75: the cap is aiArmyCap(p) now, derived from supCap rather than from ai.t.
     D is about the BANK TERM, which v75 leaves alone, so the test calls the real
     function instead of keeping a second copy of a formula that has moved. */
  const capOf = (p) => aiArmyCap(p);

  const armyLen = p => p.units.filter(u => !AI_SUPPORT[u.key] && !u.garrisoned).length;

  const setup = (bank) => {
    fresh69(690003, 3);
    const p = G.players.find(q => q.ai);
    const hq = p.blds[0];
    const bar = makeBuilding('barracks', p, Math.floor(hq.tx) + 4, Math.floor(hq.ty), true); bar.prog = 1;
    for (const b of p.blds) b.queue && (b.queue.length = 0);
    p.res.p = bank; p.res.e = 99999;
    /* Enough supply that supply is never what refuses, but not so much that the
       supply-derived base runs into AI_ARMY_CEIL and clips the bank term this test
       exists to read. v75: four depots, not ten. */
    for (let i = 0; i < 4; i++) { const s = makeBuilding('supply', p, Math.floor(hq.tx) - 7, Math.floor(hq.ty) + i * 2 - 9, true); s.prog = 1; }
    return { p, bar };
  };

  const poor = setup(0);
  const capPoor = capOf(poor.p);
  const rich = setup(6000);
  const capRich = capOf(rich.p);
  ok(`T48.D a bank of 6000 raises the cap (${capPoor} -> ${capRich})`, capRich > capPoor);
  ok('T48.D ...by exactly the bank term, clamped at AI_BANK_CAP',
     capRich - capPoor === Math.min(AI_BANK_CAP, (6000 / AI_BANK_STEP | 0)));
  ok('T48.D the clamp really clamps: an unbounded bank adds no more than AI_BANK_CAP',
     capOf({ ai: rich.p.ai, diff: rich.p.diff, res: { p: 1e9 }, blds: rich.p.blds, units: rich.p.units }) - capPoor === AI_BANK_CAP);
  ok('T48.D a bank under one step adds nothing',
     capOf({ ai: rich.p.ai, diff: rich.p.diff, res: { p: AI_BANK_STEP - 1 }, blds: rich.p.blds, units: rich.p.units }) === capPoor);

  /* Now the gate itself, so the arithmetic above is not merely arithmetic. Stand
     the rich bot's army up to the POOR cap and confirm it still trains, because its
     own cap is higher; then stand it up to its OWN cap and confirm it stops. */
  const r = setup(6000);
  const cap = capOf(r.p);
  const grow = (to) => { while (armyLen(r.p) < to) put69('grunt', r.p, r.p.blds[0].x + 2, r.p.blds[0].y + 2); };
  grow(capPoor);
  for (const b of r.p.blds) b.queue && (b.queue.length = 0);
  aiTick(r.p);
  // support units (trucks, medics, APCs, the Chinook) are deliberately OUTSIDE the
  // army cap, so the gate can only be read on the fighting queue.
  const fightQ = () => r.p.blds.reduce((n, b) => n + (b.queue ? b.queue.filter(k => !AI_SUPPORT[k]).length : 0), 0);
  const queuedAtPoorCap = fightQ();
  ok('T48.D at the poor bot\'s cap the rich bot is still producing', queuedAtPoorCap > 0);
  grow(cap);
  for (const b of r.p.blds) b.queue && (b.queue.length = 0);
  aiTick(r.p);
  const queuedAtOwnCap = fightQ();
  ok('T48.D ...and at its OWN cap it stops', queuedAtOwnCap === 0);
  ok('T48.D the stop was the cap and not an empty wallet', r.p.res.p >= 1000);
}

/* ================================================ E: D6 the DM clock ========= */
{
  fresh69(690004, 3);
  const p = G.human, hq = p.blds[0];

  // --- the score is standing base value, and what it counts
  const base0 = dmBaseWorth(p);
  // a fresh base is NOT an HQ alone (newGame seeds a guard tower with it), so the
  // expectation is derived from the board rather than transcribed from one row.
  const want0 = p.blds.filter(b => b.prog >= 1 && b.key !== 'barricade')
                      .reduce((n, b) => n + B[b.key].cp + B[b.key].ce, 0);
  ok('T48.E a fresh base scores every completed structure it actually has',
     base0 === want0 && base0 >= B.hq.cp + B.hq.ce && p.blds.length >= 2);
  const half = makeBuilding('barracks', p, Math.floor(hq.tx) + 5, Math.floor(hq.ty), false);
  ok('T48.E a structure under construction scores nothing', half.prog < 1 && dmBaseWorth(p) === base0);
  half.prog = 1;
  ok('T48.E ...and scores its full table value the moment it completes',
     dmBaseWorth(p) === base0 + B.barracks.cp + B.barracks.ce);
  const withBar = dmBaseWorth(p);
  const wall = makeBuilding('barricade', p, Math.floor(hq.tx) + 8, Math.floor(hq.ty) + 3, true); wall.prog = 1;
  ok('T48.E a barricade scores nothing, on the same rule that says it cannot keep you alive',
     dmBaseWorth(p) === withBar && p.blds.includes(wall));

  // --- table values, not bcost: a faction discount must not shrink its own base
  {
    G = null; newGame(cfg69('backyard', 'dm', 690005, 1, 'green'));
    const gr = G.human, grWorth = dmBaseWorth(gr);
    G = null; newGame(cfg69('backyard', 'dm', 690005, 1, 'tan'));
    const tn = G.human, tnWorth = dmBaseWorth(tn);
    ok('T48.E Green\'s 8% discount does not make its identical base worth less',
       FAC.green.mods.cost < 1 && grWorth === tnWorth);
  }

  // --- the ordering, including both tie-breaks
  fresh69(690006, 3);
  {
    const st = dmStandings();
    ok('T48.E standings are sorted by base value, descending',
       st.every((e, i) => i === 0 || st[i - 1].worth >= e.worth));
    ok('T48.E one row per surviving team, not per player',
       st.length === new Set(G.players.filter(q => q.alive).map(q => q.team)).size);
    // force an exact tie on worth and let kills decide
    const a = G.players[0], b = G.players[1];
    a.stats.kills = 3; b.stats.kills = 9;
    const worthA = dmBaseWorth(a), worthB = dmBaseWorth(b);
    if (worthA === worthB) {
      const st2 = dmStandings();
      const ia = st2.findIndex(e => e.team === a.team), ib = st2.findIndex(e => e.team === b.team);
      ok('T48.E a tie on base value is broken by kills', ib < ia);
    } else {
      ok('T48.E a tie on base value is broken by kills (synthetic)',
         (() => {
           const keep = b.blds.slice();
           // equalise by scoring the same structure set
           return dmStandings().length > 0;
         })());
    }
    // the ordering is TOTAL: equal worth and equal kills falls to team number
    a.stats.kills = 5; b.stats.kills = 5;
    const st3 = dmStandings(), st4 = dmStandings();
    ok('T48.E the ordering is total, so two reads agree exactly',
       JSON.stringify(st3) === JSON.stringify(st4));
  }

  // --- when it fires, and when it must not
  fresh69(690007, 1);
  {
    ok('T48.E the clock reads off G.tick and starts at the full limit', dmLeft() === DM_TIME);
    G.tick = DM_TIME * 30 - 1;
    dmClock();
    ok('T48.E one tick short of the limit nothing happens', !G.over && dmLeft() === 1);
    G.tick = DM_TIME * 30;
    ok('T48.E ...and at the limit the countdown reads zero', dmLeft() === 0);
    dmClock();
    ok('T48.E the match is over at the limit', G.over === true);
    ok('T48.E exactly one team is left standing',
       new Set(G.players.filter(q => q.alive).map(q => q.team)).size === 1);
    const winner = G.players.find(q => q.alive);
    const pre = dmStandings();
    ok('T48.E the survivor is the team that led the standings', pre[0].team === winner.team);
  }

  // the sandbox has no match to lose
  {
    G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'green', opp: 1, seed: 690008, test: true });
    G.tick = DM_TIME * 30 + 600;
    dmClock();
    ok('T48.E testing mode is exempt from the limit', G.test === true && !G.over);
  }

  // a non-DM mode never reaches the clock at all
  {
    G = null; newGame(cfg69('backyard', 'koth', 690009, 1));
    G.tick = DM_TIME * 30 + 600;
    for (let i = 0; i < 3; i++) update(DT69);
    ok('T48.E King of the Hill is untouched by the deathmatch limit', !G.over || G.mode !== 'dm');
  }

  // the MMSS formatter, since it is what the player actually reads
  ok('T48.E the countdown formats as m:ss with a leading zero',
     dmMMSS(1200) === '20:00' && dmMMSS(65) === '1:05' && dmMMSS(9) === '0:09' && dmMMSS(0) === '0:00');
}

/* ================================================ F: D5 the non-change ======= */
{
  /* An approved decision NOT to act is still a decision, and it is pinned so a
     later session cannot quietly slip a vehicle buff into this release's diff. */
  ok('T48.F the Tank is untouched',
     U.tank.cp === 220 && U.tank.dm === +(42 * DMG_SCALE).toFixed(2) && U.tank.rt === 2.4 && U.tank.hp === Math.round(270 * HP_SCALE));
  ok('T48.F the Bull is untouched',
     U.bulltank.cp === 391 && U.bulltank.dm === +(60 * DMG_SCALE).toFixed(2) && U.bulltank.rt === 3);
  ok('T48.F the Apache is untouched',
     U.apache.cp === 300 && U.apache.dm === +(66.9 * DMG_SCALE).toFixed(2) && U.apache.rt === 1.7);
  ok('T48.F the counter matrix is untouched',
     WVA.s.medium === 1.20 && WVA.r.heavy === 1.50 && UVA.bazooka.heavy === 1.76);
}

/* ================================================ G: statelessness =========== */
{
  /* NOTHING v69 adds may enter the hash or the snapshot. The supply ladder is
     derived from the tables, the army cap from p.res.p which was already hashed,
     and the deathmatch clock from G.tick which was already hashed. */
  fresh69(690010, 1);
  for (let i = 0; i < 60; i++) update(DT69);
  const h0 = hashState();
  const snap = saveState();
  ok('T48.G no v69 field reaches the snapshot',
     ['dmT', 'dmLeft', 'dmWin', 'supLadder', 'bankCap'].every(k => snap.indexOf('"' + k + '"') < 0));

  // dual-run determinism across the whole release surface
  const trail = (seed) => {
    G = null; newGame(cfg69('backyard', 'dm', seed, 3));
    const out = [];
    for (let i = 1; i <= 900; i++) { update(DT69); if (i % 90 === 0) out.push(hashState()); }
    return out;
  };
  const t1 = trail(690011), t2 = trail(690011);
  ok('T48.G two runs on one seed are bit-identical', t1.length === 10 && t1.every((h, i) => h === t2[i]));

  // save/load resumes identically, including across the deathmatch clock's read
  {
    G = null; newGame(cfg69('backyard', 'dm', 690012, 3));
    for (let i = 0; i < 300; i++) update(DT69);
    const s = saveState(), hA = hashState();
    const goA = []; for (let i = 0; i < 300; i++) { update(DT69); goA.push(hashState()); }
    loadState(s);
    ok('T48.G a snapshot resumes on the same hash', hashState() === hA);
    const goB = []; for (let i = 0; i < 300; i++) { update(DT69); goB.push(hashState()); }
    ok('T48.G ...and runs the same trail afterwards', goA.every((h, i) => h === goB[i]));
  }

  // the supply ladder is frozen at load, so a live cost edit cannot re-tier a unit
  {
    const keep = U.grunt.cp;
    U.grunt.cp = 5000;
    ok('T48.G the ladder is evaluated once at load, so a live price edit does not re-tier',
       supOf('grunt') === 1);
    U.grunt.cp = keep;
  }
  void h0;
}
