section('T62 v88: Gray\'s full exclusive set, and roadmap 2 closes');

/* What this pins, and why each claim is here rather than left to the trails: the
   trails prove v88 CHANGED the simulation, which on its own is worth nothing - a
   bug changes it too. These are the properties that make the change the one that
   was intended, plus the five a release of this shape gets wrong most easily:
   a derived constant silently re-tuned by a new row (this time it MOVED, and the
   movement is pinned rather than hidden), an aura that asks about the wrong
   entity, a stacking reduction with no ceiling, a mine that answers to the army
   that buried it, and a call-down refused everywhere except on the bot's path.

     A  the tables: Gray's set is complete, and what the 25th unit cost the roster
     B  the Choktaw - two weapons at once, and that fireSec stopped assuming one
     C  Forward Observer - it asks about the TARGET, not about the shooter
     D  Paint - the mark, its ceiling, its clock and who wears it
     E  the Heavy Barricade - the stacking aura, its cap, and what it does NOT shelter
     F  the buried mine - whose it is, who it lets past, and who can see it
     G  the Smokescreen - units AND structures, refused at the door, and the bot
     H  it is sim state, so it is hashed AND it survives a save
     I  the manual states every one of these numbers off the constant
     J  roadmap 2 is finished: every army holds the same shape of set
*/

const DT88 = 1 / 30;
const cfg88 = (fac, seed, opp) => ({ map: 'backyard', mode: 'dm', diff: 'normal', fac, opp: (opp == null ? 1 : opp), seed });
function put88(k, p, x, y) { const u = makeUnit(k, p, x, y); u.state = 'idle'; u.path = null; u.target = null; return u; }
function bld88(k, p, tx, ty) { const b = makeBuilding(k, p, tx, ty, true); b.prog = 1; b.hp = b.mhp; b.abilityCool = 0; return b; }
function foe88(p) { return G.players.find(q => q !== p && q.fac !== 'bug'); }
/* every damage figure below is taken by driving applyDmg directly rather than a
   tick of the live match. tail_v85's heal rate, tail_v86's crate and tail_v87's
   burn were each mis-measured once by reading a number a LIVE tick had also been
   writing to - wildlife bites, a landmine, a veterancy promotion. */
function hit88(e, amt) { const b = e.hp; applyDmg(e, amt, 'b', null); return b - e.hp; }

