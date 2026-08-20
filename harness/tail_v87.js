section('T60 v87: Tan\'s full exclusive set, and the first unit cooldown');

/* What this pins, and why each claim is here rather than left to the trails: the
   trails prove v87 CHANGED the simulation, which on its own is worth nothing - a
   bug changes it too. These are the properties that make the change the one that
   was intended, plus the four a release of this shape gets wrong most easily:
   a new clock that is hashed but not serialized (or the reverse), a generalised
   function that quietly changed what its FIRST caller does, an indiscriminate
   weapon that turns out to kill the thing carrying it, and a call-down that
   changes hands at every surface except the one the bot reads.

     A  the tables: Tan's set is complete, and no derived constant moved under it
     B  the u.abCool machinery, as machinery rather than as one unit's special case
     C  the Firebomb Heli - Scorched Earth, Napalm Blast, and who the fire burns
     D  the Foundry - the hull it bakes in, and Pour
     E  the Napalm Strike changes hands, at every surface including the bot's
     F  it is sim state, so it is hashed AND it survives a save
     G  the manual states every one of these numbers off the constant
     H  the bot rules, driven rather than read
*/

const DT87 = 1 / 30;
const cfg87 = (fac, seed, opp) => ({ map: 'backyard', mode: 'dm', diff: 'normal', fac, opp: (opp == null ? 1 : opp), seed });
function put87(k, p, x, y) { const u = makeUnit(k, p, x, y); u.state = 'idle'; u.path = null; u.target = null; return u; }
function bld87(k, p, tx, ty) { const b = makeBuilding(k, p, tx, ty, true); b.prog = 1; b.hp = b.mhp; b.abilityCool = 0; return b; }
/* the burn is measured by driving updateStrikes ALONE, never a tick of the live
   match. The first cut of this file ran update() and read a helicopter that had
   been bitten by wildlife as self-immolation; that is the v85 heal-rate lesson and
   the v86 crate lesson in a third shape. */
function burn87(n) { for (let i = 0; i < n; i++) updateStrikes(DT87); }

