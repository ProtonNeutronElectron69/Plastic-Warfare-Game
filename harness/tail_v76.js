'use strict';
/* ===================== v76 =====================
   T51 covers the v76 release: the named terrain-hazard rate, the Artillery
   Barrage call-down, and the manual/info-card corrections.

   Section D is the one that matters most in the long run. Every defect the v76
   audit found was the same defect: a fact written out in prose next to the
   constant it was supposed to describe, which then moved without the prose. The
   fix was to derive the prose; these checks are what make the derivation stick,
   because a future balance edit that reintroduces a hand-typed number fails here
   instead of shipping a manual that lies. */
section('T51 v76: hazard rate, artillery barrage, derived manual copy');

const DT76 = 1 / 30;
function cfg76(map, mode, seed, opp) { return { map, mode, diff: 'normal', fac: 'green', opp: (opp == null ? 3 : opp), seed }; }
let HTML76 = null;
try { HTML76 = require('fs').readFileSync('pw.html', 'utf8'); } catch (e) { HTML76 = null; }

/* ---------- A: terrain hazard rate ---------- */
section('T51.A the terrain hazard rate is named and cut 30 percent');
{
  ok('T51.A HAZ_DPS is the shipped 4.9', typeof HAZ_DPS === 'number' && HAZ_DPS === 4.9);
  ok('T51.A that is a 30 percent cut off the pre-v76 rate', Math.abs(HAZ_DPS - 7 * 0.7) < 1e-9);
  /* the sweep runs on a 0.4s accumulator, so one charged tick costs HAZ_DPS*0.4 */
  G = null; newGame(cfg76('backyard', 'dm', 761001, 3));
  const p = G.players[0];
  let cell = null;
  const N = G.map.N;
  for (let y = 2; y < N - 2 && !cell; y++) for (let x = 2; x < N - 2; x++) {
    if (G.map.fld[y * N + x] === 2) { cell = { x: x + 0.5, y: y + 0.5 }; break; }
  }
  ok('T51.A the probe found a live burn hazard to stand in', !!cell);
  if (cell) {
    const u = makeUnit('grunt', p, cell.x, cell.y);
    u.hp = 9999; u.mhp = 9999;
    ok('T51.A the unit really is standing in a code-2 field', fieldAt(u.x, u.y) === 2);
    /* drive ONE charged sweep: the accumulator is already at the 0.4s threshold,
       so dt=0 fires it with step exactly 0.4 and no float drift to argue with. */
    const before = u.hp;
    G.hazAcc = 0.4;
    updateHazards(0);
    const lost = before - u.hp;
    ok('T51.A one charged sweep costs exactly HAZ_DPS x its step',
      Math.abs(lost - HAZ_DPS * 0.4) < 1e-9);
    ok('T51.A which is strictly less than the pre-v76 rate would have cost', lost < 7 * 0.4);
  }
}