/* ---------- A: the tables ---------- */
{
  ok('T62.A Gray now fields an exclusive out of all three production buildings',
    FAC_INF.gray.includes('sniper') && FAC_VEH.gray.includes('arty') && FAC_AIR.gray.includes('choktaw'));
  ok('T62.A ...and the same three are on FAC.uu, which is what techAvailable reads',
    ['sniper', 'arty', 'choktaw'].every(k => FAC.gray.uu.includes(k)));
  ok('T62.A Gray holds two exclusive structures now',
    FAC.gray.ub.length === 2 && FAC.gray.ub.includes('bunker') && FAC.gray.ub.includes('hbarricade'));
  for (const f of ['green', 'tan', 'blue']) {
    ok(`T62.A ${f} can research neither of Gray's two, and Gray can research both`,
      ['u_choktaw', 'b_hbarricade'].every(t => !techAvailable({ fac: f }, t)) &&
      ['u_choktaw', 'b_hbarricade'].every(t => techAvailable({ fac: 'gray' }, t)));
    ok(`T62.A ...and ${f}'s build and production rosters carry neither`,
      !bldRoster({ fac: f }).includes('hbarricade') &&
      !fullRoster({ fac: f }, 'helipad').includes('choktaw'));
  }
  ok('T62.A the Choktaw is built at the Helipad',
    prodBldOf('choktaw') === 'helipad' && fullRoster({ fac: 'gray' }, 'helipad').includes('choktaw'));
  ok('T62.A the info panel attributes both to Gray',
    infoFacOf('unit', 'choktaw') === 'gray' && infoFacOf('bld', 'hbarricade') === 'gray');
  ok('T62.A its hull is above the Apache\'s, by specification',
    U.choktaw.hp > U.apache.hp && U.apache.hp === 187 && U.choktaw.hp === 203);
  ok('T62.A ...and Gray\'s x1.2 hull is what a fielded one actually wears',
    Math.round(U.choktaw.hp * FAC.gray.mods.hp) === 244);

  /* THE TRAP RULE 4 NAMES, and this is the release where one of the two MOVED.
     Both were measured BEFORE the row went in, which is the whole point of the
     rule - a derived constant that takes a min or a max over the roster is
     re-derived by an addition to it. */
  ok('T62.A the Medic heal floor is untouched - it reads the lowest-DPS COMBAT unit',
    Math.abs(MEDIC_HEAL_RATE - 2.0893604651162794) < 1e-9);
  ok('T62.A ...and it is untouched because the Choktaw is far above the floor, not by exemption',
    !U.choktaw.noPace && U.choktaw.dm / U.choktaw.rt > U.grunt.dm / U.grunt.rt &&
    (() => { let lo = Infinity; for (const k in U) { const t = U[k]; if (t.dm > 0 && t.rt > 0 && !t.heal && !t.noPace) lo = Math.min(lo, t.dm / t.rt); } return Math.abs(lo * 0.9 * HP_SCALE - MEDIC_HEAL_RATE) < 1e-12; })());

  {
    /* SUP_U DID MOVE, and it could not have been avoided. This is the first
       addition since the quartile rule shipped for which no price leaves the
       roster untouched, and the sweep that established that is REPRODUCED here
       rather than quoted: it runs the same rank computation over every total cost
       from 10 to 700 and counts how many existing units change rank. */
    const cost = k => U[k].cp + U[k].ce;
    const ranksWith = (extraCost) => {
      const U2 = Object.assign({}, U);
      delete U2.choktaw;                                   // always: the baseline is the v87 roster
      if (extraCost != null) U2.zz_probe = { cp: extraCost, ce: 0, dm: 20, rt: 1 };
      const tr = Object.keys(U2).filter(k => !U2[k].noTrain)
        .sort((a, b) => ((U2[a].cp + U2[a].ce) - (U2[b].cp + U2[b].ce)) || (a < b ? -1 : a > b ? 1 : 0));
      const o = {}; tr.forEach((k, i) => { o[k] = Math.min(SUP_MAX, 1 + Math.floor(i * SUP_MAX / tr.length)); });
      return o;
    };
    const v87ranks = ranksWith(null);                      // the roster WITHOUT the Choktaw
    const movers = Object.keys(v87ranks).filter(k => k !== 'choktaw' && supOf(k) !== v87ranks[k]);
    ok('T62.A exactly three existing units changed supply rank' + (movers.length ? ' (' + movers.slice().sort().join(', ') + ')' : ''),
      movers.slice().sort().join(',') === 'gunner,medic,sarge');
    ok('T62.A ...and every one of them fell by exactly one rank, none rose',
      movers.every(k => v87ranks[k] - supOf(k) === 1));
    ok('T62.A ...and they are precisely the units that sat ON the old quartile cuts',
      v87ranks.gunner === 2 && v87ranks.medic === 3 && v87ranks.sarge === 4);
    /* THE UNAVOIDABILITY, measured rather than asserted. */
    let minMoved = 99, cleanTop = -1;
    for (let tot = 10; tot <= 700; tot++) {
      const r = ranksWith(tot);
      const n = Object.keys(v87ranks).filter(k => k !== 'choktaw' && r[k] !== v87ranks[k]).length;
      if (n < minMoved) minMoved = n;
      if (n === 0) cleanTop = tot;
    }
    ok(`T62.A a 25th trainable unit CAN cost nothing, but only under the Machine Gunner (clean up to ${cleanTop})`,
      minMoved === 0 && cleanTop > 0 && cleanTop < cost('gunner'));
    ok('T62.A ...so no price a gunship can carry avoids it, which is why three moved',
      cost('choktaw') > cost('gunner') && cost('choktaw') === 468);
    ok('T62.A the Choktaw itself took the top rank its price bought', supOf('choktaw') === 4);
  }
}

/* ---------- B: two weapons at once ---------- */
{
  ok('T62.B the Choktaw declares a secondary, and it is a machine gun',
    !!U.choktaw.sec && U.choktaw.sec.w === 'b' && U.choktaw.sec.wc === 'b');
  ok('T62.B its MAIN weapon is the Apache\'s rocket row',
    U.choktaw.w === 'r' && U.apache.w === 'r');
  /* THE GENERALISATION, and the thing it could most easily have broken: fireSec
     was written for the Bull's hose and had three of the Bull's facts baked in.
     The Bull's own path is asserted UNCHANGED beside the new branch. */
  ok('T62.B fireSec branches on the row rather than assuming a flamethrower',
    /sc\.w===.b./.test(fireSec.toString()) && fireSec.toString().indexOf('spawnFlame') > 0);
  ok('T62.B ...and exactly two units carry a secondary now',
    Object.keys(U).filter(k => U[k].sec).sort().join(',') === 'bulltank,choktaw');

  /* the class split falls out of secOwns UNCHANGED - that is the claim */
  {
    const g = { kind: 'unit', t: { a: 'inf' }, hp: 10 };
    const tk = { kind: 'unit', t: { a: 'tank' }, hp: 10 };
    const ck = { t: U.choktaw };
    ok('T62.B the door gun owns infantry, exactly as the Bull\'s hose does',
      secOwns(ck, g) === true && secOwns({ t: U.bulltank }, g) === true);
    ok('T62.B ...and the rockets keep armour, so neither weapon can take the other\'s target',
      secOwns(ck, tk) === false);
  }

  /* DRIVEN: both weapons fire in the same fight, at different targets */
  {
    G = null; newGame(cfg88('gray', 880201));
    const me = G.human, en = foe88(me);
    const ck = put88('choktaw', me, 30, 30);
    const man = put88('grunt', en, 31.2, 30); man.hold = true;
    const tank = put88('tank', en, 32.5, 30); tank.hold = true; tank.target = null;
    ck.target = tank; ck.state = 'attack'; ck.hold = true;
    const h0 = { man: man.hp, tank: tank.hp };
    for (let i = 0; i < 90; i++) update(DT88);
    ok('T62.B the rockets worked the armour they were sent at', tank.hp < h0.tank);
    ok('T62.B ...while the door gun worked the infantry, at the same time',
      man.hp < h0.man && ck.target === tank);
    ok('T62.B ...and the two ran on their own clocks', ck.cool2 !== ck.cool);
  }
  /* the info card reads the row rather than naming the Bull's hose */
  ok('T62.B the info card describes the door gun as a door gun, and the hose as a hose',
    infoStatsHtml('unit', 'choktaw').indexOf('Door gun') >= 0 &&
    infoStatsHtml('unit', 'bulltank').indexOf('Hull flamethrower') >= 0);
}

