section('T59 v86: Green\'s full exclusive set');

/* What this pins, and why each claim is here rather than left to the trails: the
   trails prove v86 CHANGED the simulation, which on its own is worth nothing - a
   bug changes it too. These are the properties that make the change the one that
   was intended, plus the four a release of this shape gets wrong most easily:
   a derived constant silently re-tuned by two new rows in U, an aura written onto
   the entities it affects rather than read off its source, new sim state hashed
   but not serialized (or the reverse), and a "cannot be targeted" rule enforced at
   one door out of five.

     A  the tables: Green's set is complete, and nothing else in U or B moved
     B  the Command Truck - Forward Command, and Broadcast
     C  the Observation Balloon - who may shoot it, the fuel, High Ground, Bail
     D  the Command Post - the cheaper ladder, and Regroup
     E  the Supply Drop - the crates, who may take them, and that they never expire
     F  it is sim state, so it is hashed AND it survives a save
     G  the manual states every one of these numbers off the constant
     H  the bot rules, driven rather than read
*/

const DT86 = 1 / 30;
const cfg86 = (fac, seed, opp) => ({ map: 'backyard', mode: 'dm', diff: 'normal', fac, opp: (opp == null ? 1 : opp), seed });
function put86(k, p, x, y) { const u = makeUnit(k, p, x, y); u.state = 'idle'; u.path = null; u.target = null; return u; }
function bld86(k, p, tx, ty) { const b = makeBuilding(k, p, tx, ty, true); b.prog = 1; b.hp = b.mhp; b.abilityCool = 0; return b; }

/* ---------- A: the tables ---------- */
{
  ok('T59.A Green now fields an exclusive out of all three production buildings',
    FAC_INF.green.length > 0 && FAC_VEH.green.includes('cmdtruck') && FAC_AIR.green.includes('balloon'));
  ok('T59.A ...and the same three are on FAC.uu, which is what techAvailable reads',
    ['sarge', 'mortar', 'cmdtruck', 'balloon'].every(k => FAC.green.uu.includes(k)));
  ok('T59.A Green holds two exclusive structures now',
    FAC.green.ub.length === 2 && FAC.green.ub.includes('radar') && FAC.green.ub.includes('cmdpost'));
  for (const f of ['tan', 'gray', 'blue']) {
    ok(`T59.A ${f} can research none of Green's three, and Green can research all three`,
      ['u_cmdtruck', 'u_balloon', 'b_cmdpost'].every(t => !techAvailable({ fac: f }, t)) &&
      ['u_cmdtruck', 'u_balloon', 'b_cmdpost'].every(t => techAvailable({ fac: 'green' }, t)));
    ok(`T59.A ...and ${f}'s build and production rosters carry none of them`,
      !bldRoster({ fac: f }).includes('cmdpost') &&
      !fullRoster({ fac: f }, 'garage').includes('cmdtruck') &&
      !fullRoster({ fac: f }, 'helipad').includes('balloon'));
  }
  ok('T59.A the Command Truck is built at the Garage and the Balloon at the Helipad',
    prodBldOf('cmdtruck') === 'garage' && prodBldOf('balloon') === 'helipad' &&
    fullRoster({ fac: 'green' }, 'garage').includes('cmdtruck') &&
    fullRoster({ fac: 'green' }, 'helipad').includes('balloon'));
  ok('T59.A the info panel attributes all three to Green',
    infoFacOf('unit', 'cmdtruck') === 'green' && infoFacOf('unit', 'balloon') === 'green' &&
    infoFacOf('bld', 'cmdpost') === 'green');
  ok('T59.A the Balloon carries NO unit limit, by decision', !U.balloon.lim && !U.cmdtruck.lim);
  ok('T59.A both new units are unarmed, which is why neither can drag the combat floor',
    U.cmdtruck.dm === 0 && U.balloon.dm === 0);

  /* THE TRAP THE v85 NOTE NAMES. Any constant derived as a min or a max over the
     whole roster is re-derived by an addition to it. Both of these were checked
     BEFORE the rows went in and both are asserted here so they stay checked: the
     Medic's floor is a Math.min over everything that fights, and the supply
     quartiles are a rank over everything that can be trained. */
  ok('T59.A the Medic heal floor is untouched - it reads the lowest-DPS COMBAT unit',
    Math.abs(MEDIC_HEAL_RATE - 2.0893604651162794) < 1e-9);
  ok('T59.A ...and it is untouched because neither new row fights, not by exemption',
    !U.cmdtruck.noPace && !U.balloon.noPace &&
    (() => { let lo = Infinity; for (const k in U) { const t = U[k]; if (t.dm > 0 && t.rt > 0 && !t.heal && !t.noPace) lo = Math.min(lo, t.dm / t.rt); } return Math.abs(lo * 0.9 * HP_SCALE - MEDIC_HEAL_RATE) < 1e-12; })());
  {
    /* the supply ranks every unit HAD, transcribed from the v85 build, so a
       re-tiering fires here as a named unit rather than as a trail that moved */
    const V85 = { truck: 1, grunt: 1, grenadier: 1, runner: 1, bazooka: 1, bike: 1, para: 1,
      gunner: 2, flamer: 2, jeep: 2, mortar: 2, sniper: 2,
      medic: 3, aatruck: 3, tank: 3, heli: 3, apc: 3,
      sarge: 4, chinook: 4, arty: 4, apache: 4, bulltank: 4 };
    const moved = Object.keys(V85).filter(k => supOf(k) !== V85[k]);
    ok('T59.A adding two units moved NO existing unit between supply tiers' + (moved.length ? ' (' + moved.join(', ') + ')' : ''),
      moved.length === 0);
    ok('T59.A ...and the two arrivals took the ranks their prices bought',
      supOf('cmdtruck') === 2 && supOf('balloon') === 3);
    /* COUNTERFACTUAL: the prices are load-bearing, not decorative. Price the
       Command Truck one plastic under the Mortar Squad and the tiers really do
       shift, which is what makes the check above worth having. */
    const keep = U.cmdtruck.cp;
    U.cmdtruck.cp = 20;
    const cost = k => U[k].cp + U[k].ce;
    const tr = Object.keys(U).filter(k => !U[k].noTrain).sort((a, b) => (cost(a) - cost(b)) || (a < b ? -1 : a > b ? 1 : 0));
    const rank = k => Math.min(SUP_MAX, 1 + Math.floor(tr.indexOf(k) * SUP_MAX / tr.length));
    ok('T59.A COUNTERFACTUAL: a cheaper Command Truck really would re-tier the roster',
      rank('bike') !== V85.bike || rank('gunner') !== V85.gunner);
    U.cmdtruck.cp = keep;
  }
}

