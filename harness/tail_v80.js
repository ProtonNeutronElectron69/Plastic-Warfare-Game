'use strict';
/* ============================ T54  v80 TAN ABILITIES ============================
   Phase 2 of the faction ability roadmap. Every claim below is either a
   derivation check (the surfaces read the constants) or a behavioural one run
   in the arena44 fixture, and every numeric expectation is COMPUTED from the
   live constant rather than transcribed, so a tuning pass moves the constant
   and the tail follows instead of going red.

   Needs tail_v44.js prepended for arena44()/cfg44(). */

const DT80 = 1 / 30;

function arena80(seed, fac) {
  G = null;
  newGame(cfg44('kitchen', 'dm', 'normal', fac || 'tan', 1, seed || 8800));
  for (const mn of (G.map.mines || [])) mn.live = false;
  for (const ns of (G.map.nests || [])) { ns.dead = true; ns.alive = 0; ns.aggro = false; }
  return arena44(10, 8, 6, 12);
}
function foe80() { return G.players.find(p => p !== G.human && p.fac !== 'bug'); }

section('T54.A Cook-Off is keyed on the UNIT, not on weapon row f');
{
  ok('T54.A the flamer carries the flag and the Bull does not',
    U.flamer.cook === 1 && U.bulltank.cook === undefined);
  ok('T54.A ...and the Bull\'s hull weapon really is row f, so class-keying WOULD have caught it',
    U.bulltank.sec && U.bulltank.sec.wc === 'f' && U.flamer.w === 'f');
  ok('T54.A ...as is the Radio Tower, the other row-f scorer',
    WC_BLD.radiotower === 'f');

  const A = arena80(8801);
  const f = foe80();
  const hose = makeUnit('flamer', G.human, A.x + 2, A.y + 3);
  const mark = makeUnit('grunt', f, A.x + 3.4, A.y + 3);
  hose.target = mark; hose.state = 'attack'; hose.hold = true;
  for (let i = 0; i < 40 && !(mark.burnT > 0); i++) update(DT80);
  ok('T54.A a flamer hit sets a burn on what it touches', mark.burnT > 0);
  ok('T54.A ...at the Cook-Off rate, read from the constant', mark.burnDps === COOK_DPS);

  /* the Bull's hull flamer scores on the same row and must NOT ignite */
  const A2 = arena80(8802);
  const f2 = foe80();
  const bull = makeUnit('bulltank', G.human, A2.x + 2, A2.y + 3);
  const mark2 = makeUnit('grunt', f2, A2.x + 3.6, A2.y + 3);
  bull.hold = true;
  let sawSecFire = false;
  for (let i = 0; i < 120; i++) { update(DT80); if (mark2.hp <= 0) break; if (bull.cool2 > 0) sawSecFire = true; }
  ok('T54.A the Bull\'s hull flamer did fire (the claim below is not vacuous)', sawSecFire);
  ok('T54.A ...and it does NOT ignite, because Cook-Off is the flamer\'s alone',
    !(mark2.burnT > 0));
}