/* ---------- C: Forward Observer ---------- */
{
  G = null; newGame(cfg88('gray', 880301));
  const me = G.human, en = foe88(me);
  const gun = put88('arty', me, 30, 30);
  /* 11 tiles out, deliberately: the Choktaw's sight is 9, so an observer standing
     on the guns cannot see this man and an observer standing on him obviously can.
     At 9 the two cases are the same case and the check below would be vacuous. */
  const mark = put88('grunt', en, 41, 30);
  ok('T62.C with no spotter the battery has its table range', rgOf(gun, mark) === U.arty.rg);
  ok('T62.C ...and rgOf with NO target is the unextended range too, which is not an omission',
    rgOf(gun) === U.arty.rg);
  const ck = put88('choktaw', me, mark.x, mark.y);
  ok('T62.C a Choktaw over the TARGET extends the battery', rgOf(gun, mark) === U.arty.rg + FOB_RG);

  /* THE SHAPE THAT MATTERS: it asks about the target, not about the shooter.
     An observer parked on the guns and looking at nothing extends nothing. */
  ck.x = gun.x; ck.y = gun.y;
  ok('T62.C an observer sitting ON the guns, far from the target, extends nothing',
    rgOf(gun, mark) === U.arty.rg);
  ck.x = mark.x; ck.y = mark.y;

  ok('T62.C only INDIRECT fire benefits - a rifleman gets nothing',
    rgOf(put88('grunt', me, 30, 30), mark) === U.grunt.rg);
  ok('T62.C ...and "indirect" is t.mrg, not a list of two unit keys',
    !!U.arty.mrg && !!U.mortar.mrg && Object.keys(U).filter(k => U[k].mrg).sort().join(',') === 'arty,mortar' &&
    /u\.t\.mrg/.test(fobOn.toString()));
  const mort = put88('mortar', me, 30, 30);
  ok('T62.C the Mortar Squad benefits on the same flag', rgOf(mort, mark) === U.mortar.rg + FOB_RG);
  ok('T62.C an ENEMY Choktaw spots for nobody of ours',
    (() => { ck.p = en; const r = rgOf(gun, mark); ck.p = me; return r === U.arty.rg; })());
  ok('T62.C a garrisoned observer sees nothing', (() => { ck.garrisoned = true; const r = rgOf(gun, mark); ck.garrisoned = false; return r === U.arty.rg; })());
  ok('T62.C a dead one likewise', (() => { const h = ck.hp; ck.hp = 0; const r = rgOf(gun, mark); ck.hp = h; return r === U.arty.rg; })());

  /* DRIVEN through the real firing test, not read off rgOf */
  {
    G = null; newGame(cfg88('gray', 880302));
    const p2 = G.human, e2 = foe88(p2);
    const bat = put88('arty', p2, 30, 30); bat.hold = true;
    const vic = put88('grunt', e2, 30 + U.arty.rg + 1, 30); vic.hold = true;
    bat.target = vic; bat.state = 'attack'; bat.cool = 0;
    for (let i = 0; i < 60; i++) update(DT88);
    ok('T62.C a target one tile PAST the table range is not shelled', vic.hp === vic.mhp);
    const spot = put88('choktaw', p2, vic.x, vic.y);
    bat.target = vic; bat.state = 'attack'; bat.cool = 0;
    for (let i = 0; i < 200 && vic.hp === vic.mhp; i++) update(DT88);
    ok('T62.C ...and IS shelled once a Choktaw is looking at it', vic.hp < vic.mhp);
    ok('T62.C ...with the observer still alive to have done it', spot.hp > 0);
  }
}