/* ---------- A: the tables ---------- */
{
  ok('T60.A Tan now fields an exclusive out of all three production buildings',
    FAC_INF.tan.includes('flamer') && FAC_VEH.tan.includes('bulltank') && FAC_AIR.tan.includes('firebomb'));
  /* v88 FILLED IT. Gray's Helipad cell was the last empty one in the three tables,
     and this line becomes the completion claim it was counting down to: every army
     fields an exclusive out of every production building, which is the whole of
     what roadmap 2 set out to do for units. */
  ok('T60.A ...and v88 filled Gray\'s cell, the last empty one in those three tables',
    FAC_AIR.gray.includes('choktaw') &&
    ['green', 'tan', 'gray', 'blue'].every(f => FAC_INF[f].length && FAC_VEH[f].length && FAC_AIR[f].length));
  ok('T60.A Tan holds two exclusive structures now',
    FAC.tan.ub.length === 2 && FAC.tan.ub.includes('dump') && FAC.tan.ub.includes('foundry'));
  for (const f of ['green', 'gray', 'blue']) {
    ok(`T60.A ${f} can research neither of Tan's two, and Tan can research both`,
      ['u_firebomb', 'b_foundry'].every(t => !techAvailable({ fac: f }, t)) &&
      ['u_firebomb', 'b_foundry'].every(t => techAvailable({ fac: 'tan' }, t)));
    ok(`T60.A ...and ${f}'s build and production rosters carry neither`,
      !bldRoster({ fac: f }).includes('foundry') &&
      !fullRoster({ fac: f }, 'helipad').includes('firebomb'));
  }
  ok('T60.A the Firebomb is built at the Helipad, and the Foundry needs a Garage',
    prodBldOf('firebomb') === 'helipad' && fullRoster({ fac: 'tan' }, 'helipad').includes('firebomb') &&
    B.foundry.req === 'garage');
  ok('T60.A the info panel attributes both to Tan',
    infoFacOf('unit', 'firebomb') === 'tan' && infoFacOf('bld', 'foundry') === 'tan');
  ok('T60.A it fires the flame row Tan already lives on, not an eleventh weapon class',
    U.firebomb.w === 'f' && U.flamer.w === 'f' && U.bulltank.sec.w === 'f' && Object.keys(WVA).length === 10);
  ok('T60.A a soft-target weapon: it beats infantry and bounces off heavy armour',
    dmgMulFor('firebomb', 'f', 'inf') > 1.3 && dmgMulFor('firebomb', 'f', 'heavy') < 0.5);
  ok('T60.A ...and it hits softer than the Apache, which is the gunship',
    U.firebomb.dm / U.firebomb.rt < U.apache.dm / U.apache.rt);
  ok('T60.A the Foundry is not a structure a bot stacks', !B.foundry.mult);

  /* THE TWO ROSTER-WIDE DERIVATIONS, checked BEFORE the row went in and asserted
     here so they stay checked. Unlike v86's pair, the Firebomb is ARMED, so this
     time the Medic floor really was exposed to it. */
  ok('T60.A the Medic heal floor is untouched',
    Math.abs(MEDIC_HEAL_RATE - 2.0893604651162794) < 1e-9);
  ok('T60.A ...and this time by clearing the floor rather than by not fighting: the Grunt still sets it',
    U.firebomb.dm > 0 && U.firebomb.dm / U.firebomb.rt > U.grunt.dm / U.grunt.rt &&
    (() => { let lo = Infinity, who = ''; for (const k in U) { const t = U[k]; if (t.dm > 0 && t.rt > 0 && !t.heal && !t.noPace) { const v = t.dm / t.rt; if (v < lo) { lo = v; who = k; } } } return who === 'grunt'; })());
  {
    /* the supply ranks every unit HAD at v86, transcribed, so a re-tiering fires
       here as a named unit rather than as a trail that moved */
    const V86 = { truck: 1, grunt: 1, grenadier: 1, runner: 1, bazooka: 1, bike: 1, para: 1,
      gunner: 2, flamer: 2, jeep: 2, mortar: 2, cmdtruck: 2, sniper: 2,
      medic: 3, aatruck: 3, tank: 3, heli: 3, apc: 3, balloon: 3,
      sarge: 4, chinook: 4, arty: 4, apache: 4, bulltank: 4 };
    /* v88: as with T59.A, this was a claim about V87 and the roster moved under it.
       The v86 transcription is KEPT and what is asserted is the exact drift: the
       same three units, each one rank cheaper, for the arithmetic reason T35.A
       records. v87's own addition still moved nobody, which is what this line was
       written to say and is still true. */
    const moved = Object.keys(V86).filter(k => supOf(k) !== V86[k]);
    ok('T60.A v87 itself moved nobody; the only drift from the v86 table is v88\'s three' +
       (moved.length ? ' (' + moved.join(', ') + ')' : ''),
      moved.slice().sort().join(',') === 'flamer,medic,sarge' && // v88.1: the Gunner was re-priced back onto 2 and the Flamethrower took the seventh slot
      moved.every(k => V86[k] - supOf(k) === 1));
    ok('T60.A ...and the arrival took the top rank its price bought', supOf('firebomb') === 4);
    /* COUNTERFACTUAL. At 24 trainable units the quartile cuts land in exactly the
       three places they did at 23, so the only insertion point that shifts nobody
       across one is PAST the last boundary. Price it under Sarge and the roster
       really does re-tier, which is what makes the price a decision. */
    const keep = U.firebomb.cp;
    U.firebomb.cp = 100;
    const cost = k => U[k].cp + U[k].ce;
    const tr = Object.keys(U).filter(k => !U[k].noTrain).sort((a, b) => (cost(a) - cost(b)) || (a < b ? -1 : a > b ? 1 : 0));
    const rank = k => Math.min(SUP_MAX, 1 + Math.floor(tr.indexOf(k) * SUP_MAX / tr.length));
    ok('T60.A COUNTERFACTUAL: a cheaper Firebomb really would re-tier the roster',
      ['medic', 'aatruck', 'tank', 'heli', 'apc', 'balloon', 'sarge'].some(k => rank(k) !== V86[k]));
    U.firebomb.cp = keep;
  }
}