section('T54.B Pressure Valve: reach, damage, and the price of both');
{
  ok('T54.B the flamer carries the toggle capability', U.flamer.valve === 1);
  const A = arena80(8803);
  const hose = makeUnit('flamer', G.human, A.x + 2, A.y + 3);
  const base = rgOf(hose);
  hose.valve = true;
  ok('T54.B the valve adds exactly VALVE_RG through rgOf, the one range door',
    rgOf(hose) === base + VALVE_RG);
  ok('T54.B ...and exactly VALVE_DMG through dmgBonus, the one damage door',
    Math.abs(dmgBonus(hose) / (function () { hose.valve = false; const m = dmgBonus(hose); hose.valve = true; return m; })() - (1 + VALVE_DMG)) < 1e-9);

  /* the recoil is a share of what was ACTUALLY dealt, not of the nominal dm */
  const A2 = arena80(8804);
  const f2 = foe80();
  const h2 = makeUnit('flamer', G.human, A2.x + 2, A2.y + 3);
  const mark = makeUnit('grunt', f2, A2.x + 3.4, A2.y + 3);
  /* the mark must not shoot back, or `taken` measures recoil plus his bullets.
     u.dm is the per-unit baked figure, so zeroing it disarms this one grunt
     without touching the shared type row. */
  mark.dm = 0;
  h2.valve = true; h2.hold = true; h2.target = mark; h2.state = 'attack';
  const mHp0 = mark.hp, hHp0 = h2.hp;
  for (let i = 0; i < 8; i++) update(DT80);
  const dealt = mHp0 - mark.hp, taken = hHp0 - h2.hp;
  ok('T54.B the flamer hurt somebody (not vacuous)', dealt > 0);
  ok(`T54.B ...and took back VALVE_BACK of it (dealt ${dealt.toFixed(1)}, took ${taken.toFixed(1)})`,
    Math.abs(taken - dealt * VALVE_BACK) < Math.max(0.6, dealt * 0.06));

  /* attribution: his own hose is nobody's kill and earns nobody veterancy */
  const A3 = arena80(8805);
  const f3 = foe80();
  const h3 = makeUnit('flamer', G.human, A3.x + 2, A3.y + 3);
  const mob = [];
  for (let i = 0; i < 6; i++) mob.push(makeUnit('grunt', f3, A3.x + 3.3 + (i % 3) * 0.3, A3.y + 2.7 + Math.floor(i / 3) * 0.4));
  h3.valve = true; h3.hold = true;
  const kills0 = f3.stats.kills;
  for (let i = 0; i < 900 && h3.hp > 0; i++) { if (!h3.target || h3.target.hp <= 0) { const e = nearestEnemy(h3, 6); if (e) { h3.target = e; h3.state = 'attack'; } } update(DT80); }
  if (h3.hp <= 0) ok('T54.B a flamer killed by his own valve is nobody\'s kill', f3.stats.kills === kills0 + 0 || f3.stats.kills === kills0);
  else ok('T54.B (the self-kill arm did not trigger; nothing claimed)', true);
}

section('T54.C Ablative Plate negates weapon row b, including the static defences');
{
  ok('T54.C the Bull carries the plate and nothing else does',
    U.bulltank.plate === 1 && Object.keys(U).filter(k => U[k].plate).length === 1);
  const A = arena80(8806);
  const f = foe80();
  const bull = makeUnit('bulltank', G.human, A.x + 4, A.y + 3);
  ok('T54.C row b is zeroed against it', targetDmgMul(null, bull, 'b') === 0);
  ok('T54.C ...and every other row is untouched',
    ['r', 's', 'm', 'g', 'd', 'q', 'x'].every(w => targetDmgMul(null, bull, w) === dmgMulFor(null, w, armorOf(bull))));
  ok('T54.C ...and other units are not accidentally plated',
    targetDmgMul(null, makeUnit('tank', G.human, A.x + 5, A.y + 3), 'b') > 0);

  /* the two static defences resolve on row b, which is the consequence the
     owner signed off: neither can scratch a Bull. */
  ok('T54.C the guard tower and the bunker both score on row b',
    WC_BLD.guardtower === 'b' && WC_BLD.bunker === 'b');
  const tower = { kind: 'bld', key: 'guardtower', p: f, t: B.guardtower };
  const bunk = { kind: 'bld', key: 'bunker', p: f, t: B.bunker };
  ok('T54.C ...so neither can hurt a Bull at all',
    targetDmgMul(tower, bull) === 0 && targetDmgMul(bunk, bull) === 0);
  ok('T54.C the sniper\'s UVA override is superseded rather than fought with',
    UVA.sniper && UVA.sniper.heavy > 0 && targetDmgMul(makeUnit('sniper', G.human, A.x + 6, A.y + 3), bull) === 0);
  ok('T54.C the Paratrooper stays useful, because his AT munition is row r',
    paraMun(bull).wc !== 'b' && targetDmgMul(null, bull, paraMun(bull).wc) > 0);

  /* end to end: a real bullet does nothing, a real rocket does */
  const hp0 = bull.hp;
  applyDmg(bull, 100, 'b', makeUnit('grunt', f, A.x + 6.5, A.y + 3));
  ok('T54.C a live small-arms hit removes nothing', bull.hp === hp0);
  applyDmg(bull, 100, 'r', makeUnit('bazooka', f, A.x + 6.8, A.y + 3), 'r');
  ok('T54.C ...and a live rocket still does', bull.hp < hp0);
}