/* ---------- B: the Command Truck ---------- */
{
  G = null; newGame(cfg86('green', 860101));
  const p = G.human;

  /* FORWARD COMMAND. Found rather than assumed: a tile the placement door refuses
     ONLY for being outside the build zone, so the truck is the single thing that
     changes the answer. */
  let far = null;
  for (let ty = 30; ty < 56 && !far; ty++) for (let tx = 30; tx < 56 && !far; tx++)
    if (placeDeny(p, 'barracks', tx, ty) === 'near') far = { tx, ty };
  ok('T59.B there is a tile refused only for being out of the build zone', !!far);
  if (far) {
    const truck = put86('cmdtruck', p, far.tx + 4, far.ty + 1);
    ok('T59.B a Command Truck opens that tile for the three structures it anchors',
      CMD_BLD.every(k => placeDeny(p, k, far.tx, far.ty) === ''));
    ok('T59.B ...and for nothing else in the catalogue',
      Object.keys(B).filter(k => !CMD_BLD.includes(k) && !B[k].anywhere && k !== 'nest')
        .every(k => placeDeny(p, k, far.tx, far.ty) !== ''));
    ok('T59.B the three are exactly the owner\'s list, read off the constant',
      CMD_BLD.join(',') === 'barricade,guardtower,barracks');
    /* the radius is a radius: step the truck outside it and the same tile closes */
    truck.x = far.tx + 1 + CMD_R + 0.5; truck.y = far.ty + 1;
    ok('T59.B a truck past CMD_R anchors nothing', placeDeny(p, 'barracks', far.tx, far.ty) === 'near');
    truck.x = far.tx + 4; truck.y = far.ty + 1;
    ok('T59.B ...and back inside it, it anchors again', placeDeny(p, 'barracks', far.tx, far.ty) === '');
    /* a wreck and a passenger anchor nothing either */
    truck.hp = 0;
    ok('T59.B a destroyed truck anchors nothing', placeDeny(p, 'barracks', far.tx, far.ty) === 'near');
    truck.hp = truck.mhp; truck.garrisoned = true;
    ok('T59.B nor does one riding in a transport', placeDeny(p, 'barracks', far.tx, far.ty) === 'near');
    truck.garrisoned = false;
    /* and it is YOUR truck, not anybody's */
    const foe = G.players[1];
    const theirs = put86('cmdtruck', foe, far.tx + 4, far.ty + 1);
    truck.hp = 0;
    ok('T59.B an enemy truck does not open your build zone',
      placeDeny(p, 'barracks', far.tx, far.ty) === 'near' && theirs.hp > 0);
  }

  /* BROADCAST. The reload door is rtOf, so the claim is measured there and at the
     one place fireAt actually charges it. */
  G = null; newGame(cfg86('green', 860102));
  const q = G.human;
  const tr = put86('cmdtruck', q, 40, 40);
  const near = put86('grunt', q, 40.6, 40), out = put86('grunt', q, 40 + BCAST_R + 2, 40);
  ok('T59.B with the net closed nobody reloads faster',
    rtOf(near) === U.grunt.rt && rtOf(out) === U.grunt.rt);
  tr.bcast = true;
  ok(`T59.B Broadcast is a ${Math.round(BCAST_RT * 100)}% SHORTER reload, not a ${Math.round(BCAST_RT * 100)}% lower rate`,
    Math.abs(rtOf(near) - U.grunt.rt * (1 - BCAST_RT)) < 1e-12);
  ok('T59.B ...and it stops at the radius', rtOf(out) === U.grunt.rt);
  ok('T59.B it reaches vehicles and aircraft too - a reload is not an infantry idea',
    (() => { const j = put86('jeep', q, 40.6, 40.4); return Math.abs(rtOf(j) - U.jeep.rt * (1 - BCAST_RT)) < 1e-12; })());
  ok('T59.B it reaches an ALLY, not just the owner',
    (() => { const a = G.players.find(x => x !== q); if (!a) return true; a.team = q.team; const m = put86('grunt', a, 40.6, 39.6); return allied(a, q) && Math.abs(rtOf(m) - U.grunt.rt * (1 - BCAST_RT)) < 1e-12; })());
  /* it composes with Ripple Fire rather than replacing it, because both live in rtOf */
  {
    const ar = put86('arty', q, 40.4, 40.4); ar.rip = true;
    ok('T59.B a broadcast Ripple Fire pays both multipliers, at one door',
      Math.abs(rtOf(ar) - U.arty.rt * RIPPLE_RT * (1 - BCAST_RT)) < 1e-9);
  }
  /* THE COST. The truck is pinned, at the one door every order in the file goes
     through - a player order, a bot order, a rally hop and a retaliation march. */
  G = null; newGame(cfg86('green', 860103));
  const r = G.human;
  const t2 = put86('cmdtruck', r, 30, 30);
  execCmd({ op: 'bcast', pi: r.i, a: { ids: [t2.id], on: true } });
  ok('T59.B the command sets the flag and drops the march on the same tick',
    t2.bcast === true && !t2.path && !t2.dest && t2.state === 'idle');
  orderMove(t2, 44, 44);
  ok('T59.B ...and no order will move it while the net is open',
    !t2.path && t2.state === 'idle');
  const wasX = t2.x, wasY = t2.y;
  for (let i = 0; i < 90; i++) update(DT86);
  ok('T59.B ...it really does not drift', Math.abs(t2.x - wasX) < 1e-9 && Math.abs(t2.y - wasY) < 1e-9);
  execCmd({ op: 'bcast', pi: r.i, a: { ids: [t2.id], on: false } });
  orderMove(t2, 44, 44);
  ok('T59.B close the net and it takes orders again', t2.bcast === false && !!t2.path);
  /* the command door refuses a unit that carries no such capability */
  const g2 = put86('grunt', r, 31, 31);
  execCmd({ op: 'bcast', pi: r.i, a: { ids: [g2.id], on: true } });
  ok('T59.B a Grunt cannot be told to broadcast', g2.bcast === undefined);
}