/* ---------- B: the barrage ---------- */
section('T51.B artillery barrage: schedule, spread, damage');
{
  /* v77 moved BARRAGE_N (3 -> 7) and BARRAGE_DMG (210 -> 105). The exact v77
     values are pinned in T52.A; what belongs here is the shape the v76 design
     fixed and v77 did not touch. */
  ok('T51.B the barrage constants are well formed',
    BARRAGE_N >= 1 && BARRAGE_GAP === 2.0 && BARRAGE_FLY === 1.6 &&
    BARRAGE_DMG > 0 && BARRAGE_R === 3 && BARRAGE_BOX === 10);

  G = null; newGame(cfg76('backyard', 'dm', 761002, 3));
  const p = G.players[0], q = G.players[1];
  const tw = makeBuilding('radiotower', p, Math.round(p.start.x + 4), Math.round(p.start.y + 4), true);
  radioBarrage(tw, 30, 30);
  const s = G.strikes.find(z => z.kind === 'barrage');
  ok('T51.B firing pushes exactly one barrage strike', !!s && G.strikes.filter(z => z.kind === 'barrage').length === 1);
  ok('T51.B it schedules BARRAGE_N shells', !!s && s.sh.length === BARRAGE_N);
  ok('T51.B the first lands after the arc and the rest one gap apart',
    !!s && s.sh.every((z, i) => Math.abs(z.at - (BARRAGE_FLY + i * BARRAGE_GAP)) < 1e-9));
  ok('T51.B every impact point sits inside the aimed box',
    !!s && s.sh.every(z => Math.abs(z.x - s.cx) <= BARRAGE_BOX / 2 && Math.abs(z.y - s.cy) <= BARRAGE_BOX / 2));
  ok('T51.B the shells do not all land on one spot',
    !!s && new Set(s.sh.map(z => z.x + ':' + z.y)).size === BARRAGE_N);
  ok('T51.B firing spends the shared radio cooldown', tw.abilityCool === RADIO_CD);

  /* the impact roll is srand, so the same seed must place the same shells */
  const shot = (sd) => {
    G = null; newGame(cfg76('backyard', 'dm', sd, 3));
    const pp = G.players[0];
    const t2 = makeBuilding('radiotower', pp, Math.round(pp.start.x + 4), Math.round(pp.start.y + 4), true);
    radioBarrage(t2, 30, 30);
    return JSON.stringify(G.strikes.find(z => z.kind === 'barrage').sh.map(z => [z.x, z.y, z.ang]));
  };
  const r1 = shot(761003), r2 = shot(761003), r3 = shot(761004);
  ok('T51.B the impact roll is deterministic on the seed', r1 === r2);
  ok('T51.B and it is not a constant', r1 !== r3);

  /* damage: 210 at the centre, half at the rim, infantry shaded by row q */
  G = null; newGame(cfg76('backyard', 'dm', 761005, 3));
  const p2 = G.players[0], q2 = G.players[1];
  const tw2 = makeBuilding('radiotower', p2, Math.round(p2.start.x + 4), Math.round(p2.start.y + 4), true);
  const hit = (key, d) => {
    const u = makeUnit(key, q2, 30 + d, 30); u.hp = 1e6; u.mhp = 1e6;
    const b = u.hp; splash(30, 30, BARRAGE_R, BARRAGE_DMG, 'ex', tw2, 'q'); const got = b - u.hp; u.hp = 0;
    return got;
  };
  ok('T51.B a direct hit on armor is the full shell', Math.abs(hit('tank', 0) - BARRAGE_DMG) < 1e-6);
  ok('T51.B the rim is half, matching splashMul', Math.abs(hit('tank', 3) - BARRAGE_DMG * 0.5) < 1e-6);
  ok('T51.B infantry take the row q shade', Math.abs(hit('grunt', 0) - BARRAGE_DMG * WVA.q.inf) < 1e-6);
  ok('T51.B structures and light armor take it whole',
    Math.abs(hit('truck', 0) - BARRAGE_DMG) < 1e-6 && WVA.q.bldg === 1);
  /* Air is 1.00 BY SPEC. Pinned so that changing it is a decision, not a drift. */
  ok('T51.B aircraft take the shell at full value, as specified', WVA.q.air === 1);

  /* the strike runs to completion and cleans itself up */
  G = null; newGame(cfg76('backyard', 'dm', 761006, 3));
  const p3 = G.players[0];
  const tw3 = makeBuilding('radiotower', p3, Math.round(p3.start.x + 4), Math.round(p3.start.y + 4), true);
  radioBarrage(tw3, 30, 30);
  const s3 = G.strikes.find(z => z.kind === 'barrage');
  /* v77: the walk is BARRAGE_FLY + (N-1)*GAP seconds, which went from 5.6 to 13.6.
     A bare 12-second budget was enough at v76 and is not now, so the budget is
     derived from the schedule with a couple of seconds of cleanup slack. */
  const budget76 = Math.ceil(BARRAGE_FLY + (BARRAGE_N - 1) * BARRAGE_GAP + 3);
  for (let i = 0; i < 30 * budget76; i++) update(DT76);
  ok('T51.B every shell landed', s3.sh.every(z => z.done));
  ok('T51.B and the strike was removed', !G.strikes.some(z => z.kind === 'barrage'));

  ok('T51.B row q is its own row and left every other row alone',
    WVA.q && WVA.x.inf === 1 && WVA.f.inf === 1.35 && WVA.f.heavy === 0.45);
}