/* ---------- D: Paint ---------- */
{
  G = null; newGame(cfg88('gray', 880401));
  const me = G.human, en = foe88(me);
  const ck = put88('choktaw', me, 30, 30);
  const a = put88('grunt', en, 40.2, 40.2), b = put88('grunt', en, 41.8, 41.8);
  const outside = put88('grunt', en, 43.5, 43.5);
  const friend = put88('grunt', me, 40.5, 40.5);
  const n = paintArea(ck, 40, 40);
  ok('T62.D the box marks what is inside it', n === 2 && a.paintT === PAINT_T && b.paintT === PAINT_T);
  ok('T62.D ...and nothing outside it', outside.paintT === 0);
  ok('T62.D ...and never a friendly, whatever is standing there', friend.paintT === 0);
  ok('T62.D the box is PAINT_BOX tiles square, anchored on the clicked tile',
    PAINT_BOX === 2 && a.x >= 40 && a.x < 42 && outside.x >= 42);

  ok('T62.D a painted unit takes exactly +PAINT_DMG from any source',
    Math.abs(hit88(a, 20) - 20 * (1 + PAINT_DMG)) < 1e-9);
  ok('T62.D ...and an unpainted one takes the plain amount',
    Math.abs(hit88(outside, 20) - 20) < 1e-9);
  /* "from ALL sources" is one claim and applyDmg is where it is true: a burn tick,
     a mine and a crush all route through it, so the mark cannot be a weapon rule */
  ok('T62.D the mark lives in applyDmg, which is the single defender-side door',
    /tgt\.paintT>0/.test(applyDmg.toString()));

  ok('T62.D repainting RESTARTS the clock rather than stacking a second mark',
    (() => { a.paintT = 3; ck.abCool = 0; paintArea(ck, 40, 40);
      const once = hit88(a, 20);
      return a.paintT === PAINT_T && Math.abs(once - 20 * (1 + PAINT_DMG)) < 1e-9; })());
  ok('T62.D the mark expires on its own clock', (() => { a.paintT = 0.02; updateUnit(a, DT88); return a.paintT <= 0; })());
  a.hp = a.mhp; // three 25-point measurements have been taken off a 48 HP grunt; applyDmg returns 0 for a corpse
  ok('T62.D ...and an expired mark costs nothing', Math.abs(hit88(a, 20) - 20) < 1e-9);

  /* the mark OUTLIVES its source, which is why it is written on the victim */
  ok('T62.D the mark survives the aircraft that made it',
    (() => { ck.abCool = 0; paintArea(ck, 40, 40); const t = b.paintT; ck.hp = 0; kill(ck, null);
      return t === PAINT_T && b.paintT === PAINT_T; })());

  /* the cooldown, refused at the command door rather than in the panel */
  {
    G = null; newGame(cfg88('gray', 880402));
    const p2 = G.human, e2 = foe88(p2);
    const c2 = put88('choktaw', p2, 30, 30);
    const v2 = put88('grunt', e2, 40.5, 40.5);
    ok('T62.D a fresh Choktaw is ready', (c2.abCool || 0) === 0 && U.choktaw.abCd === PAINT_CD);
    execCmd({ op: 'paint', pi: p2.i, a: { ids: [c2.id], x: 40, y: 40 } });
    ok('T62.D the command paints and spends the cooldown', v2.paintT === PAINT_T && c2.abCool === PAINT_CD);
    v2.paintT = 0;
    execCmd({ op: 'paint', pi: p2.i, a: { ids: [c2.id], x: 40, y: 40 } });
    ok('T62.D ...and a second call while it is hot is refused AT THE DOOR', v2.paintT === 0);
    ok('T62.D a unit with no paint flag is refused the command too',
      (() => { const g = put88('grunt', p2, 30, 30); const w = put88('grunt', e2, 40.5, 40.5);
        execCmd({ op: 'paint', pi: p2.i, a: { ids: [g.id], x: 40, y: 40 } }); return w.paintT === 0; })());
    /* ONE aircraft paints per command, by decision - a second would only restart
       a clock that is already running and spend a cooldown for nothing */
    c2.abCool = 0;
    const c3 = put88('choktaw', p2, 31, 30);
    const v3 = put88('grunt', e2, 40.5, 40.5);
    execCmd({ op: 'paint', pi: p2.i, a: { ids: [c2.id, c3.id], x: 40, y: 40 } });
    ok('T62.D two selected Choktaws spend ONE cooldown between them',
      v3.paintT === PAINT_T && (c2.abCool > 0) !== (c3.abCool > 0));
  }
  ok('T62.D Paint is a one-shot, so it stays OUT of the toggle table',
    !UNIT_TOGGLES.some(t => t.f === 'paint' || t.c === 'paint'));
}

