section('T58 v85: the ub refactor, and Blue\'s second pass');

/* What this pins, and why each claim is here rather than left to the trails:
   the trails prove v85 CHANGED the simulation, which on its own is worth nothing -
   a bug changes it too. These are the properties that make the change the one that
   was intended, plus the two that a release of this shape gets wrong most easily:
   an aura read off the wrong entity, and new sim state that is hashed but not
   serialized (or the reverse). */

const DT85 = 1 / 30;
const cfg85 = (fac, seed, opp) => ({ map: 'backyard', mode: 'dm', diff: 'normal', fac, opp: (opp == null ? 1 : opp), seed });
function put85(k, p, x, y) { const u = makeUnit(k, p, x, y); u.state = 'idle'; u.path = null; u.target = null; return u; }

/* ---------- A: ub is a list, and every reader took the change ---------- */
{
  ok('T58.A every army\'s exclusive structures are an array, on the same footing as uu',
    Object.keys(FAC).every(f => Array.isArray(FAC[f].ub)) && Array.isArray(FAC.bug.ub));
  ok('T58.A Wildlife carries an empty one rather than an empty string',
    FAC.bug.ub.length === 0 && FAC.bug.uu.length === 0);
  /* v86: Green is the second army to reach two, so the claim is no longer "one
     army has two". Stated as the roadmap's own invariant instead - every army has
     at least one and none has more than two - which holds at v86, v87 and v88
     without another edit here, and the exact membership is pinned in T58.A's
     INFO_FEXCL_B line just below. */
  /* v88: ALL FOUR hold two now, and the "no army holds more" clause is what it was
     always for - the roadmap's shape is two apiece, and an army that grew a third
     would be a scope breach rather than a bonus. Written as equality across every
     army, which is a strictly stronger statement than the split it replaces. */
  ok('T58.A every army now holds exactly two exclusive structures',
    ['blue', 'green', 'tan', 'gray'].every(f => FAC[f].ub.length === 2) &&
    Object.keys(FAC).filter(f => f !== 'bug').every(f => FAC[f].ub.length === 2));

  /* the membership list is DERIVED off FAC, and techAvailable reads that same
     list rather than a hand-typed copy. This is the check that a new exclusive
     cannot be researchable by every army in the game - the failure mode the three
     retired literal lists had built in. */
  ok('T58.A the exclusive-building list is read off FAC and covers all eight',
    INFO_FEXCL_B.length === 8 && ['radar', 'dump', 'bunker', 'turbine', 'fwdpad', 'cmdpost', 'foundry', 'hbarricade'].every(k => INFO_FEXCL_B.includes(k)));
  ok('T58.A the exclusive-unit list is read off FAC and covers all thirteen',
    INFO_FEXCL_U.length === 13 && INFO_FEXCL_U.includes('runner') &&
    INFO_FEXCL_U.includes('cmdtruck') && INFO_FEXCL_U.includes('balloon') &&
    INFO_FEXCL_U.includes('firebomb') && INFO_FEXCL_U.includes('choktaw'));
  for (const f of ['green', 'tan', 'gray', 'blue']) {
    const mine = FAC[f].ub, theirs = INFO_FEXCL_B.filter(k => !mine.includes(k));
    ok(`T58.A ${f} may research its own structures and no other army's`,
      mine.every(k => techAvailable({ fac: f }, B[k].tech)) &&
      theirs.every(k => !techAvailable({ fac: f }, B[k].tech)));
    ok(`T58.A ${f}'s build roster carries exactly its own`,
      mine.every(k => bldRoster({ fac: f }).includes(k)) &&
      theirs.every(k => !bldRoster({ fac: f }).includes(k)));
  }
  /* the info panel has to answer "whose is this" for a second structure, which the
     old === could not do for anything but the first */
  ok('T58.A the info panel attributes both Blue structures to Blue',
    infoFacOf('bld', 'turbine') === 'blue' && infoFacOf('bld', 'fwdpad') === 'blue' &&
    infoFacOf('bld', 'bunker') === 'gray');

  /* mult is a table flag now. Two rows carry it, and the AI reads the flag. */
  ok('T58.A exactly the two structures a bot builds in numbers carry mult',
    Object.keys(B).filter(k => B[k].mult).sort().join(',') === 'bunker,turbine');
  ok('T58.A ...and neither the Forward Pad nor the Command Post is one of them', !B.fwdpad.mult && !B.cmdpost.mult); // v86: a second post's aura does not add, exactly as a second Radar Tent's does not
}

