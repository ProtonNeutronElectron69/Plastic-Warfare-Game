section('T63 v88.1: four small updates, and a thumbnail that had been blank since v88');

/* Four unrelated updates. Only ONE of them reaches the simulation - the Machine
   Gunner's price - and that one is the whole reason this release recuts trails.
   The other three are display, and the interesting thing about them is that
   reordering the manual's gallery exposed a v88 regression nothing else could see.

     A  the Machine Gunner's price, and what it bought back
     B  the Forward Pad's repair rate
     C  the gallery: green for shared, the army's colour for exclusive
     D  the gallery: Barracks, Garage, Helipad, each cheapest first
     E  the wall thumbnails, blank since v88
     F  the description pass: shorter, and every number still off its constant
*/

const DT63 = 1 / 30;
function cost63(k) { return (U[k] ? U[k].cp + U[k].ce : B[k].cp + B[k].ce); }

/* ---------- A: the Machine Gunner ---------- */
{
  ok('T63.A he costs 125 plastic, up from the v78 112', U.gunner.cp === 125 && U.gunner.ce === 0);
  ok('T63.A ...and that is the ONLY thing about him that moved',
    U.gunner.rt === .5 && U.gunner.hp === Math.round(100 * HP_SCALE) &&
    U.gunner.dm === +(12 * DMG_SCALE).toFixed(2) && U.gunner.rg === 4 &&
    U.gunner.sp === 1.9 && U.gunner.vi === 6 && U.gunner.entrench === 1);
  ok('T63.A he pays 2 supply again, which is what the price was raised for',
    supOf('gunner') === 2);

  /* THE MECHANISM, reproduced rather than asserted. At 25 trainable units the cheap
     tier holds SEVEN, so somebody is always the seventh-cheapest and pays 1. v88
     left that somebody as the Machine Gunner; the price rise makes it the
     Flamethrower. The slot does not disappear and this release does not pretend it
     does - what it buys is a better occupant. */
  {
    const tr = Object.keys(U).filter(k => !U[k].noTrain)
      .sort((a, b) => (cost63(a) - cost63(b)) || (a < b ? -1 : a > b ? 1 : 0));
    ok('T63.A the cheap tier holds seven at 25 units, so somebody is always in it',
      tr.length === 25 && tr.filter(k => supOf(k) === 1).length === 7);
    ok('T63.A ...and the seventh-cheapest is the Flamethrower now, not the Gunner',
      tr[6] === 'flamer' && tr[7] === 'gunner' && supOf('flamer') === 1);
    ok('T63.A ...because 125 clears the Flamethrower\'s 120, which is the least that would',
      U.gunner.cp > U.flamer.cp && cost63('gunner') > cost63('flamer'));
  }
  /* WHY THAT IS THE BETTER OCCUPANT, and it is the same mitigation T50.C has
     recorded since v73: the Flamethrower is Tan's alone, so three armies in four
     cannot field the per-supply leader at all. */
  ok('T63.A the new occupant is TAN-EXCLUSIVE, so three armies cannot buy him',
    FAC_INF.tan.includes('flamer') &&
    ['green', 'gray', 'blue'].every(f => !FAC_INF[f].includes('flamer')));
  {
    const armed = Object.keys(U).filter(k => U[k].dm > 0 && U[k].rt > 0 && U[k].cp > 0);
    const effDps = k => unitDPS(U[k]) * dmgMulFor(k, U[k].w, 'medium');
    const rank = armed.map(k => ({ k, v: effDps(k) / supOf(k) })).filter(o => o.v > 0)
      .sort((a, b) => b.v - a.v);
    ok('T63.A ...and his lead is flatter than the Gunner\'s was',
      rank[0].k === 'flamer' && rank[0].v / rank[1].v < 1.07);
    /* COUNTERFACTUAL: put the old price back and the Gunner leads again by more.
       Without this the claim above is just a reading of one build. */
    const keep = U.gunner.cp; U.gunner.cp = 112;
    const tr2 = Object.keys(U).filter(k => !U[k].noTrain)
      .sort((a, b) => (cost63(a) - cost63(b)) || (a < b ? -1 : a > b ? 1 : 0));
    const sup2 = {}; tr2.forEach((k, i) => { sup2[k] = Math.min(SUP_MAX, 1 + Math.floor(i * SUP_MAX / tr2.length)); });
    const r2 = armed.map(k => ({ k, v: effDps(k) / sup2[k] })).filter(o => o.v > 0).sort((a, b) => b.v - a.v);
    U.gunner.cp = keep;
    ok('T63.A COUNTERFACTUAL: at 112 he really did lead, and by more',
      r2[0].k === 'gunner' && sup2.gunner === 1 && r2[0].v / r2[1].v > rank[0].v / rank[1].v);
    ok('T63.A ...and the probe put the price back', U.gunner.cp === 125);
  }
  /* THE COST OF THE FIX, stated rather than left implied. v78 paired reload and
     price so his efficiency held; this release does not, so it IS an efficiency
     cut. Both halves are checked so neither can be quietly undone. */
  ok('T63.A the v78 rt x cp pairing is broken, deliberately: 56 -> 62.5',
    Math.abs(U.gunner.rt * U.gunner.cp - 62.5) < 1e-12 && Math.abs(.4 * 140 - 56) < 1e-12);
  ok('T63.A ...which is what drops him behind the Grunt on damage per plastic',
    U.grunt.dm / U.grunt.rt / U.grunt.cp > U.gunner.dm / U.gunner.rt / U.gunner.cp);
  ok('T63.A ...while he keeps what that measure cannot see',
    U.gunner.entrench === 1 &&
    U.gunner.hp === Math.max(...B.barracks.prod.filter(k => U[k].a === 'inf').map(k => U[k].hp)));
  /* the Medic and Sarge are NOT this edit's to move, and did not */
  ok('T63.A the Medic and Sarge stay where v88\'s roster growth put them',
    supOf('medic') === 2 && supOf('sarge') === 3);
}