/* ---------- E: the Heavy Barricade ---------- */
{
  G = null; newGame(cfg88('gray', 880501));
  const me = G.human;
  const hq = me.blds.find(b => b.key === 'hq');
  const bx = Math.floor(hq.tx) + 9, by = Math.floor(hq.ty) + 9;
  ok('T62.E it is triple the ordinary wall, off the constant', B.hbarricade.hp === BARR_HP * 3 && HBARR_HP === 150);
  ok('T62.E ...and it is a `barr` row, which is what hands it the wall\'s whole life',
    B.hbarricade.barr === 1 && B.hbarricade.hbarr === 1 && B.hbarricade.sz === 1);
  ok('T62.E it carries NO activated ability, by specification',
    !B.hbarricade.lock && !B.hbarricade.regroup && !B.hbarricade.pour && !B.hbarricade.uplink && !B.hbarricade.scuttle);

  const w1 = bld88('hbarricade', me, bx, by);
  const man = put88('grunt', me, w1.x + 1, w1.y);
  ok('T62.E one wall cuts damage by HBARR_RED', Math.abs(hit88(man, 20) - 20 * (1 - HBARR_RED)) < 1e-9);
  const w2 = bld88('hbarricade', me, bx, by + 1);
  const w3 = bld88('hbarricade', me, bx + 1, by + 1);
  ok('T62.E three overlapping walls STACK, which no other reduction in the file does',
    Math.abs(hit88(man, 20) - 20 * (1 - 3 * HBARR_RED)) < 1e-9);
  for (let i = 0; i < 4; i++) bld88('hbarricade', me, bx - 1 + (i % 2), by - 1 + ((i / 2) | 0));
  ok('T62.E ...but never past HBARR_CAP, however many overlap',
    Math.abs(hit88(man, 20) - 20 * (1 - HBARR_CAP)) < 1e-9);

  /* the three things it shelters that no other aura in the file does */
  {
    const bldg = bld88('generator', me, bx + 1, by + 2);
    ok('T62.E it shelters STRUCTURES, not only units', hit88(bldg, 20) < 20);
    const wall = bld88('barricade', me, bx + 2, by + 1);
    ok('T62.E ...and other walls, including the cheap one', hit88(wall, 20) < 20);
    ok('T62.E ...and it does NOT shelter itself - a lone wall wears its own 150',
      (() => { G = null; newGame(cfg88('gray', 880502));
        const p2 = G.human, h2 = p2.blds.find(b => b.key === 'hq');
        const lone = bld88('hbarricade', p2, Math.floor(h2.tx) + 12, Math.floor(h2.ty) + 12);
        return Math.abs(hit88(lone, 20) - 20) < 1e-9; })());
  }
  /* an enemy standing behind your wall gets nothing */
  {
    G = null; newGame(cfg88('gray', 880503));
    const p2 = G.human, e2 = foe88(p2), h2 = p2.blds.find(b => b.key === 'hq');
    const w = bld88('hbarricade', p2, Math.floor(h2.tx) + 10, Math.floor(h2.ty) + 10);
    const theirs = put88('grunt', e2, w.x + 1, w.y);
    ok('T62.E an ENEMY beside the wall is not sheltered by it', Math.abs(hit88(theirs, 20) - 20) < 1e-9);
    const ours = put88('grunt', p2, w.x + 1, w.y);
    ok('T62.E ...while one of ours on the same tile is', hit88(ours, 20) < 20);
    const far = put88('grunt', p2, w.x + 3, w.y);
    ok('T62.E and the reach really is the ring of tiles around it', Math.abs(hit88(far, 20) - 20) < 1e-9);
  }
}