/* ---------- B: the Signal Runner, as specified ---------- */
{
  ok('T58.B he is Barracks infantry, Blue-exclusive',
    U.runner.a === 'inf' && FAC_INF.blue.includes('runner') && FAC.blue.uu.includes('runner') &&
    !['green', 'tan', 'gray'].some(f => FAC[f].uu.includes('runner')));
  /* the owner's brief, stated as the two comparisons that define him */
  ok(`T58.B weaker than a Grunt on both counts (${U.runner.hp} hp vs ${U.grunt.hp}, ${(U.runner.dm / U.runner.rt).toFixed(2)} dps vs ${(U.grunt.dm / U.grunt.rt).toFixed(2)})`,
    U.runner.hp < U.grunt.hp && U.runner.dm / U.runner.rt < U.grunt.dm / U.grunt.rt);
  ok('T58.B ...and dearer than one, because what is bought is the radio',
    U.runner.cp > U.grunt.cp);
  ok('T58.B the pistol is the small-arms row at shorter reach, not a tenth row',
    U.runner.w === 'b' && Object.keys(WVA).length === 10 && U.runner.rg < U.grunt.rg);

  G = null; newGame(cfg85('blue', 850101));
  const me = G.human;
  const run = put85('runner', me, 20, 20);
  const near = put85('grunt', me, 21, 20);
  const far = put85('grunt', me, 20 + RNET_R + 3, 20);
  const jeep = put85('jeep', me, 21, 20);

  /* --- Radio Net: a passive, so there is no flag to set --- */
  ok('T58.B Radio Net lifts a nearby rifleman\'s sight by exactly RNET_VI',
    viOf(near) === U.grunt.vi + RNET_VI);
  ok('T58.B ...and reaches the Runner himself, who pays nothing for it',
    viOf(run) === U.runner.vi + RNET_VI);
  ok('T58.B ...and stops at RNET_R', viOf(far) === U.grunt.vi);
  ok('T58.B ...and is infantry only - a vehicle beside him gains nothing',
    viOf(jeep) === U.jeep.vi);
  {
    const foe = G.players.find(p => p !== me && !allied(p, me));
    const theirs = put85('grunt', foe, 21, 20);
    ok('T58.B ...and it is an ALLIED aura: an enemy standing in it sees no further',
      viOf(theirs) === U.grunt.vi);
  }

  /* --- Sprint: the toggle --- */
  ok('T58.B the toggle starts off, and only the Runner carries the flag',
    run.spr === false && near.spr === undefined);
  const base = near.sp;
  execCmd({ op: 'sprint', pi: me.i, a: { ids: [run.id], on: true } });
  ok('T58.B Sprint speeds a friendly infantryman inside the radius',
    Math.abs(spOf(near) - base * (1 + SPRINT_SPD)) < 1e-12);
  ok('T58.B ...the Runner too, by his own whistle',
    Math.abs(spOf(run) - run.sp * (1 + SPRINT_SPD)) < 1e-12);
  ok('T58.B ...nobody outside it', Math.abs(spOf(far) - far.sp) < 1e-12);
  ok('T58.B ...and no vehicle, in or out', Math.abs(spOf(jeep) - jeep.sp) < 1e-12);

  /* the price. Three doors, because a mode that only stopped ONE of them would
     leave a sprinting squad shooting on the tick the other door opened. */
  {
    const foe = G.players.find(p => p !== me && !allied(p, me));
    const mark = put85('grunt', foe, 21.5, 20);
    near.target = null; near.state = 'idle';
    orderAttack(near, mark);
    ok('T58.B a man under Sprint refuses an attack order outright', near.target === null);
    near.target = mark; near.state = 'attack';
    updateUnit(near, DT85);
    ok('T58.B ...and a target set behind the order door is dropped on the next tick',
      near.target === null);
    for (let i = 0; i < 40; i++) updateUnit(near, DT85);
    ok('T58.B ...and he acquires nothing new while it runs', near.target === null);

    execCmd({ op: 'sprint', pi: me.i, a: { ids: [run.id], on: false } });
    ok('T58.B the whistle goes down again', run.spr === false);
    orderAttack(near, mark);
    ok('T58.B ...and he takes an order again the moment it does', near.target === mark);
  }
}