/* ---------- C: the Observation Balloon ---------- */
{
  G = null; newGame(cfg86('green', 860201));
  const me = G.human, foe = G.players[1];

  ok('T59.C it has the highest sight in the game - buildings included',
    Object.keys(U).every(k => U[k].vi <= U.balloon.vi) &&
    Object.keys(B).every(k => (B[k].vi || 0) <= U.balloon.vi) &&
    U.balloon.vi === BALLOON_VI);
  ok('T59.C it drifts: the slowest thing in the air, and slower than any infantryman',
    Object.keys(U).filter(k => U[k].fly).every(k => U[k].sp >= U.balloon.sp) &&
    Object.keys(U).filter(k => U[k].a === 'inf').every(k => U[k].sp > U.balloon.sp));

  const bal = put86('balloon', me, 50, 50);
  /* WHO MAY EVEN POINT AT IT. Every acquisition door, not just the one: the gate
     is the whole ability, and a door left out is a rifleman standing under a
     balloon forever dealing nothing. */
  const rifle = put86('grunt', foe, 50.5, 50), aa = put86('aatruck', foe, 51, 50);
  ok('T59.C mainOk refuses every weapon but the AA missile',
    !mainOk(rifle, bal) && mainOk(aa, bal));
  ok('T59.C nearestEnemy does not offer it to a rifleman, and does to the AA truck',
    nearestEnemy(rifle, 12) !== bal && nearestEnemy(aa, 12) === bal);
  ok('T59.C orderAttack refuses to send a rifleman at it, from any caller',
    (() => { orderAttack(rifle, bal); return rifle.target !== bal; })());
  {
    const tw = bld86('guardtower', foe, 46, 46);
    tw.target = null; tw.cool = 0;
    for (let i = 0; i < 20; i++) updateBld(tw, DT86);
    ok('T59.C a guard tower never acquires it either - wcOf answers for buildings too',
      tw.target !== bal && !ballOk(tw, bal));
  }
  ok('T59.C the Bull\'s hull flamer does not own it either - it is not infantry',
    !secOwns({ t: U.bulltank }, bal));

  /* WHAT IT TAKES WHEN SOMETHING DOES. A flat share, superseding the matrix. */
  ok(`T59.C an AA missile deals ${Math.round(BALLOON_AA * 100)}% and every other row deals nothing`,
    targetDmgMul(aa, bal) === BALLOON_AA &&
    ['b', 'g', 'r', 's', 'm', 'f', 'd', 'q', 'x'].every(w => targetDmgMul(null, bal, w) === 0));
  ok('T59.C ...and that supersedes WVA.a.air rather than multiplying it',
    WVA.a.air === 1.6 && targetDmgMul(aa, bal) !== WVA.a.air * BALLOON_AA);
  {
    const hp0 = bal.hp;
    const tank = put86('tank', foe, 51, 51);
    splash(50, 50, 3, 200, 'ex', tank, 's');
    ok('T59.C splash never touches it - a shell on its head does nothing at all', bal.hp === hp0);
    splash(50, 50, 3, 200, 'ex', aa, 'a');
    ok('T59.C ...but an AA burst, which is how every rocket in this file lands, does',
      Math.abs((hp0 - bal.hp) - 200 * BALLOON_AA) < 1e-9);
    bal.hp = hp0;
  }

  /* HIGH GROUND, read off the balloon and written onto nobody. */
  {
    const inside = put86('grunt', me, 50 + BALLOON_VI - 2, 50);
    const outside = put86('grunt', me, 50 + BALLOON_VI + 3, 50);
    ok('T59.C an ally inside its vision gains range', rgOf(inside) === U.grunt.rg + HIGH_RG);
    ok('T59.C ...and one outside it does not', rgOf(outside) === U.grunt.rg);
    ok('T59.C the aura reaches as far as the SIGHT does, not a radius of its own',
      viOf(bal) === BALLOON_VI &&
      (() => { const edge = put86('grunt', me, 50 + BALLOON_VI - 0.2, 50); return rgOf(edge) === U.grunt.rg + HIGH_RG; })());
    ok('T59.C an unarmed hull is not handed a weapon range by it',
      rgOf(put86('truck', me, 51, 50)) === 0);
    /* MUTATION: kill the balloon and the range goes on the same tick, with
       nothing left stamped on the man */
    const keepHp = bal.hp; bal.hp = 0;
    ok('T59.C MUTATION: with the balloon down the range is gone at once',
      rgOf(inside) === U.grunt.rg);
    bal.hp = keepHp;
  }

  /* THE FUEL, and the crash. */
  G = null; newGame(cfg86('green', 860202));
  const p2 = G.human;
  const b2 = put86('balloon', p2, 40, 40);
  ok('T59.C a fresh balloon launches with a full tank', b2.fuel === BALLOON_FUEL);
  for (let i = 0; i < 30; i++) updateUnit(b2, DT86);
  ok('T59.C the gas counts down in seconds', Math.abs(b2.fuel - (BALLOON_FUEL - 1)) < 1e-9);
  {
    /* counted against the ids that existed BEFORE, because a fresh match already
       fields two Grunts of its own and a bare key count would read them as crew */
    const was = new Set(p2.units.map(u => u.id)), before = p2.units.length;
    b2.fuel = 0.5;
    for (let i = 0; i < 30; i++) if (G.units.includes(b2)) updateUnit(b2, DT86);
    ok('T59.C it comes down on its own when the gas runs out', !G.units.includes(b2));
    ok('T59.C ...and the crash kills everyone aboard: it does NOT auto-bail',
      p2.units.length === before - 1 && p2.units.every(u => was.has(u.id)));
  }
  /* BAIL is the other way down, and the only one that gets the crew back. */
  {
    G = null; newGame(cfg86('green', 860203));
    const p3 = G.human;
    const b3 = put86('balloon', p3, 40, 40);
    const before = p3.units.length, was = new Set(p3.units.map(u => u.id));
    execCmd({ op: 'bail', pi: p3.i, a: { ids: [b3.id] } });
    const crew = p3.units.filter(u => !was.has(u.id));
    ok('T59.C Bail puts exactly the four named men on the ground',
      crew.length === BAIL_CREW.length &&
      BAIL_CREW.every(k => crew.filter(u => u.key === k).length === 1));
    ok('T59.C ...and destroys the balloon it came out of',
      !G.units.includes(b3) && p3.units.length === before - 1 + BAIL_CREW.length);
    ok('T59.C ...on passable ground beneath it',
      crew.every(u => passable(Math.floor(u.x), Math.floor(u.y)) && dhyp(u.x - 40, u.y - 40) < 6));
    ok('T59.C a Grunt cannot be told to bail out of himself',
      (() => { const g = put86('grunt', p3, 30, 30); const n = p3.units.length; execCmd({ op: 'bail', pi: p3.i, a: { ids: [g.id] } }); return p3.units.length === n && g.hp > 0; })());
  }
}