/* ---------- C: the ability table is the single source ---------- */
section('T51.C one ability table feeds the panel, the card and the vision gate');
{
  /* v77 removed the Magnifying Glass, so the roster is three rows. The point of
     this section is that ONE table feeds every surface, which is exactly what a
     removal exercises; T52.B proves the removal left nothing behind. */
  /* v85: four rows, three of which every army gets. The table gained a `fac` field
     rather than a second table, so the "one source" claim this section exists to
     make is strictly stronger than it was: the panel, the manual, the vision gate
     AND now the per-army filter all read the same rows. */
  ok('T51.C four call-downs, three of them shared', RADIO_ABILITIES.length === 4);
  ok('T51.C the modes are the ones the command path dispatches',
    RADIO_ABILITIES.map(a => a.mode).join(',') === 'napalm,barrage,paradrop,lift');
  ok('T51.C an absent `fac` means everybody, and exactly one row claims an army',
    RADIO_ABILITIES.filter(a => !a.fac).length === 3 &&
    RADIO_ABILITIES.filter(a => a.fac).length === 1 && radioAbility('lift').fac === 'blue');
  ok('T51.C the filter hands three armies three and Blue four',
    ['green', 'tan', 'gray'].every(f => radioListFor({ fac: f }).length === 3) &&
    radioListFor({ fac: 'blue' }).length === 4);
  ok('T51.C ...and radioAllowed agrees with it, row for row',
    RADIO_ABILITIES.every(a => ['green', 'tan', 'gray', 'blue'].every(f =>
      radioAllowed({ fac: f }, a.mode) === radioListFor({ fac: f }).includes(a))));
  ok('T51.C the targeted ones need vision, paradrop does not',
    radioNeedsVision('napalm') && radioNeedsVision('barrage') && !radioNeedsVision('paradrop'));
  ok('T51.C an unknown mode is not an ability', !radioAbility('bombard') && !radioNeedsVision('bombard'));
  ok('T51.C every ability carries panel copy and an icon',
    RADIO_ABILITIES.every(a => a.icon && a.name && a.short && a.panel));

  /* the command path must refuse a blind barrage and an invented mode */
  G = null; newGame(cfg76('backyard', 'dm', 761007, 3));
  const p = G.players[0];
  const tw = makeBuilding('radiotower', p, Math.round(p.start.x + 4), Math.round(p.start.y + 4), true);
  const far = { x: G.map.N - 4, y: G.map.N - 4 };
  const blind = !pVision(p, far.x, far.y);
  const radioCmd = (mode, x, y) => execCmd({ pi: p.i, op: 'radio', a: { bid: tw.id, mode, x, y } });
  radioCmd('barrage', far.x, far.y);
  ok('T51.C a barrage with no vision on the target is refused',
    !blind || (!G.strikes.some(z => z.kind === 'barrage') && tw.abilityCool === 0));
  radioCmd('bombard', p.start.x, p.start.y);
  ok('T51.C an unknown mode spends nothing', tw.abilityCool === 0 && !G.strikes.length);
  radioCmd('barrage', p.start.x, p.start.y);
  ok('T51.C a barrage inside your own vision fires',
    G.strikes.some(z => z.kind === 'barrage') && tw.abilityCool === RADIO_CD);
}

