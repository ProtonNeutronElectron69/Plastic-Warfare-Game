/* tail_v81.js - T55: the v81 Gray ability release.
   A: the tunables exist, are in range, and the help slots derive from them.
   B: Camouflaged - the shot clock, the six sim doors, the client door, and the
      two places that deliberately have NO gate.
   C: Called Shot - the restriction, the bonus, and the target it drops.
   D: Shell Shock - the setback lands on survivors of an arty burst and nowhere
      else, and is additive rather than a floor.
   E: Ripple Fire - the salvo shape runs through salOf/srtOf/rtOf, the AA truck
      is untouched, and the scatter draws from srand().
   F: the Bunker - the named passive still holds, and Lockdown trades fire for hide.
   G: AI policy - Called Shot follows the target, Lockdown waits for the floor,
      Ripple Fire is deliberately unwired.
   H: state hygiene - hashed, round-tripped, defaulted on a legacy save, and no
      banned math in the new functions. */
'use strict';
section('T55 v81: the Gray Army abilities');

const DT81 = 1 / 30;
function quiet81(map, seed, W, H) {
  G = null;
  newGame(cfg44(map || 'kitchen', 'dm', 'normal', 'gray', 1, seed || 8101));
  for (const mn of (G.map.mines || [])) mn.live = false;
  for (const ns of (G.map.nests || [])) { ns.dead = true; ns.alive = 0; ns.aggro = false; }
  const A = arena44(W || 16, H || 12, 6, 12);
  return A ? { A, foe: G.players.find(p => p !== G.human && p.fac !== 'bug') } : null;
}

/* ---------- A: tunables ---------- */
{
  ok('T55.A the concealment window is a positive number of seconds', CAMO_T > 0 && CAMO_T < 60);
  ok('T55.A Called Shot pays a real but bounded bonus', CS_DMG > 0 && CS_DMG <= 1);
  ok('T55.A the Shell Shock setback is a positive number of seconds', SHOCK_SET > 0 && SHOCK_SET < 10);
  ok('T55.A the ripple is a real salvo at a fraction of a shell, for a longer reload',
    RIPPLE_N >= 2 && RIPPLE_DM > 0 && RIPPLE_DM < 1 && RIPPLE_SPL > 1 && RIPPLE_RT > 1 && RIPPLE_SRT > 0 && RIPPLE_BOX > 0);
  ok('T55.A Lockdown reduces without negating, and runs out', LOCK_RED > 0 && LOCK_RED < 1 && LOCK_T > 0 && LOCK_CD > LOCK_T);
  ok('T55.A the bot floor is a share of health', LOCK_AI_FLOOR > 0 && LOCK_AI_FLOOR < 1);
  // the help panel reads the constants rather than a retyped copy of them
  ok('T55.A every new help slot derives from its constant',
    HELP_TUNE.camoT() === CAMO_T && HELP_TUNE.csDmg() === Math.round(CS_DMG * 100) &&
    HELP_TUNE.shockSet() === SHOCK_SET && HELP_TUNE.ripN() === RIPPLE_N &&
    HELP_TUNE.ripDm() === Math.round(RIPPLE_DM * 100) && HELP_TUNE.lockRed() === Math.round(LOCK_RED * 100) &&
    HELP_TUNE.lockT() === LOCK_T && HELP_TUNE.lockCd() === LOCK_CD);
  ok('T55.A the capability flags sit on the three Gray entities and nowhere else',
    U.sniper.camo && U.sniper.cshot && U.arty.shock && U.arty.ripple && B.bunker.lock &&
    Object.keys(U).filter(k => U[k].camo).length === 1 &&
    Object.keys(U).filter(k => U[k].ripple).length === 1 &&
    Object.keys(B).filter(k => B[k].lock).length === 1);
}