/* ---------- D: the Command Post ---------- */
{
  G = null; newGame(cfg86('green', 860301));
  const p = G.human;
  const post = bld86('cmdpost', p, 40, 40);
  const inside = put86('grunt', p, 41, 41), outside = put86('grunt', p, 41 + CPOST_R + 3, 41);
  const vIn = put86('tank', p, 41, 42), vOut = put86('tank', p, 41 + CPOST_R + 3, 42);

  ok('T59.D inside the radius a promotion costs fewer kills',
    vetSteps(inside).join(',') === VET_INF.map(v => Math.max(1, Math.ceil(v * CPOST_VET))).join(',') &&
    vetSteps(inside).join(',') !== VET_INF.join(','));
  ok('T59.D ...and outside it the ladder is the one every other army climbs',
    vetSteps(outside).join(',') === VET_INF.join(',') && vetSteps(vOut).join(',') === VET_VEH.join(','));
  ok('T59.D vehicles get the same discount off their own ladder',
    vetSteps(vIn).join(',') === VET_VEH.map(v => Math.max(1, Math.ceil(v * CPOST_VET))).join(','));
  ok('T59.D the first rung stays reachable at any multiplier',
    vetSteps(inside).every(v => v >= 1) && vetSteps(vIn).every(v => v >= 1));
  /* the discount is a LADDER, not credit: u.kl is hashed through hI's |0, so a
     fractional kill would advance the state without advancing the hash */
  ok('T59.D it spends the ladder and not the kill count - kl stays an integer',
    (() => { inside.kl = 2; vetRankUp(inside); return Number.isInteger(inside.kl) && inside.kl === 3; })());
  ok('T59.D ...and that third kill promoted the man inside where it would not outside',
    (() => { outside.kl = 2; vetRankUp(outside); return inside.vr === 3 && outside.vr === 2; })());
  ok('T59.D an unfinished post grants nothing',
    (() => { post.prog = 0.5; const r = vetSteps(inside).join(','); post.prog = 1; return r === VET_INF.join(','); })());
  ok('T59.D nor does a rubbled one',
    (() => { post.hp = 0; const r = vetSteps(inside).join(','); post.hp = post.mhp; return r === VET_INF.join(','); })());

  /* REGROUP */
  {
    const hurt = put86('grunt', p, 41.5, 40.5), whole = put86('grunt', p, 41.5, 41.5);
    const away = put86('grunt', p, 41 + CPOST_R + 4, 41);
    hurt.hp = 10; away.hp = 10;
    execCmd({ op: 'regroup', pi: p.i, a: { bid: post.id } });
    ok('T59.D Regroup hands back a share of each unit\'s OWN maximum',
      Math.abs(hurt.hp - (10 + hurt.mhp * REGROUP_HP)) < 1e-9);
    ok('T59.D ...and nothing to a unit outside the radius', away.hp === 10);
    ok('T59.D ...and never past a full unit\'s maximum', whole.hp === whole.mhp);
    ok('T59.D it spends the cooldown and writes no duration - there is nothing running',
      post.abilityCool === REGROUP_CD && !post.upT);
    const was = hurt.hp;
    execCmd({ op: 'regroup', pi: p.i, a: { bid: post.id } });
    ok('T59.D a second press while it recharges does nothing at all', hurt.hp === was);
    post.abilityCool = 0;
    execCmd({ op: 'regroup', pi: p.i, a: { bid: post.id } });
    ok('T59.D ...and everything once it is ready again', hurt.hp > was);
  }
  ok('T59.D a Radar Tent cannot be told to regroup',
    (() => { const rt = bld86('radar', p, 48, 48); execCmd({ op: 'regroup', pi: p.i, a: { bid: rt.id } }); return rt.abilityCool === 0; })());
}