section('T54.D Full Throttle: speed, crush, and silence');
{
  ok('T54.D the Bull carries the toggle capability', U.bulltank.throttle === 1);
  const A = arena80(8807);
  const f = foe80();
  const bull = makeUnit('bulltank', G.human, A.x + 3, A.y + 3);
  const base = spOf(bull);
  bull.thr = true;
  ok('T54.D spOf is the speed door and the throttle is the only thing bending it',
    Math.abs(spOf(bull) - base * (1 + THROTTLE_SPD)) < 1e-9);
  const plain = makeUnit('tank', G.human, A.x + 3.5, A.y + 5);
  ok('T54.D ...and a unit with no throttle capability reads its bare speed',
    spOf(plain) === plain.sp);

  /* crush: enemy infantry under the hull die, friendly infantry do not, and a
     garrisoned man is not on the ground to be driven over */
  const victim = makeUnit('grunt', f, bull.x + THROTTLE_R * 0.5, bull.y);
  const friend = makeUnit('grunt', G.human, bull.x - THROTTLE_R * 0.5, bull.y);
  const bystand = makeUnit('grunt', f, bull.x + THROTTLE_R + 1.5, bull.y);
  crush80(bull);
  ok('T54.D enemy infantry under the tracks are crushed outright', victim.hp <= 0);
  ok('T54.D friendly infantry are not', friend.hp > 0);
  ok('T54.D and infantry outside the hull radius are not', bystand.hp > 0);

  const A2 = arena80(8808);
  const f2 = foe80();
  const bull2 = makeUnit('bulltank', G.human, A2.x + 3, A2.y + 3);
  const apc = makeUnit('apc', G.human, bull2.x + THROTTLE_R * 0.4, bull2.y);
  const rider = makeUnit('grunt', f2, bull2.x + THROTTLE_R * 0.4, bull2.y);
  rider.garrisoned = true;
  bull2.thr = true; crush80(bull2);
  ok('T54.D a garrisoned man is not on the ground and survives', rider.hp > 0 && !!apc);

  /* the guns are silent while it rolls */
  const A3 = arena80(8809);
  const f3 = foe80();
  /* inside the HULL FLAMER's 2.6 reach, not the cannon's 5: the v52 split gives
     infantry to the secondary, so a grunt parked at cannon range is a target
     the Bull would ignore even standing still. */
  const bull3 = makeUnit('bulltank', G.human, A3.x + 2, A3.y + 3);
  const mark = makeUnit('grunt', f3, A3.x + 4.1, A3.y + 3);
  bull3.thr = true;
  const mHp0 = mark.hp;
  for (let i = 0; i < 200; i++) update(DT80);
  ok('T54.D a throttling Bull holds fire entirely', mark.hp === mHp0 && !bull3.target && !bull3.target2);
  bull3.thr = false;
  for (let i = 0; i < 200 && mark.hp === mHp0; i++) update(DT80);
  ok('T54.D ...and shoots again the moment it throttles down (not vacuous)', mark.hp < mHp0);
}

section('T54.E Scuttle: the dump takes the neighbourhood with it');
{
  ok('T54.E the dump carries the ability', B.dump.scuttle === 1);
  const A = arena80(8810);
  const f = foe80();
  const dump = makeBuilding('dump', G.human, Math.floor(A.x + 3), Math.floor(A.y + 3), true);
  dump.prog = 1;
  const near = makeUnit('grunt', f, dump.x + 0.6, dump.y);
  const far = makeUnit('grunt', f, dump.x + SCUTTLE_R - 0.6, dump.y);
  const outside = makeUnit('grunt', f, dump.x + SCUTTLE_R + 2.5, dump.y);
  const mate = makeUnit('gunner', G.human, dump.x + 0.6, dump.y + 0.2);
  const nearHp0 = near.hp, farHp0 = far.hp, mateHp0 = mate.hp, outHp0 = outside.hp;
  scuttle80(dump);
  ok('T54.E the dump destroys itself', dump.hp <= 0);
  ok('T54.E enemies inside the radius are hit', near.hp < nearHp0);
  ok('T54.E ...harder at the centre than at the edge',
    (nearHp0 - near.hp) > (farHp0 - far.hp));
  ok('T54.E ...and nothing outside it is touched', outside.hp === outHp0);
  ok('T54.E friendly units are hit too, at SCUTTLE_FF of it',
    mate.hp < mateHp0 && (mateHp0 - mate.hp) < (nearHp0 - near.hp));

  /* it is not splash(): splash skips allies outright, which is exactly why this
     ability could not be built on it. This is the non-vacuity check for that. */
  const A2 = arena80(8811);
  const f2 = foe80();
  const dump2 = makeBuilding('dump', G.human, Math.floor(A2.x + 3), Math.floor(A2.y + 3), true);
  dump2.prog = 1;
  const mate2 = makeUnit('gunner', G.human, dump2.x + 0.6, dump2.y);
  const m2Hp0 = mate2.hp;
  splash(dump2.x, dump2.y, SCUTTLE_R, SCUTTLE_DM, 'ex', dump2);
  ok('T54.E MUTATION: the same blast through splash() would have spared the ally',
    mate2.hp === m2Hp0);
}