/* ---------- B: the u.abCool machinery ---------- */
{
  /* The claim of this section is that v87 built MACHINERY and not one helicopter's
     special case, because v88's Paint is the next thing to use it. Everything here
     is stated about t.abCd and u.abCool rather than about the Firebomb. */
  ok('T60.B the DURATION lives on the table row, so a row declares its own clock',
    U.firebomb.abCd === FB_CD && typeof U.firebomb.abCd === 'number');
  /* v88 IS THE PROOF THIS SECTION WAS WRITTEN FOR. The claim above is that v87
     built machinery rather than one helicopter's special case, and the Choktaw's
     Paint is the second user of it - a row declaring abCd:20 and nothing else new.
     Both rows are named, so a third still has to be declared here. */
  ok('T60.B ...and exactly the rows that declare one are the rows that have an ability with one',
    Object.keys(U).filter(k => U[k].abCd).sort().join(',') === 'choktaw,firebomb');
  ok('T60.B the second user needed NO new machinery, only a duration on its row',
    U.choktaw.abCd === PAINT_CD && !!U.choktaw.paint);

  G = null; newGame(cfg87('tan', 870201));
  const me = G.human;
  const fb = put87('firebomb', me, 30, 30);
  const gr = put87('grunt', me, 31, 30);
  ok('T60.B the field is written ONLY onto rows that carry the capability',
    fb.abCool === 0 && gr.abCool === undefined);
  ok('T60.B a fresh unit is ready, not recharging', fb.abCool === 0);

  execCmd({ op: 'napalmblast', pi: me.i, a: { ids: [fb.id] } });
  ok('T60.B using the ability charges the row\'s own duration', fb.abCool === FB_CD);
  const n0 = G.strikes.length;
  execCmd({ op: 'napalmblast', pi: me.i, a: { ids: [fb.id] } });
  ok('T60.B ...and a second use is refused at the COMMAND door, not merely greyed out',
    G.strikes.length === n0 && fb.abCool === FB_CD);

  /* the clock is ticked in updateUnit, which is where every other per-unit clock
     is - the building pair records what happens to a timer parked in a branch */
  for (let i = 0; i < 30; i++) updateUnit(fb, DT87);
  ok('T60.B the clock runs down in seconds', Math.abs(fb.abCool - (FB_CD - 1)) < 1e-9);
  fb.abCool = 0;
  execCmd({ op: 'napalmblast', pi: me.i, a: { ids: [fb.id] } });
  ok('T60.B ...and it fires again once it reaches zero', G.strikes.length > n0);

  /* testing mode zeroes it, exactly as it zeroes every building cooldown */
  {
    G = null; newGame(Object.assign(cfg87('tan', 870202), { test: true }));
    const p = G.human, f2 = put87('firebomb', p, 30, 30);
    execCmd({ op: 'napalmblast', pi: p.i, a: { ids: [f2.id] } });
    ok('T60.B testing mode leaves the ability ready, like every building cooldown',
      G.test === true && f2.abCool === 0);
  }
  /* and nothing that does not carry the ability can be told to use it */
  {
    G = null; newGame(cfg87('tan', 870203));
    const p = G.human, ap = put87('apache', p, 30, 30);
    const s0 = G.strikes.length;
    execCmd({ op: 'napalmblast', pi: p.i, a: { ids: [ap.id] } });
    ok('T60.B an Apache cannot be told to drop a napalm blast', G.strikes.length === s0);
  }
}