/* ---------- E: the Supply Drop ---------- */
{
  G = null; newGame(cfg86('green', 860401));
  const p = G.human, foe = G.players[1];
  const tw = bld86('radiotower', p, 40, 60);
  const p0 = p.res.p, e0 = p.res.e;

  execCmd({ op: 'radio', pi: p.i, a: { bid: tw.id, mode: 'supply', x: 41, y: 62 } });
  ok('T59.E the call goes up as a strike and spends the tower',
    G.strikes.some(s => s.kind === 'supply') && tw.abilityCool > 0);
  ok('T59.E ...and pays nothing out until the crates land',
    p.res.p === p0 && p.res.e === e0 && G.crates.length === 0);
  for (let i = 0; i < 60; i++) update(DT86);
  ok('T59.E two crates land, one of each resource',
    G.crates.length === 2 && G.crates.filter(c => c.kind === 'p').length === 1 &&
    G.crates.filter(c => c.kind === 'e').length === 1);
  ok('T59.E ...carrying the figures the table states',
    G.crates.every(c => c.amt === (c.kind === 'e' ? DROP_E : DROP_P)) && DROP_P === 500 && DROP_E === 500);
  ok('T59.E ...on passable ground, and the strike is done with',
    G.crates.every(c => passable(Math.floor(c.x), Math.floor(c.y))) &&
    !G.strikes.some(s => s.kind === 'supply'));

  /* NO EXPIRY. Two full minutes of live match, and tracked by IDENTITY rather than
     by a count: this is a real match with a bot in it, and one of the owner's own
     units wandering over the OTHER crate would make a count read as an expiry. */
  const watched = G.crates[0];
  for (let i = 0; i < 3600; i++) update(DT86);
  ok('T59.E a crate nobody has walked over is still there two minutes later',
    G.crates.includes(watched));

  /* WHO MAY TAKE IT. Driven through updateCrates directly rather than through a
     tick of the live match, on the v85 rule that a fixture measuring one thing
     inside update() is measuring the whole match: the first cut of this stood an
     enemy Grunt on the crate and he was dead by the end of the tick (a buried
     landmine, 276 damage), so the check was reading a corpse rather than a
     refusal. That the main loop calls the sweep at all is proved separately just
     below, with a live tick. */
  {
    const c = watched;
    const theirs = put86('grunt', foe, c.x, c.y);
    updateCrates();
    ok('T59.E an enemy standing on a crate cannot take it',
      G.crates.includes(c) && theirs.hp > 0 && !allied(foe, p));
    const mine = put86('grunt', p, c.x, c.y);
    const before = c.kind === 'e' ? p.res.e : p.res.p;
    updateCrates();
    ok('T59.E ...and one of yours standing on it collects it instantly',
      !G.crates.includes(c) && mine.hp > 0 &&
      Math.abs((c.kind === 'e' ? p.res.e : p.res.p) - (before + c.amt)) < 1e-6);
    /* and the sweep really is on the main loop, not only reachable from a test */
    const last = G.crates[0];
    if (last) {
      const b4 = last.kind === 'e' ? p.res.e : p.res.p;
      put86('grunt', p, last.x, last.y);
      update(DT86);
      ok('T59.E ...and update() drives the sweep, so this happens in a real match',
        !G.crates.includes(last) &&
        Math.abs((last.kind === 'e' ? p.res.e : p.res.p) - (b4 + last.amt)) < 1e-6);
    } else ok('T59.E ...and update() drives the sweep, so this happens in a real match', false);
  }
  /* FACTION GATE, at the command door rather than in the panel */
  {
    G = null; newGame(cfg86('gray', 860402));
    const g = G.human, gt = bld86('radiotower', g, 40, 60);
    execCmd({ op: 'radio', pi: g.i, a: { bid: gt.id, mode: 'supply', x: 41, y: 62 } });
    ok('T59.E a Gray tower sending the Green mode is refused at the command door',
      gt.abilityCool === 0 && !G.strikes.some(s => s.kind === 'supply') && G.crates.length === 0);
  }
  ok('T59.E and the two faction rows do not leak into one another',
    radioAllowed({ fac: 'green' }, 'supply') && !radioAllowed({ fac: 'green' }, 'lift') &&
    radioAllowed({ fac: 'blue' }, 'lift') && !radioAllowed({ fac: 'blue' }, 'supply'));
}

