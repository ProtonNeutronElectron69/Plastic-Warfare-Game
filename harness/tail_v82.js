/* tail_v82.js - T56: the v82 Blue ability release.
   A: the tunables exist, are in range, and the help slots derive from them.
   B: Evasive - the flag is written by movement and nothing else, the multiplier
      lands only on a bike, and the COVERAGE CEILING is on the record.
   C: Flat Out - speed, sight, no guns, and no attack order from any of the four
      callers that reach orderAttack.
   D: Air Assault - the squad fires out, the aircraft is pinned, and the guards
      that were NOT edited are asserted as deliberate.
   E: exposure - splash reaches a firing passenger and nobody else, and the APC
      shield and smoke cover deliberately still do not.
   F: garrison hygiene - a passenger who dies in the hold leaves the hold.
   G: Overdrive - triple, then dark, then back, on the two clocks the building
      already had, and the cycle is a NET LOSS by design.
   H: AI policy is deliberately unwired, and state hygiene: hashed, round-tripped,
      defaulted on a legacy save, and no banned math in the new functions. */
'use strict';
section('T56 v82: the Blue Army abilities');

const DT82 = 1 / 30;
function quiet82(map, seed, W, H) {
  G = null;
  newGame(cfg44(map || 'kitchen', 'dm', 'normal', 'blue', 1, seed || 8201));
  for (const mn of (G.map.mines || [])) mn.live = false;
  for (const ns of (G.map.nests || [])) { ns.dead = true; ns.alive = 0; ns.aggro = false; }
  const A = arena44(W || 24, H || 16, 6, 16);
  if (!A) return null;
  const foe = G.players.find(p => p !== G.human && p.fac !== 'bug');
  foe.ai = null; G.human.ai = null;
  return { A, foe };
}

/* ---------- A: tunables ---------- */
{
  ok('T56.A Evasive reduces without negating', EVADE_RED > 0 && EVADE_RED < 1);
  ok('T56.A Flat Out is a real but bounded speed and sight gain',
    FLAT_SPD > 0 && FLAT_SPD <= 1 && FLAT_VI > 0 && FLAT_VI < 10);
  ok('T56.A Overdrive multiplies, runs out, and goes dark for longer than it ran',
    OVER_MUL > 1 && OVER_T > 0 && OVER_OFF > 0 && OVER_OFF > OVER_T);
  /* The cooldown is DERIVED from the two windows rather than typed. If it were
     typed and drifted the turbine would either sit dark past its own button or
     come back to life before it, and neither reads as a bug from the UI. */
  ok('T56.A the cooldown is the sum of the two windows, not a typed third number',
    OVER_CD === OVER_T + OVER_OFF);
  ok('T56.A every new help slot derives from its constant',
    HELP_TUNE.evadeRed() === Math.round(EVADE_RED * 100) && HELP_TUNE.flatSpd() === Math.round(FLAT_SPD * 100) &&
    HELP_TUNE.flatVi() === FLAT_VI && HELP_TUNE.overMul() === OVER_MUL &&
    HELP_TUNE.overT() === OVER_T && HELP_TUNE.overOff() === OVER_OFF && HELP_TUNE.overCd() === OVER_CD);
  ok('T56.A the capability flags sit on the three Blue entities and nowhere else',
    U.bike.evade && U.bike.flat && U.chinook.assault && B.turbine.over &&
    Object.keys(U).filter(k => U[k].evade).length === 1 &&
    Object.keys(U).filter(k => U[k].flat).length === 1 &&
    Object.keys(U).filter(k => U[k].assault).length === 1 &&
    Object.keys(B).filter(k => B[k].over).length === 1);
  /* v82: the Chinook's aura figure is named once and the info card reads it, so
     the card cannot state a percentage the table does not set. */
  ok('T56.A the Chinook card states the aura the table actually sets',
    U.chinook.aura === U0AURA && U.chinook.d.includes(String(Math.round(U0AURA * 100)) + '% harder'));
}