/* ---------- B: the Forward Pad ---------- */
{
  ok('T63.B the repair rate is 3 HP/s', PAD_REP === 3);
  ok('T63.B ...which is deliberately ABOVE the Medic\'s, reversing the v85 ordering',
    PAD_REP > MEDIC_HEAL_RATE);
  /* DRIVEN through the real building tick, not read off the constant */
  {
    G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'blue', opp: 1, seed: 881001 });
    const me = G.human, hq = me.blds.find(b => b.key === 'hq');
    const pad = makeBuilding('fwdpad', me, Math.floor(hq.tx) + 6, Math.floor(hq.ty) + 6, true);
    pad.prog = 1; pad.hp = pad.mhp;
    const air = makeUnit('heli', me, pad.x + 1, pad.y);
    air.state = 'idle'; air.path = null; air.hp = 10;
    const h0 = air.hp;
    for (let i = 0; i < 30; i++) updateBld(pad, DT63);
    ok('T63.B a damaged aircraft on the pad gains PAD_REP a second',
      Math.abs((air.hp - h0) - PAD_REP) < 1e-6);
    /* the ground is still not repaired by anything */
    const man = makeUnit('grunt', me, pad.x + 1, pad.y);
    man.state = 'idle'; man.path = null; man.hp = 10;
    const g0 = man.hp;
    for (let i = 0; i < 30; i++) updateBld(pad, DT63);
    ok('T63.B ...and a man standing on it gains nothing, which is unchanged', man.hp === g0);
    air.hp = air.mhp;
    for (let i = 0; i < 30; i++) updateBld(pad, DT63);
    ok('T63.B ...and it still never overheals', air.hp === air.mhp);
  }
  /* the sizing claim the higher rate was chosen against */
  ok('T63.B the Apache is about a minute on the pad from a sliver, not two',
    U.apache.hp / PAD_REP > 45 && U.apache.hp / PAD_REP < 90);
  ok('T63.B the card states the live rate off the constant',
    B.fwdpad.d.includes(String(PAD_REP) + ' HP/s') && B.fwdpad.d.includes(String(PAD_R)));
}