/* ---------- F: it is sim state, so it is hashed AND it survives a save ---------- */
{
  G = null; newGame(cfg86('green', 860501));
  const me = G.human;
  const tr = put86('cmdtruck', me, 20, 20);
  const bal = put86('balloon', me, 22, 22);

  const h0 = hashState();
  tr.bcast = true;
  ok('T59.F the Broadcast flag is inside hashState', hashState() !== h0);
  const h1 = hashState();
  bal.fuel -= 5;
  ok('T59.F ...and so is the balloon\'s remaining gas', hashState() !== h1);

  const json = saveState();
  G = null; newGame(cfg86('green', 860501));
  loadState(json);
  ok('T59.F a snapshot carries both',
    G.units.find(u => u.key === 'cmdtruck').bcast === true &&
    Math.abs(G.units.find(u => u.key === 'balloon').fuel - (BALLOON_FUEL - 5)) < 1e-9);

  /* THE CRATES ARE THE RISKY HALF: a list that is hashed and not serialized fails
     a save/load, and one that is serialized and not hashed desyncs a live match
     without ever failing a test. Both directions are driven here. */
  G = null; newGame(cfg86('green', 860502));
  const p2 = G.human, tw = bld86('radiotower', p2, 40, 60);
  execCmd({ op: 'radio', pi: p2.i, a: { bid: tw.id, mode: 'supply', x: 41, y: 62 } });
  for (let i = 0; i < 60; i++) update(DT86);
  const hc = hashState();
  const withCrates = saveState();
  ok('T59.F the crates are in the snapshot',
    JSON.parse(withCrates).crates.length === 2);
  G.crates.pop();
  ok('T59.F ...and taking one out moves the hash', hashState() !== hc);
  G = null; newGame(cfg86('green', 860502));
  loadState(withCrates);
  ok('T59.F a reload restores them exactly', hashState() === hc && G.crates.length === 2);
  /* and they still work after the round trip */
  {
    const c = G.crates[0], p3 = G.players[c.pi];
    const before = c.kind === 'e' ? p3.res.e : p3.res.p;
    put86('grunt', p3, c.x, c.y);
    update(DT86);
    ok('T59.F ...and a reloaded crate is still collectable',
      G.crates.length === 1 && Math.abs((c.kind === 'e' ? p3.res.e : p3.res.p) - (before + c.amt)) < 1e-6);
  }

  /* the three auras write nothing onto the entities they affect, which is the seam
     the whole release is built on: a line under a Broadcast is one boolean. */
  G = null; newGame(cfg86('green', 860503));
  const p4 = G.human;
  const t4 = put86('cmdtruck', p4, 20, 20);
  const b4 = put86('balloon', p4, 20, 21);
  bld86('cmdpost', p4, 22, 22);
  const g4 = put86('grunt', p4, 20.5, 20.5);
  t4.bcast = true;
  const enc = JSON.parse(saveState()).units.find(u => u.id === g4.id);
  ok('T59.F a man inside all three auras carries no new field of his own',
    enc.bcast === undefined && enc.fuel === undefined);
  ok('T59.F ...and all three are still real for him, read off their sources',
    Math.abs(rtOf(g4) - U.grunt.rt * (1 - BCAST_RT)) < 1e-12 &&
    rgOf(g4) === U.grunt.rg + HIGH_RG &&
    vetSteps(g4).join(',') !== VET_INF.join(','));
  ok('T59.F MUTATION: remove the three sources and all three effects stop at once',
    (() => {
      t4.bcast = false; b4.hp = 0;
      for (const b of p4.blds.slice()) if (b.t.cpost) b.hp = 0;
      return rtOf(g4) === U.grunt.rt && rgOf(g4) === U.grunt.rg && vetSteps(g4).join(',') === VET_INF.join(',');
    })());

  /* determinism: the same seed, twice, with all of it in flight */
  const run = () => {
    G = null; newGame(cfg86('green', 860504, 3));
    const q = G.human;
    const tw2 = bld86('radiotower', q, 40, 60);
    put86('cmdtruck', q, 30, 30).bcast = true;
    put86('balloon', q, 32, 32);
    bld86('cmdpost', q, 34, 34);
    execCmd({ op: 'radio', pi: q.i, a: { bid: tw2.id, mode: 'supply', x: 36, y: 36 } });
    for (let i = 0; i < 600; i++) update(DT86);
    return hashState();
  };
  ok('T59.F two runs of the same seed with everything in flight agree', run() === run());
}