/* ---------- C: the Firebomb Heli ---------- */
{
  /* SCORCHED EARTH: the ground burns, which is a different weapon from Cook-Off
     setting the TARGET alight, and the pair of them are what makes the distinction
     worth having. */
  G = null; newGame(cfg87('tan', 870301));
  const me = G.human, foe = G.players[1];
  const fb = put87('firebomb', me, 50, 50);
  fb.abCool = 999;                       // the passive must not need the ability
  const mark = put87('grunt', foe, 52, 50);
  const friend = put87('grunt', me, 52.1, 50.1);
  const m0 = mark.hp, f0 = friend.hp;
  fb.cool = 0; fireAt(fb, mark);
  const sc = G.strikes.find(s => s.kind === 'fbomb' && s.scorch);
  ok('T60.C one hit leaves one burning tile behind', !!sc && sc.burn.length === 1);
  ok('T60.C ...keyed on the row, not on the weapon class the Flamethrower shares',
    !!U.firebomb.scorch && !U.flamer.scorch && !U.bulltank.scorch);
  ok('T60.C ...and it does NOT set the target alight, which is Cook-Off\'s job',
    !U.firebomb.cook && !mark.burnT);
  fb.cool = 0; fireAt(fb, mark);
  ok('T60.C a second hit APPENDS to the same entry rather than pushing a second strike',
    G.strikes.filter(s => s.kind === 'fbomb').length === 1 && sc.burn.length === 2);
  burn87(60);
  ok('T60.C the fire burns the enemy standing in it', mark.hp < m0);
  ok('T60.C ...and NOT your own man beside him - the passive is not indiscriminate',
    friend.hp === f0);
  burn87(200);
  ok('T60.C the entry leaves when its last tile goes out, on no schedule of its own',
    !G.strikes.some(s => s.kind === 'fbomb'));

  /* NAPALM BLAST: the ability, and the three things about its fire. */
  G = null; newGame(cfg87('tan', 870302));
  const p2 = G.human, q2 = G.players[1];
  const heli = put87('firebomb', p2, 40, 40);
  const ally = put87('grunt', p2, 40.2, 40.2);
  const enemy = put87('grunt', q2, 39.8, 39.8);
  const myAir = put87('heli', p2, 40.1, 40.1);
  const theirAir = put87('heli', q2, 40.05, 40.05);
  const a0 = ally.hp, e0 = enemy.hp, h0 = heli.hp;
  execCmd({ op: 'napalmblast', pi: p2.i, a: { ids: [heli.id] } });
  const st = G.strikes.find(s => s.kind === 'fbomb' && !s.scorch);
  ok('T60.C the blast schedules exactly FB_N tiles', !!st && st.cells.length === FB_N);
  ok('T60.C ...every one of them inside FB_R of the helicopter',
    st.cells.every(c => dhyp(c.x - 40, c.y - 40) <= FB_R + 1e-9));
  ok('T60.C ...and they are not all the same tile', new Set(st.cells.map(c => c.x.toFixed(3) + ',' + c.y.toFixed(3))).size > 1);
  burn87(30);                            // the blast phase is over by 0.45s
  const aAfterBlast = ally.hp, airAfterBlast = myAir.hp;
  burn87(300);                           // now the BURN alone
  ok('T60.C the burn takes your own ground troops with it', ally.hp < aAfterBlast);
  ok('T60.C ...and the enemy\'s', enemy.hp < e0);
  ok('T60.C the fire is on the ground, so it cannot reach YOUR aircraft',
    myAir.hp === airAfterBlast);
  ok('T60.C ...nor the helicopter hovering directly over the fire it dropped',
    heli.hp >= h0);
  ok('T60.C the blast itself is a weapon and does hit an enemy aircraft, unlike the fire',
    theirAir.hp < theirAir.mhp);
  ok('T60.C the strike cleans itself up', !G.strikes.some(s => s.kind === 'fbomb'));
}