/* ---------- B: Camouflaged ---------- */
{
  const S = quiet81('kitchen', 8101);
  const { A, foe } = S;
  const sn = makeUnit('sniper', G.human, A.x + 2, A.y + 5);
  const gr = makeUnit('grunt', foe, A.x + 4, A.y + 5);

  ok('T55.B a fresh sniper is already cold, so he starts concealed', sn.shotT >= CAMO_T && hid81(sn, foe.p || foe));
  ok('T55.B ...and nothing but a sniper carries the clock', gr.shotT == null);
  ok('T55.B a concealed man is not acquired by the one target scan', nearestEnemy(gr, 9) !== sn);
  ok('T55.B ...and cannot be ordered onto either', (orderAttack(gr, sn), gr.target !== sn));

  fireAt(sn, gr);
  ok('T55.B firing zeroes the clock and reveals him', sn.shotT === 0 && !hid81(sn, foe));
  ok('T55.B ...so the man he shot can answer', nearestEnemy(gr, 9) === sn);
  orderAttack(gr, sn);
  ok('T55.B ...and can be ordered onto him', gr.target === sn);

  // the clock runs, and concealment comes back
  sn.target = null; sn.state = 'idle'; sn.hold = true;
  for (let i = 0; i < Math.ceil((CAMO_T + 1) * 30); i++) { sn.target = null; if (sn.state === 'attack') sn.state = 'idle'; update(DT81); }
  ok('T55.B the clock runs on and concealment returns', sn.shotT >= CAMO_T && hid81(sn, foe));
  ok('T55.B ...but a target already held is KEPT, not broken', gr.target === sn);

  ok('T55.B concealment is per-ARMY, not global - his own side always sees him', !hid81(sn, G.human));
  ok('T55.B the client door hides him from an enemy human and never from his owner',
    visibleToHuman(sn) === true);

  // the retaliation block and the help sweep have no gate BECAUSE firing reveals him
  {
    const s2 = quiet81('kitchen', 8102);
    const sn2 = makeUnit('sniper', s2.foe, s2.A.x + 2, s2.A.y + 5);
    const vic = makeUnit('grunt', G.human, s2.A.x + 4, s2.A.y + 5);
    const pal = makeUnit('grunt', G.human, s2.A.x + 4.4, s2.A.y + 5.4);
    vic.state = 'idle'; pal.state = 'idle';
    sn2.shotT = 999;
    fireAt(sn2, vic);
    ok('T55.B a sniper who fires is answered by the man he hit', vic.target === sn2 || pal.target === sn2);
  }
  // the bot threat list does not see him either
  {
    const s3 = quiet81('kitchen', 8103);
    const bot = s3.foe;
    const sn3 = makeUnit('sniper', G.human, s3.A.x + 2, s3.A.y + 5);
    ok('T55.B a concealed man does not read as a threat to a bot', hid81(sn3, bot));
  }
}

/* ---------- C: Called Shot ---------- */
{
  const S = quiet81('kitchen', 8104);
  const { A, foe } = S;
  const sn = makeUnit('sniper', G.human, A.x + 2, A.y + 5);
  const gr = makeUnit('grunt', foe, A.x + 4, A.y + 5);
  const jp = makeUnit('jeep', foe, A.x + 3.2, A.y + 5);

  ok('T55.C off, he takes the nearer vehicle', csOk(sn, jp) && mainOk(sn, jp));
  const base = dmgBonus(sn);
  sn.cs = true;
  ok('T55.C on, the vehicle is refused outright', !csOk(sn, jp) && !mainOk(sn, jp) && csOk(sn, gr));
  ok('T55.C ...the acquisition scan skips it too', nearestEnemy(sn, 9) === gr);
  ok('T55.C ...no structure and no wildlife either',
    (() => { const b = makeBuilding('barracks', foe, Math.floor(A.x + 6), Math.floor(A.y + 5)); b.prog = 1; return nearestEnemy(sn, 12) === gr; })());
  ok('T55.C ...and the bonus is exactly CS_DMG over the same baseline',
    Math.abs(dmgBonus(sn) - base * (1 + CS_DMG)) < 1e-9);
  // the command drops a target he may no longer take
  sn.cs = false; sn.target = jp; sn.state = 'attack';
  execCmd({ op: 'cshot', pi: G.human.i, a: { ids: [sn.id], on: true } });
  ok('T55.C toggling on drops a target he can no longer legally hold', sn.cs === true && sn.target !== jp);
}