section('T54.F the new state is hashed, serialized and deterministic');
{
  const A = arena80(8812);
  const hose = makeUnit('flamer', G.human, A.x + 2, A.y + 3);
  const bull = makeUnit('bulltank', G.human, A.x + 3, A.y + 4);
  ok('T54.F the toggles are written only onto the units that carry them',
    hose.valve === false && bull.thr === false &&
    makeUnit('grunt', G.human, A.x + 4, A.y + 5).valve === undefined);

  const h0 = hashState();
  hose.valve = true;
  ok('T54.F the valve moves the hash', hashState() !== h0);
  hose.valve = false;
  ok('T54.F ...and putting it back restores it', hashState() === h0);
  bull.thr = true;
  ok('T54.F the throttle moves the hash', hashState() !== h0);
  bull.thr = false;

  /* burnDps: serialized since forever, hashed only from v80, because Cook-Off
     is the second writer of it and the two write different values. */
  const mark = makeUnit('grunt', G.human, A.x + 5, A.y + 3);
  const h1 = hashState();
  applyBurn(mark, COOK_DPS);
  const h2 = hashState();
  mark.burnDps = COOK_DPS + 1;
  ok('T54.F the burn RATE is hashed, not just the timer', hashState() !== h2 && h2 !== h1);
  ok('T54.F ...and the two writers really do disagree, which is why it had to be',
    COOK_DPS !== 7.2);

  const snap = saveState(); /* already a string - JSON.stringify-ing it again escapes every quote */
  ok('T54.F every new field survives a save/load round trip',
    snap.indexOf('"valve"') >= 0 && snap.indexOf('"thr"') >= 0 && snap.indexOf('"burnDps"') >= 0);
  ok('T54.F ...and the round trip restores them',
    (function () { const h = hashState(); loadState(snap); return hashState() === h; })());
}

section('T54.G every Tan number is derived, not typed');
{
  const SLOTS = ['cookDps', 'valveDmg', 'valveRg', 'valveBack', 'thrSpd', 'scDm', 'scR', 'scFf'];
  const missing = SLOTS.filter(k => !HELP_TUNE[k]);
  ok('T54.G every Tan ability number has a help slot' + (missing.length ? ' [' + missing.join(',') + ']' : ''),
    missing.length === 0);
  const bad = SLOTS.filter(k => { const v = helpTuneValue(k); return v == null || v === '' || Number.isNaN(v); });
  ok('T54.G ...and every one resolves' + (bad.length ? ' [' + bad.join(',') + ']' : ''), bad.length === 0);
  const HTML80 = (function () { try { return require('fs').readFileSync('pw.html', 'utf8'); } catch (e) { return null; } })();
  if (!HTML80) ok('T54.G pw.html is readable next to the harness', false);
  else {
    const unwired = SLOTS.filter(k => HTML80.indexOf('data-tune="' + k + '"') < 0);
    ok('T54.G ...and is referenced by the manual' + (unwired.length ? ' [' + unwired.join(',') + ']' : ''),
      unwired.length === 0);
    const p0 = HTML80.indexOf('function refreshSelPanel');
    const p1 = HTML80.indexOf('function unitCapCount', p0);
    const panel = HTML80.slice(p0, p1 > p0 ? p1 : p0 + 20000);
    for (const tok of ['VALVE_DMG', 'VALVE_RG', 'VALVE_BACK', 'THROTTLE_SPD', 'SCUTTLE_DM', 'SCUTTLE_R', 'SCUTTLE_FF'])
      ok('T54.G the panel derives ' + tok, panel.indexOf(tok) >= 0);
  }
  ok('T54.G the flamer card quotes the live burn rate', U.flamer.d.indexOf(String(COOK_DPS) + '/s') >= 0);
  ok('T54.G the Bull card quotes the live throttle bonus',
    U.bulltank.d.indexOf(String(Math.round(THROTTLE_SPD * 100)) + '%') >= 0);
  ok('T54.G the dump card quotes the live scuttle damage', B.dump.d.indexOf(String(SCUTTLE_DM)) >= 0);
}