/* ---------- D: the Foundry ---------- */
{
  G = null; newGame(cfg87('tan', 870401));
  const me = G.human;
  const bare = makeUnit('tank', me, 30, 30);
  const inf0 = makeUnit('grunt', me, 30, 31);
  const f = bld87('foundry', me, Math.floor(me.start.x) + 6, Math.floor(me.start.y) + 6);
  const built = makeUnit('tank', me, 31, 30);
  const inf1 = makeUnit('grunt', me, 31, 31);
  const air = makeUnit('heli', me, 32, 31);

  ok('T60.D a vehicle built while it stands rolls out with more hull',
    built.mhp === Math.round(U.tank.hp * FAC.tan.mods.hp * (1 + FOUNDRY_HP)) && built.mhp > bare.mhp);
  ok('T60.D ...and hp tracks mhp, so a client that disagreed would diverge in hashState at once',
    built.hp === built.mhp);
  ok('T60.D infantry is untouched by it', inf1.mhp === inf0.mhp);
  ok('T60.D so are aircraft - the Garage is what "vehicle" means in this file',
    air.mhp === Math.round(U.heli.hp * FAC.tan.mods.hp) && prodBldOf('heli') !== 'garage');
  ok('T60.D an unfinished Foundry grants nothing',
    (() => { f.prog = 0.5; const t = makeUnit('tank', me, 33, 30); f.prog = 1; return t.mhp === bare.mhp; })());
  ok('T60.D the hull is BAKED IN: it survives the building it came from',
    (() => { const keep = built.mhp; f.hp = 0; const still = built.mhp; f.hp = f.mhp; return still === keep; })());
  ok('T60.D ...which is what makes it a production buff and not an aura',
    makeUnit.toString().indexOf('FOUNDRY_HP') > 0);
  /* it MULTIPLIES with the Garage upgrade rather than replacing it */
  {
    const g = bld87('garage', me, Math.floor(me.start.x) - 6, Math.floor(me.start.y) + 6);
    g.upg = true;
    const both = makeUnit('tank', me, 34, 30, g);
    ok('T60.D it stacks with the Garage upgrade rather than replacing it',
      both.mhp === Math.round(U.tank.hp * FAC.tan.mods.hp * (1 + UPGRADES.garage.unitBuff) * (1 + FOUNDRY_HP)));
  }

  /* POUR */
  G = null; newGame(cfg87('tan', 870402));
  const p2 = G.human;
  for (let i = 0; i < 5; i++) bld87('supply', p2, Math.floor(p2.start.x) - 8 + i * 3, Math.floor(p2.start.y) - 8);
  const fo = bld87('foundry', p2, Math.floor(p2.start.x) + 6, Math.floor(p2.start.y) + 6);
  const g1 = bld87('garage', p2, Math.floor(p2.start.x) - 6, Math.floor(p2.start.y) + 6);
  const g2 = bld87('garage', p2, Math.floor(p2.start.x) + 10, Math.floor(p2.start.y) - 2);
  p2.res.p = 9999; p2.res.e = 9999;
  g1.queue.push('jeep'); g2.queue.push('tank');
  const cash = p2.res.p, n0 = p2.units.length;
  const want = Math.round(ucost(p2, 'jeep').p * POUR_COST) + Math.round(ucost(p2, 'tank').p * POUR_COST);
  execCmd({ op: 'pour', pi: p2.i, a: { bid: fo.id } });
  ok('T60.D Pour charges the surcharge on every Garage it finishes', cash - p2.res.p === want && want > 0);
  ok('T60.D ...and spends the cooldown', fo.abilityCool === POUR_CD);
  update(DT87);
  ok('T60.D both vehicles roll out on the next tick, through the ordinary spawn path',
    p2.units.length === n0 + 2 && p2.units.some(u => u.key === 'jeep') && p2.units.some(u => u.key === 'tank'));
  ok('T60.D ...carrying the Foundry hull, because they were produced while it stood',
    p2.units.filter(u => u.key === 'tank').every(u => u.mhp === Math.round(U.tank.hp * FAC.tan.mods.hp * (1 + FOUNDRY_HP))));
  {
    const c1 = p2.res.p; g1.queue.push('jeep');
    execCmd({ op: 'pour', pi: p2.i, a: { bid: fo.id } });
    ok('T60.D a second press while it recharges costs nothing at all', p2.res.p === c1);
  }
  {
    fo.abilityCool = 0; g1.queue.length = 0; g2.queue.length = 0;
    execCmd({ op: 'pour', pi: p2.i, a: { bid: fo.id } });
    ok('T60.D a pour with nothing queued spends no cooldown', fo.abilityCool === 0);
  }
  {
    /* a bankrupt player pours nothing, and is charged nothing */
    fo.abilityCool = 0; g1.queue.push('tank'); p2.res.p = 1;
    execCmd({ op: 'pour', pi: p2.i, a: { bid: fo.id } });
    ok('T60.D ...and neither does one who cannot pay for it', p2.res.p === 1 && fo.abilityCool === 0);
  }
  ok('T60.D a Munitions Dump cannot be told to pour',
    (() => { const d = bld87('dump', p2, Math.floor(p2.start.x) + 12, Math.floor(p2.start.y) + 6); execCmd({ op: 'pour', pi: p2.i, a: { bid: d.id } }); return d.abilityCool === 0; })());
}