/* ---------- C: the gallery's colours ---------- */
{
  ok('T63.C the shared default is Green, and it is a named constant',
    INFO_COMMON_FAC === 'green');
  /* EVERY entry, both tabs, derived off FAC rather than transcribed */
  {
    const bad = [];
    for (const k of INFO_UNITS) {
      const own = Object.keys(FAC).find(f => (FAC[f].uu || []).includes(k));
      const want = own || INFO_COMMON_FAC;
      if (infoFacOf('unit', k) !== want) bad.push('unit ' + k);
    }
    for (const k of INFO_BLDS) {
      const own = Object.keys(FAC).find(f => (FAC[f].ub || []).includes(k));
      const want = own || INFO_COMMON_FAC;
      if (infoFacOf('bld', k) !== want) bad.push('bld ' + k);
    }
    ok('T63.C every card shows Green, or its owner\'s colour if it has one' +
       (bad.length ? ' (' + bad.join(', ') + ')' : ''), bad.length === 0);
  }
  /* NON-VACUITY: at least one of each army's exclusives really does read its own
     colour, so "everything is green" would not pass the sweep above. */
  ok('T63.C ...and all four armies really are represented',
    infoFacOf('unit', 'runner') === 'blue' && infoFacOf('unit', 'flamer') === 'tan' &&
    infoFacOf('unit', 'sniper') === 'gray' && infoFacOf('unit', 'mortar') === 'green' &&
    infoFacOf('bld', 'turbine') === 'blue' && infoFacOf('bld', 'foundry') === 'tan' &&
    infoFacOf('bld', 'hbarricade') === 'gray' && infoFacOf('bld', 'radar') === 'green');
  ok('T63.C a shared unit is Green even to a Tan reader, which is the point of the change',
    (function () {
      G = null; newGame({ map: 'backyard', mode: 'dm', diff: 'normal', fac: 'tan', opp: 1, seed: 881002 });
      return infoFacOf('unit', 'grunt') === 'green' && infoFacOf('bld', 'hq') === 'green' &&
             infoFacOf('unit', 'flamer') === 'tan' && G.human.fac === 'tan';
    })());
  ok('T63.C ...and it does not read G at all any more, so it cannot change between readings',
    infoFacOf.toString().indexOf('G.human') < 0 && infoFacOf.toString().indexOf('SETUP') < 0);
}

/* ---------- D: the gallery's order ---------- */
{
  ok('T63.D every unit and every drawable structure is still in the gallery',
    INFO_UNITS.length === Object.keys(U).length &&
    INFO_BLDS.length === Object.keys(B).filter(k => k !== 'nest' && !B[k].lvl).length && !INFO_BLDS.includes('nest') && !INFO_BLDS.includes('crate')); // v107: level art (t.lvl) is scenery, not a card, on the nest's own footing
  ok('T63.D ...exactly once each',
    new Set(INFO_UNITS).size === INFO_UNITS.length && new Set(INFO_BLDS).size === INFO_BLDS.length);

  /* the three groups, in order, and the grouping is prodBldOf - the same function
     the build menus and the Foundry read, so a unit cannot be filed under one
     heading here and another there. */
  {
    const seen = INFO_UNITS.map(k => prodBldOf(k));
    const runs = seen.filter((b, i) => i === 0 || b !== seen[i - 1]);
    ok('T63.D the units run Barracks, then Garage, then Helipad, in three unbroken runs',
      runs.join(',') === 'barracks,garage,helipad');
  }
  /* cheapest first WITHIN each group, with the drop-only Paratrooper last in his */
  {
    const bad = [];
    for (let i = 1; i < INFO_UNITS.length; i++) {
      const a = INFO_UNITS[i - 1], b = INFO_UNITS[i];
      if (prodBldOf(a) !== prodBldOf(b)) continue;
      const aN = !!U[a].noTrain, bN = !!U[b].noTrain;
      if (aN !== bN) { if (aN && !bN) bad.push(a + ' before ' + b); continue; }
      if (cost63(a) > cost63(b)) bad.push(a + '(' + cost63(a) + ') before ' + b + '(' + cost63(b) + ')');
    }
    ok('T63.D ...and each group runs cheapest to dearest' + (bad.length ? ' (' + bad.join('; ') + ')' : ''),
      bad.length === 0);
    ok('T63.D the drop-only Paratrooper rides last in his group, not first at cp 0',
      U.para.noTrain === 1 && U.para.cp === 0 &&
      INFO_UNITS[INFO_UNITS.filter(k => prodBldOf(k) === 'barracks').length - 1] === 'para');
  }
  /* structures are one run, cheapest first */
  {
    const bad = [];
    for (let i = 1; i < INFO_BLDS.length; i++)
      if (cost63(INFO_BLDS[i - 1]) > cost63(INFO_BLDS[i]))
        bad.push(INFO_BLDS[i - 1] + ' before ' + INFO_BLDS[i]);
    ok('T63.D the structures are one run, cheapest to dearest' + (bad.length ? ' (' + bad.join('; ') + ')' : ''),
      bad.length === 0);
    ok('T63.D ...so the cheapest wall leads it and the HQ closes it',
      INFO_BLDS[0] === 'barricade' && INFO_BLDS[INFO_BLDS.length - 1] === 'hq');
  }
  /* the tie-break is total, for the reason SUP_U's is: two entries priced the same
     must not swap between loads. The Garage and the Outpost are both 263. */
  ok('T63.D equal costs break on key name, so the order cannot reshuffle',
    cost63('garage') === cost63('outpost') &&
    INFO_BLDS.indexOf('garage') < INFO_BLDS.indexOf('outpost'));
}