/* ---------- C: the Forward Pad ---------- */
{
  ok('T58.C it is Blue\'s second structure, gated to Blue',
    FAC.blue.ub.includes('fwdpad') && techAvailable({ fac: 'blue' }, 'b_fwdpad') &&
    !techAvailable({ fac: 'gray' }, 'b_fwdpad'));

  G = null; newGame(cfg85('blue', 850102));
  const me = G.human;
  const pad = makeBuilding('fwdpad', me, 24, 24, true);
  const near = put85('heli', me, 25, 25), far = put85('heli', me, 25 + PAD_R + 4, 25);
  const truck = put85('jeep', me, 25, 25);
  for (const u of [near, far, truck]) u.hp = 10;

  /* The passive. NOTHING repaired aircraft before this, which is the whole
     capability, so it is driven rather than asserted off the constant.
     The RATE is measured through updateBld alone - the real function, called
     directly - because this is a live match and an aircraft parked in the open is
     a target: the first cut of this ran the full loop and measured -4.86 HP/s on a
     helicopter that an enemy rifleman had found at tick 22. Measuring a heal rate
     inside a firefight measures the firefight. The full loop still gets its own
     check below, stated as a DIFFERENCE between two aircraft taking the same
     match, which is immune to whatever either of them is being shot by. */
  for (let i = 0; i < 30; i++) updateBld(pad, DT85);
  ok(`T58.C a hurt aircraft on the pad is repaired at PAD_REP (${(near.hp - 10).toFixed(2)}/s)`,
    Math.abs((near.hp - 10) - PAD_REP) < 1e-9);
  ok('T58.C ...one outside the radius is not', far.hp === 10);
  ok('T58.C ...and a ground vehicle is not, whatever it is parked on', truck.hp === 10);
  {
    const full = put85('apache', me, 25, 25);
    const h = full.hp;
    for (let i = 0; i < 30; i++) updateBld(pad, DT85);
    ok('T58.C ...and an undamaged aircraft costs it nothing', full.hp === h);
    full.hp = full.mhp - 0.5;
    for (let i = 0; i < 60; i++) updateBld(pad, DT85);
    ok('T58.C it never overheals', full.hp === full.mhp);
  }
  /* v85 set PAD_REP DELIBERATELY under the Medic's rate, so the Pad read as the
     quiet half of the building. v88.1 raised it to 3, i.e. deliberately ABOVE, and
     the reason is recorded in the constants block: at 1.6 a Huey took over a minute
     on the pad and an Apache two, which is longer than the match phase either is
     bought for. The ordering between the two was never load-bearing - the Medic
     follows the fight and heals anything on legs, the Pad is a fixed 2x2 that
     repairs only what flies, and nothing else in the game repairs that at all.
     Re-aimed at the claim that still holds, and pinned two-sided so a further
     rise fires as loudly as this one did. */
  ok('T58.C the rate is 3 HP/s, raised past the Medic\'s at v88.1',
    PAD_REP === 3 && PAD_REP > MEDIC_HEAL_RATE);
  ok('T58.C ...and it is still slow enough that a wreck is a real commitment',
    U.apache.hp / PAD_REP > 45 && U.apache.hp / PAD_REP < 90);

  /* Scramble: army-wide, on the building's own two clocks, exactly as Overdrive
     and Lockdown are - no new building state was added for it. */
  ok('T58.C Scramble is off before it is called', !scramOn(me));
  const flyBase = far.sp;
  execCmd({ op: 'scramble', pi: me.i, a: { bid: pad.id } });
  ok('T58.C it arms onto upT and abilityCool and nothing else',
    scramOn(me) && Math.abs(pad.upT - SCRAM_T) < 1e-12 && Math.abs(pad.abilityCool - SCRAM_CD) < 1e-12);
  ok('T58.C ...and reaches an aircraft on the far side of the map, not just the pad',
    Math.abs(spOf(far) - flyBase * (1 + SCRAM_SPD)) < 1e-12);
  ok('T58.C ...but no ground unit', Math.abs(spOf(truck) - truck.sp) < 1e-12);
  execCmd({ op: 'scramble', pi: me.i, a: { bid: pad.id } });
  ok('T58.C a second call while it is cooling is refused, not stacked',
    Math.abs(pad.upT - SCRAM_T) < 1e-12);
  pad.upT = 0;
  ok('T58.C ...and the speed goes with the duration, not the cooldown',
    !scramOn(me) && Math.abs(spOf(far) - flyBase) < 1e-12);

  /* Finally, the main loop really does drive the passive - the rate above was
     measured through updateBld directly, which proves the arithmetic but not that
     anything calls it. Counting the ticks on which a hurt aircraft gains EXACTLY
     PAD_REP*dt does both, and is immune to the match going on around it: a tick
     where an enemy rifleman lands a shot simply is not one of the ticks counted,
     which is the flaw that sank the first cut of this (it measured a firefight and
     reported -4.86 HP/s). */
  {
    G = null; newGame(cfg85('blue', 850110));
    const p = G.human;
    makeBuilding('fwdpad', p, 24, 24, true);
    const on = put85('heli', p, 25, 25), off = put85('heli', p, 25 + PAD_R + 4, 25);
    on.hp = off.hp = 40;
    /* The bar is "at least a second of it" rather than "most of the window", and
       the OUT-of-range arm asks whether it ever gained EXACTLY the pad's rate
       rather than whether it gained at all. Both are deliberate. A parked
       helicopter in a live match is a target - the one on the pad is shot down part
       way through this window, which is fine and is not what is being measured -
       and aircraft gain health from other things too (this fixture caught the
       out-of-range one taking a single +11 from a veterancy rung). Keying on the
       exact per-tick figure isolates the pad from both. */
    let onTicks = 0, offTicks = 0;
    for (let i = 0; i < 300; i++) {
      const a = on.hp, b = off.hp;
      update(DT85);
      if (Math.abs((on.hp - a) - PAD_REP * DT85) < 1e-9) onTicks++;
      if (Math.abs((off.hp - b) - PAD_REP * DT85) < 1e-9) offTicks++;
    }
    ok(`T58.C the main loop drives the passive - ${onTicks} ticks gained exactly PAD_REP*dt`,
      onTicks >= 30);
    ok('T58.C ...and the aircraft out of range gained it on none of them', offTicks === 0);
  }
}