/* ---------- D: the manual is derived, not typed ---------- */
section('T51.D the field manual reads its numbers off the constants');
{
  const slot = (k) => String(helpTuneValue(k));
  ok('T51.D the veterancy rungs come from the v75 ladders',
    slot('vetInf') === VET_INF.join(' / ') && slot('vetVeh') === VET_VEH.join(' / '));
  ok('T51.D the ladders are the ones the sim actually promotes on',
    VET_INF.join(',') === '1,2,4' && VET_VEH.join(',') === '2,4,8' &&
    vetSteps({ t: U.grunt }) === VET_INF && vetSteps({ t: U.tank }) === VET_VEH);
  ok('T51.D the bazooka figure comes from the override layer',
    slot('bazHeavy') === UVA.bazooka.heavy.toFixed(2) && UVA.bazooka.heavy !== WVA.r.heavy);
  ok('T51.D the rocket row figures come from WVA',
    slot('rockMed') === WVA.r.medium.toFixed(2) && slot('rockHeavy') === WVA.r.heavy.toFixed(2));
  ok('T51.D the AA figure comes from WVA', slot('aaAir') === WVA.a.air.toFixed(2));
  ok('T51.D the barrage figures come from the barrage constants',
    slot('barrN') === String(BARRAGE_N) && slot('barrDmg') === String(BARRAGE_DMG) &&
    slot('barrR') === String(BARRAGE_R) && slot('barrInf') === WVA.q.inf.toFixed(2) &&
    slot('barrBox') === BARRAGE_BOX + '\u00d7' + BARRAGE_BOX);
  ok('T51.D the ability list and cooldown come from the ability table',
    slot('radioList') === radioAbilityList() && slot('radioCd') === (RADIO_CD / 60) + '-minute' &&
    slot('radioList').split(', ').length === RADIO_ABILITIES.length);

  /* the four roster omissions the audit found, each pinned */
  ok('T51.D the small-arms roster now carries the Bunker and the Paratrooper',
    slot('wcB').includes(B.bunker.n) && slot('wcB').includes(U.para.n) && slot('wcB').includes(B.guardtower.n));
  ok('T51.D the flame roster names the tower call-down, not the tower',
    slot('wcF').includes(U.flamer.n) && slot('wcF').includes('Napalm Strike') &&
    !slot('wcF').includes(B.radiotower.n));
  ok('T51.D the AA row has a roster at all', slot('wcA') === U.aatruck.n);
  ok('T51.D the barrage row has a roster', slot('wcQ') === 'Artillery Barrage');
  ok('T51.D every weapon row except the unclassed one names a source',
    ['b', 'g', 'r', 's', 'm', 'f', 'd', 'a', 'q'].every(w => wcRoster(w).length > 0) && wcRoster('x') === '');
  ok('T51.D the rosters are generated from the live tables',
    wcRoster('g') === U.grenadier.n && wcRoster('r').includes(U.bazooka.n) && wcRoster('r').includes(U.apache.n));
  ok('T51.D the Lab list carries the Radio Tower and drops the faction buildings',
    slot('labBlds').includes(B.radiotower.n) && slot('labBlds').includes(B.garage.n) &&
    !slot('labBlds').includes(B.turbine.n) && !slot('labBlds').includes(B.bunker.n));

  /* every slot the markup asks for must exist, and vice versa is not required
     (HELP_TUNE may carry a slot the prose has not used yet) */
  if (HTML76) {
    const asked = new Set((HTML76.match(/data-tune="([a-zA-Z]+)"/g) || []).map(s => s.slice(11, -1)));
    asked.delete('key');
    const missing = [...asked].filter(k => helpTuneValue(k) == null);
    ok('T51.D every slot the manual asks for resolves', missing.length === 0);
    const empties = [...asked].filter(k => String(helpTuneValue(k)).length === 0);
    ok('T51.D and none of them resolves to nothing', empties.length === 0);
  } else {
    ok('T51.D the manual markup was readable off disk', false);
  }
}

/* ---------- E: the info card agrees with the sim ---------- */
section('T51.E the Field Manual info card agrees with the sim');
{
  const card = infoStatsHtml('unit', 'gunner');
  ok('T51.E the entrench line prints the real multiplier',
    card.includes(ENTRENCH_RATE + '\u00d7 fire rate') && card.includes(Math.round(CONE_HALF * 2 * 180 / Math.PI) + '\u00b0'));
  ok('T51.E and it no longer claims a multiplier the sim does not apply',
    ENTRENCH_RATE !== 2 && !/double fire rate/.test(card));

  const rt = infoStatsHtml('bld', 'radiotower');
  ok('T51.E the tower card lists every call-down',
    RADIO_ABILITIES.every(a => rt.includes(a.name)) && rt.includes(radioCDText() + ' cooldown'));

  const bk = infoStatsHtml('bld', 'bunker');
  ok('T51.E the bunker card derives its upgraded garrison',
    bk.includes(B.bunker.gar + ' infantry (' + Math.round(B.bunker.gar * UPGRADES.bunker.eff) + ' upgraded)'));

  const sup = infoStatsHtml('bld', 'supply');
  ok('T51.E the sell value derives from SELL_FRAC',
    sup.includes(Math.round(B.supply.cp * SELL_FRAC) + ' \u2b22 (' + Math.round(SELL_FRAC * 100) + '%)'));
  ok('T51.E and it agrees with what selling actually refunds',
    Math.round(B.supply.cp * SELL_FRAC) === Math.round(bcost({ fac: 'tan' }, 'supply').p * SELL_FRAC));
}