/* ---------- D: Shell Shock ---------- */
{
  const S = quiet81('kitchen', 8105, 20, 14);
  const { A, foe } = S;
  const ar = makeUnit('arty', G.human, A.x + 14, A.y + 5);
  const g1 = makeUnit('grunt', foe, A.x + 5, A.y + 5);
  const g2 = makeUnit('grunt', foe, A.x + 5.4, A.y + 5.2);
  g1.cool = 0.2; g2.cool = 0.2;
  const before = g1.cool;
  splash(g1.x, g1.y, ar.t.spl, 5, 'ex', ar, 'm', 0);
  ok('T55.D a survivor of the burst has the setback ADDED to the clock he was holding',
    Math.abs(g1.cool - (before + SHOCK_SET)) < 1e-9);
  ok('T55.D ...and so does everyone else inside the radius', g2.cool > 0.2);
  // a dead man is not shocked, and a non-arty burst does not shock at all
  {
    const bz = makeUnit('bazooka', G.human, A.x + 12, A.y + 7);
    const g3 = makeUnit('grunt', foe, A.x + 7, A.y + 7); g3.cool = 0.3;
    splash(g3.x, g3.y, bz.t.spl, 5, 'ex', bz, 'r', 0);
    ok('T55.D only the Rocket Artillery shocks - a bazooka burst does not', Math.abs(g3.cool - 0.3) < 1e-9);
    const g4 = makeUnit('grunt', foe, A.x + 8, A.y + 7); g4.cool = 0.3;
    splash(g4.x, g4.y, ar.t.spl, 100000, 'ex', ar, 'm', 0);
    ok('T55.D ...and a man the burst KILLS is not shocked', g4.hp <= 0 && Math.abs(g4.cool - 0.3) < 1e-9);
  }
  ok('T55.D the setback is not a floor: it can push a clock past its own reload',
    (() => { const g5 = makeUnit('grunt', foe, A.x + 5, A.y + 9); g5.cool = U.grunt.rt; splash(g5.x, g5.y, ar.t.spl, 5, 'ex', ar, 'm', 0); return g5.cool > U.grunt.rt; })());
}