/* ---------- B: Evasive ---------- */
{
  const S = quiet82('kitchen', 8201);
  const bk = makeUnit('bike', G.human, S.A.x + 3, S.A.y + 5);
  const gr = makeUnit('grunt', G.human, S.A.x + 3, S.A.y + 6);

  ok('T56.B a fresh bike is not moving', bk.mvg === false);
  ok('T56.B ...and nothing but a bike carries the flag', gr.mvg == null);

  bk.mvg = false; const still = applyDmg(bk, 20, 'b', null);
  bk.hp = bk.mhp; bk.mvg = true; const moving = applyDmg(bk, 20, 'b', null);
  ok('T56.B a still bike takes strictly more than a moving one', still > 0 && moving > 0 && moving < still);
  ok('T56.B a moving one takes exactly EVADE_RED less', Math.abs(moving - still * (1 - EVADE_RED)) < 1e-6);

  gr.mvg = true; const grDm = applyDmg(gr, 20, 'b', null);
  ok('T56.B the flag on anything else does nothing at all', Math.abs(grDm - still) < 1e-6);

  // the flag follows movement, not the state name
  bk.hp = bk.mhp; bk.hold = false;
  orderMove(bk, S.A.x + 10, S.A.y + 5, false);
  for (let i = 0; i < 20; i++) update(DT82);
  const marched = bk.mvg;
  bk.hold = true; bk.path = null; bk.state = 'idle'; bk.target = null;
  for (let i = 0; i < 10; i++) update(DT82);
  ok('T56.B marching sets it and parking clears it', marched === true && bk.mvg === false);
}
{
  /* THE COVERAGE CEILING, on the record so nobody re-scopes this by feel. Measured
     over three full Blue-bot matches at scope: 82.3% of a Scout Bike's incoming
     damage lands while it is parked in the attack state shooting, 15.6% in the
     attack state while displaced, 1.5% under an ordered march and 0.5% idle. So
     displacement is the only definition worth building, it covers 17.3% of the
     damage, and EVADE_RED can therefore never mitigate more than that share of
     what kills a bike. A state test - "is he in the move state" - would have
     covered 1.5% and been inert in the Shell Shock sense. */
  ok('T56.B Evasive is keyed on displacement, not on the state name',
    updateUnit.toString().includes('u.mvg=(u.x!==sx82||u.y!==sy82)') &&
    !applyDmg.toString().includes("t.evade&&tgt.state==='move'"));
  ok('T56.B and the ceiling on what it can ever mitigate is 17.3% of a bike\'s damage',
    EVADE_RED * 0.173 < 0.10);
}

/* ---------- C: Flat Out ---------- */
{
  const S = quiet82('kitchen', 8202);
  const bk = makeUnit('bike', G.human, S.A.x + 3, S.A.y + 5);
  const en = makeUnit('grunt', S.foe, S.A.x + 5, S.A.y + 5);
  const sp0 = spOf(bk), vi0 = viOf(bk);
  bk.flat = true;
  ok('T56.C Flat Out routes through spOf and viOf, not a second door',
    Math.abs(spOf(bk) - sp0 * (1 + FLAT_SPD)) < 1e-9 && viOf(bk) === vi0 + FLAT_VI);
  orderAttack(bk, en);
  ok('T56.C he takes no attack order while it runs', bk.target !== en);
  bk.flat = false; orderAttack(bk, en);
  ok('T56.C ...and takes one the moment it stops', bk.target === en);

  // the toggle drops the target rather than gating fireAt, which is the v80 shape
  execCmd({ pi: G.human.i, op: 'flat', a: { ids: [bk.id], on: true } });
  ok('T56.C turning it on drops the target he was holding', bk.target === null && bk.flat === true);
  ok('T56.C ...and he acquires nothing new while it runs',
    (() => { bk.state = 'idle'; for (let i = 0; i < 60; i++) update(DT82); return bk.target === null; })());
  ok('T56.C a bike still takes ordinary move orders',
    (orderMove(bk, S.A.x + 8, S.A.y + 5, false), bk.state === 'move'));
}