/* ---------- E: the Napalm Strike changes hands ---------- */
{
  ok('T60.E it is Tan\'s alone now', radioAllowed({ fac: 'tan' }, 'napalm') &&
    !['green', 'gray', 'blue'].some(f => radioAllowed({ fac: f }, 'napalm')));
  ok('T60.E ...and it did so by GAINING a field, not by moving to a second table',
    !!radioAbility('napalm') && radioAbility('napalm').fac === 'tan' && RADIO_ABILITIES.length === 6); // v88: 5 -> 6, Gray's Smokescreen
  ok('T60.E the shared pool is now the barrage and the paradrop',
    RADIO_ABILITIES.filter(a => !a.fac).map(a => a.mode).sort().join() === 'barrage,paradrop');
  ok('T60.E Tan\'s panel offers three, and each army sees only its own',
    radioListFor({ fac: 'tan' }).map(a => a.mode).sort().join() === 'barrage,napalm,paradrop' &&
    ['green', 'tan', 'gray', 'blue'].every(f => radioListFor({ fac: f }).every(a => !a.fac || a.fac === f)));
  ok('T60.E and v88 gave Gray the Smokescreen, so every army now holds exactly one',
    radioListFor({ fac: 'gray' }).length === 3 && radioAbility('smokescr').fac === 'gray' &&
    ['green', 'tan', 'gray', 'blue'].every(f => RADIO_ABILITIES.filter(a => a.fac === f).length === 1));
  ok('T60.E ...and the vision gate did not move with the ownership',
    radioNeedsVision('napalm') && radioNeedsVision('barrage') && !radioNeedsVision('paradrop'));

  /* THE COMMAND DOOR, which is what actually enforces it - the panel is
     client-local and a peer can send any mode it likes */
  for (const f of ['green', 'gray', 'blue']) {
    G = null; newGame(cfg87(f, 870501));
    const p = G.human, tw = bld87('radiotower', p, Math.round(p.start.x + 5), Math.round(p.start.y + 5));
    const s0 = G.strikes.length;
    execCmd({ op: 'radio', pi: p.i, a: { bid: tw.id, mode: 'napalm', x: tw.x + 2, y: tw.y + 2 } });
    ok(`T60.E a ${f} tower sending the Tan mode is refused at the command door`,
      G.strikes.length === s0 && tw.abilityCool === 0);
  }
  {
    G = null; newGame(cfg87('tan', 870502));
    const p = G.human, tw = bld87('radiotower', p, Math.round(p.start.x + 5), Math.round(p.start.y + 5));
    const s0 = G.strikes.length;
    execCmd({ op: 'radio', pi: p.i, a: { bid: tw.id, mode: 'napalm', x: tw.x + 2, y: tw.y + 2 } });
    ok('T60.E ...and a Tan tower still fires it', G.strikes.length === s0 + 1 && tw.abilityCool > 0);
  }
  /* THE BOT PATH, which is the surface a faction call-down is most easily forgotten
     at: aiTick reaches radioNapalm directly rather than through execCmd. */
  ok('T60.E the bot asks the same gate the command door does',
    aiTick.toString().indexOf("radioAllowed(p,'napalm')") > 0);
}