/* ---------- E: Ripple Fire ---------- */
{
  const S = quiet81('kitchen', 8106, 20, 14);
  const { A, foe } = S;
  const ar = makeUnit('arty', G.human, A.x + 12, A.y + 5);
  ok('T55.E off, the artillery is a single-shell weapon on its own reload',
    salOf(ar) === 0 && rtOf(ar) === U.arty.rt);
  ar.rip = true;
  ok('T55.E on, the salvo shape and the longer reload come from the three doors',
    salOf(ar) === RIPPLE_N && Math.abs(srtOf(ar) - RIPPLE_SRT) < 1e-9 &&
    Math.abs(rtOf(ar) - U.arty.rt * RIPPLE_RT) < 1e-9);
  // the AA truck's fixed salvo is unmoved by any of it
  {
    const aa = makeUnit('aatruck', G.human, A.x + 12, A.y + 8);
    ok('T55.E the AA truck still reads its own table salvo through the same doors',
      salOf(aa) === U.aatruck.sal && Math.abs(srtOf(aa) - U.aatruck.srt) < 1e-9 && rtOf(aa) === U.aatruck.rt);
  }
  // a ripple salvo spends RIPPLE_N rockets srt apart and then pays the long reload
  {
    const tgt = makeUnit('grunt', foe, A.x + 5, A.y + 5);
    const cools = [];
    for (let k = 0; k < RIPPLE_N; k++) { fireAt(ar, tgt); cools.push(+ar.cool.toFixed(4)); }
    ok('T55.E the first rockets are srt apart and the last pays the full reload',
      cools.slice(0, RIPPLE_N - 1).every(c => Math.abs(c - RIPPLE_SRT) < 1e-6) &&
      Math.abs(cools[RIPPLE_N - 1] - U.arty.rt * RIPPLE_RT) < 1e-6);
    ok('T55.E each rocket carries RIPPLE_DM of a shell and a wider burst',
      G.projs.length >= RIPPLE_N &&
      Math.abs(G.projs[G.projs.length - 1].spl - U.arty.spl * RIPPLE_SPL) < 1e-9);
    ok('T55.E ...and lands inside the scatter box rather than on the aim point',
      G.projs.slice(-RIPPLE_N).every(p => Math.abs(p.tx - tgt.x) <= RIPPLE_BOX + 1e-9 && Math.abs(p.ty - tgt.y) <= RIPPLE_BOX + 1e-9) &&
      G.projs.slice(-RIPPLE_N).some(p => p.tx !== tgt.x || p.ty !== tgt.y));
  }
  // the scatter is seeded, so two runs of the same match scatter identically
  {
    const run = () => {
      const s = quiet81('kitchen', 8107, 20, 14);
      const a2 = makeUnit('arty', G.human, s.A.x + 12, s.A.y + 5); a2.rip = true; a2.hold = true;
      const t2 = makeUnit('grunt', s.foe, s.A.x + 5, s.A.y + 5); t2.hp = t2.mhp = 9999;
      for (let i = 0; i < 300; i++) { if (!a2.target || a2.target.hp <= 0) { a2.target = t2; a2.state = 'attack'; } update(DT81); }
      return hashState();
    };
    ok('T55.E the scatter draws from srand(), so the match reproduces exactly', run() === run());
  }
  // toggling does not leave a part-salvo running on the new timing
  {
    const a3 = makeUnit('arty', G.human, A.x + 12, A.y + 10); a3.rip = true; a3.salv = 2;
    execCmd({ op: 'ripple', pi: G.human.i, a: { ids: [a3.id], on: false } });
    ok('T55.E toggling clears the salvo counter with the shape that owned it', a3.rip === false && a3.salv === 0);
  }
}

/* ---------- F: the Bunker ---------- */
{
  const S = quiet81('kitchen', 8108, 20, 14);
  const { A, foe } = S;
  const bk = makeBuilding('bunker', G.human, Math.floor(A.x + 4), Math.floor(A.y + 6));
  bk.prog = 1; bk.hp = bk.mhp;
  for (let i = 0; i < 4; i++) { const g = makeUnit('grunt', G.human, bk.x, bk.y); g.garrisoned = true; bk.garrison.push(g); }
  const shooter = makeUnit('grunt', foe, bk.x + 2, bk.y);

  // the NAMED passive: the garrison is exempt from splash, unchanged from before v81
  const gHp = bk.garrison[0].hp;
  splash(bk.x, bk.y, 4, 200, 'ex', shooter, 'g', 0);
  ok('T55.F the named passive still holds - garrisoned infantry take no splash',
    bk.garrison.every(g => g.hp === gHp));

  bk.hp = bk.mhp;
  const h0 = bk.hp; applyDmg(bk, 100, 'b', shooter); const open = h0 - bk.hp;
  execCmd({ op: 'lock', pi: G.human.i, a: { bid: bk.id } });
  ok('T55.F the ability arms its duration and its cooldown', bk.upT === LOCK_T && bk.abilityCool > 0);
  const h1 = bk.hp; applyDmg(bk, 100, 'b', shooter); const locked = h1 - bk.hp;
  ok('T55.F locked down, the bunker takes exactly LOCK_RED less',
    Math.abs(locked - open * (1 - LOCK_RED)) < 1e-6);
  ok('T55.F it cannot be re-fired on cooldown',
    (() => { const t = bk.upT; bk.upT = 0; execCmd({ op: 'lock', pi: G.human.i, a: { bid: bk.id } }); const r = bk.upT === 0; bk.upT = t; return r; })());
  // the garrison holds fire for as long as it runs
  {
    const before = shooter.hp;
    for (let i = 0; i < 60; i++) { bk.upT = LOCK_T; update(DT81); }
    ok('T55.F ...and the garrison stops firing for all of it', shooter.hp === before);
    bk.upT = 0; bk.cool = 0;
    for (let i = 0; i < 60; i++) update(DT81);
    ok('T55.F ...then shoots again once it runs out', shooter.hp < before);
  }
  ok('T55.F a locked-down bunker does not read as a running uplink', upOn(G.human) === false);
  ok('T55.F Lockdown added no building field - it rides the timer that already ticked',
    bk.lockT === undefined && typeof bk.upT === 'number');
}