/* ---------- D: Rapid Redeploy ---------- */
{
  /* v87: "the shared set" is the barrage and the paradrop now - the napalm went to
     Tan. Read off the table rather than transcribed, so the next row to change
     hands moves this check with it instead of breaking it. */
  ok('T58.D the row belongs to Blue alone, and the other three keep the shared set',
    radioAllowed({ fac: 'blue' }, 'lift') &&
    !['green', 'tan', 'gray'].some(f => radioAllowed({ fac: f }, 'lift')) &&
    ['green', 'tan', 'gray'].every(f => RADIO_ABILITIES.filter(a => !a.fac)
      .every(a => radioAllowed({ fac: f }, a.mode))));
  ok('T58.D it needs no vision, like the paradrop it is drawn as',
    !radioNeedsVision('lift'));

  G = null; newGame(cfg85('blue', 850103));
  const me = G.human;
  const tower = makeBuilding('radiotower', me, 10, 10, true);
  const men = []; for (let i = 0; i < 4; i++) men.push(put85('grunt', me, 12 + i, 12));
  const veh = put85('jeep', me, 16, 12);
  const foe = G.players.find(p => p !== me && !allied(p, me));
  const theirs = put85('grunt', foe, 17, 12);

  /* the id list is re-derived sim-side and trusts nothing the client sent: a
     vehicle and an enemy in the same call must both be dropped. */
  execCmd({ op: 'radio', pi: me.i, a: { bid: tower.id, mode: 'lift', x: 40, y: 40, ids: men.map(m => m.id).concat([veh.id, theirs.id]) } });
  ok('T58.D the infantry go up', men.every(m => m.garrisoned));
  ok('T58.D ...a vehicle in the same call does not', !veh.garrisoned);
  ok('T58.D ...and neither does an enemy', !theirs.garrisoned);
  ok('T58.D the tower spends the shared call-down cooldown', tower.abilityCool > 0);
  ok('T58.D off the map means off the map - nothing can see or shoot them',
    men.every(m => !nearestEnemy(theirs, 99) || nearestEnemy(theirs, 99) !== m));

  for (let i = 0; i < 90; i++) update(DT85);
  ok('T58.D they come back', men.every(m => !m.garrisoned && m.hp > 0));
  ok('T58.D ...at the destination', men.every(m => dhyp(m.x - 40, m.y - 40) < 6));
  ok('T58.D ...and on passable ground', men.every(m => passable(Math.floor(m.x), Math.floor(m.y))));
  ok('T58.D the strike cleans itself up', !G.strikes.some(s => s.kind === 'lift'));

  /* it creates nobody: the whole roster count is unchanged across a redeploy,
     which is what separates it from the Paradrop it borrows its animation from */
  {
    G = null; newGame(cfg85('blue', 850104));
    const p = G.human, tw = makeBuilding('radiotower', p, 10, 10, true);
    const squad = []; for (let i = 0; i < 3; i++) squad.push(put85('grunt', p, 12 + i, 12));
    const before = p.units.length;
    execCmd({ op: 'radio', pi: p.i, a: { bid: tw.id, mode: 'lift', x: 35, y: 35, ids: squad.map(m => m.id) } });
    for (let i = 0; i < 90; i++) update(DT85);
    ok('T58.D a redeploy creates nobody - the headcount is untouched', p.units.length === before);
  }
  /* a call that filters down to nobody must not burn the cooldown */
  {
    G = null; newGame(cfg85('blue', 850105));
    const p = G.human, tw = makeBuilding('radiotower', p, 10, 10, true);
    const v = put85('jeep', p, 12, 12);
    execCmd({ op: 'radio', pi: p.i, a: { bid: tw.id, mode: 'lift', x: 35, y: 35, ids: [v.id] } });
    ok('T58.D a call with nobody liftable in it spends nothing', tw.abilityCool === 0);
  }
  /* and no other army can send the mode, however the command arrives */
  {
    G = null; newGame(cfg85('gray', 850106));
    const p = G.human, tw = makeBuilding('radiotower', p, 10, 10, true);
    const m = put85('grunt', p, 12, 12);
    execCmd({ op: 'radio', pi: p.i, a: { bid: tw.id, mode: 'lift', x: 35, y: 35, ids: [m.id] } });
    ok('T58.D a Gray tower sending the Blue mode is refused at the command door',
      !m.garrisoned && tw.abilityCool === 0);
  }
}