/* ---------- G: the manual states these facts off the constants ---------- */
{
  const want = { cmdR: CMD_R, bcastR: BCAST_R, bcastRt: Math.round(BCAST_RT * 100),
    ballVi: BALLOON_VI, ballFuel: BALLOON_FUEL, ballAa: Math.round(BALLOON_AA * 100),
    highRg: HIGH_RG, cpostR: CPOST_R, cpostVet: Math.round((1 - CPOST_VET) * 100),
    regroupHp: Math.round(REGROUP_HP * 100), regroupCd: REGROUP_CD,
    dropP: DROP_P, dropE: DROP_E };
  const bad = Object.keys(want).filter(k => String(helpTuneValue(k)) !== String(want[k]));
  ok('T59.G every v86 manual slot reads the constant the sim reads' + (bad.length ? ' (' + bad.join(', ') + ')' : ''),
    bad.length === 0);
  /* the two list slots read the OTHER tables rather than retyping them, which is
     the whole reason the Command Truck's and the Balloon's card copy is written
     below B rather than inside U */
  ok('T59.G the anchored-structure list is read off B, in the door\'s own order',
    String(helpTuneValue('cmdBlds')) === CMD_BLD.map(k => B[k].n).join(', '));
  ok('T59.G the bail crew is read off U',
    String(helpTuneValue('bailCrew')) === BAIL_CREW.map(k => U[k].n).join(', '));
  ok('T59.G ...and the two info cards say the same, off the same lists',
    U.cmdtruck.d.includes(B.barracks.n) && U.balloon.d.includes(U.bazooka.n) &&
    U.cmdtruck.d.length > 0 && U.balloon.d.length > 0);
  {
    let html = null;
    try { html = require('fs').readFileSync('pw.html', 'utf8'); } catch (e) { html = null; }
    ok('T59.G pw.html is readable next to the harness', !!html);
    if (html) {
      const missing = Object.keys(want).filter(k => html.indexOf('data-tune="' + k + '"') < 0);
      ok('T59.G every v86 slot is actually wired into the manual markup' + (missing.length ? ' (' + missing.join(', ') + ')' : ''),
        missing.length === 0);
    }
  }
}