/* ---------- F: the buried mine ---------- */
{
  /* the ROLL, over a real sample. HBARR_MINE_P is 0.10 and the draw is taken for
     every completed wall whether or not it succeeds, so the stream does not fork
     on the outcome - which is checked on its own below. */
  G = null; newGame(cfg88('gray', 880601));
  const me = G.human, en = foe88(me);
  G.map.mines.length = 0;
  let tries = 0;
  for (let i = 0; i < 400; i++) {
    const b = makeBuilding('hbarricade', me, 2 + (i % 40), 2 + ((i / 40) | 0), true);
    b.prog = 0.99; tries++; updateBld(b, 1);
  }
  const buried = G.map.mines.filter(m => m.gray).length;
  ok(`T62.F the roll is about one in ten (${buried}/${tries})`,
    tries === 400 && Math.abs(buried / tries - HBARR_MINE_P) < 0.05);
  ok('T62.F the draw is taken for EVERY wall, so the RNG stream cannot fork on the outcome',
    /const roll=srand\(\);/.test(buryHBMine.toString()) &&
    buryHBMine.toString().indexOf('srand()') === buryHBMine.toString().lastIndexOf('srand()'));

  const mn = G.map.mines.find(m => m.gray);
  ok('T62.F a buried mine records whose it is', !!mn && mn.pi === me.i && mn.gray === 1 && mn.live === true);
  ok('T62.F it does NOT answer to the army that buried it', mineArms(mn, { p: me }) === false);
  ok('T62.F ...and it does answer to everybody else', mineArms(mn, { p: en }) === true);
  ok('T62.F the map\'s own mines still answer to everybody, including Gray',
    (() => { const plain = { x: 5, y: 5, live: true }; return mineArms(plain, { p: me }) === true && mineArms(plain, { p: en }) === true; })());
  ok('T62.F the sweep consults it rather than trusting the list',
    /mineArms\(mn,u\)/.test(updateHazards.toString()));

  /* DRIVEN: the owner walks over it and lives; an enemy does not */
  {
    G = null; newGame(cfg88('gray', 880602));
    const p2 = G.human, e2 = foe88(p2);
    G.map.mines.length = 0;
    G.map.mines.push({ x: 30, y: 30, live: true, gray: 1, pi: p2.i });
    const ours = put88('grunt', p2, 30, 30);
    updateHazards(DT88);
    ok('T62.F the owner walks over his own field untouched',
      G.map.mines[0].live === true && ours.hp === ours.mhp);
    const theirs = put88('grunt', e2, 30, 30);
    updateHazards(DT88);
    ok('T62.F ...and an enemy on the same tile sets it off', G.map.mines[0].live === false);
    ok('T62.F ...and it hits as hard as any other mine', theirs.hp < theirs.mhp);
  }
  /* the FRONT is the nearest enemy HQ, and with none there is no mine */
  {
    G = null; newGame(cfg88('gray', 880603));
    const p2 = G.human, e2 = foe88(p2);
    const h2 = p2.blds.find(b => b.key === 'hq'), eh = e2.blds.find(b => b.key === 'hq');
    const w = bld88('hbarricade', p2, Math.floor(h2.tx) + 6, Math.floor(h2.ty) + 6);
    ok('T62.F the front is the nearest enemy HQ', hbMineFront(w) === eh);
    G.map.mines.length = 0;
    for (let i = 0; i < 200; i++) { const m = buryHBMine(w); if (m) break; }
    const got = G.map.mines.filter(m => m.gray);
    ok('T62.F ...and the mine lands toward it, about HBARR_MINE_D tiles out',
      got.length === 1 && dhyp(got[0].x - w.x, got[0].y - w.y) <= HBARR_MINE_D + 3 &&
      dhyp(got[0].x - eh.x, got[0].y - eh.y) < dhyp(w.x - eh.x, w.y - eh.y));
    /* with no enemy HQ there is no front, so no mine - but the draw is still taken */
    for (const b of e2.blds.slice()) if (b.key === 'hq') { b.hp = 0; kill(b, null); }
    G.map.mines.length = 0;
    const r0 = G.rngS;
    for (let i = 0; i < 50; i++) buryHBMine(w);
    ok('T62.F with no enemy HQ nothing is buried, and the stream still advanced',
      G.map.mines.filter(m => m.gray).length === 0 && G.rngS !== r0);
  }
}