/* ---------- E: it is sim state, so it is hashed AND it survives a save ---------- */
{
  G = null; newGame(cfg85('blue', 850107));
  const me = G.human;
  const run = put85('runner', me, 20, 20);
  const h0 = hashState();
  run.spr = true;
  ok('T58.E the Sprint flag is inside hashState', hashState() !== h0);

  const json = saveState();
  G = null; newGame(cfg85('blue', 850107));
  loadState(json);
  ok('T58.E ...and a snapshot carries it',
    G.units.find(u => u.key === 'runner').spr === true);

  /* the redeploy's off-map window is the risky half: it borrows u.garrisoned, so a
     snapshot cut mid-flight has to carry BOTH the flag and the strike that will
     clear it, or the squad is stranded off the board forever. Driven end to end. */
  G = null; newGame(cfg85('blue', 850108));
  const p2 = G.human, tw = makeBuilding('radiotower', p2, 10, 10, true);
  const squad = []; for (let i = 0; i < 3; i++) squad.push(put85('grunt', p2, 12 + i, 12));
  const ids = squad.map(m => m.id);
  execCmd({ op: 'radio', pi: p2.i, a: { bid: tw.id, mode: 'lift', x: 35, y: 35, ids } });
  update(DT85);
  const mid = saveState();
  ok('T58.E the in-flight strike is in the snapshot',
    JSON.parse(mid).strikes.some(s => s.kind === 'lift' && s.drops && s.drops.length === 3));
  G = null; newGame(cfg85('blue', 850108));
  loadState(mid);
  for (let i = 0; i < 120; i++) update(DT85);
  const landed = ids.map(i => G.units.find(u => u.id === i));
  ok('T58.E ...and a squad caught mid-flight still lands after a reload',
    landed.every(u => u && !u.garrisoned && dhyp(u.x - 35, u.y - 35) < 6));

  /* the auras are read off position at the point of use and write nothing, so
     neither of them may appear on a unit that does not carry the capability */
  G = null; newGame(cfg85('blue', 850109));
  const p3 = G.human;
  const r3 = put85('runner', p3, 20, 20), g3 = put85('grunt', p3, 21, 20);
  r3.spr = true;
  const before = JSON.parse(saveState()).units.find(u => u.id === g3.id);
  ok('T58.E a man inside both auras carries no new field of his own',
    before.spr === undefined && Object.keys(before).filter(k => k === 'spr' || k === 'rnet').length === 0);
  ok('T58.E ...and the effect is still real for him, read off the Runner',
    Math.abs(spOf(g3) - g3.sp * (1 + SPRINT_SPD)) < 1e-12 && viOf(g3) === U.grunt.vi + RNET_VI);
  /* MUTATION: kill the Runner and both auras must vanish on the same tick, with
     nothing left stamped on anybody */
  r3.hp = 0;
  ok('T58.E MUTATION: with the Runner dead both auras stop at once',
    Math.abs(spOf(g3) - g3.sp) < 1e-12 && viOf(g3) === U.grunt.vi);
}