/* ---------- E: the wall thumbnails ---------- */
{
  /* A REGRESSION v88 SHIPPED AND NOTHING CAUGHT. v88 gave drawBarricade a t.hbarr
     test to pick its silhouette, and the manual's thumbnail stub passed no `t` at
     all - so the ordinary wall threw inside infoPortraitCv's try and drew nothing,
     while the Heavy Barricade fell through to SPR.bld, which is empty because
     neither wall is baked. Both cells were blank for a whole release and it only
     became visible when v88.1's cost sort put them first. */
  let threw = null, blank = [];
  for (const f of ['green', 'tan', 'gray', 'blue']) {
    for (const k of Object.keys(B).filter(x => B[x].barr)) {
      try {
        const cv = infoPortraitCv('bld', k, f);
        if (!cv || !cv.width) blank.push(k + '/' + f);
      } catch (e) { threw = threw || (k + '/' + f + ': ' + e.message); }
    }
  }
  ok('T63.E both walls render a thumbnail in every army\'s colours' + (threw ? ' (' + threw + ')' : ''),
    threw === null && blank.length === 0);
  ok('T63.E the portrait path is keyed on t.barr, not on the key',
    /B\[key\]\.barr/.test(infoPortraitCv.toString()));
  ok('T63.E ...and it hands drawBarricade a real row, which is what it reads',
    /t:B\[key\]/.test(infoPortraitCv.toString()) && /b\.t\.hbarr/.test(drawBarricade.toString()));
  /* MUTATION ARM: a stub with no `t` really does throw, so the fix is not decorative */
  ok('T63.E MUTATION: the stub without a row really would have thrown',
    (function () {
      try { drawBarricade(document.createElement('canvas').getContext('2d'),
        { key: 'barricade', p: { fac: 'green' }, prog: 1 }, 0, 0); return false; }
      catch (e) { return true; }
    })());
  /* and every OTHER card still renders, which is what T26.I covers but is worth
     restating here because this section changed the path they share */
  {
    let bad = null;
    for (const k of INFO_UNITS) { try { infoPortraitCv('unit', k, 'green') } catch (e) { bad = bad || ('unit ' + k) } }
    for (const k of INFO_BLDS) { try { infoPortraitCv('bld', k, 'green') } catch (e) { bad = bad || ('bld ' + k) } }
    ok('T63.E every other thumbnail still renders too' + (bad ? ' (' + bad + ')' : ''), bad === null);
  }
}