/* ---------- F: it is sim state, so it is hashed AND it survives a save ---------- */
{
  G = null; newGame(cfg87('tan', 870601));
  const me = G.human;
  const fb = put87('firebomb', me, 20, 20);
  const h0 = hashState();
  fb.abCool = 12;
  ok('T60.F the unit cooldown is inside hashState', hashState() !== h0);

  const json = saveState();
  G = null; newGame(cfg87('tan', 870601));
  loadState(json);
  ok('T60.F ...and a snapshot carries it',
    Math.abs(G.units.find(u => u.key === 'firebomb').abCool - 12) < 1e-9);

  /* the burning ground is the risky half: a scorch entry is appended to over time
     and a blast entry outlives the helicopter that dropped it, so a snapshot cut
     mid-burn has to carry the whole list or the fire vanishes on reload */
  G = null; newGame(cfg87('tan', 870602));
  const p2 = G.human;
  const heli = put87('firebomb', p2, 40, 40);
  execCmd({ op: 'napalmblast', pi: p2.i, a: { ids: [heli.id] } });
  burn87(30);
  const mid = saveState();
  ok('T60.F the burning ground is in the snapshot',
    JSON.parse(mid).strikes.some(s => s.kind === 'fbomb' && s.burn && s.burn.length));
  const hMid = hashState();
  G = null; newGame(cfg87('tan', 870602));
  loadState(mid);
  ok('T60.F a reload restores it exactly', hashState() === hMid);
  {
    /* a man is stood on a cell that is still alight AFTER the reload rather than
       before it: a victim placed in the fire beforehand is dead by the time the
       snapshot is taken, which measures nothing about the reload */
    const s2 = G.strikes.find(x => x.kind === 'fbomb');
    const cell = s2 && s2.burn.find(bc => s2.t < bc.until);
    if (!cell) ok('T60.F ...and the reloaded fire still has a live tile to stand on', false);
    else {
      const foe2 = G.players.find(x => x !== G.human && !allied(x, G.human));
      const v = put87('grunt', foe2, cell.x, cell.y), b0 = v.hp;
      burn87(60);
      ok('T60.F ...and the fire is still burning after the reload', v.hp < b0);
    }
  }
  /* THE OWNER MAY DIE INSIDE ITS OWN FIRE. loadState resolves a dead owner to
     null, and the sweep used to read owner.p unguarded - a crash inside update()
     that would have taken the tick with it. */
  {
    G = null; newGame(cfg87('tan', 870603));
    const p3 = G.human;
    const h3 = put87('firebomb', p3, 40, 40);
    execCmd({ op: 'napalmblast', pi: p3.i, a: { ids: [h3.id] } });
    burn87(20);
    const s = G.strikes.find(x => x.kind === 'fbomb');
    s.owner = null;                      // exactly what loadState leaves behind
    let threw = false;
    try { burn87(60); } catch (e) { threw = true; }
    ok('T60.F a fire whose owner is gone keeps burning instead of throwing', !threw);
  }
  /* the Firebomb writes nothing onto anybody else, and a match without one
     snapshots as it did before v87 */
  {
    G = null; newGame(cfg87('tan', 870604));
    const p4 = G.human, g4 = put87('grunt', p4, 20, 20);
    const enc = JSON.parse(saveState()).units.find(u => u.id === g4.id);
    ok('T60.F a unit with no cooldown ability carries no cooldown field',
      enc.abCool === undefined);
  }
  /* determinism with everything in flight */
  const run = () => {
    G = null; newGame(cfg87('tan', 870605, 3));
    const q = G.human;
    const h = put87('firebomb', q, 30, 30);
    bld87('foundry', q, Math.round(q.start.x + 6), Math.round(q.start.y + 6));
    execCmd({ op: 'napalmblast', pi: q.i, a: { ids: [h.id] } });
    for (let i = 0; i < 600; i++) update(DT87);
    return hashState();
  };
  ok('T60.F two runs of the same seed with fire on the ground agree', run() === run());
}