/* ---------- F: the stale copy is gone from the shipped file ---------- */
section('T51.F the corrected claims are absent from the shipped markup');
{
  if (HTML76) {
    /* Each pattern below is a claim the v76 audit proved false. They are matched
       against the WHOLE shipped file, comments included, so the wording of any
       comment near these mechanics has to stay clear of them. */
    const gone = [
      ['the pre-v75 promotion ladder', /every\s*3\s*\/\s*6\s*\/\s*12\s*kills/],
      ['the pre-v69 entrench multiplier', /double fire rate/],
      ['the pre-v51 bazooka override', /\u00d71\.60 for the Bazooka/],
      ['the hand-typed small-arms roster', /\(Grunt, Gunner, Sniper, Sarge, Jeep, Bike, Huey, Guard Tower\)/],
      ['the hand-typed flame roster', /\(Flamethrower, Napalm\)/],
      ['the pre-v76 Lab structure list', /Garage, Helipad, Generator, Turbine, Guard Tower, and your faction building/]
    ];
    for (const [what, re] of gone) ok('T51.F ' + what + ' is gone', !re.test(HTML76));
    ok('T51.F the absence scan is not vacuous', /data-tune="vetInf"/.test(HTML76) && /data-tune="wcB"/.test(HTML76));
    ok('T51.F the bare hazard literal is gone from the sweep',
      !/applyDmg\(u,7\*step/.test(HTML76) && !/applyDmg\(cr,7\*step/.test(HTML76) && /HAZ_DPS\*step/.test(HTML76));
  } else {
    ok('T51.F the shipped markup was readable off disk', false);
  }
}

/* ---------- G: strikes survive a snapshot (out of scope, disclosed) ---------- */
section('T51.G an in-flight call-down survives save/load');
{
  /* SNAP_ENT_SKIP drops the key `t` because entities use it for their type row.
     A strike uses it for elapsed seconds, so every strike came back with an
     undefined clock, went NaN on the next `s.t+=dt`, and stalled. hashState
     hashes s.t, so a mid-strike save diverged from tick zero. Present since v30
     for the laser and napalm; the barrage inherited it. The laser is gone at
     v77, so only the three surviving strike kinds are round-tripped here. */
  const roundTrip = (fire, wait) => {
    G = null; newGame(cfg76('backyard', 'dm', 762001, 3));
    for (let i = 0; i < 300; i++) update(DT76);
    const p = G.players[0];
    const tw = makeBuilding('radiotower', p, Math.round(p.start.x + 4), Math.round(p.start.y + 4), true);
    fire(tw);
    for (let i = 0; i < wait; i++) update(DT76);
    const snap = saveState();
    const a = []; for (let i = 0; i < 180; i++) { update(DT76); a.push(hashState()); }
    loadState(snap);
    const b = []; for (let i = 0; i < 180; i++) { update(DT76); b.push(hashState()); }
    return a.length === b.length && a.every((h, i) => h === b[i]);
  };
  ok('T51.G a barrage mid-flight resumes bit-identical', roundTrip(t => radioBarrage(t, 30, 30), 40));
  ok('T51.G so does a napalm strike mid-drop', roundTrip(t => radioNapalm(t, 30, 30), 40));
  ok('T51.G and a paradrop, which never lost its clock', roundTrip(t => radioParadrop(t, 30, 30), 3));

  /* the clock is what was missing: prove it is carried, and that the skip set
     still drops `t` for the entities that need it dropped */
  G = null; newGame(cfg76('backyard', 'dm', 762002, 3));
  for (let i = 0; i < 60; i++) update(DT76);
  const p2 = G.players[0];
  const tw2 = makeBuilding('radiotower', p2, Math.round(p2.start.x + 4), Math.round(p2.start.y + 4), true);
  radioBarrage(tw2, 30, 30);
  for (let i = 0; i < 20; i++) update(DT76);
  const t0 = G.strikes.find(z => z.kind === 'barrage').t;
  const enc = JSON.parse(saveState());
  ok('T51.G the encoded strike carries its clock', typeof enc.strikes[0].t === 'number' && enc.strikes[0].t === t0);
  ok('T51.G units still have their type row stripped, as intended',
    SNAP_ENT_SKIP.has('t') && enc.units.every(u => u.t === undefined));
  loadState(JSON.stringify(enc));
  ok('T51.G and it comes back a number, not undefined',
    G.strikes.find(z => z.kind === 'barrage').t === t0);
  /* a pre-v76 save has no strike clock at all; it must load as 0, not NaN */
  const old = JSON.parse(saveState());
  delete old.strikes[0].t;
  loadState(JSON.stringify(old));
  const s9 = G.strikes.find(z => z.kind === 'barrage');
  update(DT76);
  ok('T51.G a pre-v76 save with no strike clock resumes at zero, never NaN',
    !!s9 && typeof s9.t === 'number' && s9.t === s9.t);
}