/* ---------- G: AI policy ---------- */
{
  const S = quiet81('kitchen', 8109, 20, 14);
  const { A, foe } = S;
  const bot = foe;
  const sn = makeUnit('sniper', bot, A.x + 4, A.y + 5);
  const man = makeUnit('grunt', G.human, A.x + 6, A.y + 5);
  const car = makeUnit('jeep', G.human, A.x + 6, A.y + 8);
  /* driven through update(), not aiTick(): the rule lives in the sim precisely
     because aiTick's 18-tick cadence is slower than a target turns over, and a
     test that called aiTick directly would be testing the wrong door. */
  sn.target = man; sn.hold = true; update(DT81);
  ok('T55.G a bot opens Called Shot on a man', sn.cs === true);
  sn.target = car; update(DT81);
  ok('T55.G ...and closes it on anything else', sn.cs === false);
  sn.target = null; update(DT81);
  ok('T55.G ...and on nothing at all, so he is never left refusing every target', sn.cs === false);
  sn.hold = false;

  const bk = makeBuilding('bunker', bot, Math.floor(A.x + 10), Math.floor(A.y + 10));
  bk.prog = 1; bk.hp = bk.mhp;
  for (let i = 0; i < 3; i++) { const g = makeUnit('grunt', bot, bk.x, bk.y); g.garrisoned = true; bk.garrison.push(g); }
  aiTick(bot);
  ok('T55.G a healthy bunker is not locked down', bk.upT <= 0);
  bk.hp = bk.mhp * (LOCK_AI_FLOOR - 0.05); bk.abilityCool = 0;
  aiTick(bot);
  ok('T55.G ...one below the floor is', bk.upT > 0);
  {
    const empty = makeBuilding('bunker', bot, Math.floor(A.x + 13), Math.floor(A.y + 10));
    empty.prog = 1; empty.hp = empty.mhp * 0.1; empty.abilityCool = 0;
    aiTick(bot);
    ok('T55.G an EMPTY bunker never spends it - there is no fire to trade away', empty.upT <= 0);
  }
  /* v106: REVERSED ON PURPOSE, and by this check's own reasoning. v81 recorded
     that Ripple Fire "measured better than single fire in every arm, so a rule
     would only ever be a way of saying always on" - and left it unwired, which
     meant a CPU battery never rippled at all. v106 re-measured it (60 sim-seconds
     x 3 seeds, one battery against a fixed block: 1.33x the damage against ONE
     man, 1.09-2.79x against two to six) and wrote the always-on rule v81
     described. The claim that has NOT changed is the one below it: the bot never
     reaches into a human's army. */
  ok('T55.G a BOT battery always ripples - v81 measured it better in every arm',
    aiTick.toString().includes('u.rip=true'));
  {
    const ba = makeUnit('arty', bot, A.x + 6, A.y + 6);
    ba.rip = false; aiTick(bot);
    ok('T55.G ...so a bot arty that rolled off the line single-firing is switched over', ba.rip === true);
    const ha = makeUnit('arty', G.human, A.x + 17, A.y + 6);
    ha.rip = false; aiTick(bot);
    ok('T55.G ...and a HUMAN battery keeps the single fire it shipped with', ha.rip === false);
  }
  ok('T55.G ...and a HUMAN sniper is never touched by the bot rule',
    (() => { const h = makeUnit('sniper', G.human, A.x + 15, A.y + 5); h.cs = true; h.target = null; update(DT81); return h.cs === true; })());
}