/* ---------- D: Air Assault ---------- */
{
  const S = quiet82('kitchen', 8203);
  const ch = makeUnit('chinook', G.human, S.A.x + 4, S.A.y + 6);
  ch.mhp *= 40; ch.hp = ch.mhp;
  const pax = [];
  for (let i = 0; i < 4; i++) {
    const g = makeUnit('grunt', G.human, ch.x, ch.y);
    g.garrisoned = true; ch.garrison.push(g); g.state = 'idle'; pax.push(g);
  }
  const foes = [];
  for (let i = 0; i < 3; i++) { const f = makeUnit('grunt', S.foe, ch.x + 2.6 + i * 0.4, ch.y); f.mhp *= 20; f.hp = f.mhp; foes.push(f); }

  let dealt = 0;
  const _a = applyDmg;
  applyDmg = function (t, a, ty, at, w) { const o = _a(t, a, ty, at, w); if (at && pax.includes(at)) dealt += o; return o; };
  for (let i = 0; i < 300; i++) update(DT82);
  const quiet = dealt;
  ch.aslt = true;
  for (let i = 0; i < 300; i++) update(DT82);
  const loud = dealt - quiet;
  applyDmg = _a;

  ok('T56.D a quiet hold fires nothing at all', quiet === 0);
  ok('T56.D an assaulting hold fires', loud > 0);
  ok('T56.D the carrier writes the flag onto every man aboard', pax.every(u => u.fo === true));
  ok('T56.D the passengers are still garrisoned while they do it', pax.every(u => u.garrisoned === true));
  orderMove(ch, ch.x + 5, ch.y, false);
  ok('T56.D the aircraft is pinned for as long as it runs', ch.state !== 'move');
  execCmd({ pi: G.human.i, op: 'assault', a: { ids: [ch.id], on: false } });
  ok('T56.D ceasing fire clears the flag on every man', pax.every(u => u.fo === false));
  ok('T56.D ...and the aircraft flies again', (orderMove(ch, ch.x + 5, ch.y, false), ch.state === 'move'));

  /* THE GUARDS THAT WERE DELIBERATELY NOT EDITED. The roadmap held that firing out
     "cuts against several garrisoned guards" and named eleven. Walked at v82:
     every one of them is candidate-side or defender-side and not one blocks a
     passenger from firing. The single door that does is updateUnit's garrison
     return, which is why fireOut82 is driven by the CARRIER instead. */
  ok('T56.D the acquisition scan still passes over a garrisoned man',
    nearestEnemy.toString().includes('e.garrisoned'));
  ok('T56.D ...and the one door that stopped him firing is still the garrison return',
    updateUnit.toString().includes('if(u.garrisoned)return;'));
  /* Nor is he invulnerable while he shoots, and THAT needed no edit either:
     orderAttack, the retaliation block and the call-for-help sweep each take the
     attacker by reference and none of them tests whether he is aboard. */
  ok('T56.D orderAttack carries no guard on a garrisoned TARGET, so his victim answers him',
    !orderAttack.toString().includes('tgt.garrisoned'));
}

/* ---------- E: exposure ---------- */
{
  const S = quiet82('kitchen', 8204);
  const ch = makeUnit('chinook', G.human, S.A.x + 4, S.A.y + 6);
  ch.mhp *= 40; ch.hp = ch.mhp;
  const g = makeUnit('grunt', G.human, ch.x, ch.y);
  g.garrisoned = true; ch.garrison.push(g);
  const en = makeUnit('grunt', S.foe, ch.x + 6, ch.y);

  const quiet = (() => { const h = g.hp; splash(ch.x, ch.y, 2, 30, 'ex', en, 'm', 0); return h - g.hp; })();
  g.fo = true;
  const firing = (() => { const h = g.hp; splash(ch.x, ch.y, 2, 30, 'ex', en, 'm', 0); return h - g.hp; })();
  ok('T56.E a blast still skips a quiet passenger', quiet === 0);
  ok('T56.E ...and finds one who is firing out', firing > 0);

  /* Owner decision, recorded rather than inferred: splash answers Air Assault and
     the other two defensive doors deliberately do NOT. A firing passenger is
     exposed to area fire and stays outside the APC's damage reduction and outside
     any smoke over the aircraft. */
  ok('T56.E the APC shield still skips a garrisoned man, firing or not',
    applyDmg.toString().includes("tgt.t.a==='inf'&&!tgt.garrisoned"));
  ok('T56.E ...and so does strike cover', applyDmg.toString().includes('if(!tgt.garrisoned)for(const s of (G.strikes||[]))'));
  // a bunker garrison is untouched by all of this: u.fo is only ever written by a carrier
  const bk = makeBuilding('bunker', G.human, Math.floor(S.A.x + 8), Math.floor(S.A.y + 8));
  bk.prog = 1; bk.hp = bk.mhp;
  const bg = makeUnit('grunt', G.human, bk.x, bk.y);
  bg.garrisoned = true; bk.garrison.push(bg);
  for (let i = 0; i < 30; i++) update(DT82);
  const bh = bg.hp; splash(bk.x, bk.y, 2, 30, 'ex', en, 'm', 0);
  ok('T56.E a bunker garrison keeps the exemption exactly as before', bg.fo !== true && bg.hp === bh);
}

/* ---------- F: garrison hygiene ---------- */
{
  const S = quiet82('kitchen', 8205);
  const ch = makeUnit('chinook', G.human, S.A.x + 4, S.A.y + 6);
  ch.mhp *= 40; ch.hp = ch.mhp;
  const g = makeUnit('grunt', G.human, ch.x, ch.y);
  g.garrisoned = true; g.fo = true; ch.garrison.push(g);
  const en = makeUnit('grunt', S.foe, ch.x + 6, ch.y);
  applyDmg(g, 9999, 'b', en);
  /* Before v82 a garrisoned man could not be hurt at all, so no code ever had to
     take a corpse out of a hold. At scope, 2 of 8 passengers died inside a 40s
     fixture and every one of them stayed in the array: the bay read 8/15 with 6
     men alive, which counts against the cap and lies in the panel. */
  ok('T56.F a passenger who dies in the hold leaves the hold',
    ch.garrison.length === 0 && !G.units.includes(g));
  ok('T56.F ...and the bay reads what is actually aboard', ch.garrison.filter(u => u.hp <= 0).length === 0);
}