/* ---------- G: the Smokescreen ---------- */
{
  ok('T62.G it is a `fac` row on the shared table, not a second table',
    !!radioAbility('smokescr') && radioAbility('smokescr').fac === 'gray');
  ok('T62.G only Gray may arm it',
    radioAllowed({ fac: 'gray' }, 'smokescr') &&
    !['green', 'tan', 'blue'].some(f => radioAllowed({ fac: f }, 'smokescr')));
  ok('T62.G it needs no vision, on the Paradrop\'s rule rather than the Barrage\'s',
    !radioNeedsVision('smokescr'));

  G = null; newGame(cfg88('gray', 880701));
  const me = G.human, en = foe88(me);
  const hq = me.blds.find(b => b.key === 'hq');
  const tower = bld88('radiotower', me, Math.floor(hq.tx) + 6, Math.floor(hq.ty) + 6);
  radioSmokescreen(tower, 40, 40);
  const inside = put88('grunt', me, 40.2, 40.2);
  const bldg = bld88('generator', me, 39, 39);
  const outside = put88('grunt', me, 40 + SMOKESCR_BOX, 40);
  const enemyIn = put88('grunt', en, 40.2, 40.2);
  ok('T62.G a friendly unit inside takes SMOKESCR_RED less',
    Math.abs(hit88(inside, 20) - 20 * (1 - SMOKESCR_RED)) < 1e-9);
  ok('T62.G a friendly STRUCTURE inside does too, which the Mortar\'s cloud never did',
    Math.abs(hit88(bldg, 20) - 20 * (1 - SMOKESCR_RED)) < 1e-9);
  ok('T62.G ...and that is the difference the constants record',
    SMOKESCR_RED === 0.40 && SMOKE_RED === 0.20 && SMOKESCR_BOX === 7 && SMOKESCR_T > SMOKE_T);
  ok('T62.G a friendly outside takes the plain amount', Math.abs(hit88(outside, 20) - 20) < 1e-9);
  ok('T62.G an ENEMY standing in it takes the plain amount', Math.abs(hit88(enemyIn, 20) - 20) < 1e-9);
  ok('T62.G the cloud expires on its own clock',
    (() => { const s = G.strikes.find(x => x.kind === 'smokescr'); s.t = SMOKESCR_T; updateStrikes(DT88);
      return !G.strikes.some(x => x.kind === 'smokescr'); })());
  ok('T62.G ...and once it is gone the reduction is gone with it',
    Math.abs(hit88(inside, 20) - 20) < 1e-9);

  /* THE DOOR, which is what actually enforces the ownership - the panel is
     client-local and a peer can send whatever mode it likes */
  {
    G = null; newGame(cfg88('green', 880702));
    const gp = G.human, gh = gp.blds.find(b => b.key === 'hq');
    const gt = bld88('radiotower', gp, Math.floor(gh.tx) + 6, Math.floor(gh.ty) + 6);
    execCmd({ op: 'radio', pi: gp.i, a: { bid: gt.id, mode: 'smokescr', x: 40, y: 40 } });
    ok('T62.G a GREEN tower is refused the Smokescreen at execCmd',
      !G.strikes.some(s => s.kind === 'smokescr') && gt.abilityCool === 0);
  }
  /* THE BOT, which is the surface that hides: aiTick calls the ability function
     directly and never passes through execCmd. v87 records this trap by name. */
  ok('T62.G the bot path is gated too, on radioAllowed and not on the mode string',
    /radioAllowed\(p,'smokescr'\)/.test(aiTick.toString()) &&
    /radioSmokescreen\(radio,/.test(aiTick.toString()));
  ok('T62.G ...and the Choktaw\'s Paint is on the bot\'s list as well',
    /paintArea\(u,bx,by\)/.test(aiTick.toString()));
}

/* ---------- H: hashed AND serialized ---------- */
{
  G = null; newGame(cfg88('gray', 880801));
  const me = G.human, en = foe88(me);
  const hq = me.blds.find(b => b.key === 'hq');
  const ck = put88('choktaw', me, hq.x + 4, hq.y + 4);
  const vic = put88('grunt', en, hq.x + 8.5, hq.y + 8.5);
  paintArea(ck, Math.floor(hq.x) + 8, Math.floor(hq.y) + 8);
  G.map.mines.push({ x: hq.x + 12, y: hq.y + 12, live: true, gray: 1, pi: me.i });
  bld88('hbarricade', me, Math.floor(hq.tx) + 10, Math.floor(hq.ty) + 10);
  radioSmokescreen(bld88('radiotower', me, Math.floor(hq.tx) + 6, Math.floor(hq.ty) + 6), hq.x + 2, hq.y + 2);

  const h0 = hashState();
  ok('T62.H the mark moves the hash', (() => { const t = vic.paintT; vic.paintT = 1; const h = hashState(); vic.paintT = t; return h !== h0; })());
  ok('T62.H the cooldown moves the hash', (() => { const t = ck.abCool; ck.abCool = 3; const h = hashState(); ck.abCool = t; return h !== h0; })());
  ok('T62.H the mine\'s OWNER moves the hash',
    (() => { const m = G.map.mines[G.map.mines.length - 1]; const t = m.pi; m.pi = 99; const h = hashState(); m.pi = t; return h !== h0; })());
  ok('T62.H ...and so does where it is buried',
    (() => { const m = G.map.mines[G.map.mines.length - 1]; const t = m.x; m.x += 1; const h = hashState(); m.x = t; return h !== h0; })());

  const coolAtSave = ck.abCool;   // captured BEFORE the run: ck is a live object and keeps ticking
  const json = saveState();
  for (let i = 0; i < 30; i++) update(DT88);
  loadState(json);
  ok('T62.H save/load restores the exact hash', hashState() === h0);
  const ck2 = G.units.find(u => u.key === 'choktaw');
  const vic2 = G.units.find(u => u.paintT > 0);
  ok('T62.H the Choktaw and its cooldown survive the round-trip',
    !!ck2 && ck2.abCool === coolAtSave && coolAtSave === PAINT_CD);
  ok('T62.H the mark survives it', !!vic2 && Math.abs(vic2.paintT - PAINT_T) < 1e-9);
  ok('T62.H the buried mine survives it, owner and all',
    G.map.mines.some(m => m.gray === 1 && m.pi === me.i && m.live));
  ok('T62.H the wall survives it', G.blds.some(b => b.key === 'hbarricade' && b.t.hbarr));
  ok('T62.H the cloud survives it', G.strikes.some(s => s.kind === 'smokescr'));
  /* a pre-v88 save carries none of the new fields, and the defaults are honest */
  {
    const old = JSON.parse(json);
    for (const u of old.units) delete u.paintT;
    for (const m of old.mines) { delete m.gray; delete m.pi; }
    loadState(JSON.stringify(old));
    ok('T62.H a pre-v88 save loads with every unit unpainted',
      G.units.every(u => u.paintT === 0));
    ok('T62.H ...and every mine answering to everybody, which is what it was',
      G.map.mines.every(m => !m.gray && m.pi === null) &&
      mineArms(G.map.mines[0], { p: G.human }) === true);
  }
}

/* ---------- I: the manual states every number off the constant ---------- */
{
  const HTML88 = (() => { try { return require('fs').readFileSync('pw.html', 'utf8'); } catch (e) { return null; } })();
  ok('T62.I pw.html is readable next to the harness', !!HTML88);
  if (HTML88) {
    const slots = ['fobRg', 'paintDmg', 'paintBox', 'paintT', 'paintCd',
      'hbarrHp', 'hbarrRed', 'hbarrCap', 'hbarrMineP', 'hbarrMineD',
      'scrBox', 'scrRed', 'scrT'];
    const missing = slots.filter(k => !HELP_TUNE[k]);
    ok('T62.I every v88 figure has a HELP_TUNE slot' + (missing.length ? ' (' + missing.join(', ') + ')' : ''),
      missing.length === 0);
    const unused = slots.filter(k => HTML88.indexOf('data-tune="' + k + '"') < 0);
    ok('T62.I ...and every slot is actually read by the markup' + (unused.length ? ' (' + unused.join(', ') + ')' : ''),
      unused.length === 0);
    /* the slots return what the constants say, not a typed-in copy */
    ok('T62.I the slots read the constants',
      HELP_TUNE.fobRg() === FOB_RG && HELP_TUNE.paintDmg() === 25 && HELP_TUNE.paintCd() === PAINT_CD &&
      HELP_TUNE.hbarrHp() === HBARR_HP && HELP_TUNE.hbarrCap() === 60 &&
      HELP_TUNE.scrBox() === SMOKESCR_BOX && HELP_TUNE.scrRed() === 40);
    /* the manual names the new things, so a reader can find them at all */
    for (const nm of ['Choktaw Heli', 'Forward Observer', 'Paint', 'Heavy Barricade', 'Smokescreen'])
      ok('T62.I the manual names the ' + nm, HTML88.indexOf(nm) > 0);
  }
}

/* ---------- J: roadmap 2 is finished ---------- */
{
  /* The claim the whole roadmap was for, stated once, over all four armies at
     once and derived off FAC rather than transcribed. */
  const ARMIES = ['green', 'tan', 'gray', 'blue'];
  ok('T62.J every army fields an exclusive out of the Barracks, the Garage AND the Helipad',
    ARMIES.every(f => FAC_INF[f].length > 0 && FAC_VEH[f].length > 0 && FAC_AIR[f].length > 0));
  ok('T62.J every army holds exactly two exclusive structures',
    ARMIES.every(f => FAC[f].ub.length === 2));
  ok('T62.J every army holds exactly one call-down of its own',
    ARMIES.every(f => RADIO_ABILITIES.filter(a => a.fac === f).length === 1));
  ok('T62.J ...and the shared pool is still the barrage and the paradrop',
    RADIO_ABILITIES.filter(a => !a.fac).map(a => a.mode).sort().join() === 'barrage,paradrop');
  ok('T62.J ...off ONE table with one field, never a second table per army',
    RADIO_ABILITIES.length === 6 && ARMIES.every(f => radioListFor({ fac: f }).length === 3));
  ok('T62.J no army can research another\'s exclusive, in either direction',
    ARMIES.every(f => ARMIES.filter(g => g !== f).every(g =>
      FAC[g].uu.concat(FAC[g].ub).every(k => {
        const t = (U[k] || B[k]).tech;
        return !t || !techAvailable({ fac: f }, t);
      }))));
  /* the build-menu alphabet, which v86 recorded as the thing that would run out */
  ok('T62.J the build menu still fits the alphabet, with room left',
    ARMIES.every(f => bldRoster({ fac: f }).length <= MENU_KEYS.length) &&
    ARMIES.every(f => bldRoster({ fac: f }).length === bldRoster({ fac: ARMIES[0] }).length));
}