/* ---------- F: the description pass ---------- */
{
  /* every card still says something */
  const empty = INFO_UNITS.filter(k => !U[k].d || !U[k].d.length)
    .concat(INFO_BLDS.filter(k => !B[k].d || !B[k].d.length));
  ok('T63.F every unit and structure still carries a description' + (empty.length ? ' (' + empty.join(', ') + ')' : ''),
    empty.length === 0);
  /* the pass was a SHORTENING. Transcribed lengths would rot on the next word
     changed, so what is pinned is the property: nothing runs past what a card can
     show without scrolling, and the longest is shorter than v88's longest was. */
  const longestU = Math.max(...INFO_UNITS.map(k => U[k].d.length));
  const longestB = Math.max(...INFO_BLDS.map(k => B[k].d.length));
  ok(`T63.F no description runs past 340 characters (longest unit ${longestU}, structure ${longestB})`,
    longestU <= 340 && longestB <= 340);
  ok('T63.F ...and the two that were longest at v88 both came in',
    U.balloon.d.length < 356 && U.choktaw.d.length < 311 && B.hbarricade.d.length < 291);

  /* THE RULE THAT MATTERS: a shortened card must not have turned a derived number
     into a typed one. Each of these reads a live constant, so moving the constant
     moves the card - which is what the check drives. */
  const derived = [
    ['flamer', () => U.flamer.d, () => String(COOK_DPS) + '/s'],
    ['mortar', () => U.mortar.d, () => String(Math.round(SMOKE_RED * 100)) + '%'],
    ['sniper', () => U.sniper.d, () => String(CAMO_T) + 's'],
    ['sarge', () => U.sarge.d, () => String(SARGE_REGEN) + ' HP/s'],
    ['bike', () => U.bike.d, () => String(Math.round(EVADE_RED * 100)) + '%'],
    ['runner', () => U.runner.d, () => String(RNET_R)],
    ['gunner', () => U.gunner.d, () => String(Math.round((ENTRENCH_RATE - 1) * 100)) + '%'],
    ['medic', () => U.medic.d, () => String(MEDIC_HEAL_RADIUS) + ' tiles'],
    ['arty', () => U.arty.d, () => String(RIPPLE_N) + ' rockets'],
    ['bulltank', () => U.bulltank.d, () => String(Math.round(THROTTLE_SPD * 100)) + '%'],
    ['balloon', () => U.balloon.d, () => String(BALLOON_FUEL) + 's'],
    ['firebomb', () => U.firebomb.d, () => String(FB_N) + ' bombs'],
    ['choktaw', () => U.choktaw.d, () => String(FOB_RG) + ' tiles'],
    ['barricade', () => B.barricade.d, () => String(BARR_HP) + ' HP'],
    ['hbarricade', () => B.hbarricade.d, () => String(HBARR_HP) + ' HP'],
    ['bunker', () => B.bunker.d, () => String(BUNK_GAR) + ' infantry'],
    ['radar', () => B.radar.d, () => String(UPLINK_T) + 's'],
    ['fwdpad', () => B.fwdpad.d, () => String(PAD_REP) + ' HP/s'],
    ['foundry', () => B.foundry.d, () => String(POUR_CD) + 's'],
    ['cmdpost', () => B.cmdpost.d, () => String(REGROUP_CD) + 's'],
    ['hq', () => B.hq.d, () => String(BUILD_R_HQ) + '-tile'],
  ];
  const missing = derived.filter(([, d, want]) => d().indexOf(want()) < 0).map(x => x[0]);
  ok('T63.F every shortened card still states its figure off the live constant' +
     (missing.length ? ' (' + missing.join(', ') + ')' : ''), missing.length === 0);

  /* the two DERIVED cards still read their lists rather than a retyped copy */
  ok('T63.F the Command Truck and the Balloon still read their lists off the tables',
    U.cmdtruck.d.includes(CMD_BLD.map(k => B[k].n).join(', ')) &&
    U.balloon.d.includes(BAIL_CREW.map(k => U[k].n).join(', ')));
  ok('T63.F ...and the Lab still names its three producers off TECH_BLD',
    B.lab.d.includes(B.barracks.n) && B.lab.d.includes(B.garage.n) && B.lab.d.includes(B.helipad.n) &&
    !/every unit/.test(B.lab.d));

  /* nothing gained a stray template artefact in the rewrite */
  const artefact = INFO_UNITS.filter(k => /\$\{|undefined|NaN/.test(U[k].d))
    .concat(INFO_BLDS.filter(k => /\$\{|undefined|NaN/.test(B[k].d)));
  ok('T63.F no card leaked a template expression, an undefined or a NaN' +
     (artefact.length ? ' (' + artefact.join(', ') + ')' : ''), artefact.length === 0);
}