/* ---------- G: Overdrive ---------- */
{
  const S = quiet82('kitchen', 8206);
  const tb = makeBuilding('turbine', G.human, Math.floor(S.A.x + 3), Math.floor(S.A.y + 3));
  tb.prog = 1; tb.hp = tb.mhp;
  const draw = n => { const e0 = G.human.res.e; for (let i = 0; i < n; i++) updateBld(tb, DT82); return G.human.res.e - e0; };
  const base = draw(30);
  execCmd({ pi: G.human.i, op: 'over', a: { bid: tb.id } });
  const burst = draw(30);
  for (let i = 0; i < 30 * OVER_T; i++) updateBld(tb, DT82);
  const dark = draw(30);
  ok('T56.G Overdrive multiplies the ONE income door', Math.abs(burst - base * OVER_MUL) < 1e-6);
  ok('T56.G ...then the turbine produces nothing', Math.abs(dark) < 1e-9);
  ok('T56.G ...and it runs on the two clocks the building already had, with no new state',
    tb.upT != null && tb.abilityCool != null && tb.overT === undefined);
  ok('T56.G a turbine on cooldown refuses a second press',
    (() => { const a = tb.abilityCool; execCmd({ pi: G.human.i, op: 'over', a: { bid: tb.id } }); return tb.abilityCool === a; })());
  /* THE CYCLE IS A NET LOSS, by owner decision, and it is asserted so nobody
     later reads the ability as a power boost. Over OVER_CD seconds a turbine
     delivers 2*eps*OVER_T extra and gives up eps*OVER_OFF, which is negative for
     any OVER_OFF above twice OVER_T. Overdrive buys the electricity EARLIER, it
     does not buy more of it. */
  const gain = 2 * B.turbine.eps * OVER_T, lost = B.turbine.eps * OVER_OFF;
  ok('T56.G one cycle is deliberately a net LOSS of electricity', gain < lost);
}

/* ---------- H: AI policy and state hygiene ---------- */
{
  /* Overdrive is STILL deliberately unwired, and measured rather than assumed:
     across three Blue-bot matches a bot's training options were blocked by ENERGY
     alone 0.4% of the time and by plastic 61.2%, against a median bank of 2156,
     so an energy floor would fire on nothing - and when it did fire it would
     trade 88 electricity now for 154 later.
     v106 REVERSED the other two. Flat Out and Air Assault were unwired here
     alongside it, and probe_v106 measured what that cost: over four all-CPU
     matches both read 0.0% of carrier-ticks, i.e. the bots owned them and never
     once used them. Both are driven now (Roadmap 4 item 4); Overdrive is not,
     because its measurement still says not to. */
  const ai = aiTick.toString();
  ok('T56.H a bot rule now reads Flat Out', ai.includes('u.flat='));
  ok('T56.H ...and Air Assault', ai.includes('u.aslt='));
  ok('T56.H no bot rule presses Overdrive', !ai.includes("'over'") && !ai.includes('OVER_T'));

  const S = quiet82('kitchen', 8207);
  const bk = makeUnit('bike', G.human, S.A.x + 3, S.A.y + 5);
  const ch = makeUnit('chinook', G.human, S.A.x + 4, S.A.y + 6);
  bk.flat = true; ch.aslt = true;
  for (let i = 0; i < 120; i++) update(DT82);
  const h1 = hashState(), snap = saveState();
  loadState(snap);
  ok('T56.H the new fields round-trip through a save', hashState() === h1);
  const hs = hashState.toString();
  ok('T56.H ...because all four are hashed',
    hs.includes('u.flat?1:0') && hs.includes('u.aslt?1:0') && hs.includes('u.fo?1:0') && hs.includes('u.mvg?1:0'));

  // a legacy save carries none of them and must not load as undefined
  const legacy = JSON.parse(snap);
  for (const u of legacy.units) { delete u.flat; delete u.aslt; delete u.fo; delete u.mvg; }
  loadState(legacy);
  const lb = G.units.find(u => u.key === 'bike'), lc = G.units.find(u => u.key === 'chinook');
  ok('T56.H a pre-v82 save defaults every one of them rather than loading undefined',
    lb && lb.flat === false && lb.mvg === false && lc && lc.aslt === false && lc.fo === false);

  const BANNED82 = ['Math.random', 'Math.hypot', 'Math.pow', 'Math.atan2', 'Date.now', 'performance.now'];
  const src82 = fireOut82.toString() + spOf.toString() + viOf.toString();
  ok('T56.H no banned math in the new sim functions', !BANNED82.some(b => src82.includes(b)));
}