/* ---------- H: the bot rules, driven rather than read ---------- */
{
  G = null; newGame(cfg86('green', 860601, 3));
  const bot = G.players.find(p => p.ai);
  ok('T59.H both new units are support in the bot\'s eyes, so neither votes on composition',
    !!AI_SUPPORT.cmdtruck && !!AI_SUPPORT.balloon);
  ok('T59.H ...and neither can be drawn by the combat pick, which scores damage per plastic',
    Object.keys(U).filter(k => AI_SUPPORT[k]).every(k => !(U[k].dm > 0)));

  /* BROADCAST: opened on a firefight the truck is already parked beside, closed
     again the moment it stops, so it is never a permanent pin. */
  {
    G = null; newGame(cfg86('green', 860602, 3));
    const p = G.players.find(x => x.ai) || G.players[1];
    p.ai = p.ai || makeAIBrain('balanced');
    const tr = put86('cmdtruck', p, 30, 30);
    const men = []; for (let i = 0; i < BCAST_AI_N; i++) men.push(put86('grunt', p, 30.5 + i * 0.2, 30));
    for (const m of men) m.calmT = 0;
    aiTick(p);
    ok('T59.H a bot opens the net when its line beside the truck is under fire', tr.bcast === true);
    for (const m of men) m.calmT = 999;
    aiTick(p);
    ok('T59.H ...and closes it again when the shooting stops', tr.bcast === false);
  }
  /* REGROUP: spent on units that are actually hurt, not merely in contact. */
  {
    G = null; newGame(cfg86('green', 860603, 3));
    const p = G.players.find(x => x.ai) || G.players[1];
    p.ai = p.ai || makeAIBrain('balanced');
    const post = bld86('cmdpost', p, 30, 30);
    const men = []; for (let i = 0; i < REGROUP_AI_N; i++) men.push(put86('grunt', p, 31 + i * 0.3, 31));
    aiTick(p);
    ok('T59.H a bot does not spend Regroup on an army that is not hurt', post.abilityCool === 0);
    for (const m of men) m.hp = m.mhp * (REGROUP_AI_FLOOR - 0.2);
    const was = men[0].hp;
    aiTick(p);
    ok('T59.H ...and spends it when they are', post.abilityCool > 0 && men[0].hp > was);
  }
  /* BAIL: a bot gets its crew out rather than losing them to the fuel clock. */
  {
    G = null; newGame(cfg86('green', 860604, 3));
    const p = G.players.find(x => x.ai) || G.players[1];
    p.ai = p.ai || makeAIBrain('balanced');
    const b = put86('balloon', p, 30, 30);
    b.fuel = BAIL_AI_T + 20;
    aiTick(p);
    ok('T59.H a bot leaves a balloon with gas in it alone', G.units.includes(b));
    b.fuel = BAIL_AI_T - 1;
    aiTick(p);
    ok('T59.H ...and gets the crew out before it falls',
      !G.units.includes(b) && BAIL_CREW.every(k => p.units.some(u => u.key === k)));
  }
  /* SUPPLY DROP: called when the bank is empty, not as a standing habit. */
  {
    /* a WATCH match, which is the only configuration that boots one bot per
       faction - in a normal match the named faction belongs to the human */
    G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'green', opp: 3, seed: 860605, watch: true });
    const p = G.players.find(x => x.ai && x.fac === 'green');
    if (!p) { ok('T59.H a Green bot was fielded to test the call-down against', false); }
    else {
      const tw = bld86('radiotower', p, Math.round(p.start.x + 5), Math.round(p.start.y + 5));
      p.ai.radioReadyT = -1e6;
      p.res.p = 4000;
      aiTick(p);
      ok('T59.H a rich Green bot does not spend the tower on its own supplies',
        !G.strikes.some(s => s.kind === 'supply'));
      tw.abilityCool = 0; p.ai.radioReadyT = -1e6;
      p.res.p = AI_DROP_FLOOR - 20;
      aiTick(p);
      ok('T59.H ...and a broke one does', G.strikes.some(s => s.kind === 'supply'));
    }
  }
}