/* ---------- G: the manual states these facts off the constants ---------- */
{
  const want = { fbCd: FB_CD, fbN: FB_N, fbR: FB_R, fbDm: FB_DM, fbBurn: FB_BURN,
    scorchT: SCORCH_T, scorchDps: SCORCH_DPS, groundDps: GROUND_DPS,
    foundryHp: Math.round(FOUNDRY_HP * 100), pourCost: Math.round(POUR_COST * 100), pourCd: POUR_CD };
  const bad = Object.keys(want).filter(k => String(helpTuneValue(k)) !== String(want[k]));
  ok('T60.G every v87 manual slot reads the constant the sim reads' + (bad.length ? ' (' + bad.join(', ') + ')' : ''),
    bad.length === 0);
  ok('T60.G the tower\'s own burn seconds are a constant now, because two weapons read the rate',
    typeof NAPALM_T === 'number' && NAPALM_T < FB_BURN &&
    updateStrikes.toString().indexOf('NAPALM_T') > 0);
  ok('T60.G ...and "prolonged" is the DURATION, not a hotter fire - the rate is one shared constant',
    napalmBurn.toString().indexOf('GROUND_DPS') > 0);
  {
    let html = null;
    try { html = require('fs').readFileSync('pw.html', 'utf8'); } catch (e) { html = null; }
    ok('T60.G pw.html is readable next to the harness', !!html);
    if (html) {
      const missing = Object.keys(want).filter(k => html.indexOf('data-tune="' + k + '"') < 0);
      ok('T60.G every v87 slot is actually wired into the manual markup' + (missing.length ? ' (' + missing.join(', ') + ')' : ''),
        missing.length === 0);
    }
  }
}

/* ---------- H: the bot rules, driven rather than read ---------- */
{
  ok('T60.H the Firebomb is a line fighter in the bot\'s eyes, unlike v86\'s pair',
    !AI_SUPPORT.firebomb && U.firebomb.dm > 0);

  /* NAPALM BLAST: spent on a clump, and vetoed by its own men standing in it. */
  {
    G = null; newGame(cfg87('tan', 870701, 3));
    const p = G.players.find(x => x.ai) || G.players[1];
    p.ai = p.ai || makeAIBrain('balanced');
    const q = G.players.find(x => x !== p && !allied(x, p));
    const h = put87('firebomb', p, 30, 30);
    aiTick(p);
    ok('T60.H a bot does not empty its racks over an empty field', (h.abCool || 0) === 0);
    for (let i = 0; i < FB_AI_CLUMP; i++) put87('grunt', q, 30 + i * 0.4, 30.2);
    for (let i = 0; i <= FB_AI_OWN; i++) put87('grunt', p, 30.1, 30 + i * 0.4);
    aiTick(p);
    ok('T60.H ...nor over a clump with too many of its own men standing in it',
      (h.abCool || 0) === 0);
    for (const u of p.units.slice()) if (u.key === 'grunt') { u.x = 60; u.y = 60; }
    aiTick(p);
    ok('T60.H ...and does once the clump is theirs alone',
      (h.abCool || 0) > 0 && G.strikes.some(s => s.kind === 'fbomb'));
  }
  /* POUR: spent by a bot that is BANKED, because the surcharge buys time and time
     is only worth plastic to somebody with plastic spare. */
  {
    G = null; newGame(cfg87('tan', 870702, 3));
    const p = G.players.find(x => x.ai) || G.players[1];
    p.ai = p.ai || makeAIBrain('balanced');
    for (let i = 0; i < 5; i++) bld87('supply', p, Math.floor(p.start.x) - 8 + i * 3, Math.floor(p.start.y) - 8);
    const fo = bld87('foundry', p, Math.floor(p.start.x) + 6, Math.floor(p.start.y) + 6);
    const gs = [bld87('garage', p, Math.floor(p.start.x) - 6, Math.floor(p.start.y) + 6),
                bld87('garage', p, Math.floor(p.start.x) + 10, Math.floor(p.start.y) - 2)];
    for (const g of gs) g.queue.push('jeep');
    p.res.p = AI_POUR_BANK - 100;
    aiTick(p);
    ok('T60.H a poor bot does not buy time it cannot afford to waste', fo.abilityCool === 0);
    p.res.p = AI_POUR_BANK + 500;
    aiTick(p);
    ok('T60.H ...and a banked one does', fo.abilityCool > 0);
  }
}