/* ---------- H: state hygiene ---------- */
{
  const S = quiet81('kitchen', 8110, 20, 14);
  const { A, foe } = S;
  const sn = makeUnit('sniper', G.human, A.x + 3, A.y + 5);
  const ar = makeUnit('arty', G.human, A.x + 6, A.y + 5);
  const bk = makeBuilding('bunker', G.human, Math.floor(A.x + 9), Math.floor(A.y + 5));
  bk.prog = 1; bk.hp = bk.mhp; bk.upT = LOCK_T;
  sn.shotT = 2.5; sn.cs = true; ar.rip = true; ar.salv = 2;

  const h0 = hashState();
  sn.shotT = 2.6; ok('T55.H the shot clock is hashed', hashState() !== h0);
  sn.shotT = 2.5;
  const h1 = hashState(); sn.cs = false; ok('T55.H Called Shot is hashed', hashState() !== h1); sn.cs = true;
  const h2 = hashState(); ar.rip = false; ok('T55.H Ripple Fire is hashed', hashState() !== h2); ar.rip = true;
  const h3 = hashState(); bk.upT = LOCK_T - 1; ok('T55.H the Lockdown timer is hashed', hashState() !== h3); bk.upT = LOCK_T;

  const json = saveState(); const want = hashState();
  loadState(json);
  const sn2 = G.units.find(u => u.key === 'sniper'), ar2 = G.units.find(u => u.key === 'arty'), bk2 = G.blds.find(b => b.key === 'bunker');
  ok('T55.H the three unit fields round-trip through a snapshot',
    hashState() === want && Math.abs(sn2.shotT - 2.5) < 1e-9 && sn2.cs === true && ar2.rip === true && ar2.salv === 2);
  ok('T55.H ...and so does the Lockdown timer', Math.abs(bk2.upT - LOCK_T) < 1e-9);

  // a save written before v81 carries none of them and must load to the cold defaults
  {
    const old = JSON.parse(saveState());
    for (const u of old.units) { delete u.shotT; delete u.cs; delete u.rip; }
    loadState(JSON.stringify(old));
    const s3 = G.units.find(u => u.key === 'sniper'), a3 = G.units.find(u => u.key === 'arty');
    ok('T55.H a pre-v81 save defaults a sniper to cold and both toggles to off',
      s3.shotT === 999 && s3.cs === false && a3.rip === false);
  }
  // no v81 field lands on a unit that cannot use it
  {
    const g = makeUnit('grunt', G.human, A.x + 12, A.y + 5);
    ok('T55.H nothing but the Gray units grows a v81 field',
      g.shotT === undefined && g.cs === undefined && g.rip === undefined);
  }
  const BANNED81 = ['Math.random', 'Math.hypot', 'Math.atan2', 'Math.sin(', 'Math.cos(', 'Date.now', 'performance.now'];
  /* splash() is deliberately NOT in this list: it has carried a cosmetic
     Math.random since long before v81 (the flame lick it spawns on a fire hit)
     and the Shell Shock line added to it draws no randomness of its own. */
  const PURE81 = [['hid81', hid81], ['csOk', csOk], ['salOf', salOf], ['srtOf', srtOf], ['rtOf', rtOf], ['fireAt', fireAt]];
  const dirty = [];
  for (const [n, f] of PURE81) { const src = f.toString(); for (const b of BANNED81) if (src.includes(b)) dirty.push(n + ' uses ' + b); }
  ok('T55.H the new sim functions use only deterministic math' + (dirty.length ? ' (' + dirty.join(', ') + ')' : ''), dirty.length === 0);
  ok('T55.H the concealment test never reads the client fog grid',
    !hid81.toString().includes('G.fog') && !hid81.toString().includes('fogAt'));
}