/* ---------- F: the manual states these facts off the constants ---------- */
{
  const want = { rnetR: RNET_R, rnetVi: RNET_VI, sprintR: SPRINT_R, padR: PAD_R, padRep: PAD_REP, liftMax: LIFT_MAX, scramT: SCRAM_T, scramCd: SCRAM_CD };
  let bad = [];
  for (const k in want) if (String(helpTuneValue(k)) !== String(want[k])) bad.push(k);
  ok('T58.F every v85 manual slot reads the constant the sim reads' + (bad.length ? ' (' + bad.join(', ') + ')' : ''),
    bad.length === 0);
  ok('T58.F the percentage slots are formatted in the table, not in the markup',
    helpTuneValue('sprintSpd') === Math.round(SPRINT_SPD * 100) &&
    helpTuneValue('scramSpd') === Math.round(SCRAM_SPD * 100));
  /* the two info cards state their own numbers off the same constants */
  ok('T58.F the Runner\'s card quotes his own radii rather than retyping them',
    U.runner.d.includes(String(RNET_R)) && U.runner.d.includes(String(Math.round(SPRINT_SPD * 100))));
  ok('T58.F the Pad\'s card quotes its own rate and radius',
    B.fwdpad.d.includes(String(PAD_R)) && B.fwdpad.d.includes(String(PAD_REP)));
}
